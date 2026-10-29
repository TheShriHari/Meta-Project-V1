/**
 * web/src/core/hallpetch.ts - Emergent Hall-Petch derivation from 1D discrete dislocation pile-ups.
 * Pure TypeScript scientific core: zero UI, DOM, Three.js, or network dependencies (NFR-04).
 * Matches Python reference hpsim.core.hallpetch exactly.
 */

import { computeEfnRoots, computePileupPrefactor } from "./pileup.ts";

const EFN_ROOTS_CACHE = new Map<number, number[]>([[0, [0.0]]]);

function getCachedEfnRootsWithZero(mobileCount: number): number[] {
  if (!EFN_ROOTS_CACHE.has(mobileCount)) {
    if (mobileCount <= 0) {
      EFN_ROOTS_CACHE.set(mobileCount, [0.0]);
    } else {
      const roots = computeEfnRoots(mobileCount);
      EFN_ROOTS_CACHE.set(mobileCount, [0.0, ...roots]);
    }
  }
  return EFN_ROOTS_CACHE.get(mobileCount)!;
}

export interface SourceShutoffInputs {
  muPa: number;
  nu: number;
  burgersM: number;
  tauEffPa: number;
  sourceDistanceM: number;
  tauSrcPa?: number;
  maxCount?: number;
}

export interface SourceShutoffResult {
  count: number;
  tipStressPa: number;
  backStressPa: number;
  netSourceStressPa: number;
  positionsM: number[];
  pileupLengthM: number;
  asymptoticCount: number;
  coreOverlapFlagged: boolean;
}

export interface YieldOnsetInputs {
  muPa: number;
  nu: number;
  burgersM: number;
  grainSizeM: number;
  tauStarRefPa: number;
  mPrime?: number;
  beta?: number;
  tauCPa?: number;
  taylorFactor?: number;
  sigma0OffsetPa?: number | null;
  tauSrcPa?: number;
  maxCount?: number;
  bisectionIterations?: number;
}

export interface YieldOnsetResult {
  converged: boolean;
  grainSizeM: number;
  sourceDistanceM: number;
  tauStarEffectivePa: number;
  tauEffCritPa: number;
  tauEffAnalyticPa: number;
  criticalCount: number;
  tipStressPa: number;
  sigmaYPa: number;
  sigmaYAnalyticPa: number;
  plateauWidthPa: number;
}

export interface HallPetchSweepInputs {
  muPa: number;
  nu: number;
  burgersM: number;
  tauCPa: number;
  taylorFactor: number;
  tauStarRefPa: number;
  grainSizesM: number[];
  mPrime?: number;
  beta?: number;
  sigma0OffsetPa?: number | null;
  tauSrcPa?: number;
  bootstrapSamples?: number;
  seed?: number;
}

export interface HallPetchPoint {
  grainSizeM: number;
  invSqrtDM05: number;
  tauEffCritPa: number;
  tauEffAnalyticPa: number;
  sigmaYPa: number;
  sigmaYAnalyticPa: number;
  criticalCount: number;
  plateauWidthPa: number;
}

export interface HallPetchSweepResult {
  points: HallPetchPoint[];
  fittedSigma0Pa: number;
  fittedKyPaM05: number;
  analyticSigma0Pa: number;
  analyticKyPaM05: number;
  kyCi95LowPaM05: number;
  kyCi95HighPaM05: number;
  sigma0Ci95LowPa: number;
  sigma0Ci95HighPa: number;
  rSquared: number;
  logLogSlope: number;
  logLogIntercept: number;
  kyRelErrorVsAnalytic: number;
  v09Passed: boolean;
  v10Passed: boolean;
}

export function computeEffectiveTauStar(
  tauStarRefPa: number,
  mPrime = 1.0,
  beta = 0.0
): number {
  if (tauStarRefPa <= 0.0) {
    throw new Error(`tauStarRefPa must be positive, got ${tauStarRefPa}`);
  }
  if (!(mPrime >= 0.0 && mPrime <= 1.0)) {
    throw new Error(`mPrime must be in [0, 1], got ${mPrime}`);
  }
  if (beta < 0.0) {
    throw new Error(`beta must be >= 0, got ${beta}`);
  }
  return tauStarRefPa * (1.0 + beta * (1.0 - mPrime));
}

export function computeAnalyticHallPetchKy(
  muPa: number,
  nu: number,
  burgersM: number,
  tauStarPa: number,
  taylorFactor = 3.06
): number {
  return (
    taylorFactor *
    Math.sqrt((2.0 * muPa * burgersM * tauStarPa) / (Math.PI * (1.0 - nu)))
  );
}

