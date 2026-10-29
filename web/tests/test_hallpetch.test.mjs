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
