/**
 * web/tests/test_boundary.test.mjs - Phase 4 tests for grain-boundary transmission core.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateGeometricCompatibility,
  calculateResidualBurgersMagnitude,
  evaluateBoundaryTransmission,
} from "../src/core/boundary.ts";
import { makeUniaxialStressTensor } from "../src/core/stress.ts";
import { rotationMatrixEulerZXZ } from "../src/core/rotations.ts";
import { calculateBurgersMagnitude } from "../src/core/slipsystems.ts";

const A_FCC = 4.0495e-10;
const B_FCC = calculateBurgersMagnitude(A_FCC, "FCC");

const near = (a, b, tol, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (diff=${Math.abs(a - b)})`);

test("geometric compatibility bounds and identical systems", () => {
  const s1 = [1, 0, 0];
  const n1 = [0, 1, 0];
  near(calculateGeometricCompatibility(s1, n1, s1, n1), 1.0, 1e-12, "identical");

  const s2 = [0, 0, 1];
  const n2 = [0, 1, 0];
  near(calculateGeometricCompatibility(s1, n1, s2, n2), 0.0, 1e-12, "orthogonal directions");
});

test("residual Burgers magnitude minimization", () => {
  const bIn = [B_FCC, 0, 0];
  const bOutSame = [B_FCC, 0, 0];
  const bOutOpp = [-B_FCC, 0, 0];

  near(calculateResidualBurgersMagnitude(bIn, bOutSame), 0.0, 1e-15, "same");
  near(calculateResidualBurgersMagnitude(bIn, bOutOpp), 0.0, 1e-15, "opposite");

  const bOutOrtho = [0, B_FCC, 0];
  near(calculateResidualBurgersMagnitude(bIn, bOutOrtho), Math.SQRT2 * B_FCC, 1e-12, "ortho");
});

test("identical orientations produces perfect match on candidate 0", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);

  const thresholds = {
    mPrimeMin: 0.5,
    tauCPa: 5.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  };

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, thresholds);
  assert.equal(res.outcome, "transmitted");
  assert.ok(res.selectedCandidate !== null);
  assert.equal(res.selectedCandidate?.systemIndex, 0);
  near(res.selectedCandidate?.mPrime ?? 0, 1.0, 1e-12);
  near(res.selectedCandidate?.residualBM ?? 1, 0.0, 1e-15);
  assert.equal(res.selectedCandidate?.passedAll, true);
});

test("deliberate misorientation 90 deg z produces valid candidate list", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = rotationMatrixEulerZXZ(Math.PI / 2, 0, 0);
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);

  const thresholds = {
    mPrimeMin: 0.2,
    tauCPa: 1.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  };

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 25.0e6, thresholds);
  assert.equal(res.candidates.length, 12);
  for (const c of res.candidates) {
    assert.ok(c.mPrime >= 0.0 && c.mPrime <= 1.0 + 1e-12);
  }
});

test("independent rejection criteria in TypeScript", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);

  // 1. Reject on m'
  const res1 = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, {
    mPrimeMin: 1.1,
    tauCPa: 1.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  });
  assert.equal(res1.outcome, "pinned");
  assert.equal(res1.selectedCandidate, null);

  // 2. Reject on tau_out < tau_c
  const res2 = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, {
    mPrimeMin: 0.5,
    tauCPa: 1000.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  });
  assert.equal(res2.outcome, "pinned");

  // 3. Reject on tau_tip < tau*
  const res3 = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 5.0e6, {
    mPrimeMin: 0.5,
    tauCPa: 1.0e6,
    tauStarRefPa: 50.0e6,
    beta: 0.0,
  });
  assert.equal(res3.outcome, "pinned");
});

test("unresolved tau*_ref produces explicit unresolved_threshold outcome", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, {
    mPrimeMin: 0.5,
    tauCPa: 1.0e6,
    tauStarRefPa: null,
    beta: 0.0,
  });

  assert.equal(res.outcome, "unresolved_threshold");
  assert.equal(res.selectedCandidate, null);
  assert.ok(res.summaryLog.includes("tau_star_ref is unresolved"));
  for (const c of res.candidates) {
    assert.equal(c.passedTauTip, null);
  }
});

test("deterministic tie-breaking order in TypeScript: m', then |b_r|, then tau_out, then index", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);

  const thresholds = {
    mPrimeMin: 0.1,
    tauCPa: 1.0e6,
    tauStarRefPa: 5.0e6,
    beta: 0.0,
  };

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 25.0e6, thresholds);
  assert.equal(res.outcome, "transmitted");
  assert.ok(res.selectedCandidate !== null);
  // Candidate 0 matches identical orientation, m'=1, |b_r|=0
  assert.equal(res.selectedCandidate?.systemIndex, 0);
});

test("outgoing RSS is computed from full tensor and transforms consistently", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  // 90 deg rotation about z
  const ROut = rotationMatrixEulerZXZ(Math.PI / 2, 0, 0);
  const sigma = makeUniaxialStressTensor(40e6, [0, 0, 1]);

  const thresholds = {
    mPrimeMin: 0.0,
    tauCPa: 1.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  };

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, thresholds);
  assert.equal(res.candidates.length, 12);
  for (const c of res.candidates) {
    assert.ok(c.tauOutPa >= 0);
    // Uniaxial along z with magnitude 40 MPa means RSS <= 40 MPa * 0.5 = 20 MPa
    assert.ok(c.tauOutPa <= 20e6 + 1e-6);
  }
});

test("no acceptable candidate yields pinned with numerical reasons", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  // Zero stress -> tau_out = 0 on all systems, failing tau_c
  const sigma = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const thresholds = {
    mPrimeMin: 0.5,
    tauCPa: 5.0e6,
    tauStarRefPa: 10.0e6,
    beta: 0.0,
  };

  const res = evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 15.0e6, thresholds);
  assert.equal(res.outcome, "pinned");
  assert.equal(res.selectedCandidate, null);
  assert.ok(res.summaryLog.includes("Pinned: No candidate slip system satisfied all transmission criteria"));
});

test("transmission evaluation does not mutate input state", () => {
  const RIn = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const ROut = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const sigma = makeUniaxialStressTensor(50e6, [0, 0, 1]);
  const thresholds = {
    mPrimeMin: 0.5,
    tauCPa: 5.0e6,
    tauStarRefPa: 10.0e6,
    beta: 1.0,
  };

  const frozenRIn = JSON.stringify(RIn);
  const frozenROut = JSON.stringify(ROut);
  const frozenSigma = JSON.stringify(sigma);
  const frozenThresholds = JSON.stringify(thresholds);

  evaluateBoundaryTransmission(0, RIn, ROut, B_FCC, sigma, 20.0e6, thresholds);

  assert.equal(JSON.stringify(RIn), frozenRIn);
  assert.equal(JSON.stringify(ROut), frozenROut);
  assert.equal(JSON.stringify(sigma), frozenSigma);
  assert.equal(JSON.stringify(thresholds), frozenThresholds);
});

