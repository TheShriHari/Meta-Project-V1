/**
 * web/src/core/boundary.ts - Grain-boundary dislocation transmission decision core in pure TypeScript.
 * Matches Python reference hpsim.core.boundary exactly.
 * Pure math: zero UI, DOM, or rendering dependencies.
 */

import type { Vec3, Mat3 } from "./vectors.ts";
import { vectorDot, vectorNorm } from "./vectors.ts";
import { transformVectorCrystalToSpecimen } from "./rotations.ts";
import { calculateResolvedShearStress } from "./stress.ts";
import { getFccSlipSystems, type SlipSystem } from "./slipsystems.ts";

export interface TransmissionThresholds {
  mPrimeMin: number;
  tauCPa: number;
  tauStarRefPa: number | null;
  beta: number;
}

export interface CandidateEvaluation {
  systemIndex: number;
  planeMiller: [number, number, number];
  directionMiller: [number, number, number];
  sSpecimen: Vec3;
  nSpecimen: Vec3;
  mPrime: number;
  residualBM: number;
  tauOutPa: number;
  tauStarPa: number | null;
  passedMPrime: boolean;
  passedTauOut: boolean;
  passedTauTip: boolean | null; // null if tauStarRefPa is null
  passedAll: boolean;
  rejectionReasons: string[];
}

export type TransmissionOutcome = "transmitted" | "pinned" | "unresolved_threshold";

export interface TransmissionResult {
  outcome: TransmissionOutcome;
  incomingSystemIndex: number;
  selectedCandidate: CandidateEvaluation | null;
  candidates: CandidateEvaluation[];
  summaryLog: string;
}

export function calculateGeometricCompatibility(
  sIn: Vec3,
  nIn: Vec3,
  sOut: Vec3,
  nOut: Vec3
): number {
  const normSIn = vectorNorm(sIn);
  const normNIn = vectorNorm(nIn);
  const normSOut = vectorNorm(sOut);
  const normNOut = vectorNorm(nOut);

  const dotS = Math.abs(vectorDot(sIn, sOut) / (normSIn * normSOut));
  const dotN = Math.abs(vectorDot(nIn, nOut) / (normNIn * normNOut));

  const mPrime = dotS * dotN;
  return Math.min(Math.max(mPrime, 0.0), 1.0);
}

export function calculateResidualBurgersMagnitude(
  bIn: Vec3,
  bOut: Vec3
): number {
  const diffMinus = Math.hypot(bIn[0] - bOut[0], bIn[1] - bOut[1], bIn[2] - bOut[2]);
  const diffPlus = Math.hypot(bIn[0] + bOut[0], bIn[1] + bOut[1], bIn[2] + bOut[2]);
  return Math.min(diffMinus, diffPlus);
}

export function evaluateCandidateSlipSystem(
  candidateSystem: SlipSystem,
  sInSpec: Vec3,
  nInSpec: Vec3,
  bInSpec: Vec3,
  ROut: Mat3,
  bMagnitudeM: number,
  sigmaSpecimen: Mat3,
  tauTipPa: number,
  thresholds: TransmissionThresholds
): CandidateEvaluation {
  const sOutSpec = transformVectorCrystalToSpecimen(candidateSystem.s, ROut);
  const nOutSpec = transformVectorCrystalToSpecimen(candidateSystem.n, ROut);
  const bOutSpec: Vec3 = [
    sOutSpec[0] * bMagnitudeM,
    sOutSpec[1] * bMagnitudeM,
    sOutSpec[2] * bMagnitudeM,
  ];

  const mPrime = calculateGeometricCompatibility(sInSpec, nInSpec, sOutSpec, nOutSpec);
  const residualB = calculateResidualBurgersMagnitude(bInSpec, bOutSpec);

  const tauRss = calculateResolvedShearStress(sigmaSpecimen, sOutSpec, nOutSpec);
  const tauOut = Math.abs(tauRss);

  const reasons: string[] = [];

  // Criterion 1: m' >= m'_min
  const passedMPrime = mPrime >= thresholds.mPrimeMin - 1e-12;
  if (!passedMPrime) {
    reasons.push(`m' = ${mPrime.toFixed(4)} < m'_min (${thresholds.mPrimeMin.toFixed(4)})`);
  }

  // Criterion 2: tau_out >= tau_c
  const passedTauOut = tauOut >= thresholds.tauCPa - 1e-6;
  if (!passedTauOut) {
    reasons.push(`tau_out = ${(tauOut / 1e6).toFixed(3)} MPa < tau_c (${(thresholds.tauCPa / 1e6).toFixed(3)} MPa)`);
  }

  // Criterion 3: tau_tip >= tau*(m') = tau*_ref * (1 + beta * (1 - m'))
  let passedTauTip: boolean | null = null;
  let tauStarPa: number | null = null;

  if (thresholds.tauStarRefPa !== null) {
    tauStarPa = thresholds.tauStarRefPa * (1.0 + thresholds.beta * (1.0 - mPrime));
    passedTauTip = tauTipPa >= tauStarPa - 1e-6;
    if (!passedTauTip) {
      reasons.push(`tau_tip = ${(tauTipPa / 1e6).toFixed(3)} MPa < tau*(m') (${(tauStarPa / 1e6).toFixed(3)} MPa)`);
    }
  } else {
    reasons.push("tau*_ref is unresolved (M6 pending calibration); threshold check blocked");
  }

  const passedAll = passedTauTip === null ? false : Boolean(passedMPrime && passedTauOut && passedTauTip);

  return {
    systemIndex: candidateSystem.index,
    planeMiller: candidateSystem.planeMiller,
    directionMiller: candidateSystem.directionMiller,
    sSpecimen: sOutSpec,
    nSpecimen: nOutSpec,
    mPrime,
    residualBM: residualB,
    tauOutPa: tauOut,
    tauStarPa,
    passedMPrime,
    passedTauOut,
    passedTauTip,
    passedAll,
    rejectionReasons: reasons,
  };
}

