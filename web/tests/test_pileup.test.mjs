/**
 * web/tests/test_pileup.test.mjs - Phase 5 tests for discrete dislocation pile-up engine & EFN benchmark.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  solvePileupEquilibrium,
  computeEfnExactPositions,
  computeEfnAsymptoticCount,
  computePileupPrefactor,
  validatePileupInputs,
} from "../src/core/pileup.ts";

const A_FCC_AL = 4.0495e-10; // m
const B_FCC_AL = A_FCC_AL / Math.SQRT2; // ~ 2.8634e-10 m
const MU_AL = 26.0e9; // Pa
const NU_AL = 0.33;

const near = (a, b, tol, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (diff=${Math.abs(a - b)}, tol=${tol})`);

test("input validation rejects unphysical parameters", () => {
  const valid = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 50e6,
    count: 5,
  };
  const res = solvePileupEquilibrium(valid);
  assert.equal(res.status, "converged");
  assert.equal(res.converged, true);

  assert.throws(() => solvePileupEquilibrium({ ...valid, muPa: -1.0 }), /muPa/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, muPa: 0.0 }), /muPa/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, nu: 0.5 }), /nu/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, nu: -1.0 }), /nu/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, burgersM: 0.0 }), /burgersM/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, tauAppliedPa: -10e6 }), /tauAppliedPa/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, count: 1 }), /count/);
  assert.throws(() => solvePileupEquilibrium({ ...valid, muPa: Number.NaN }), /finite/);
});

test("two-dislocation analytical solution N=2", () => {
  const inputs = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 40e6,
    count: 2,
  };
  const res = solvePileupEquilibrium(inputs);
  assert.equal(res.converged, true);
  assert.equal(res.positionsM.length, 2);
  assert.equal(res.positionsM[0], 0.0);

  const A = (MU_AL * B_FCC_AL) / (2.0 * Math.PI * (1.0 - NU_AL));
  const expectedX2 = A / 40e6;

  near(res.positionsM[1], expectedX2, expectedX2 * 1e-10, "x2 analytical position");
  near(res.maxResidualPa, 0.0, 1e-6, "residual");

  const efnPos = computeEfnExactPositions(inputs);
  assert.equal(efnPos.length, 2);
  near(efnPos[1], expectedX2, expectedX2 * 1e-10, "efn exact pos");
});

test("three-dislocation analytical solution N=3", () => {
  const inputs = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 50e6,
    count: 3,
  };
  const res = solvePileupEquilibrium(inputs);
  assert.equal(res.converged, true);

  const A = (MU_AL * B_FCC_AL) / (2.0 * Math.PI * (1.0 - NU_AL));
  const lam = 50e6 / A;
  const expectedX2 = (3.0 - Math.sqrt(3.0)) / (2.0 * lam);
  const expectedX3 = (3.0 + Math.sqrt(3.0)) / (2.0 * lam);

  assert.equal(res.positionsM[0], 0.0);
  near(res.positionsM[1], expectedX2, expectedX2 * 1e-10, "N=3 x2");
  near(res.positionsM[2], expectedX3, expectedX3 * 1e-10, "N=3 x3");

  const efnPos = computeEfnExactPositions(inputs);
  near(res.positionsM[1], efnPos[1], 1e-14, "parity x2");
  near(res.positionsM[2], efnPos[2], 1e-14, "parity x3");
});

test("force signs and repulsion", () => {
  const A = computePileupPrefactor(MU_AL, NU_AL, B_FCC_AL);
  const xEq = A / 50e6;

  // At x < xEq: repulsion from 0 (A/x) > applied stress (50 MPa) => net force is positive
  const xClose = 0.5 * xEq;
  const netStressClose = A / xClose - 50e6;
  assert.ok(netStressClose > 0.0, "repels away from obstacle");

  // At x > xEq: repulsion < applied stress => net force is negative (drives toward obstacle)
  const xFar = 2.0 * xEq;
  const netStressFar = A / xFar - 50e6;
  assert.ok(netStressFar < 0.0, "drives toward obstacle");
});

test("position ordering and positive non-zero spacing", () => {
  for (const N of [2, 5, 10, 20]) {
    const inputs = {
      muPa: MU_AL,
      nu: NU_AL,
      burgersM: B_FCC_AL,
      tauAppliedPa: 60e6,
      count: N,
    };
    const res = solvePileupEquilibrium(inputs);
    assert.equal(res.converged, true);
    const pos = res.positionsM;

    for (let i = 0; i < pos.length - 1; i++) {
      assert.ok(pos[i + 1] > pos[i], `Ordering violation at index ${i} for N=${N}`);
    }
  }
});

test("crowding toward obstacle (density gradient)", () => {
  const inputs = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 50e6,
    count: 8,
  };
  const res = solvePileupEquilibrium(inputs);
  assert.equal(res.converged, true);

  const spacings = [];
  for (let i = 0; i < res.positionsM.length - 1; i++) {
    spacings.push(res.positionsM[i + 1] - res.positionsM[i]);
  }

  for (let k = 0; k < spacings.length - 1; k++) {
    assert.ok(spacings[k + 1] > spacings[k], `Density crowding violated at spacing index ${k}`);
  }
});

test("EFN numerical benchmark agreement across counts", () => {
  for (const N of [2, 3, 5, 10, 15, 25]) {
    const inputs = {
      muPa: MU_AL,
      nu: NU_AL,
      burgersM: B_FCC_AL,
      tauAppliedPa: 45e6,
      count: N,
    };
    const res = solvePileupEquilibrium(inputs);
    const efnPos = computeEfnExactPositions(inputs);

    assert.equal(res.converged, true);
    let maxErr = 0.0;
    for (let i = 0; i < N; i++) {
      maxErr = Math.max(maxErr, Math.abs(res.positionsM[i] - efnPos[i]));
    }
    assert.ok(maxErr < 1e-10, `Discrepancy too large for N=${N}: ${maxErr}`);
    assert.ok(res.maxResidualPa < 1e-5, `Residual too large for N=${N}: ${res.maxResidualPa}`);
  }
});

test("Eshelby tip stress multiplication tau_tip = N * tau_app", () => {
  for (const N of [2, 4, 8, 16]) {
    const tauApp = 30e6;
    const inputs = {
      muPa: MU_AL,
      nu: NU_AL,
      burgersM: B_FCC_AL,
      tauAppliedPa: tauApp,
      count: N,
    };
    const res = solvePileupEquilibrium(inputs);
    assert.equal(res.converged, true);
    near(res.tipStressPa, N * tauApp, 1e-6, `Tip stress for N=${N}`);
  }
});

test("scaling laws with tau_app and mu", () => {
  const baseInputs = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 50e6,
    count: 6,
  };
  const baseRes = solvePileupEquilibrium(baseInputs);

  // 1. Double applied stress -> positions halve
  const doubleStress = { ...baseInputs, tauAppliedPa: 100e6 };
  const doubleRes = solvePileupEquilibrium(doubleStress);
  for (let i = 0; i < 6; i++) {
    near(doubleRes.positionsM[i], 0.5 * baseRes.positionsM[i], 1e-14, `Stress scaling index ${i}`);
  }

  // 2. Double shear modulus -> positions double
  const doubleMu = { ...baseInputs, muPa: 2.0 * MU_AL };
  const doubleMuRes = solvePileupEquilibrium(doubleMu);
  for (let i = 0; i < 6; i++) {
    near(doubleMuRes.positionsM[i], 2.0 * baseRes.positionsM[i], 1e-14, `Mu scaling index ${i}`);
  }
});

test("EFN asymptotic count relation and finite-size scaling", () => {
  // Small N=3
  const in3 = { muPa: MU_AL, nu: NU_AL, burgersM: B_FCC_AL, tauAppliedPa: 50e6, count: 3 };
  const res3 = solvePileupEquilibrium(in3);
  const L3 = res3.positionsM[2];
  const nApprox3 = computeEfnAsymptoticCount(L3, 50e6, MU_AL, NU_AL, B_FCC_AL);
  const ratio3 = nApprox3 / 3.0;
  near(ratio3, 0.3943, 0.02, "N=3 finite-size ratio");

  // Larger N=30
  const in30 = { muPa: MU_AL, nu: NU_AL, burgersM: B_FCC_AL, tauAppliedPa: 50e6, count: 30 };
  const res30 = solvePileupEquilibrium(in30);
  const L30 = res30.positionsM[29];
  const nApprox30 = computeEfnAsymptoticCount(L30, 50e6, MU_AL, NU_AL, B_FCC_AL);
  const ratio30 = nApprox30 / 30.0;
  assert.ok(ratio30 > 0.80 && ratio30 < 0.90, `N=30 asymptotic ratio: ${ratio30}`);
  assert.ok(ratio30 > ratio3, "Monotonic asymptotic approach");
});

test("solver inadequate iteration budget flags max_iterations_exceeded", () => {
  const perturbedInitial = [0.0, 1e-8, 2e-8, 4e-8, 8e-8];
  const inputs = {
    muPa: MU_AL,
    nu: NU_AL,
    burgersM: B_FCC_AL,
    tauAppliedPa: 50e6,
    count: 5,
    initialPositionsM: perturbedInitial,
    maxIterations: 1,
  };
  const res = solvePileupEquilibrium(inputs);
  assert.equal(res.converged, false);
  assert.equal(res.status, "max_iterations_exceeded");
});
