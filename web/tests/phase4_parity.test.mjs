/**
 * web/tests/phase4_parity.test.mjs - Parity tests comparing TypeScript boundary core with Python golden fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { evaluateBoundaryTransmission } from "../src/core/boundary.ts";
import { calculateBurgersMagnitude } from "../src/core/slipsystems.ts";

const A_FCC = 4.0495e-10;
const B_FCC = calculateBurgersMagnitude(A_FCC, "FCC");

const fixtures = JSON.parse(fs.readFileSync("tests/golden/phase4_fixtures.json", "utf-8"));

const near = (a, b, tol = 1e-12, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: actual=${a}, expected=${b}, diff=${Math.abs(a - b)}`);

test("parity case 1: identical orientations transmitted", () => {
  const c = fixtures.case1_identical;
  const t = c.thresholds;
  const res = evaluateBoundaryTransmission(
    0,
    c.R_in,
    c.R_out,
    B_FCC,
    c.sigma,
    c.tau_tip,
    {
      mPrimeMin: t.m_prime_min,
      tauCPa: t.tau_c_pa,
      tauStarRefPa: t.tau_star_ref_pa,
      beta: t.beta,
    }
  );

  assert.equal(res.outcome, c.result.outcome);
  assert.equal(res.incomingSystemIndex, c.result.incoming_system_index);
  assert.ok(res.selectedCandidate !== null);
  assert.equal(res.selectedCandidate?.systemIndex, c.result.selected_candidate.system_index);

  near(res.selectedCandidate?.mPrime ?? 0, c.result.selected_candidate.m_prime, 1e-12);
  near(res.selectedCandidate?.residualBM ?? 1, c.result.selected_candidate.residual_b_m, 1e-15);
  near(res.selectedCandidate?.tauOutPa ?? 0, c.result.selected_candidate.tau_out_pa, 1e-6);
  near(res.selectedCandidate?.tauStarPa ?? 0, c.result.selected_candidate.tau_star_pa, 1e-6);

  assert.equal(res.candidates.length, c.result.candidates.length);
  for (let i = 0; i < res.candidates.length; i++) {
    near(res.candidates[i].mPrime, c.result.candidates[i].m_prime, 1e-12);
    near(res.candidates[i].residualBM, c.result.candidates[i].residual_b_m, 1e-12);
    near(res.candidates[i].tauOutPa, c.result.candidates[i].tau_out_pa, 1e-6);
    assert.equal(res.candidates[i].passedAll, c.result.candidates[i].passed_all);
  }
});

test("parity case 2: misoriented grain transmission", () => {
  const c = fixtures.case2_misoriented;
  const t = c.thresholds;
  const res = evaluateBoundaryTransmission(
    3,
    c.R_in,
    c.R_out,
    B_FCC,
    c.sigma,
    c.tau_tip,
    {
      mPrimeMin: t.m_prime_min,
      tauCPa: t.tau_c_pa,
      tauStarRefPa: t.tau_star_ref_pa,
      beta: t.beta,
    }
  );

  assert.equal(res.outcome, c.result.outcome);
  assert.equal(res.selectedCandidate?.systemIndex, c.result.selected_candidate?.system_index);
  near(res.selectedCandidate?.mPrime ?? 0, c.result.selected_candidate?.m_prime ?? 0, 1e-12);
  near(res.selectedCandidate?.tauOutPa ?? 0, c.result.selected_candidate?.tau_out_pa ?? 0, 1e-6);
});

test("parity case 3: pinned outcome", () => {
  const c = fixtures.case3_pinned;
  const t = c.thresholds;
  const res = evaluateBoundaryTransmission(
    3,
    c.R_in,
    c.R_out,
    B_FCC,
    c.sigma,
    c.tau_tip,
    {
      mPrimeMin: t.m_prime_min,
      tauCPa: t.tau_c_pa,
      tauStarRefPa: t.tau_star_ref_pa,
      beta: t.beta,
    }
  );

  assert.equal(res.outcome, "pinned");
  assert.equal(res.selectedCandidate, null);
  for (let i = 0; i < res.candidates.length; i++) {
    assert.equal(res.candidates[i].passedAll, false);
  }
});

test("parity case 4: unresolved threshold outcome", () => {
  const c = fixtures.case4_unresolved;
  const t = c.thresholds;
  const res = evaluateBoundaryTransmission(
    3,
    c.R_in,
    c.R_out,
    B_FCC,
    c.sigma,
    c.tau_tip,
    {
      mPrimeMin: t.m_prime_min,
      tauCPa: t.tau_c_pa,
      tauStarRefPa: null,
      beta: t.beta,
    }
  );

  assert.equal(res.outcome, "unresolved_threshold");
  assert.equal(res.selectedCandidate, null);
  for (let i = 0; i < res.candidates.length; i++) {
    assert.equal(res.candidates[i].passedTauTip, null);
  }
});
