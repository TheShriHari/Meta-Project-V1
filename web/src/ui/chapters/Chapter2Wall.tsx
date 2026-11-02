/**
 * web/src/ui/chapters/Chapter2Wall.tsx
 * Chapter 2: The Wall — Discover how grain boundaries interact with dislocations.
 * Uses existing evaluateBoundaryTransmission, buildDemo, and Viewer.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Viewer, LAYERS } from "../../render/viewer.ts";
import type { ViewName } from "../../render/camera.ts";
import { SceneLegend } from "../components/SceneLegend.tsx";
import { buildDemo, bestSystemIndex, LOADING_AXES, type Demo } from "../../model/demo.ts";
import { framesToSteps } from "../../core/playback.ts";
import { evaluateBoundaryTransmission, type TransmissionResult } from "../../core/boundary.ts";
import { makeUniaxialStressTensor } from "../../core/stress.ts";
import { getFccSlipSystems } from "../../core/slipsystems.ts";
import { rotationMatrixEulerZXZ } from "../../core/rotations.ts";
import type { ChapterProps } from "../learning/learningTypes.ts";

const SLOW_SPEED = 0.22;
const BASE_STEPS_PER_SECOND = 60;
const MAX_SIM_STEPS = 10000;

export function Chapter2Wall({
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

  const [tiltDeg, setTiltDeg] = useState<number>(15);
  const [phaseStep, setPhaseStep] = useState<"idle" | "running" | "evaluated">("idle");
  const [transmissionResult, setTransmissionResult] = useState<TransmissionResult | null>(null);
  const [isDislocationViewActive, setIsDislocationViewActive] = useState<boolean>(false);

  // Initialize Viewer with boundary layer enabled
  const initScene = useCallback((tilt: number) => {
    const v = viewerRef.current;
    if (!v) return;

    const axis = LOADING_AXES["[001]"];
    const systemIndex = bestSystemIndex(axis);
    const demo = buildDemo({
      cells: 5,
      systemIndex,
      axisKey: "[001]",
      appliedStress_pa: 50e6,
      grain2TiltDeg: tilt,
      mPrimeMin: 0.7,
      useIllustrativeTauStar: true,
      illustrativeTauStarRef_pa: 45e6,
      illustrativeTauTip_pa: 85e6,
    });
    simRef.current = demo;

    v.loadStructure(demo);
    for (const l of LAYERS) {
      v.setLayer(
        l,
        l === "atoms" || l === "ghost" || l === "slipPlane" || l === "core" || l === "boundary" || l === "outgoingCandidates" || l === "burgers"
      );
    }
    v.setView("isometric");
    v.setCorePosition(demo.controller.state.pos_m);
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    const v = new Viewer(hostRef.current);
    viewerRef.current = v;

    initScene(tiltDeg);
    setNarration(
      "A glowing grain boundary cuts through the crystal — the interface where two differently tilted grains meet."
    );

    return () => {
      cancelAnimationFrame(rafRef.current);
      v.dispose();
      viewerRef.current = null;
    };
  }, [initScene, tiltDeg, setNarration]);

  // Evaluate transmission using real boundary module
  const evaluateTransmission = useCallback((tilt: number): TransmissionResult => {
    const stressPa = 50e6;
    const sigma = makeUniaxialStressTensor(stressPa, LOADING_AXES["[001]"]);
    const systemIndex = bestSystemIndex(LOADING_AXES["[001]"]);
    const R1 = rotationMatrixEulerZXZ(0, 0, 0);
    const R2 = rotationMatrixEulerZXZ((tilt * Math.PI) / 180, 0, 0);
    const bM = 2.86338e-10; // Al Burgers magnitude

    return evaluateBoundaryTransmission(
      systemIndex,
      R1,
      R2,
      bM,
      sigma,
      85e6,
      {
        mPrimeMin: 0.70,
        tauCPa: 5e6,
        tauStarRefPa: 45e6, // Illustrative threshold
        beta: 1.0,
      }
    );
  }, []);

  const handleStressIt = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    cancelAnimationFrame(rafRef.current);

    initScene(tiltDeg);
    const demo = simRef.current;
    if (!demo) return;

    const outcome = evaluateTransmission(tiltDeg);
    setTransmissionResult(outcome);
    setPhaseStep("running");
    setNarration(`Gliding toward the boundary at ${tiltDeg}° grain tilt...`);

    let acc = 0;
    let last = performance.now();
    const c = demo.controller;

    const tick = (now: number) => {
      const frameDt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;

      const r = framesToSteps(acc, frameDt, SLOW_SPEED, BASE_STEPS_PER_SECOND);
      acc = r.accumulator;

      for (let k = 0; k < r.steps; k++) {
        c.step();
        if (c.state.status === "at_domain_limit" || c.history.length >= MAX_SIM_STEPS) {
          viewer.setCorePosition(c.state.pos_m);
          setPhaseStep("evaluated");

          if (outcome.outcome === "transmitted") {
            setNarration(
              "Transmitted! The grains are closely aligned, so the dislocation found a compatible path through the boundary."
            );
          } else if (outcome.outcome === "pinned") {
            setNarration(
              "Blocked! The grains meet at too steep an angle. The boundary acts as a wall and traps the dislocation."
            );
          } else {
            setNarration(
              "Unresolved! The geometric alignment was evaluated, but physical barrier threshold is pending calibration."
            );
          }

          onCompleteChapter();
          onLogExperiment({
            chapter: "wall",
            materialKey: material,
            misalignmentDeg: tiltDeg,
            outcome: outcome.outcome === "pinned" ? "BLOCKED" : outcome.outcome.toUpperCase(),
            notes: `Grain tilt ${tiltDeg}°, m' = ${outcome.selectedCandidate?.mPrime.toFixed(3) ?? "N/A"}`,
          });
          return;
        }
      }

      if (r.steps > 0) {
        viewer.setCorePosition(c.state.pos_m);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [initScene, tiltDeg, evaluateTransmission, material, setNarration, onCompleteChapter, onLogExperiment]);

  return (
    <div className="chapter-scene chapter-2-wall">
      <div className="chapter-canvas-host-wrapper">
        <div ref={hostRef} className="chapter-canvas-host" />

        {/* 3D In-Scene Callout */}
        <div className="scene-overlay-badge boundary-annotation">
          <span className="amber-dot-pulse" />
          <span className="boundary-label">Grain Boundary Interface (Plane)</span>
        </div>

        {/* Camera Views & Dislocation View */}
        <div className="views chapter-camera-views" role="group" aria-label="Camera views">
          {(["front", "top", "side", "isometric"] as ViewName[]).map((vn) => (
            <button
              key={vn}
              type="button"
              id={`ch2-view-${vn}`}
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
            id="ch2-view-dislocation"
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
            id="ch2-view-reset"
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
          chapterId="wall"
          hasGrainBoundary={true}
          hasExtraHalfPlane={false}
          hasDisplacedAtoms={true}
          hasGhostLattice={true}
          hasBurgersVector={true}
        />

        {/* Outcome banner on completion */}
        {phaseStep === "evaluated" && transmissionResult && (
          <div
            className={`scene-outcome-banner ${
              transmissionResult.outcome === "transmitted"
                ? "success"
                : transmissionResult.outcome === "pinned"
                ? "blocked"
                : "unresolved"
            }`}
          >
            <span className="outcome-icon">
              {transmissionResult.outcome === "transmitted" ? "✓" : "✕"}
            </span>
            <div className="outcome-details">
              <strong>
                {transmissionResult.outcome === "transmitted"
                  ? "TRANSMITTED"
                  : transmissionResult.outcome === "pinned"
                  ? "BLOCKED"
                  : "UNRESOLVED"}
              </strong>
              <small>
                {transmissionResult.outcome === "transmitted"
                  ? `Passed into next grain (m' = ${transmissionResult.selectedCandidate?.mPrime.toFixed(2)})`
                  : `Dislocation arrested at boundary (Tilt ${tiltDeg}°)`}
              </small>
            </div>
          </div>
        )}
      </div>

      {/* Floating Control Island */}
      <div className="chapter-control-island">
        {phaseStep !== "running" && (
          <div className="island-action-group">
            <div className="island-slider-wrap">
              <label htmlFor="ch2-tilt-slider">
                Grain Misalignment: <strong>{tiltDeg}°</strong>{" "}
                <span className="tilt-hint">
                  {tiltDeg <= 20 ? "(Low angle — easier transmission)" : "(High angle — strong barrier)"}
                </span>
              </label>
              <input
                id="ch2-tilt-slider"
                type="range"
                min={0}
                max={90}
                step={5}
                value={tiltDeg}
                onChange={(e) => {
                  setTiltDeg(Number(e.target.value));
                  setPhaseStep("idle");
                  initScene(Number(e.target.value));
                }}
              />
            </div>

            <button
              className="chapter-primary-btn glow"
              onClick={handleStressIt}
              id="btn-stress-wall"
            >
              Stress it &rarr;
            </button>
          </div>
        )}

        {phaseStep === "running" && (
          <div className="island-running-group">
            <span className="spinner-orbit amber" />
            <span className="island-running-text">
              Testing boundary transmission at {tiltDeg}° tilt...
            </span>
          </div>
        )}

        {phaseStep === "evaluated" && (
          <div className="island-completed-group">
            <button
              className="chapter-primary-btn pulse"
              onClick={() => onNavigateChapter("strength")}
              id="btn-goto-strength"
            >
              More walls, more strength &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
