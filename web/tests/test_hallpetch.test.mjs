/**
 * web/tests/test_hallpetch.test.mjs - Unit & validation (V-09, V-10) tests for TypeScript
 * Phase 6 Emergent Hall-Petch derivation engine.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  solvePileupWithSource,
  findYieldOnset,
  computeAnalyticHallPetchKy,
  computeAnalyticTauStarFromKy,
  runHallPetchSweep,
  evaluateSourceDistanceSensitivity,
  CALIBRATED_MATERIALS,
} from "../src/core/hallpetch.ts";

test("solvePileupWithSource returns count 0 when tauEffPa <= tauSrcPa", () => {
  const res = solvePileupWithSource({
    muPa: 26.0e9,
    nu: 0.345,
    burgersM: 2.86343e-10,
    tauEffPa: 0.0,
    sourceDistanceM: 10.0e-6,
    tauSrcPa: 0.0,
  });
  assert.equal(res.count, 0);
  assert.equal(res.tipStressPa, 0.0);
  assert.equal(res.positionsM.length, 0);
});

test("Independent analytical oracle: N=1->N=2 emission threshold, N=2 exact root & back-stress, and N=1 yield onset", () => {
  const muPa = 26.0e9;
  const nu = 0.345;
  const burgersM = 2.86343e-10;
  const L = 10.0e-6;
  const tauSrcPa = 0.5e6;

  // Closed-form elastic interaction prefactor A = mu * b / [2 * pi * (1 - nu)]
  const A = (muPa * burgersM) / (2.0 * Math.PI * (1.0 - nu));
  const tauBackN1 = A / L;

  // At tau_eff = tau_src + 0.999 * (A / L), source back-stress prevents 2nd dislocation emission -> count == 1
  const resBelow = solvePileupWithSource({
    muPa,
    nu,
    burgersM,
    tauEffPa: tauSrcPa + 0.999 * tauBackN1,
    sourceDistanceM: L,
    tauSrcPa,
  });
  assert.equal(resBelow.count, 1);
  assert.equal(resBelow.positionsM[0], 0.0);
  assert.ok(Math.abs(resBelow.backStressPa - tauBackN1) / tauBackN1 < 1e-12);

  // At tau_eff = tau_src + 1.001 * (A / L), net source stress > tau_src -> count >= 2
  const resAbove = solvePileupWithSource({
    muPa,
    nu,
    burgersM,
    tauEffPa: tauSrcPa + 1.001 * tauBackN1,
    sourceDistanceM: L,
    tauSrcPa,
  });
  assert.ok(resAbove.count >= 2);

  // Exact N = 2 closed-form oracle at tau_eff = 1.5 * (A / L), tau_src = 0:
  // x_0 = 0, x_1 = A / tau_eff (since xi_1 = 2 for L_1^(1)(xi) = 2 - xi = 0)
  const tauN2 = 1.5 * tauBackN1;
  const resN2 = solvePileupWithSource({
    muPa,
    nu,
    burgersM,
    tauEffPa: tauN2,
    sourceDistanceM: L,
    tauSrcPa: 0.0,
  });
  assert.equal(resN2.count, 2);
  const expectedX1 = A / tauN2;
  const expectedBackN2 = A / L + A / (L - expectedX1);
  assert.ok(Math.abs(resN2.positionsM[1] - expectedX1) / expectedX1 < 1e-12);
  assert.ok(Math.abs(resN2.backStressPa - expectedBackN2) / expectedBackN2 < 1e-12);

  // Single-dislocation yield onset oracle (tau* <= A / L => N_crit = 1, tau_eff,crit = tau*)
  const tauStarSingle = 0.8 * tauBackN1;
  const onsetSingle = findYieldOnset({
    muPa,
    nu,
    burgersM,
    grainSizeM: 2.0 * L,
    tauStarRefPa: tauStarSingle,
    tauSrcPa: 0.0,
  });
  assert.equal(onsetSingle.converged, true);
  assert.equal(onsetSingle.criticalCount, 1);
  assert.ok(Math.abs(onsetSingle.tauEffCritPa - tauStarSingle) / tauStarSingle < 1e-6);
});

test("solvePileupWithSource maintains tipStress = N * tauEff and monotonic N", () => {
  const muPa = 26.0e9;
  const nu = 0.345;
  const burgersM = 2.86343e-10;
  const sourceDistanceM = 10.0e-6;

  let prevCount = 0;
  for (const tauMpa of [2, 5, 10, 20]) {
    const tauEffPa = tauMpa * 1e6;
    const res = solvePileupWithSource({
      muPa,
      nu,
      burgersM,
      tauEffPa,
      sourceDistanceM,
    });
    assert.ok(res.count >= prevCount);
    assert.ok(Math.abs(res.tipStressPa - res.count * tauEffPa) / res.tipStressPa < 1e-12);
    for (const p of res.positionsM) {
      assert.ok(p >= 0.0 && p < sourceDistanceM);
    }
    prevCount = res.count;
  }
});

test("findYieldOnset finds critical shear stress and respects mPrime/beta barrier scaling", () => {
  const muPa = 26.0e9;
  const nu = 0.345;
  const burgersM = 2.86343e-10;
  const grainSizeM = 25.0e-6;
  const tauStarRefPa = 65.0e6;

  const res0 = findYieldOnset({
    muPa,
    nu,
    burgersM,
    grainSizeM,
    tauStarRefPa,
    mPrime: 0.6,
    beta: 0.0,
    tauCPa: 0.8e6,
    taylorFactor: 3.06,
  });
  assert.equal(res0.converged, true);
  assert.ok(res0.tipStressPa >= res0.tauStarEffectivePa * 0.9999);

  const res1 = findYieldOnset({
    muPa,
    nu,
    burgersM,
    grainSizeM,
    tauStarRefPa,
    mPrime: 0.6,
    beta: 1.0,
    tauCPa: 0.8e6,
    taylorFactor: 3.06,
  });
  assert.ok(Math.abs(res1.tauStarEffectivePa - tauStarRefPa * 1.4) < 1.0);
  assert.ok(res1.tauEffCritPa > res0.tauEffCritPa);
});

test("runHallPetchSweep validates V-09 (-0.5 +/- 0.05 log-log slope) and V-10 (k_y within 15%)", () => {
  const muPa = 26.0e9;
  const nu = 0.345;
  const burgersM = 2.86343e-10;
  const taylorFactor = 3.06;
  const tauCPa = 0.8e6;
  const tauStarRefPa = 66.25e6;

  const grainSizesM = [];
  const nPts = 20;
  const logMin = Math.log10(5.0e-6);
  const logMax = Math.log10(250.0e-6);
  for (let i = 0; i < nPts; i++) {
    grainSizesM.push(Math.pow(10, logMin + (i / (nPts - 1)) * (logMax - logMin)));
  }

  const sweep = runHallPetchSweep({
    muPa,
    nu,
    burgersM,
    tauCPa,
    taylorFactor,
    tauStarRefPa,
    grainSizesM,
    bootstrapSamples: 200,
    seed: 42,
  });

  assert.equal(sweep.v09Passed, true);
  assert.ok(Math.abs(sweep.logLogSlope - (-0.5)) <= 0.05);
  assert.equal(sweep.v10Passed, true);

  const kyAnalytic = computeAnalyticHallPetchKy(muPa, nu, burgersM, tauStarRefPa, taylorFactor);
  const relErr = Math.abs(sweep.fittedKyPaM05 - kyAnalytic) / kyAnalytic;
  assert.ok(relErr <= 0.15);
  assert.ok(sweep.kyCi95LowPaM05 <= sweep.fittedKyPaM05 && sweep.fittedKyPaM05 <= sweep.kyCi95HighPaM05);
});

test("CALIBRATED_MATERIALS provides all 4 audited materials with calibrated tauStarRefPa", () => {
  for (const key of ["aluminium", "copper", "pure_iron", "ferritic_steel"]) {
    assert.ok(key in CALIBRATED_MATERIALS);
    assert.ok(CALIBRATED_MATERIALS[key].calibratedTauStarRefPa > 0);
  }
});

test("evaluateSourceDistanceSensitivity validates k_y ~ sqrt(1/L) analytical scaling in {d/4, d/2, d}", () => {
  const muPa = 26.0e9;
  const nu = 0.345;
  const burgersM = 2.86343e-10;
  const taylorFactor = 3.06;
  const tauCPa = 0.8e6;
  const tauStarRefPa = 80.89e6;

  const dSweep = Array.from({ length: 16 }, (_, i) => 10.0e-6 * Math.pow(40.0, i / 15.0));
  const sens = evaluateSourceDistanceSensitivity(
    {
      muPa,
      nu,
      burgersM,
      tauCPa,
      taylorFactor,
      tauStarRefPa,
      grainSizesM: dSweep,
      sigma0OffsetPa: 10.0e6,
      bootstrapSamples: 30,
      seed: 42,
    },
    [0.25, 0.5, 1.0]
  );

  assert.deepEqual(sens.ratios, [0.25, 0.5, 1.0]);

  // V-09 holds across all source distances
  for (const r of [0.25, 0.5, 1.0]) {
    const res = sens.results[r];
    assert.equal(res.v09Passed, true);
    assert.ok(Math.abs(res.logLogSlope - (-0.5)) <= 0.05);
  }

  // Analytical sqrt(1/L) scaling:
  // k_y(d/4) / k_y(d/2) ~ sqrt(2) = 1.4142 within 5%
  const scaleD4 = sens.ratioToHalfDScaling[0.25];
  assert.ok(Math.abs(scaleD4 - Math.SQRT2) / Math.SQRT2 <= 0.05);

  // k_y(d) / k_y(d/2) ~ 1/sqrt(2) = 0.7071 within 5%
  const scaleD = sens.ratioToHalfDScaling[1.0];
  assert.ok(Math.abs(scaleD - (1.0 / Math.SQRT2)) / (1.0 / Math.SQRT2) <= 0.05);
});
