/**
 * web/src/ui/chapters/Chapter1Defect.tsx
 * Chapter 1: The Defect — Discover what a dislocation is and watch it move.
 * Uses existing buildDemo, SimulationController, and Viewer without modifying physics core.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Viewer, LAYERS } from "../../render/viewer.ts";
import type { ViewName } from "../../render/camera.ts";
import { SceneLegend } from "../components/SceneLegend.tsx";
import { buildDemo, bestSystemIndex, LOADING_AXES, type Demo } from "../../model/demo.ts";
import { framesToSteps } from "../../core/playback.ts";
import type { ChapterProps } from "../learning/learningTypes.ts";

const SLOW_SPEED = 0.55;
const BASE_STEPS_PER_SECOND = 60;
const MAX_SIM_STEPS = 10000;

export function Chapter1Defect({
  onCompleteChapter,
  onNavigateChapter,
  onLogExperiment,
  setNarration,
  material,
}: ChapterProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const rafRef = useRef<number>(0);
  const simRef = useRef<Demo | null>(null);

  const [stressMpa, setStressMpa] = useState<number>(40);
  const [phaseStep, setPhaseStep] = useState<"inspect" | "running" | "completed">("inspect");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isDislocationViewActive, setIsDislocationViewActive] = useState<boolean>(false);

  // Initialize Viewer
  useEffect(() => {
    if (!hostRef.current) return;
    const v = new Viewer(hostRef.current);
    viewerRef.current = v;

    const axis = LOADING_AXES["[001]"];
    const systemIndex = bestSystemIndex(axis);
    const demo = buildDemo({
      cells: 5,
      systemIndex,
      axisKey: "[001]",
      appliedStress_pa: 40e6,
    });
    simRef.current = demo;
    v.loadStructure(demo);

    for (const l of LAYERS) {
      v.setLayer(l, l === "atoms" || l === "ghost" || l === "extraHalfPlane" || l === "slipPlane" || l === "core" || l === "burgers");
    }
    v.setView("front");
    v.setCorePosition(demo.controller.state.pos_m);

    (window as any).__hpsim_glide_debug = {
      getPosM: () => demo.controller.state.pos_m,
      getCoreCoords: () => {
        const core = {
          x: (demo.geom.p0[0] + demo.controller.state.pos_m * demo.geom.s[0]) * 1e9,
          y: (demo.geom.p0[1] + demo.controller.state.pos_m * demo.geom.s[1]) * 1e9,
          z: (demo.geom.p0[2] + demo.controller.state.pos_m * demo.geom.s[2]) * 1e9,
        };
        return core;
      },
      getCameraPose: () => v.saveCameraState(),
      getProgress: () => 0,
      getStatus: () => demo.controller.state.status,
    };

    setNarration("An extra half-plane of atoms ends inside the crystal. Its terminating edge is the dislocation line.");

    return () => {
      cancelAnimationFrame(rafRef.current);
      v.dispose();
      viewerRef.current = null;
    };
  }, [setNarration]);

  // Start glide
  const handleApplyStress = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    cancelAnimationFrame(rafRef.current);

    const axis = LOADING_AXES["[001]"];
    const systemIndex = bestSystemIndex(axis);
    const demo = buildDemo({
      cells: 5,
      systemIndex,
      axisKey: "[001]",
      appliedStress_pa: stressMpa * 1e6,
    });
    simRef.current = demo;

    viewer.loadStructure(demo);
    for (const l of LAYERS) {
      viewer.setLayer(l, l === "atoms" || l === "ghost" || l === "extraHalfPlane" || l === "slipPlane" || l === "core" || l === "burgers");
    }
    // View preserved across simulation runs
    viewer.setCorePosition(demo.controller.state.pos_m);

    // Expose real-time telemetry on window for QA and logging
    (window as any).__hpsim_glide_debug = {
      getPosM: () => c.state.pos_m,
      getCoreCoords: () => {
        const core = {
          x: (geom.p0[0] + c.state.pos_m * geom.s[0]) * 1e9,
          y: (geom.p0[1] + c.state.pos_m * geom.s[1]) * 1e9,
          z: (geom.p0[2] + c.state.pos_m * geom.s[2]) * 1e9,
        };
        return core;
      },
      getCameraPose: () => viewer.saveCameraState(),
      getProgress: () =>
        Math.min(
          Math.max(((c.state.pos_m - geom.tMin) / totalDistance) * 100, 0),
          100
        ),
      getStatus: () => c.state.status,
    };

    setPhaseStep("running");
    setProgressPercent(0);
    setNarration(`Stress applied (${stressMpa} MPa). The dislocation is gliding along its slip plane.`);

    let acc = 0;
    let last = performance.now();
    const c = demo.controller;
    const geom = demo.geom;
    const totalDistance = Math.max(geom.tMax - geom.tMin, 1e-12);

    const tick = (now: number) => {
      const frameDt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;

      // Pacing speed scales with stress: higher stress glides faster
      const speedMultiplier = SLOW_SPEED * (stressMpa / 40);
      const r = framesToSteps(acc, frameDt, speedMultiplier, BASE_STEPS_PER_SECOND);
      acc = r.accumulator;

      for (let k = 0; k < r.steps; k++) {
        c.step();
        if (c.state.status === "at_domain_limit" || c.history.length >= MAX_SIM_STEPS) {
          viewer.setCorePosition(c.state.pos_m);
          setProgressPercent(100);
          setPhaseStep("completed");
          setNarration(
            "The defect left the simulated region. The crystal's atoms have permanently shifted."
          );
          onCompleteChapter();
          onLogExperiment({
            chapter: "defect",
            materialKey: material,
            appliedStressMpa: stressMpa,
            outcome: "Dislocation exited crystal region (permanent deformation)",
            notes: "Single crystal edge dislocation glide",
          });
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
  }, [stressMpa, material, setNarration, onCompleteChapter, onLogExperiment]);

  return (
    <div className="chapter-scene chapter-1-defect">
      <div className="chapter-canvas-host-wrapper">
        <div ref={hostRef} className="chapter-canvas-host" />

        {/* 3D In-Scene Callouts */}
        <div className="scene-overlay-badge core-annotation">
          <span className="core-dot-pulse" />
          <span className="core-label">
            {phaseStep === "running"
              ? `← Dislocation gliding (${progressPercent}%)`
              : "Defect line (Dislocation core)"}
          </span>
        </div>

        {/* Scientific honesty chip */}
        <div className="scene-disclaimer-chip">
          <span>Edge Dislocation (⊥) • Single FCC Slip Plane</span>
        </div>

        {/* Camera Views & Dislocation View */}
        <div className="chapter-camera-views chapter-views-bar" role="group" aria-label="Camera views">
          {(["front", "top", "side", "isometric"] as ViewName[]).map((vn) => (
            <button
              key={vn}
              type="button"
              id={`ch1-view-${vn}`}
              title={`Switch camera to ${vn} view`}
              onClick={() => {
                setIsDislocationViewActive(false);
                viewerRef.current?.setView(vn);
              }}
            >
              {vn}
            </button>
          ))}
          <button
            type="button"
            id="ch1-view-dislocation"
            title="Dedicated textbook edge-dislocation perspective"
            onClick={() => {
              const active = viewerRef.current?.toggleDislocationView();
              setIsDislocationViewActive(Boolean(active));
            }}
            style={{
              borderColor: isDislocationViewActive ? "#10b981" : undefined,
              color: isDislocationViewActive ? "#6ee7b7" : undefined,
              fontWeight: isDislocationViewActive ? 700 : undefined,
            }}
          >
            {isDislocationViewActive ? "Return to Free View" : "Dislocation View"}
          </button>
          <button
            type="button"
            id="ch1-view-reset"
            title="Reset camera to default view"
            onClick={() => {
              setIsDislocationViewActive(false);
              viewerRef.current?.resetCamera();
            }}
          >
            Reset
          </button>
        </div>

        {/* Context-Aware Scene Legend */}
        <SceneLegend
          chapterId="defect"
          hasGrainBoundary={false}
          hasExtraHalfPlane={true}
          hasDisplacedAtoms={true}
          hasGhostLattice={true}
          hasBurgersVector={true}
        />
      </div>

      {/* Floating Control Strip */}
      <div className="chapter-control-island">
        {phaseStep === "inspect" && (
          <div className="island-action-group">
            <button
              className="chapter-primary-btn glow"
              onClick={handleApplyStress}
              id="btn-apply-stress"
              title="Stress it / Apply stress"
            >
              Apply stress &rarr;
            </button>
            <div className="island-slider-wrap">
              <label htmlFor="ch1-stress-slider">
                Stress: <strong>{stressMpa} MPa</strong>
              </label>
              <input
                id="ch1-stress-slider"
                type="range"
                min={20}
                max={70}
                step={5}
                value={stressMpa}
                onChange={(e) => setStressMpa(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {phaseStep === "running" && (
          <div className="island-running-group">
            <span className="spinner-orbit" />
            <span className="island-running-text">
              Gliding under {stressMpa} MPa shear stress...
            </span>
          </div>
        )}

        {phaseStep === "completed" && (
          <div className="island-completed-group">
            <button
              className="chapter-secondary-btn"
              onClick={handleApplyStress}
              id="btn-repeat-glide"
            >
              Glide Again ↺
            </button>
            <button
              className="chapter-primary-btn pulse"
              onClick={() => onNavigateChapter("wall")}
              id="btn-goto-wall"
              title="Next: Grain Boundaries"
            >
              What stops it? (Grain Boundaries) &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
