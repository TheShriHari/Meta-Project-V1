/**
 * web/tests/phase6_parity.test.mjs - Cross-runtime golden parity tests between Python
 * reference (`tests/golden/phase6_fixtures.json`) and TypeScript (`web/src/core/hallpetch.ts`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  solvePileupWithSource,
  findYieldOnset,
  runHallPetchSweep,
} from "../src/core/hallpetch.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../../tests/golden/phase6_fixtures.json");

test("Phase 6 Cross-Runtime Golden Parity: Source Shut-Off", () => {
  const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  for (const c of data.source_shutoff_cases) {
    const inp = c.inputs;
    const exp = c.expected;
    const res = solvePileupWithSource({
      muPa: inp.mu_pa,
      nu: inp.nu,
      burgersM: inp.burgers_m,
      tauEffPa: inp.tau_eff_pa,
      sourceDistanceM: inp.source_distance_m,
      tauSrcPa: inp.tau_src_pa,
    });

    assert.equal(res.count, exp.count, `Count mismatch in ${c.id}`);
    assert.ok(
      Math.abs(res.tipStressPa - exp.tip_stress_pa) / exp.tip_stress_pa < 1e-12,
      `Tip stress mismatch in ${c.id}`
    );
    assert.ok(
      Math.abs(res.backStressPa - exp.back_stress_pa) / exp.back_stress_pa < 1e-11,
      `Back stress mismatch in ${c.id}`
    );
    assert.equal(res.positionsM.length, exp.positions_m.length);
    for (let i = 0; i < res.positionsM.length; i++) {
      assert.ok(
        Math.abs(res.positionsM[i] - exp.positions_m[i]) < 1e-13,
        `Position ${i} mismatch in ${c.id}`
      );
    }
  }
});

test("Phase 6 Cross-Runtime Golden Parity: Yield-Onset Bisection (5 cases)", () => {
  const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  for (const c of data.yield_onset_cases) {
    const inp = c.inputs;
    const exp = c.expected;
    const res = findYieldOnset({
      muPa: inp.mu_pa,
      nu: inp.nu,
      burgersM: inp.burgers_m,
      grainSizeM: inp.grain_size_m,
      tauStarRefPa: inp.tau_star_ref_pa,
      mPrime: inp.m_prime,
      beta: inp.beta,
      tauCPa: inp.tau_c_pa,
      taylorFactor: inp.taylor_factor,
      sigma0OffsetPa: inp.sigma_0_offset_pa,
    });

    assert.equal(res.criticalCount, exp.critical_count, `Critical count mismatch in ${c.id}`);
    assert.ok(
      Math.abs(res.tauEffCritPa - exp.tau_eff_crit_pa) / exp.tau_eff_crit_pa < 1e-9,
      `tauEffCritPa mismatch in ${c.id}`
    );
    assert.ok(
      Math.abs(res.sigmaYPa - exp.sigma_y_pa) / exp.sigma_y_pa < 1e-9,
      `sigmaYPa mismatch in ${c.id}`
    );
  }
});

test("Phase 6 Cross-Runtime Golden Parity: Hall-Petch Sweep, OLS Fit & Seeded Bootstrap CI", () => {
  const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  const inp = data.sweep_case.inputs;
  const exp = data.sweep_case.expected;

  const res = runHallPetchSweep({
    muPa: inp.mu_pa,
    nu: inp.nu,
    burgersM: inp.burgers_m,
    tauCPa: inp.tau_c_pa,
    taylorFactor: inp.taylor_factor,
    tauStarRefPa: inp.tau_star_ref_pa,
    grainSizesM: inp.grain_sizes_m,
    sigma0OffsetPa: inp.sigma_0_offset_pa,
    bootstrapSamples: inp.bootstrap_samples,
    seed: inp.seed,
  });

  assert.ok(
    Math.abs(res.fittedKyPaM05 - exp.fitted_k_y_pa_m05) / exp.fitted_k_y_pa_m05 < 1e-9,
    "fittedKyPaM05 parity mismatch"
  );
  assert.ok(
    Math.abs(res.fittedSigma0Pa - exp.fitted_sigma_0_pa) / exp.fitted_sigma_0_pa < 1e-9,
    "fittedSigma0Pa parity mismatch"
  );
  assert.ok(
    Math.abs(res.logLogSlope - exp.log_log_slope) < 1e-9,
    "logLogSlope parity mismatch"
  );
  assert.ok(
    Math.abs(res.kyCi95LowPaM05 - exp.k_y_ci95_low_pa_m05) / exp.k_y_ci95_low_pa_m05 < 1e-9,
    "Bootstrap CI low parity mismatch"
  );
  assert.ok(
    Math.abs(res.kyCi95HighPaM05 - exp.k_y_ci95_high_pa_m05) / exp.k_y_ci95_high_pa_m05 < 1e-9,
    "Bootstrap CI high parity mismatch"
  );
  assert.equal(res.v09Passed, exp.v09_passed);
  assert.equal(res.v10Passed, exp.v10_passed);
});
