/**
 * web/tests/phase5_parity.test.mjs - Parity tests comparing TypeScript pile-up core with Python golden fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  solvePileupEquilibrium,
  computeEfnExactPositions,
  computePileupPrefactor,
} from "../src/core/pileup.ts";

const fixtures = JSON.parse(fs.readFileSync("tests/golden/phase5_fixtures.json", "utf-8"));

const near = (a, b, tol = 1e-12, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: actual=${a}, expected=${b}, diff=${Math.abs(a - b)}`);

test("parity case 1: small pile-up N=3 (Al)", () => {
  const c = fixtures.case1_small_pileup_n3;
  const inputs = {
    muPa: c.mu_pa,
    nu: c.nu,
    burgersM: c.burgers_m,
    tauAppliedPa: c.tau_applied_pa,
    count: c.count,
  };
  const res = solvePileupEquilibrium(inputs);

  assert.equal(res.status, "converged");
  assert.equal(res.converged, true);
  assert.equal(res.positionsM.length, c.count);

  for (let i = 0; i < c.count; i++) {
    near(res.positionsM[i], c.positions_m[i], 1e-14, `Position index ${i}`);
  }
  for (let i = 0; i < res.residualsPa.length; i++) {
    near(res.residualsPa[i], c.residuals_pa[i], 1e-6, `Residual index ${i}`);
  }
  near(res.tipStressPa, c.tip_stress_pa, 1e-6, "Tip stress");
  near(res.pileupLengthM, c.pileup_length_m, 1e-14, "Pileup length");
});

test("parity case 2: medium pile-up N=8 (Al)", () => {
  const c = fixtures.case2_medium_pileup_n8;
  const inputs = {
    muPa: c.mu_pa,
    nu: c.nu,
    burgersM: c.burgers_m,
    tauAppliedPa: c.tau_applied_pa,
    count: c.count,
  };
  const res = solvePileupEquilibrium(inputs);

  assert.equal(res.status, "converged");
  assert.equal(res.converged, true);
  assert.equal(res.positionsM.length, c.count);

  for (let i = 0; i < c.count; i++) {
    near(res.positionsM[i], c.positions_m[i], 1e-13, `Position index ${i}`);
  }
  for (let i = 0; i < res.residualsPa.length; i++) {
    near(res.residualsPa[i], c.residuals_pa[i], 1e-5, `Residual index ${i}`);
  }
  near(res.tipStressPa, c.tip_stress_pa, 1e-6, "Tip stress");
  near(res.pileupLengthM, c.pileup_length_m, 1e-13, "Pileup length");
});

test("parity case 3: copper pile-up N=15 (Cu)", () => {
  const c = fixtures.case3_copper_pileup_n15;
  const inputs = {
    muPa: c.mu_pa,
    nu: c.nu,
    burgersM: c.burgers_m,
    tauAppliedPa: c.tau_applied_pa,
    count: c.count,
  };
  const res = solvePileupEquilibrium(inputs);

  assert.equal(res.status, "converged");
  assert.equal(res.converged, true);
  assert.equal(res.positionsM.length, c.count);

  for (let i = 0; i < c.count; i++) {
    near(res.positionsM[i], c.positions_m[i], 1e-12, `Position index ${i}`);
  }
  for (let i = 0; i < res.residualsPa.length; i++) {
    near(res.residualsPa[i], c.residuals_pa[i], 1e-4, `Residual index ${i}`);
  }
  near(res.tipStressPa, c.tip_stress_pa, 1e-6, "Tip stress");
  near(res.pileupLengthM, c.pileup_length_m, 1e-12, "Pileup length");
});

test("parity case 4: high stress pile-up N=25 (Al)", () => {
  const c = fixtures.case4_high_stress_pileup_n25;
  const inputs = {
    muPa: c.mu_pa,
    nu: c.nu,
    burgersM: c.burgers_m,
    tauAppliedPa: c.tau_applied_pa,
    count: c.count,
  };
  const res = solvePileupEquilibrium(inputs);

  assert.equal(res.status, "converged");
  assert.equal(res.converged, true);
  assert.equal(res.positionsM.length, c.count);

  for (let i = 0; i < c.count; i++) {
    near(res.positionsM[i], c.positions_m[i], 1e-12, `Position index ${i}`);
  }
  for (let i = 0; i < res.residualsPa.length; i++) {
    near(res.residualsPa[i], c.residuals_pa[i], 1e-4, `Residual index ${i}`);
  }
  near(res.tipStressPa, c.tip_stress_pa, 1e-6, "Tip stress");
  near(res.pileupLengthM, c.pileup_length_m, 1e-12, "Pileup length");
});

test("parity case 5: damped Newton solve from perturbed initial guess N=4", () => {
  const c = fixtures.case5_newton_perturbed_n4;
  const inputs = {
    muPa: c.mu_pa,
    nu: c.nu,
    burgersM: c.burgers_m,
    tauAppliedPa: c.tau_applied_pa,
    count: c.count,
    tolerancePa: c.tolerance_pa,
    maxIterations: 50,
    initialPositionsM: c.initial_positions_m,
  };
  const res = solvePileupEquilibrium(inputs);

  assert.equal(res.status, c.status);
  assert.equal(res.converged, c.converged);
  assert.equal(res.iterations, c.iterations);

  for (let i = 0; i < c.count; i++) {
    near(res.positionsM[i], c.positions_m[i], 1e-12, `Position index ${i}`);
  }
  near(res.maxResidualPa, c.max_residual_pa, 1e-3, "Max residual");
});
