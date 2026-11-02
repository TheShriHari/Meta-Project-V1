/**
 * web/src/ui/BeginnerScreen.tsx
 * Beginner-friendly landing screen for HPSim.
 * One-click simulation, slow-motion presentation, Hall-Petch line chart, and zero parameter clutter.
 * Scientific integrity: edge dislocation labelled honestly with engine limitation note.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Viewer, LAYERS } from "../render/viewer.ts";
import { buildDemo, bestSystemIndex, LOADING_AXES, type Demo } from "../model/demo.ts";
import { framesToSteps } from "../core/playback.ts";
import { HallPetchChart } from "./HallPetchChart.tsx";

const SLOW_SPEED = 0.2; // 0.2x wall-clock presentation speed (physics dt and velocity equations unmodified)
const BASE_STEPS_PER_SECOND = 60;
const MAX_BEGINNER_HISTORY = 10000;

interface SampleConfig {
  id: string;
  name: string;
  materialKey: "aluminium" | "copper";
  axisKey: string;
  stressMpa: number;
  cells: number;
  description: string;
}

const SUPPORTED_SAMPLES: SampleConfig[] = [
  {
    id: "al_001",
    name: "Pure Aluminium (FCC)",
    materialKey: "aluminium",
    axisKey: "[001]",
    stressMpa: 40,
    cells: 5,
    description: "FCC crystal under [001] uniaxial tension, primary slip system active.",
  },
  {
    id: "cu_001",
    name: "High-Purity Copper (FCC)",
    materialKey: "copper",
    axisKey: "[001]",
    stressMpa: 45,
    cells: 5,
    description: "FCC copper sample oriented for symmetric single-slip glide.",
  },
  {
    id: "al_011",
    name: "Aluminium [011] Crystal",
    materialKey: "aluminium",
    axisKey: "[011]",
    stressMpa: 50,
    cells: 5,
    description: "FCC aluminium oriented along [011] with optimal resolved shear stress.",
  },
];

interface BeginnerScreenProps {
  onGoAdvanced: () => void;
}

export function BeginnerScreen({ onGoAdvanced }: BeginnerScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const rafRef = useRef<number>(0);
  const simRef = useRef<Demo | null>(null);

  const [simState, setSimState] = useState<"idle" | "running" | "completed">("idle");
  const [sampleIndex, setSampleIndex] = useState<number>(0);
  const [runCount, setRunCount] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const activeSample = useMemo(() => {
    return SUPPORTED_SAMPLES[sampleIndex % SUPPORTED_SAMPLES.length];
  }, [sampleIndex]);

  // Mount 3D Viewer once
  useEffect(() => {
    if (!hostRef.current) return;
    const v = new Viewer(hostRef.current);
    viewerRef.current = v;

    // Load initial idle sample geometry so the 3D canvas is immediately attractive
    const axis = LOADING_AXES[SUPPORTED_SAMPLES[0].axisKey];
    const systemIndex = bestSystemIndex(axis);
    const initialDemo = buildDemo({
      cells: SUPPORTED_SAMPLES[0].cells,
      systemIndex,
      axisKey: SUPPORTED_SAMPLES[0].axisKey,
      appliedStress_pa: SUPPORTED_SAMPLES[0].stressMpa * 1e6,
    });
    simRef.current = initialDemo;
    v.loadStructure(initialDemo);

    for (const l of LAYERS) {
      v.setLayer(l, l === "atoms" || l === "slipPlane" || l === "core");
    }
    v.setView("front");
    v.setCorePosition(initialDemo.controller.state.pos_m);

    return () => {
      cancelAnimationFrame(rafRef.current);
      v.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Run simulation whenever runCount increments
  useEffect(() => {
    if (runCount === 0) return;
    const viewer = viewerRef.current;
    if (!viewer) return;

    cancelAnimationFrame(rafRef.current);

    const axis = LOADING_AXES[activeSample.axisKey];
    const systemIndex = bestSystemIndex(axis);

    const demo = buildDemo({
      cells: activeSample.cells,
      systemIndex,
      axisKey: activeSample.axisKey,
      appliedStress_pa: activeSample.stressMpa * 1e6,
    });
    simRef.current = demo;

    viewer.loadStructure(demo);
    for (const l of LAYERS) {
      viewer.setLayer(l, l === "atoms" || l === "slipPlane" || l === "core");
    }
    viewer.setView("front");
    viewer.setCorePosition(demo.controller.state.pos_m);

    setSimState("running");
    setProgressPercent(0);

    let acc = 0;
    let last = performance.now();
    const c = demo.controller;
    const geom = demo.geom;
    const totalDistance = Math.max(geom.tMax - geom.tMin, 1e-12);

    const tick = (now: number) => {
      const frameDt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // Slow motion pacing via framesToSteps speed multiplier
      const r = framesToSteps(acc, frameDt, SLOW_SPEED, BASE_STEPS_PER_SECOND);
      acc = r.accumulator;

      for (let k = 0; k < r.steps; k++) {
        c.step();
        if (c.state.status === "at_domain_limit" || c.history.length >= MAX_BEGINNER_HISTORY) {
          viewer.setCorePosition(c.state.pos_m);
          setProgressPercent(100);
          setSimState("completed");
          return;
        }
      }

      if (r.steps > 0) {
        viewer.setCorePosition(c.state.pos_m);
        const currentProgress = Math.min(
          Math.max(((c.state.pos_m - geom.tMin) / totalDistance) * 100, 0),
          100
        );
        setProgressPercent(Math.round(currentProgress));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [runCount, activeSample]);

  const handleSimulateNow = useCallback(() => {
    // If not first run, select next sample or randomize to demonstrate fresh run capability
    setSampleIndex((prev) => (runCount > 0 ? (prev + 1) % SUPPORTED_SAMPLES.length : prev));
    setSimState("idle");
    setRunCount((prev) => prev + 1);
  }, [runCount]);

  return (
    <div className="beginner-container">
      {/* Top Header */}
      <header className="beginner-header">
        <div className="beginner-header-inner">
          <div className="beginner-brand">
            <h1 className="beginner-title">HPSim — See How Dislocations Move</h1>
            <p className="beginner-tagline">
              Watch how tiny defects move through crystals and how grain size affects material strength.
            </p>
          </div>
          <button
            className="beginner-advanced-btn"
            id="btn-go-advanced"
            onClick={onGoAdvanced}
            aria-label="Open advanced research simulation controls"
          >
            Advanced Simulation &rarr;
          </button>
        </div>
      </header>

      {/* Main Dual-Panel Viewport */}
      <main className="beginner-body">
        {/* Left Column: 3D Dislocation Simulation */}
        <section className="beginner-sim-section" aria-label="3D Dislocation Simulation Viewer">
          <div className="beginner-canvas-wrapper">
            <div ref={hostRef} className="beginner-canvas-host" id="beginner-viewport" />

            {/* In-canvas simulation badge */}
            <div className="beginner-canvas-badge">
              <span className="badge-dot" data-state={simState} />
              <span className="badge-text">
                {simState === "running"
                  ? `Simulating Slow Motion (${progressPercent}%)`
                  : simState === "completed"
                  ? "Arrived at Boundary"
                  : "Ready"}
              </span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="beginner-action-bar">
            <button
              id="btn-simulate-now"
              className="beginner-primary-btn"
              onClick={handleSimulateNow}
              disabled={simState === "running"}
            >
              {simState === "running" ? (
                <>
                  <span className="spinner-icon" /> Simulating...
                </>
              ) : simState === "completed" ? (
                "Simulate Another Sample"
              ) : (
                "Simulate Now"
              )}
            </button>

            {/* Status message */}
            <div className="beginner-status-info">
              <span className="sample-label">
                Sample: <strong>{activeSample.name}</strong>
              </span>
              <span className="sample-desc">{activeSample.description}</span>
            </div>
          </div>

          {/* Scientific Dislocation Description & Honesty Banner */}
          <div className="beginner-dislocation-meta">
            <div className="dislocation-type-pill">
              <span className="type-symbol">&perp;</span>
              <span className="type-title">Edge Dislocation (Plane Strain)</span>
            </div>
            <p className="dislocation-limitation-note">
              <strong>Scientific Notice:</strong> The simulator models the analytical Volterra edge-dislocation
              displacement field and overdamped glide kinetics. Screw dislocation visualization is currently
              unsupported by the underlying plane-strain continuum engine.
            </p>
          </div>
        </section>

        {/* Right Column: Simple Hall-Petch Chart */}
        <aside className="beginner-chart-section" aria-label="Hall-Petch Strengthening Relationship">
          <HallPetchChart materialKey={activeSample.materialKey} />

          {/* Concept explainer for beginners */}
          <div className="beginner-concept-card">
            <h4>What does this show?</h4>
            <p>
              <strong>1. Defects Move:</strong> When stress is applied, dislocations glide through the crystal lattice until stopped by a grain boundary.
            </p>
            <p>
              <strong>2. Hall&ndash;Petch Relation:</strong> In finer-grained metals (higher <em>d<sup>&minus;&frac12;</sup></em>),
              dislocations pile up quickly against boundaries, requiring higher stress to cause permanent plastic yield.
            </p>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="beginner-footer">
        <span className="footer-meta">
          HPSim v1.0 &bull; Dual-Stack Scientific Simulation &bull; 100% Client-Side WebGL
        </span>
        <button
          className="footer-advanced-link"
          onClick={onGoAdvanced}
        >
          Access Full Research Controls (Schmid Glide, Grain Boundary Transmission, 1D Pile-Up, Micrographs) &rarr;
        </button>
      </footer>
    </div>
  );
}
