import { useEffect, useMemo, useRef, useState } from "react";
import { Viewer, LAYERS, type Layer } from "../render/viewer.ts";
import type { ViewName } from "../render/camera.ts";
import { buildDemo, bestSystemIndex, LOADING_AXES, ILLUSTRATIVE } from "../model/demo.ts";
import { framesToSteps } from "../core/playback.ts";
import { getFccSlipSystems } from "../core/slipsystems.ts";
import { schmidFactorUniaxial, makeUniaxialStressTensor } from "../core/stress.ts";
import { paToMpa, mToNm } from "../core/units.ts";
import { evaluateBoundaryTransmission, type TransmissionResult } from "../core/boundary.ts";
import { rotationMatrixEulerZXZ } from "../core/rotations.ts";
import {
  solvePileupEquilibrium,
  computeEfnExactPositions,
  computeEfnAsymptoticCount,
  type PileupInputs,
  type PileupResult,
} from "../core/pileup.ts";
import {
  runHallPetchSweep,
  CALIBRATED_MATERIALS,
  type HallPetchSweepResult,
} from "../core/hallpetch.ts";

const BASE_STEPS_PER_SECOND = 60;
const MAX_HISTORY = 20000;
const LAYER_LABEL: Record<Layer, string> = {
  atoms: "Atoms",
  bonds: "NN bonds",
  cell: "Unit cell",
  axes: "Axes (X red, Y green, Z blue)",
  slipPlane: "Slip plane",
  burgers: "Burgers vector",
  core: "Dislocation line + core",
  boundary: "Grain boundary plane & adjacent grain",
  outgoingCandidates: "Candidate outgoing slip vectors",
};

const MISORIENTATION_PRESETS = [
  { label: "0° (Identical)", deg: 0 },
  { label: "15° (Low-angle)", deg: 15 },
  { label: "45° (High-angle)", deg: 45 },
  { label: "90° (Orthogonal)", deg: 90 },
];