export function computeAnalyticTauStarFromKy(
  kyPaM05: number,
  muPa: number,
  nu: number,
  burgersM: number,
  taylorFactor = 3.06
): number {
  const ratio = kyPaM05 / taylorFactor;
  return ((Math.PI * (1.0 - nu)) / (2.0 * muPa * burgersM)) * (ratio * ratio);
}

export function solvePileupWithSource(
  inputs: SourceShutoffInputs
): SourceShutoffResult {
  const tauSrcPa = inputs.tauSrcPa ?? 0.0;
  const maxCount = inputs.maxCount ?? 300;

  if (
    inputs.muPa <= 0.0 ||
    !(inputs.nu > -1.0 && inputs.nu < 0.5) ||
    inputs.burgersM <= 0.0
  ) {
    throw new Error("Invalid elastic or Burgers parameters in SourceShutoffInputs");
  }
  if (inputs.sourceDistanceM <= 0.0) {
    throw new Error(`sourceDistanceM must be positive, got ${inputs.sourceDistanceM}`);
  }

  const L = inputs.sourceDistanceM;
  const tauEff = inputs.tauEffPa;
  if (tauEff <= tauSrcPa) {
    return {
      count: 0,
      tipStressPa: 0.0,
      backStressPa: 0.0,
      netSourceStressPa: tauEff - tauSrcPa,
      positionsM: [],
      pileupLengthM: 0.0,
      asymptoticCount: 0.0,
      coreOverlapFlagged: false,
    };
  }

  const A = computePileupPrefactor(inputs.muPa, inputs.nu, inputs.burgersM);
  const lam = tauEff / A;
  const lDim = 2.0 * lam * L;
  const asympN =
    (Math.PI * (1.0 - inputs.nu) * L * tauEff) / (inputs.muPa * inputs.burgersM);

  let N = 1;
  while (N < maxCount) {
    const rootsN = getCachedEfnRootsWithZero(N - 1);
    if (rootsN[rootsN.length - 1] >= lDim) {
      break;
    }
    let tauBack = 0.0;
    for (let j = 0; j < rootsN.length; j++) {
      const posJ = rootsN[j] / (2.0 * lam);
      tauBack += A / (L - posJ);
    }
    if (tauEff - tauBack > tauSrcPa) {
      const rootsNext = getCachedEfnRootsWithZero(N);
      if (rootsNext[rootsNext.length - 1] < lDim) {
        N += 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  const rootsFinal = getCachedEfnRootsWithZero(N - 1);
  const positionsM = rootsFinal.map((r) => r / (2.0 * lam));
  let backStressPa = Number.POSITIVE_INFINITY;
  if (positionsM[positionsM.length - 1] < L) {
    backStressPa = 0.0;
    for (const p of positionsM) {
      backStressPa += A / (L - p);
    }
  }

  let coreOverlap = false;
  if (N >= 2) {
    let minGap = Number.POSITIVE_INFINITY;
    for (let i = 1; i < positionsM.length; i++) {
      minGap = Math.min(minGap, positionsM[i] - positionsM[i - 1]);
    }
    if (minGap < inputs.burgersM) {
      coreOverlap = true;
    }
  }

  return {
    count: N,
    tipStressPa: N * tauEff,
    backStressPa,
    netSourceStressPa: tauEff - backStressPa,
    positionsM,
    pileupLengthM: positionsM[positionsM.length - 1],
    asymptoticCount: asympN,
    coreOverlapFlagged: coreOverlap,
  };
}

export function findYieldOnset(inputs: YieldOnsetInputs): YieldOnsetResult {
  if (inputs.grainSizeM <= 0.0) {
    throw new Error(`grainSizeM must be positive, got ${inputs.grainSizeM}`);
  }

  const mPrime = inputs.mPrime ?? 1.0;
  const beta = inputs.beta ?? 0.0;
  const tauCPa = inputs.tauCPa ?? 0.0;
  const taylorFactor = inputs.taylorFactor ?? 3.06;
  const tauSrcPa = inputs.tauSrcPa ?? 0.0;
  const maxCount = inputs.maxCount ?? 300;
  const bisectionIterations = inputs.bisectionIterations ?? 40;

  const L = 0.5 * inputs.grainSizeM;
  const tauStar = computeEffectiveTauStar(inputs.tauStarRefPa, mPrime, beta);

  const tauEffAnalytic = Math.sqrt(
    (2.0 * inputs.muPa * inputs.burgersM * tauStar) /
      (Math.PI * (1.0 - inputs.nu) * inputs.grainSizeM)
  );

  let lo = Math.max(tauSrcPa + 1.0, 0.2 * tauEffAnalytic);
  let hi = Math.max(1.6 * tauEffAnalytic, tauSrcPa + 100.0);

  for (let k = 0; k < 10; k++) {
    const resHi = solvePileupWithSource({
      muPa: inputs.muPa,
      nu: inputs.nu,
      burgersM: inputs.burgersM,
      tauEffPa: hi,
      sourceDistanceM: L,
      tauSrcPa,
      maxCount,
    });
    if (resHi.tipStressPa >= tauStar) {
      break;
    }
    hi *= 2.0;
  }

  for (let iter = 0; iter < bisectionIterations; iter++) {
    const mid = 0.5 * (lo + hi);
    const resMid = solvePileupWithSource({
      muPa: inputs.muPa,
      nu: inputs.nu,
      burgersM: inputs.burgersM,
      tauEffPa: mid,
      sourceDistanceM: L,
      tauSrcPa,
      maxCount,
    });
    if (resMid.tipStressPa >= tauStar) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const finalRes = solvePileupWithSource({
    muPa: inputs.muPa,
    nu: inputs.nu,
    burgersM: inputs.burgersM,
    tauEffPa: hi,
    sourceDistanceM: L,
    tauSrcPa,
    maxCount,
  });

  const nCrit = Math.max(finalRes.count, 1);
  const plateauWidthPa = tauStar / nCrit - tauStar / (nCrit + 1);

  const sigma0Base =
    inputs.sigma0OffsetPa !== undefined && inputs.sigma0OffsetPa !== null
      ? inputs.sigma0OffsetPa
      : taylorFactor * tauCPa;
  const sigmaYPa = sigma0Base + taylorFactor * hi;
  const sigmaYAnalyticPa = sigma0Base + taylorFactor * tauEffAnalytic;

  return {
    converged: finalRes.tipStressPa >= tauStar * (1.0 - 1e-6),
    grainSizeM: inputs.grainSizeM,
    sourceDistanceM: L,
    tauStarEffectivePa: tauStar,
    tauEffCritPa: hi,
    tauEffAnalyticPa: tauEffAnalytic,
    criticalCount: nCrit,
    tipStressPa: finalRes.tipStressPa,
    sigmaYPa,
    sigmaYAnalyticPa,
    plateauWidthPa,
  };
}

function olsLinearFit(
  x: number[],
  y: number[]
): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  let xSum = 0.0;
  let ySum = 0.0;
  for (let i = 0; i < n; i++) {
    xSum += x[i];
    ySum += y[i];
  }
  const xMean = xSum / n;
  const yMean = ySum / n;

  let num = 0.0;
  let denom = 0.0;
  let ssTot = 0.0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    num += dx * dy;
    denom += dx * dx;
    ssTot += dy * dy;
  }
  if (denom <= 0.0) {
    return { slope: 0.0, intercept: yMean, r2: 0.0 };
  }
  const slope = num / denom;
  const intercept = yMean - slope * xMean;
  let ssRes = 0.0;
  for (let i = 0; i < n; i++) {
    const err = y[i] - (intercept + slope * x[i]);
    ssRes += err * err;
  }
  const r2 = ssTot > 0.0 ? 1.0 - ssRes / ssTot : 1.0;
  return { slope, intercept, r2 };
}

export function runHallPetchSweep(
  inputs: HallPetchSweepInputs
): HallPetchSweepResult {
  if (inputs.grainSizesM.length < 3) {
    throw new Error("HallPetchSweepInputs requires at least 3 grain sizes");
  }

  const mPrime = inputs.mPrime ?? 1.0;
  const beta = inputs.beta ?? 0.0;
  const tauSrcPa = inputs.tauSrcPa ?? 0.0;
  const bootstrapSamples = inputs.bootstrapSamples ?? 200;
  const seed = inputs.seed ?? 42;

  const points: HallPetchPoint[] = inputs.grainSizesM.map((d) => {
    const onset = findYieldOnset({
      muPa: inputs.muPa,
      nu: inputs.nu,
      burgersM: inputs.burgersM,
      grainSizeM: d,
      tauStarRefPa: inputs.tauStarRefPa,
      mPrime,
      beta,
      tauCPa: inputs.tauCPa,
      taylorFactor: inputs.taylorFactor,
      sigma0OffsetPa: inputs.sigma0OffsetPa,
      tauSrcPa,
    });
    return {
      grainSizeM: onset.grainSizeM,
      invSqrtDM05: Math.pow(onset.grainSizeM, -0.5),
      tauEffCritPa: onset.tauEffCritPa,
      tauEffAnalyticPa: onset.tauEffAnalyticPa,
      sigmaYPa: onset.sigmaYPa,
      sigmaYAnalyticPa: onset.sigmaYAnalyticPa,
      criticalCount: onset.criticalCount,
      plateauWidthPa: onset.plateauWidthPa,
    };
  });

  const invSqrtD = points.map((p) => p.invSqrtDM05);
  const sigmaY = points.map((p) => p.sigmaYPa);
  const logD = points.map((p) => Math.log10(p.grainSizeM));
  const logTauCrit = points.map((p) => Math.log10(p.tauEffCritPa));

  const hpFit = olsLinearFit(invSqrtD, sigmaY);
  const logFit = olsLinearFit(logD, logTauCrit);

  const tauStarEff = computeEffectiveTauStar(inputs.tauStarRefPa, mPrime, beta);
  const analyticKy = computeAnalyticHallPetchKy(
    inputs.muPa,
    inputs.nu,
    inputs.burgersM,
    tauStarEff,
    inputs.taylorFactor
  );
  const analyticSigma0 =
    inputs.sigma0OffsetPa !== undefined && inputs.sigma0OffsetPa !== null
      ? inputs.sigma0OffsetPa
      : inputs.taylorFactor * inputs.tauCPa;

  const nPts = points.length;
  const nBoot = Math.max(bootstrapSamples, 10);
  const bootKy: number[] = [];
  const bootS0: number[] = [];
  let state = seed >>> 0;

  for (let b = 0; b < nBoot; b++) {
    const bx: number[] = [];
    const by: number[] = [];
    for (let i = 0; i < nPts; i++) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      const idx = state % nPts;
      bx.push(invSqrtD[idx]);
      by.push(sigmaY[idx]);
    }
    const bFit = olsLinearFit(bx, by);
    if (bFit.slope > 0.0) {
      bootKy.push(bFit.slope);
      bootS0.push(bFit.intercept);
    }
  }

  bootKy.sort((a, b) => a - b);
  bootS0.sort((a, b) => a - b);
  const loIdx = Math.floor(0.025 * (bootKy.length - 1));
  const hiIdx = Math.floor(0.975 * (bootKy.length - 1));

  const relErr = Math.abs(hpFit.slope - analyticKy) / analyticKy;
  const v09Passed = Math.abs(logFit.slope - -0.5) <= 0.05;
  const v10Passed = relErr <= 0.15;

  return {
    points,
    fittedSigma0Pa: hpFit.intercept,
    fittedKyPaM05: hpFit.slope,
    analyticSigma0Pa: analyticSigma0,
    analyticKyPaM05: analyticKy,
    kyCi95LowPaM05: bootKy[loIdx],
    kyCi95HighPaM05: bootKy[hiIdx],
    sigma0Ci95LowPa: bootS0[loIdx],
    sigma0Ci95HighPa: bootS0[hiIdx],
    rSquared: hpFit.r2,
    logLogSlope: logFit.slope,
    logLogIntercept: logFit.intercept,
    kyRelErrorVsAnalytic: relErr,
    v09Passed,
    v10Passed,
  };
}

export interface CalibratedMaterialEntry {
  key: string;
  name: string;
  structure: "FCC" | "BCC";
  muPa: number;
  nu: number;
  burgersM: number;
  tauCPa: number;
  tauCStatus: "sourced" | "needs_citation";
  taylorFactor: number;
  calibratedTauStarRefPa: number;
  analyticTauStarRefPa: number;
  calibrationFit: {
    sourceId: string;
    doi: string;
    purity: string;
    dMinUm: number;
    dMaxUm: number;
    sigma0Pa: number;
    kyPaM05: number;
  };
  heldOutFit: {
    sourceId: string;
    doi: string;
    purity: string;
    dMinUm: number;
    dMaxUm: number;
    sigma0Pa: number;
    kyPaM05: number;
  };
}

export const CALIBRATED_MATERIALS: Record<string, CalibratedMaterialEntry> = {
  aluminium: {
    key: "aluminium",
    name: "Aluminium (99.999% High-Purity Al)",
    structure: "FCC",
    muPa: 26.0e9,
    nu: 0.345,
    burgersM: 2.86343e-10,
    tauCPa: 0.8e6,
    tauCStatus: "sourced",
    taylorFactor: 3.06,
    calibratedTauStarRefPa: 80885916.12147665,
    analyticTauStarRefPa: 66253375.65319495,
    calibrationFit: {
      sourceId: "Hansen (1977)",
      doi: "10.1016/0001-6160(77)90171-7",
      purity: "99.999% High-Purity Al",
      dMinUm: 25.0,
      dMaxUm: 450.0,
      sigma0Pa: 10.0e6,
      kyPaM05: 67000.0,
    },
    heldOutFit: {
      sourceId: "Hansen (1977) AA1050",
      doi: "10.1016/0001-6160(77)90171-7",
      purity: "99.5% Commercial Al (AA1050)",
      dMinUm: 18.0,
      dMaxUm: 380.0,
      sigma0Pa: 16.5e6,
      kyPaM05: 78000.0,
    },
  },
  copper: {
    key: "copper",
    name: "Copper (99.999% High-Purity Cu)",
    structure: "FCC",
    muPa: 46.4e9,
    nu: 0.343,
    burgersM: 2.5562e-10,
    tauCPa: 0.65e6,
    tauCStatus: "sourced",
    taylorFactor: 3.06,
    calibratedTauStarRefPa: 172257928.15101492,
    analyticTauStarRefPa: 145194313.80689067,
    calibrationFit: {
      sourceId: "Hansen & Ralph (1982)",
      doi: "10.1016/0001-6160(82)90221-8",
      purity: "99.999% High-Purity Copper",
      dMinUm: 12.0,
      dMaxUm: 220.0,
      sigma0Pa: 20.0e6,
      kyPaM05: 125000.0,
    },
    heldOutFit: {
      sourceId: "Feltham & Meakin (1957)",
      doi: "10.1080/14786435708231728",
      purity: "99.95% Polycrystalline Copper",
      dMinUm: 14.0,
      dMaxUm: 150.0,
      sigma0Pa: 23.5e6,
      kyPaM05: 144000.0,
    },
  },
  pure_iron: {
    key: "pure_iron",
    name: "Pure Alpha-Iron (Ti-Stabilised IF Iron)",
    structure: "BCC",
    muPa: 81.6e9,
    nu: 0.291,
    burgersM: 2.48246e-10,
    tauCPa: 27.5e6,
    tauCStatus: "sourced",
    taylorFactor: 2.75,
    calibratedTauStarRefPa: 118353190.81981021,
    analyticTauStarRefPa: 94479591.97846673,
    calibrationFit: {
      sourceId: "Takeda et al. (2008) IF-Fe",
      doi: "10.2355/isijinternational.48.1122",
      purity: "Ti-stabilised IF Iron (4 ppm C)",
      dMinUm: 7.7,
      dMaxUm: 69.4,
      sigma0Pa: 56.0e6,
      kyPaM05: 114000.0,
    },
    heldOutFit: {
      sourceId: "Takeda et al. (2008) Base Fe",
      doi: "10.2355/isijinternational.48.1122",
      purity: "Base Pure Iron (5 ppm C)",
      dMinUm: 8.2,
      dMaxUm: 82.6,
      sigma0Pa: 72.0e6,
      kyPaM05: 188000.0,
    },
  },
  ferritic_steel: {
    key: "ferritic_steel",
    name: "Ferritic Steel (C60 Low-Carbon 56 ppm C)",
    structure: "BCC",
    muPa: 81.0e9,
    nu: 0.29,
    burgersM: 2.48289e-10,
    tauCPa: 35.0e6,
    tauCStatus: "needs_citation",
    taylorFactor: 2.75,
    calibratedTauStarRefPa: 2115926912.507524,
    analyticTauStarRefPa: 1952404244.446555,
    calibrationFit: {
      sourceId: "Takeda et al. (2008) C60",
      doi: "10.2355/isijinternational.48.1122",
      purity: "C60 Low-Carbon Steel (56 ppm C)",
      dMinUm: 6.9,
      dMaxUm: 59.2,
      sigma0Pa: 61.0e6,
      kyPaM05: 516000.0,
    },
    heldOutFit: {
      sourceId: "Armstrong et al. (1962)",
      doi: "10.1080/14786436208201857",
      purity: "0.15% C Mild Steel",
      dMinUm: 10.0,
      dMaxUm: 160.0,
      sigma0Pa: 68.0e6,
      kyPaM05: 620000.0,
    },
  },
};