export function evaluateBoundaryTransmission(
  incomingSystemIndex: number,
  RIn: Mat3,
  ROut: Mat3,
  bMagnitudeM: number,
  sigmaSpecimen: Mat3,
  tauTipPa: number,
  thresholds: TransmissionThresholds
): TransmissionResult {
  const fccSystems = getFccSlipSystems();
  const inSys = fccSystems[incomingSystemIndex];

  const sInSpec = transformVectorCrystalToSpecimen(inSys.s, RIn);
  const nInSpec = transformVectorCrystalToSpecimen(inSys.n, RIn);
  const bInSpec: Vec3 = [
    sInSpec[0] * bMagnitudeM,
    sInSpec[1] * bMagnitudeM,
    sInSpec[2] * bMagnitudeM,
  ];

  const evaluations: CandidateEvaluation[] = [];
  for (const candSys of fccSystems) {
    evaluations.push(
      evaluateCandidateSlipSystem(
        candSys,
        sInSpec,
        nInSpec,
        bInSpec,
        ROut,
        bMagnitudeM,
        sigmaSpecimen,
        tauTipPa,
        thresholds
      )
    );
  }

  // Check unresolved state
  if (thresholds.tauStarRefPa === null) {
    const summary =
      "Transmission decision unresolved: tau_star_ref is unresolved (M6 calibration pending). " +
      `Evaluated ${evaluations.length} candidates for geometric compatibility and driving stress.`;
    return {
      outcome: "unresolved_threshold",
      incomingSystemIndex,
      selectedCandidate: null,
      candidates: evaluations,
      summaryLog: summary,
    };
  }

  const accepted = evaluations.filter((c) => c.passedAll);

  if (accepted.length === 0) {
    const summary =
      "Pinned: No candidate slip system satisfied all transmission criteria " +
      `(m' >= ${thresholds.mPrimeMin}, tau_out >= ${(thresholds.tauCPa / 1e6).toFixed(2)} MPa, ` +
      "tau_tip >= tau*(m')).";
    return {
      outcome: "pinned",
      incomingSystemIndex,
      selectedCandidate: null,
      candidates: evaluations,
      summaryLog: summary,
    };
  }

  // Deterministic tie-breaking per spec 5.5:
  // 1. Highest m' (descending)
  // 2. Lowest residual_b (ascending)
  // 3. Highest tau_out (descending)
  // 4. Lowest system_index (ascending)
  accepted.sort((a, b) => {
    // 1. Highest m'
    const diffMPrime = Number((b.mPrime - a.mPrime).toFixed(10));
    if (diffMPrime !== 0) return diffMPrime;

    // 2. Lowest residual_b
    const diffResB = Number(((a.residualBM - b.residualBM) / bMagnitudeM).toFixed(10));
    if (diffResB !== 0) return diffResB;

    // 3. Highest tau_out
    const diffTauOut = Number(((b.tauOutPa - a.tauOutPa) / 1e6).toFixed(6));
    if (diffTauOut !== 0) return diffTauOut;

    // 4. Lowest system_index
    return a.systemIndex - b.systemIndex;
  });

  const selected = accepted[0];

  const summary =
    `Transmitted: Candidate ${selected.systemIndex} ` +
    `(${selected.planeMiller.join(" ")})[${selected.directionMiller.join(" ")}] selected. ` +
    `m' = ${selected.mPrime.toFixed(4)}, |b_r| = ${(selected.residualBM * 1e10).toFixed(3)} Angstrom, ` +
    `tau_out = ${(selected.tauOutPa / 1e6).toFixed(3)} MPa >= tau_c, ` +
    `tau_tip = ${(tauTipPa / 1e6).toFixed(3)} MPa >= tau* (${((selected.tauStarPa ?? 0) / 1e6).toFixed(3)} MPa).`;

  return {
    outcome: "transmitted",
    incomingSystemIndex,
    selectedCandidate: selected,
    candidates: evaluations,
    summaryLog: summary,
  };
}