export function App() {
  const [axisKey, setAxisKey] = useState("[001]");
  const [cells, setCells] = useState(5);
  const [systemIndex, setSystemIndex] = useState(() => bestSystemIndex(LOADING_AXES["[001]"]));
  const [stressMpa, setStressMpa] = useState(40);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [version, setVersion] = useState(0);
  const [layerOn, setLayerOn] = useState<Record<Layer, boolean>>(
    () => Object.fromEntries(LAYERS.map((l) => [l, true])) as Record<Layer, boolean>
  );

  // Phase 4: Grain-Boundary Transmission state
  const [grain2TiltDeg, setGrain2TiltDeg] = useState(15);
  const [mPrimeMin, setMPrimeMin] = useState(0.70);
  const [useIllustrativeTauStar, setUseIllustrativeTauStar] = useState(false);
  const [illustrativeTauStarRefMpa, setIllustrativeTauStarRefMpa] = useState(50);
  const [illustrativeTauTipMpa, setIllustrativeTauTipMpa] = useState(80);
  const [beta, setBeta] = useState(1.0);

  // Phase 5: Discrete Dislocation Pile-Up state
  const [pileupN, setPileupN] = useState(8);
  const [pileupStressMpa, setPileupStressMpa] = useState(50);
  const [pileupMaterial, setPileupMaterial] = useState<"Al" | "Cu">("Al");
  const [pileupPerturbed, setPileupPerturbed] = useState(false);

  const pileupInputs: PileupInputs = useMemo(() => {
    const isAl = pileupMaterial === "Al";
    const muPa = isAl ? 26.0e9 : 48.0e9;
    const nu = isAl ? 0.33 : 0.34;
    const burgersM = isAl ? 2.86338e-10 : 2.55619e-10;
    const tauAppliedPa = Math.max(pileupStressMpa, 1) * 1e6;

    if (pileupPerturbed) {
      const efn = computeEfnExactPositions({
        muPa,
        nu,
        burgersM,
        tauAppliedPa,
        count: pileupN,
      });
      const perturbed = [...efn];
      for (let i = 1; i < perturbed.length; i++) {
        perturbed[i] *= 1.05;
      }
      return {
        muPa,
        nu,
        burgersM,
        tauAppliedPa,
        count: pileupN,
        tolerancePa: 1e-4,
        maxIterations: 20,
        initialPositionsM: perturbed,
      };
    }

    return {
      muPa,
      nu,
      burgersM,
      tauAppliedPa,
      count: pileupN,
      tolerancePa: 1e-5,
    };
  }, [pileupMaterial, pileupStressMpa, pileupN, pileupPerturbed]);

  const pileupResult: PileupResult = useMemo(() => {
    return solvePileupEquilibrium(pileupInputs);
  }, [pileupInputs]);

  const asympCount = useMemo(() => {
    const isAl = pileupMaterial === "Al";
    const muPa = isAl ? 26.0e9 : 48.0e9;
    const nu = isAl ? 0.33 : 0.34;
    const burgersM = isAl ? 2.86338e-10 : 2.55619e-10;
    return computeEfnAsymptoticCount(
      pileupResult.pileupLengthM,
      Math.max(pileupStressMpa, 1) * 1e6,
      muPa,
      nu,
      burgersM
    );
  }, [pileupMaterial, pileupStressMpa, pileupResult.pileupLengthM]);

  // Phase 6: Emergent Hall-Petch Derivation state
  const [hpMaterialKey, setHpMaterialKey] = useState<string>("aluminium");
  const [hpPlotMode, setHpPlotMode] = useState<"hallpetch" | "loglog">("hallpetch");
  const [hpCustomTauStarMpa, setHpCustomTauStarMpa] = useState<number | null>(null);

  const hpSpec = CALIBRATED_MATERIALS[hpMaterialKey] ?? CALIBRATED_MATERIALS.aluminium;
  const activeTauStarPa =
    hpCustomTauStarMpa !== null ? hpCustomTauStarMpa * 1e6 : hpSpec.calibratedTauStarRefPa;
  const isHpCustom = hpCustomTauStarMpa !== null;

  const hpSweep: HallPetchSweepResult = useMemo(() => {
    const nPts = 12;
    const logMin = Math.log10(5.0e-6);
    const logMax = Math.log10(200.0e-6);
    const grainSizesM: number[] = [];
    for (let i = 0; i < nPts; i++) {
      grainSizesM.push(Math.pow(10, logMin + (i / (nPts - 1)) * (logMax - logMin)));
    }
    return runHallPetchSweep({
      muPa: hpSpec.muPa,
      nu: hpSpec.nu,
      burgersM: hpSpec.burgersM,
      tauCPa: hpSpec.tauCPa,
      taylorFactor: hpSpec.taylorFactor,
      tauStarRefPa: activeTauStarPa,
      grainSizesM,
      sigma0OffsetPa: hpSpec.calibrationFit.sigma0Pa,
      bootstrapSamples: 200,
      seed: 42,
    });
  }, [hpSpec, activeTauStarPa]);

  const hpHeldOutMeanRelErr = useMemo(() => {
    const held = hpSpec.heldOutFit;
    let sumRel = 0.0;
    for (const pt of hpSweep.points) {
      const litPa = held.sigma0Pa + held.kyPaM05 * pt.invSqrtDM05;
      sumRel += Math.abs(pt.sigmaYPa - litPa) / litPa;
    }
    return sumRel / hpSweep.points.length;
  }, [hpSpec, hpSweep]);

  const demo = useMemo(
    () =>
      buildDemo({
        cells,
        systemIndex,
        axisKey,
        appliedStress_pa: stressMpa * 1e6,
        grain2TiltDeg,
        mPrimeMin,
        useIllustrativeTauStar,
        illustrativeTauStarRef_pa: illustrativeTauStarRefMpa * 1e6,
        illustrativeTauTip_pa: illustrativeTauTipMpa * 1e6,
        beta,
      }),
    // Rebuild demo only when crystal structure or orientation changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, systemIndex, axisKey, grain2TiltDeg]
  );
  const c = demo.controller;
  const bump = () => setVersion((v) => v + 1);

  // Synchronized transmission evaluation with reactive stress/threshold updates
  const transmission: TransmissionResult = useMemo(() => {
    const sigma = makeUniaxialStressTensor(stressMpa * 1e6, LOADING_AXES[axisKey]);
    const R1 = rotationMatrixEulerZXZ(0, 0, 0);
    const R2 = rotationMatrixEulerZXZ((grain2TiltDeg * Math.PI) / 180, 0, 0);
    return evaluateBoundaryTransmission(
      systemIndex,
      R1,
      R2,
      demo.b_m,
      sigma,
      illustrativeTauTipMpa * 1e6,
      {
        mPrimeMin,
        tauCPa: ILLUSTRATIVE.tau_c_pa,
        tauStarRefPa: useIllustrativeTauStar ? illustrativeTauStarRefMpa * 1e6 : null,
        beta,
      }
    );
  }, [
    systemIndex,
    axisKey,
    stressMpa,
    grain2TiltDeg,
    mPrimeMin,
    useIllustrativeTauStar,
    illustrativeTauStarRefMpa,
    illustrativeTauTipMpa,
    beta,
    demo.b_m,
  ]);

  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  useEffect(() => {
    const v = new Viewer(hostRef.current!);
    viewerRef.current = v;
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    v.loadStructure(demo);
    LAYERS.forEach((l) => v.setLayer(l, layerOn[l]));
    setPlaying(false);
    c.setAppliedStress(stressMpa * 1e6);
    bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    c.setAppliedStress(stressMpa * 1e6);
    bump();
  }, [stressMpa, c]);

  useEffect(() => {
    viewerRef.current?.updateTransmission(transmission);
  }, [transmission]);

  useEffect(() => {
    viewerRef.current?.setCorePosition(c.state.pos_m);
  }, [version, c]);

  // Playback loop: wall-clock -> whole fixed steps.
  const playRef = useRef({ playing, speed });
  playRef.current = { playing, speed };
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      acc = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!playRef.current.playing) {
        acc = 0;
        return;
      }
      const r = framesToSteps(acc, dt, playRef.current.speed, BASE_STEPS_PER_SECOND);
      acc = r.accumulator;
      for (let k = 0; k < r.steps; k++) {
        c.step();
        if (c.state.status === "at_domain_limit" || c.history.length >= MAX_HISTORY) {
          setPlaying(false);
          break;
        }
      }
      if (r.steps > 0) bump();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [c]);

  const ro = c.readout();
  const systems = getFccSlipSystems();
  const setView = (v: ViewName) => viewerRef.current?.setView(v);
  const toggle = (l: Layer) => {
    const nv = !layerOn[l];
    setLayerOn({ ...layerOn, [l]: nv });
    viewerRef.current?.setLayer(l, nv);
  };
  const above = Math.abs(ro.tauRss_pa) > ro.tauC_pa;
  const stateText = ro.replaying
    ? "replay"
    : ro.status === "at_domain_limit"
    ? "stopped at simulation-domain limit (grain boundary arrival)"
    : !above
    ? "stationary (|τ_RSS| ≤ τ_c)"
    : playing
    ? "gliding"
    : "paused (would glide)";

  return (
    <div className="app">
      <header className="banner" role="note">
        <h1>HPSim · Dislocation Glide, Transmission & Discrete Pile-Up Engine</h1>
        <p>
          <strong>Phase 4 & Phase 5:</strong> Grain-boundary transmission (geometric compatibility) and
          <strong> 1D Discrete Dislocation Pile-Up Engine</strong> (Eshelby–Frank–Nabarro 1951 benchmark).
          Continuum isotropic elasticity. Material parameter <strong>τ*_ref (Decision M6) remains unresolved</strong>.
          Explanatory model; not molecular dynamics.
        </p>
      </header>
      <main className="layout">
        <section className="viewport" aria-label="3D crystal view">
          <div ref={hostRef} className="canvas-host" id="viewport" />
          <div className="views" role="group" aria-label="Camera views">
            {(["front", "top", "side", "isometric"] as ViewName[]).map((v) => (
              <button key={v} id={`view-${v}`} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
            <button id="view-reset" onClick={() => viewerRef.current?.resetCamera()}>
              reset camera
            </button>
          </div>
        </section>
        <aside className="panel" aria-label="Controls">
          {/* Phase 4 Grain-Boundary Transmission */}
          <div className="card" id="card-transmission">
            <h2>
              Grain-Boundary Transmission <span className="tag phase4">Phase 4</span>
            </h2>

            {/* Outcome banner */}
            <div className={`outcome-box ${transmission.outcome}`} id="transmission-outcome">
              {transmission.outcome === "transmitted" && (
                <>
                  <h3>✔ TRANSMITTED</h3>
                  <p>
                    Transmitted into Grain 2 on system #{transmission.selectedCandidate?.systemIndex} (
                    {transmission.selectedCandidate?.planeMiller.join(" ")})[
                    {transmission.selectedCandidate?.directionMiller.join(" ")}].
                  </p>
                  <p>
                    m' = {transmission.selectedCandidate?.mPrime.toFixed(4)}, |b_r| ={" "}
                    {((transmission.selectedCandidate?.residualBM ?? 0) * 1e10).toFixed(2)} Å, τ_out ={" "}
                    {paToMpa(transmission.selectedCandidate?.tauOutPa ?? 0).toFixed(2)} MPa.
                  </p>
                </>
              )}
              {transmission.outcome === "pinned" && (
                <>
                  <h3>✕ PINNED</h3>
                  <p>Dislocation pinned at boundary. No candidate system met all criteria (m', τ_out, and τ*).</p>
                </>
              )}
              {transmission.outcome === "unresolved_threshold" && (
                <>
                  <h3>⚠ UNRESOLVED THRESHOLD</h3>
                  <p>
                    Geometric compatibility ($m'$) and driving stress ($\tau_{`out`}$) evaluated, but $\tau^*_{`ref`}$
                    is pending calibration under <strong>Decision M6</strong>.
                  </p>
                  <p>Status is explicitly blocked from fabricated pass/fail assertion.</p>
                </>
              )}
            </div>

            {/* Adjacent grain orientation controls */}
            <label>
              Adjacent Grain 2 Columnar Tilt θ: {grain2TiltDeg}°
              <div className="btn-group">
                {MISORIENTATION_PRESETS.map((p) => (
                  <button
                    key={p.deg}
                    className={grain2TiltDeg === p.deg ? "active" : ""}
                    onClick={() => setGrain2TiltDeg(p.deg)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                id="grain2-tilt"
                type="range"
                min={0}
                max={90}
                step={1}
                value={grain2TiltDeg}
                onChange={(e) => setGrain2TiltDeg(Number(e.target.value))}
              />
            </label>

            <label>
              Compatibility threshold m'_min: {mPrimeMin.toFixed(2)}
              <input
                id="mprime-min"
                type="range"
                min={0.4}
                max={0.95}
                step={0.05}
                value={mPrimeMin}
                onChange={(e) => setMPrimeMin(Number(e.target.value))}
              />
            </label>

            {/* Unresolved parameter handling */}
            <label className="check" style={{ marginTop: "10px" }}>
              <input
                id="chk-illustrative-tau"
                type="checkbox"
                checked={useIllustrativeTauStar}
                onChange={(e) => setUseIllustrativeTauStar(e.target.checked)}
              />{" "}
              Supply illustrative τ*_ref <span className="tag illustrative">demo only</span>
            </label>

            {useIllustrativeTauStar ? (
              <div className="callout">
                <span className="tag illustrative">ILLUSTRATIVE VALUES — NOT SOURCED</span>
                <label>
                  Illustrative τ*_ref: {illustrativeTauStarRefMpa} MPa
                  <input
                    id="tau-star-ref"
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={illustrativeTauStarRefMpa}
                    onChange={(e) => setIllustrativeTauStarRefMpa(Number(e.target.value))}
                  />
                </label>
                <label>
                  Illustrative dislocation tip stress τ_tip: {illustrativeTauTipMpa} MPa
                  <input
                    id="tau-tip"
                    type="range"
                    min={20}
                    max={150}
                    step={5}
                    value={illustrativeTauTipMpa}
                    onChange={(e) => setIllustrativeTauTipMpa(Number(e.target.value))}
                  />
                </label>
                <label>
                  Misorientation sensitivity β: {beta.toFixed(1)}
                  <input
                    id="beta"
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={beta}
                    onChange={(e) => setBeta(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : (
              <div className="callout warning">
                <strong>Gate 0 / Decision M6 Pending:</strong> τ*_ref is uncalibrated. The engine outputs an explicit{" "}
                <code>unresolved_threshold</code> outcome rather than guessing an unphysical default.
              </div>
            )}

            {/* Candidate slip systems table */}
            <label>Grain 2 Candidate Slip Systems ({transmission.candidates.length}):</label>
            <div className="table-scroll">
              <table className="cand-table" id="table-candidates">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Plane/Dir</th>
                    <th>m'</th>
                    <th>|b_r|/b</th>
                    <th>τ_out</th>
                    <th>τ*</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {transmission.candidates.map((cand) => {
                    const isSelected = transmission.selectedCandidate?.systemIndex === cand.systemIndex;
                    const rowClass = isSelected
                      ? "selected"
                      : cand.passedMPrime && cand.passedTauOut
                      ? "qualifying"
                      : "rejected";
                    return (
                      <tr key={cand.systemIndex} className={rowClass}>
                        <td>{cand.systemIndex}</td>
                        <td>
                          ({cand.planeMiller.join("")})[{cand.directionMiller.join("")}]
                        </td>
                        <td>{cand.mPrime.toFixed(3)}</td>
                        <td>{(cand.residualBM / demo.b_m).toFixed(2)}</td>
                        <td>{paToMpa(cand.tauOutPa).toFixed(1)}</td>
                        <td>{cand.tauStarPa !== null ? paToMpa(cand.tauStarPa).toFixed(1) : "—"}</td>
                        <td>
                          {cand.passedAll
                            ? isSelected
                              ? "Selected"
                              : "Passed"
                            : cand.rejectionReasons[0] ?? "Rejected"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phase 5 Discrete Dislocation Pile-Up Engine */}
          <div className="card" id="card-pileup">
            <h2>
              Discrete Dislocation Pile-Up <span className="tag phase5">Phase 5</span>
            </h2>

            <div className="callout">
              <strong>1D Continuum Elastic Array:</strong> Straight edge dislocations gliding on a single slip plane
              under uniform applied shear stress, accumulating against an immovable obstacle at x=0 (Eshelby–Frank–Nabarro 1951).
              Explanatory discrete model; not molecular dynamics.
            </div>

            {/* Status Alert */}
            <div
              className={`outcome-box ${pileupResult.status === "converged" ? "transmitted" : "pinned"}`}
              id="pileup-status-box"
            >
              {pileupResult.status === "converged" && (
                <>
                  <h3>✔ EQUILIBRIUM CONVERGED</h3>
                  <p>
                    Exact force equilibrium verified across {pileupN} dislocations ({pileupN - 1} mobile + 1 locked).
                    Residual |R_max| = {pileupResult.maxResidualPa.toExponential(2)} Pa.
                  </p>
                </>
              )}
              {pileupResult.status === "max_iterations_exceeded" && (
                <>
                  <h3>⚠ ITERATION BUDGET EXCEEDED</h3>
                  <p>Damped Newton-Raphson relaxation did not converge within the iteration budget.</p>
                </>
              )}
              {pileupResult.status === "numerical_failure" && (
                <>
                  <h3>✕ NUMERICAL FAILURE</h3>
                  <p>Singular Jacobian encountered during force-balance solve.</p>
                </>
              )}
            </div>

            {/* 1D Pileup SVG Schematic */}
            <div className="pileup-box">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
                <span>Immovable Obstacle (x=0)</span>
                <span>Slip Direction s (Positive x) →</span>
              </div>
              <div className="pileup-svg-wrap">
                <svg viewBox="0 0 320 70" width="100%" height="70" aria-label="1D Pile-Up Diagram">
                  {/* Hatched Obstacle barrier */}
                  <rect x="0" y="5" width="20" height="60" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" />
                  <line x1="20" y1="5" x2="20" y2="65" stroke="#ef4444" strokeWidth="3" />

                  {/* Slip Plane Axis */}
                  <line x1="20" y1="35" x2="310" y2="35" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Driving stress direction label */}
                  <text x="270" y="16" fill="#93c5fd" fontSize="9" textAnchor="middle">← Applied τ</text>

                  {/* Dislocation Glyphs */}
                  {pileupResult.converged &&
                    pileupResult.positionsM.map((pos, idx) => {
                      const maxPos = Math.max(pileupResult.pileupLengthM, 1e-12);
                      const px = 20 + (pos / maxPos) * 280;
                      const isLocked = idx === 0;
                      const color = isLocked ? "#ef4444" : "#38bdf8";

                      return (
                        <g key={idx} transform={`translate(${px.toFixed(1)}, 35)`}>
                          {/* Inverted T symbol (⊥) */}
                          <line x1="-3" y1="0" x2="3" y2="0" stroke={color} strokeWidth="2" />
                          <line x1="0" y1="0" x2="0" y2="-12" stroke={color} strokeWidth="2" />
                          {idx === 0 && (
                            <text x="0" y="16" fill="#f87171" fontSize="8" textAnchor="middle" fontWeight="bold">
                              #1
                            </text>
                          )}
                          {idx === pileupResult.positionsM.length - 1 && (
                            <text x="0" y="16" fill="#38bdf8" fontSize="8" textAnchor="middle">
                              #{idx + 1}
                            </text>
                          )}
                        </g>
                      );
                    })}
                </svg>
              </div>

              {/* Spatial Scale cue */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                <span>0 nm</span>
                <span>Pile-up Length L = {(pileupResult.pileupLengthM * 1e9).toFixed(2)} nm</span>
              </div>
            </div>

            {/* Readout metrics */}
            <dl style={{ margin: "8px 0" }}>
              <dt>Obstacle Tip Stress τ_tip</dt>
              <dd id="ro-pileup-tip" style={{ color: "#fca5a5" }}>
                {paToMpa(pileupResult.tipStressPa).toFixed(1)} MPa (×{pileupN} stress conc.)
              </dd>
              <dt>Discrete Pile-Up Length L</dt>
              <dd id="ro-pileup-length">{(pileupResult.pileupLengthM * 1e9).toFixed(2)} nm</dd>
              <dt>EFN Asymptotic Count N_asymp</dt>
              <dd id="ro-pileup-asymp">
                {asympCount.toFixed(2)} (ratio: {(asympCount / pileupN).toFixed(3)})
              </dd>
              <dt>Max Residual Force/Stress</dt>
              <dd id="ro-pileup-res">{pileupResult.maxResidualPa.toExponential(2)} Pa</dd>
              <dt>Solver Iterations</dt>
              <dd id="ro-pileup-iters">{pileupResult.iterations}</dd>
            </dl>

            {/* Controls */}
            <label>
              Dislocation Count N: {pileupN} (1 locked + {pileupN - 1} mobile)
              <input
                id="pileup-count"
                type="range"
                min={2}
                max={25}
                step={1}
                value={pileupN}
                onChange={(e) => setPileupN(Number(e.target.value))}
              />
            </label>

            <label>
              Applied Shear Stress τ_app: {pileupStressMpa} MPa
              <input
                id="pileup-stress"
                type="range"
                min={10}
                max={150}
                step={5}
                value={pileupStressMpa}
                onChange={(e) => setPileupStressMpa(Number(e.target.value))}
              />
            </label>

            <label>
              Material Preset <span className="tag illustrative">illustrative</span>
              <div className="btn-group">
                <button
                  className={pileupMaterial === "Al" ? "active" : ""}
                  onClick={() => setPileupMaterial("Al")}
                >
                  Aluminium (μ=26 GPa, ν=0.33)
                </button>
                <button
                  className={pileupMaterial === "Cu" ? "active" : ""}
                  onClick={() => setPileupMaterial("Cu")}
                >
                  Copper (μ=48 GPa, ν=0.34)
                </button>
              </div>
            </label>

            <label className="check" style={{ marginTop: "8px" }}>
              <input
                id="chk-pileup-perturbed"
                type="checkbox"
                checked={pileupPerturbed}
                onChange={(e) => setPileupPerturbed(e.target.checked)}
              />{" "}
              Test Newton relaxation from perturbed guess (+5% initial error)
            </label>

            {/* Equilibrium Positions Table */}
            <div className="pileup-dislocations-list">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pos (nm)</th>
                    <th>Spacing d (nm)</th>
                    <th>Residual (Pa)</th>
                  </tr>
                </thead>
                <tbody>
                  {pileupResult.positionsM.map((pos, idx) => {
                    const spacing = idx > 0 ? (pos - pileupResult.positionsM[idx - 1]) * 1e9 : 0.0;
                    const res = idx > 0 ? pileupResult.residualsPa[idx - 1] : 0.0;
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{(pos * 1e9).toFixed(3)}</td>
                        <td>{idx > 0 ? spacing.toFixed(3) : "— (locked)"}</td>
                        <td>{idx > 0 ? res.toExponential(2) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phase 6 Emergent Hall-Petch Derivation */}
          <div className="card" id="card-hallpetch">
            <h2>
              Emergent Hall–Petch <span className="tag phase6">Phase 6</span>
            </h2>

            <div className="callout">
              <strong>Discrete Pile-Up Yield Derivation:</strong> For each grain size <em>d</em> (source at{" "}
              <em>L = d/2</em>), bisection finds the critical shear stress <em>τ_eff,crit</em> where pile-up tip stress{" "}
              <em>τ_tip = N·τ_eff ≥ τ*(m&apos;)</em>. The <em>d</em><sup>−1/2</sup> strengthening law emerges from the
              discrete force-balance equilibria.
            </div>

            {/* V-09 & V-10 Benchmark Status Box */}
            <div
              className={`outcome-box ${hpSweep.v09Passed && hpSweep.v10Passed ? "transmitted" : "unresolved_threshold"}`}
              id="hp-status-box"
            >
              <h3>
                {hpSweep.v09Passed && hpSweep.v10Passed
                  ? "✔ V-09 & V-10 BENCHMARKS VERIFIED"
                  : "⚠ PARAMETER SENSITIVITY REGIME"}
              </h3>
              <p>
                Log–log slope <em>d(log τ_eff,crit)/d(log d)</em> ={" "}
                <strong>{hpSweep.logLogSlope.toFixed(4)}</strong> (V-09 target: −0.50 ± 0.05). Simulated{" "}
                <em>k_y</em> = <strong>{(hpSweep.fittedKyPaM05 / 1e3).toFixed(1)}</strong> vs analytic EFN{" "}
                <strong>{(hpSweep.analyticKyPaM05 / 1e3).toFixed(1)} MPa·μm<sup>1/2</sup></strong> (diff:{" "}
                {(hpSweep.kyRelErrorVsAnalytic * 100).toFixed(1)}%, V-10 ≤ 15%).
              </p>
            </div>

            {/* Material & Plot Mode Controls */}
            <label>
              Material System{" "}
              <span className={`tag ${hpSpec.tauCStatus === "sourced" ? "sourced" : "unresolved"}`}>
                {hpSpec.tauCStatus}
              </span>
              <select
                id="hp-material"
                value={hpMaterialKey}
                onChange={(e) => {
                  setHpMaterialKey(e.target.value);
                  setHpCustomTauStarMpa(null);
                }}
              >
                {Object.values(CALIBRATED_MATERIALS).map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name} ({m.structure})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Chart Mode
              <div className="btn-group">
                <button
                  id="btn-hp-mode-linear"
                  className={hpPlotMode === "hallpetch" ? "active" : ""}
                  onClick={() => setHpPlotMode("hallpetch")}
                >
                  σ_y vs d^(−1/2) (Hall–Petch)
                </button>
                <button
                  id="btn-hp-mode-loglog"
                  className={hpPlotMode === "loglog" ? "active" : ""}
                  onClick={() => setHpPlotMode("loglog")}
                >
                  log₁₀(τ_eff,crit) vs log₁₀(d) (V-09)
                </button>
              </div>
            </label>

            {/* Interactive SVG Hall-Petch / Log-Log Chart */}
            <div className="pileup-box">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "4px",
                }}
              >
                <span>
                  {hpPlotMode === "hallpetch"
                    ? "Yield Stress σ_y (MPa) vs d^(−1/2) (μm^(−1/2))"
                    : "log₁₀(τ_eff,crit [MPa]) vs log₁₀(d [μm])"}
                </span>
                <span className={`tag ${isHpCustom ? "illustrative" : "calibrated"}`}>
                  {isHpCustom ? "illustrative τ*_ref" : "calibrated τ*_ref"}
                </span>
              </div>

              <div className="pileup-svg-wrap">
                {(() => {
                  const W = 320;
                  const H = 175;
                  const padL = 38;
                  const padR = 14;
                  const padT = 14;
                  const padB = 28;
                  const plotW = W - padL - padR;
                  const plotH = H - padT - padB;

                  if (hpPlotMode === "hallpetch") {
                    const xVals = hpSweep.points.map((p) => p.invSqrtDM05 * 1e-3); // um^(-0.5)
                    const xMin = 0.0;
                    const xMax = Math.max(...xVals) * 1.08;

                    const cal = hpSpec.calibrationFit;
                    const held = hpSpec.heldOutFit;
                    const ySim = hpSweep.points.map((p) => p.sigmaYPa / 1e6);
                    const yAna = hpSweep.points.map((p) => p.sigmaYAnalyticPa / 1e6);
                    const yHeldMax = (held.sigma0Pa + held.kyPaM05 * (xMax * 1e3)) / 1e6;
                    const yMin = 0.0;
                    const yMax = Math.max(...ySim, ...yAna, yHeldMax) * 1.1;

                    const toX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
                    const toY = (y: number) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

                    const x0 = xMin;
                    const x1 = xMax;
                    const fitY0 = (hpSweep.fittedSigma0Pa + hpSweep.fittedKyPaM05 * (x0 * 1e3)) / 1e6;
                    const fitY1 = (hpSweep.fittedSigma0Pa + hpSweep.fittedKyPaM05 * (x1 * 1e3)) / 1e6;

                    const anaY0 = (hpSweep.analyticSigma0Pa + hpSweep.analyticKyPaM05 * (x0 * 1e3)) / 1e6;
                    const anaY1 = (hpSweep.analyticSigma0Pa + hpSweep.analyticKyPaM05 * (x1 * 1e3)) / 1e6;

                    const calY0 = (cal.sigma0Pa + cal.kyPaM05 * (x0 * 1e3)) / 1e6;
                    const calY1 = (cal.sigma0Pa + cal.kyPaM05 * (x1 * 1e3)) / 1e6;

                    const heldY0 = (held.sigma0Pa + held.kyPaM05 * (x0 * 1e3)) / 1e6;
                    const heldY1 = (held.sigma0Pa + held.kyPaM05 * (x1 * 1e3)) / 1e6;

                    return (
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        height={H}
                        aria-label="Emergent Hall-Petch Chart"
                      >
                        {/* Axes */}
                        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth="1" />
                        <line
                          x1={padL}
                          y1={padT + plotH}
                          x2={padL + plotW}
                          y2={padT + plotH}
                          stroke="#475569"
                          strokeWidth="1"
                        />

                        {/* Y-axis ticks */}
                        {[0, 0.5, 1].map((f, idx) => {
                          const yVal = yMin + f * (yMax - yMin);
                          const py = toY(yVal);
                          return (
                            <g key={idx}>
                              <line x1={padL - 3} y1={py} x2={padL} y2={py} stroke="#64748b" />
                              <text x={padL - 5} y={py + 3} fill="#94a3b8" fontSize="8" textAnchor="end">
                                {yVal.toFixed(0)}
                              </text>
                            </g>
                          );
                        })}

                        {/* X-axis ticks */}
                        {[0, 0.5, 1].map((f, idx) => {
                          const xVal = xMin + f * (xMax - xMin);
                          const px = toX(xVal);
                          return (
                            <g key={idx}>
                              <line x1={px} y1={padT + plotH} x2={px} y2={padT + plotH + 3} stroke="#64748b" />
                              <text
                                x={px}
                                y={padT + plotH + 12}
                                fill="#94a3b8"
                                fontSize="8"
                                textAnchor="middle"
                              >
                                {xVal.toFixed(2)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Axis labels */}
                        <text
                          x={padL + plotW / 2}
                          y={H - 4}
                          fill="#cbd5e1"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          d^(−1/2) [μm^(−1/2)]
                        </text>

                        {/* Held-out literature line (amber dashed) */}
                        <line
                          x1={toX(x0)}
                          y1={toY(heldY0)}
                          x2={toX(x1)}
                          y2={toY(heldY1)}
                          stroke="#f59e0b"
                          strokeWidth="1.3"
                          strokeDasharray="2 2"
                        />

                        {/* Calibration literature line (green dashed) */}
                        <line
                          x1={toX(x0)}
                          y1={toY(calY0)}
                          x2={toX(x1)}
                          y2={toY(calY1)}
                          stroke="#10b981"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                        />

                        {/* Analytic EFN continuum line (purple dotted) */}
                        <line
                          x1={toX(x0)}
                          y1={toY(anaY0)}
                          x2={toX(x1)}
                          y2={toY(anaY1)}
                          stroke="#a855f7"
                          strokeWidth="1.5"
                          strokeDasharray="1.5 2.5"
                        />

                        {/* Simulated OLS regression line (cyan solid) */}
                        <line
                          x1={toX(x0)}
                          y1={toY(fitY0)}
                          x2={toX(x1)}
                          y2={toY(fitY1)}
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />

                        {/* Discrete pile-up simulation points */}
                        {hpSweep.points.map((pt, i) => {
                          const cx = toX(pt.invSqrtDM05 * 1e-3);
                          const cy = toY(pt.sigmaYPa / 1e6);
                          return (
                            <circle
                              key={i}
                              cx={cx}
                              cy={cy}
                              r="2.8"
                              fill="#0284c7"
                              stroke="#e0f2fe"
                              strokeWidth="1"
                            />
                          );
                        })}
                      </svg>
                    );
                  } else {
                    const xVals = hpSweep.points.map((p) => Math.log10(p.grainSizeM * 1e6));
                    const yVals = hpSweep.points.map((p) => Math.log10(p.tauEffCritPa / 1e6));
                    const xMin = Math.min(...xVals) - 0.08;
                    const xMax = Math.max(...xVals) + 0.08;
                    const yMin = Math.min(...yVals) - 0.1;
                    const yMax = Math.max(...yVals) + 0.1;

                    const toX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
                    const toY = (y: number) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

                    const logInterceptMpa =
                      hpSweep.logLogIntercept - 6.0 - 6.0 * hpSweep.logLogSlope;
                    const y0 = logInterceptMpa + hpSweep.logLogSlope * xMin;
                    const y1 = logInterceptMpa + hpSweep.logLogSlope * xMax;

                    return (
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        height={H}
                        aria-label="Log-Log Emergent Exponent Chart"
                      >
                        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth="1" />
                        <line
                          x1={padL}
                          y1={padT + plotH}
                          x2={padL + plotW}
                          y2={padT + plotH}
                          stroke="#475569"
                          strokeWidth="1"
                        />
                        <line
                          x1={toX(xMin)}
                          y1={toY(y0)}
                          x2={toX(xMax)}
                          y2={toY(y1)}
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />
                        {hpSweep.points.map((pt, i) => (
                          <circle
                            key={i}
                            cx={toX(Math.log10(pt.grainSizeM * 1e6))}
                            cy={toY(Math.log10(pt.tauEffCritPa / 1e6))}
                            r="2.8"
                            fill="#38bdf8"
                            stroke="#e0f2fe"
                            strokeWidth="1"
                          />
                        ))}
                        <text
                          x={padL + plotW / 2}
                          y={H - 4}
                          fill="#cbd5e1"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          log₁₀(d [μm]) — Fitted Slope = {hpSweep.logLogSlope.toFixed(4)}
                        </text>
                      </svg>
                    );
                  }
                })()}
              </div>

              {/* Legend with symbols + color (NFR-08 accessible) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "10.5px", color: "#cbd5e1" }}>
                <span>● Discrete Pile-Up + OLS Fit (cyan)</span>
                <span>⋯ Analytic EFN Continuum (purple)</span>
                <span>-- Calib. Fit: {hpSpec.calibrationFit.sourceId} (green)</span>
                <span>-- Held-Out: {hpSpec.heldOutFit.sourceId} (amber)</span>
              </div>
            </div>

            {/* Key Hall-Petch Readouts */}
            <dl style={{ margin: "8px 0" }}>
              <dt>Barrier Threshold τ*_ref</dt>
              <dd id="ro-hp-taustar">{(activeTauStarPa / 1e6).toFixed(2)} MPa</dd>
              <dt>Simulated Slope k_y (95% CI)</dt>
              <dd id="ro-hp-ky">
                {(hpSweep.fittedKyPaM05 / 1e3).toFixed(1)} [
                {(hpSweep.kyCi95LowPaM05 / 1e3).toFixed(1)}, {(hpSweep.kyCi95HighPaM05 / 1e3).toFixed(1)}] MPa·μm
                <sup>1/2</sup>
              </dd>
              <dt>Analytic Continuum k_y (EFN)</dt>
              <dd id="ro-hp-ky-ana">
                {(hpSweep.analyticKyPaM05 / 1e3).toFixed(1)} MPa·μm<sup>1/2</sup>
              </dd>
              <dt>Calibration Fit k_y ({hpSpec.calibrationFit.sourceId})</dt>
              <dd id="ro-hp-ky-cal">
                {(hpSpec.calibrationFit.kyPaM05 / 1e3).toFixed(1)} MPa·μm<sup>1/2</sup>
              </dd>
              <dt>Held-Out Mean Error ({hpSpec.heldOutFit.sourceId}, V-15)</dt>
              <dd id="ro-hp-v15">{(hpHeldOutMeanRelErr * 100).toFixed(1)}%</dd>
              <dt>Log–Log Exponent (V-09) / R²</dt>
              <dd id="ro-hp-slope">
                {hpSweep.logLogSlope.toFixed(4)} / R²={hpSweep.rSquared.toFixed(4)}
              </dd>
            </dl>

            {/* Optional interactive tau*_ref sensitivity slider */}
            <label>
              Sensitivity Override τ*_ref: {(activeTauStarPa / 1e6).toFixed(1)} MPa{" "}
              {isHpCustom && (
                <button
                  style={{ padding: "2px 6px", fontSize: "10px", marginLeft: "6px" }}
                  onClick={() => setHpCustomTauStarMpa(null)}
                >
                  Reset to Calibrated
                </button>
              )}
              <input
                id="hp-taustar-slider"
                type="range"
                min={Math.max(10, Math.round((hpSpec.calibratedTauStarRefPa / 1e6) * 0.4))}
                max={Math.round((hpSpec.calibratedTauStarRefPa / 1e6) * 1.8)}
                step={1}
                value={Math.round(activeTauStarPa / 1e6)}
                onChange={(e) => setHpCustomTauStarMpa(Number(e.target.value))}
              />
            </label>
          </div>

          {/* Existing Playback Card */}
          <div className="card">
            <h2>Playback</h2>
            <div className="row">
              <button
                id="btn-play"
                className="primary"
                onClick={() => {
                  if (!c.atHead) {
                    c.seek(c.history.length - 1);
                  }
                  setPlaying(!playing);
                  bump();
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                id="btn-step"
                onClick={() => {
                  setPlaying(false);
                  c.step();
                  bump();
                }}
              >
                Step
              </button>
              <button
                id="btn-reset"
                onClick={() => {
                  setPlaying(false);
                  c.reset();
                  setStressMpa(40);
                  bump();
                }}
              >
                Reset
              </button>
            </div>
            <label>
              Timeline (step {ro.step} of {c.history.length - 1})
              <input
                id="timeline"
                type="range"
                min={0}
                max={Math.max(c.history.length - 1, 1)}
                value={c.index}
                onChange={(e) => {
                  setPlaying(false);
                  c.seek(Number(e.target.value));
                  bump();
                }}
              />
            </label>
            <label>
              Playback speed ×{speed} <small>(presentation only)</small>
              <input
                id="speed"
                type="range"
                min={0.25}
                max={8}
                step={0.25}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
            <label>
              Applied uniaxial stress σ: {stressMpa} MPa
              <input
                id="stress"
                type="range"
                min={-100}
                max={100}
                step={1}
                value={stressMpa}
                onChange={(e) => setStressMpa(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="card" id="readout" aria-live="polite">
            <h2>
              Readout <span className="tag">illustrative</span>
            </h2>
            <dl>
              <dt>Resolved shear stress τ_RSS</dt>
              <dd id="ro-tau">{paToMpa(ro.tauRss_pa).toFixed(3)} MPa</dd>
              <dt>Critical stress τ_c</dt>
              <dd id="ro-tauc">{paToMpa(ro.tauC_pa).toFixed(3)} MPa</dd>
              <dt>Glide velocity v</dt>
              <dd id="ro-v">{ro.velocity_mps.toExponential(3)} m/s</dd>
              <dt>Core position (along s)</dt>
              <dd id="ro-pos">{mToNm(ro.pos_m).toFixed(4)} nm</dd>
              <dt>Time</dt>
              <dd id="ro-t">{(ro.t_s * 1e12).toFixed(2)} ps</dd>
              <dt>State</dt>
              <dd id="ro-state">{stateText}</dd>
              <dt>Schmid factor m</dt>
              <dd>{demo.schmid.toFixed(4)}</dd>
            </dl>
          </div>

          <div className="card">
            <h2>Crystal & loading</h2>
            <label>
              Loading axis (crystal frame)
              <select
                id="axis"
                value={axisKey}
                onChange={(e) => {
                  setAxisKey(e.target.value);
                  setSystemIndex(bestSystemIndex(LOADING_AXES[e.target.value]));
                }}
              >
                {Object.keys(LOADING_AXES).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Incoming slip system {"{111}<110>"}
              <select
                id="system"
                value={systemIndex}
                onChange={(e) => setSystemIndex(Number(e.target.value))}
              >
                {systems.map((s, i) => (
                  <option key={i} value={i}>
                    {`(${s.planeMiller.join(" ")})[${s.directionMiller.join(
                      " "
                    )}]  m=${schmidFactorUniaxial(s.s, s.n, LOADING_AXES[axisKey]).toFixed(3)}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cells per side: {cells} ({4 * cells ** 3} atoms)
              <input
                id="cells"
                type="range"
                min={3}
                max={8}
                value={cells}
                onChange={(e) => setCells(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="card">
            <h2>Layers</h2>
            <div className="toggles">
              {LAYERS.map((l) => (
                <label key={l} className="check">
                  <input
                    id={`layer-${l}`}
                    type="checkbox"
                    checked={layerOn[l]}
                    onChange={() => toggle(l)}
                  />{" "}
                  {LAYER_LABEL[l]}
                </label>
              ))}
            </div>
          </div>

          <div className="card note">
            <h2>Parameter provenance</h2>
            <p>
              a = {(ILLUSTRATIVE.a_m * 1e9).toFixed(4)} nm (Al-like, <em>illustrative</em>), b = a/√2 ={" "}
              {(demo.b_m * 1e9).toFixed(4)} nm (computed), ν = {ILLUSTRATIVE.nu}, τ_c ={" "}
              {ILLUSTRATIVE.tau_c_pa / 1e6} MPa, M_d = {ILLUSTRATIVE.M_d.toExponential(0)} 1/(Pa·s), Δt ={" "}
              {ILLUSTRATIVE.dt_s * 1e12} ps, r_c = b.
            </p>
            <p style={{ marginTop: "6px" }}>
              <strong>Phase 4 Grain Boundary:</strong> Controlled columnar interface between Grain 1 and Grain 2.
              Decision M6 remains open; τ*_ref is not calibrated.
            </p>
            <p style={{ marginTop: "6px" }}>
              <strong>Phase 5 Pile-Up Benchmark:</strong> Discrete edge-dislocation equilibrium benchmarked against
              Eshelby–Frank–Nabarro (1951) associated Laguerre polynomial roots. Tip stress concentration τ_tip = N·τ_app.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

