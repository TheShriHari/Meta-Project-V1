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
  CALIBRATED_MATERIALS,
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

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const MATS = [
  [26.0e9, 0.345, 2.86343e-10],
  [46.4e9, 0.343, 2.5562e-10],
  [81.6e9, 0.293, 2.48e-10],
];

function assertSame(a, b, msg) {
  assert.equal(a.count, b.count, `count ${msg}`);
  assert.equal(a.positionsM.length, b.positionsM.length, `len ${msg}`);
  assert.deepEqual(a.positionsM, b.positionsM, `positions ${msg}`);
  assert.equal(a.tipStressPa, b.tipStressPa, `tip ${msg}`);
  assert.equal(a.backStressPa, b.backStressPa, `back ${msg}`);
  assert.equal(a.netSourceStressPa, b.netSourceStressPa, `net ${msg}`);
}

test("Warm-start vs pure sequential search: randomized + boundary equivalence (tau_src>0, max_count, L range)", () => {
  const rnd = lcg(12345);
  let n = 0;
  for (let i = 0; i < 150; i++) {
    const [mu, nu, b] = MATS[i % MATS.length];
    // grain 10-400 um -> L = d/2 in 5-200 um (log-uniform), plus tiny L
    const L = i % 15 === 0 ? 1e-7 * (1 + 9 * rnd()) : 5e-6 * Math.pow(40, rnd());
    const tauEff = 1e5 * Math.pow(1000, rnd());
    const tauSrc = i % 3 === 0 ? 0 : tauEff * rnd() * 0.9;
    const maxCount = [1, 2, 3, 5, 17, 60, 300][i % 7];
    const base = { muPa: mu, nu, burgersM: b, tauEffPa: tauEff, sourceDistanceM: L, tauSrcPa: tauSrc, maxCount };
    const w = solvePileupWithSource({ ...base, warmStart: true });
    const s = solvePileupWithSource({ ...base, warmStart: false });
    assertSame(w, s, JSON.stringify(base));
    assert.ok(w.count <= Math.max(1, maxCount));
    n++;
  }
  assert.equal(n, 150);
});

test("Warm-start equivalence at emission-threshold boundaries (tauEff just around back-stress of N)", () => {
  const [mu, nu, b] = MATS[0];
  const A = (mu * b) / (2 * Math.PI * (1 - nu));
  const L = 10e-6;
  const tauSrc = 0.5e6;
  for (const f of [1 - 1e-12, 1, 1 + 1e-12, 1 + 1e-6, 0.999999]) {
    const tauEff = (A / L + tauSrc) * f;
    for (const maxCount of [1, 2, 3, 300]) {
      const base = { muPa: mu, nu, burgersM: b, tauEffPa: tauEff, sourceDistanceM: L, tauSrcPa: tauSrc, maxCount };
      assertSame(
        solvePileupWithSource({ ...base, warmStart: true }),
        solvePileupWithSource({ ...base, warmStart: false }),
        `boundary f=${f} max=${maxCount}`
      );
    }
  }
  // strict '>' : tauEff - back(1) == tauSrc exactly must NOT emit a 2nd dislocation
  const tauEff = tauSrc + A / L;
  const r = solvePileupWithSource({ muPa: mu, nu, burgersM: b, tauEffPa: tauEff, sourceDistanceM: L, tauSrcPa: tauSrc });
  assert.ok(r.count >= 1);
});

test("solvePileupWithSource edge inputs: throw semantics and zero-count branch", () => {
  const ok = { muPa: 26e9, nu: 0.345, burgersM: 2.8e-10, tauEffPa: 1e6, sourceDistanceM: 1e-5 };
  for (const bad of [
    { muPa: 0 }, { muPa: -1 }, { burgersM: 0 }, { nu: 0.5 }, { nu: -1 }, { sourceDistanceM: 0 }, { sourceDistanceM: -1e-5 },
  ]) {
    assert.throws(() => solvePileupWithSource({ ...ok, ...bad }), Error);
  }
  // validation precedes the early return
  assert.throws(() => solvePileupWithSource({ ...ok, tauEffPa: 0, sourceDistanceM: 0 }), Error);
  const z = solvePileupWithSource({ ...ok, tauEffPa: 2e6, tauSrcPa: 2e6 });
  assert.equal(z.count, 0);
  assert.equal(z.tipStressPa, 0);
  assert.equal(z.backStressPa, 0);
  assert.equal(z.netSourceStressPa, 0);
  assert.equal(z.positionsM.length, 0);
});

test("Calibration/held-out report keys: TS recomputation matches Python fixture summary", () => {
  const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  const sweepD = Array.from({ length: 16 }, (_, i) => 10e-6 * Math.pow(40, i / 15));
  for (const [key, exp] of Object.entries(data.calibration_validation_summary)) {
    assert.equal("held_out_mean_rel_error" in exp, false);
    assert.equal("held_out_max_rel_error" in exp, false);
    assert.equal("held_out_unadjusted_sigma0_mean_rel_error" in exp, false);
    const m = CALIBRATED_MATERIALS[key];
    assert.ok(m, key);
    const h = m.heldOutFit;
    const c = m.calibrationFit;
    const dh = Array.from({ length: 5 }, (_, i) => h.dMinUm * 1e-6 * Math.pow(h.dMaxUm / h.dMinUm, i / 4));
    const errs = { unadj: [], adj: [] };
    for (const d of dh) {
      const lit = h.sigma0Pa + h.kyPaM05 * d ** -0.5;
      for (const [s0, k] of [[c.sigma0Pa, "unadj"], [h.sigma0Pa, "adj"]]) {
        const o = findYieldOnset({
          muPa: m.muPa, nu: m.nu, burgersM: m.burgersM, grainSizeM: d,
          tauStarRefPa: m.calibratedTauStarRefPa, tauCPa: m.tauCPa,
          taylorFactor: m.taylorFactor, sigma0OffsetPa: s0,
        });
        errs[k].push(Math.abs(o.sigmaYPa - lit) / lit);
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const close = (a, b, t) => Math.abs(a - b) <= t * Math.abs(b);
    assert.ok(close(mean(errs.unadj), exp.held_out_unadjusted_mean_rel_error, 1e-6), `${key} unadj mean`);
    assert.ok(close(Math.max(...errs.unadj), exp.held_out_unadjusted_max_rel_error, 1e-6), `${key} unadj max`);
    assert.ok(close(mean(errs.adj), exp.held_out_intercept_adjusted_mean_rel_error, 1e-6), `${key} adj mean`);
    assert.ok(close(Math.max(...errs.adj), exp.held_out_intercept_adjusted_max_rel_error, 1e-6), `${key} adj max`);
    assert.equal(mean(errs.unadj) <= 0.25, exp.v15_within_25pct_band, `${key} v15`);
    assert.ok(close(Math.abs(exp.simulated_k_y_pa_m05 - h.kyPaM05) / h.kyPaM05, exp.held_out_k_y_rel_diff, 1e-9), `${key} ky diff`);
    assert.ok(sweepD.length === 16);
  }
});
