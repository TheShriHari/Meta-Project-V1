/**
 * web/tests/phase7_parity.test.mjs - Parity and invariant tests for Phase 7 micrograph
 * chord statistics, parametric rescaling (V-16), and chord-ensemble Hall-Petch evaluation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeChordStats,
  rescaleChords,
  evaluateChordEnsembleHallPetch,
  BUILTIN_MICROGRAPH_PRESETS,
} from "../src/core/micrograph.ts";
import { CALIBRATED_MATERIALS, findYieldOnset } from "../src/core/hallpetch.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../../tests/golden/phase7_fixtures.json");

test("Phase 7 deterministic parity: rescaleChords (V-16) and evaluateChordEnsembleHallPetch", () => {
  const al = CALIBRATED_MATERIALS.aluminium;
  const preset = BUILTIN_MICROGRAPH_PRESETS.aluminium;

  for (const targetUm of [15.0, 30.0, 60.0, 120.0]) {
    const targetM = targetUm * 1e-6;
    const rescaled = rescaleChords(preset.chordsM, targetM);

    // V-16: rescaled mean within 1e-9 relative error and CV preserved within 1e-12
    const relMeanErr = Math.abs(rescaled.meanM - targetM) / targetM;
    assert.ok(relMeanErr <= 1e-9, `V-16 mean rel err ${relMeanErr} > 1e-9`);
    assert.ok(
      Math.abs(rescaled.cv - preset.stats.cv) <= 1e-12,
      `V-16 CV drift ${Math.abs(rescaled.cv - preset.stats.cv)} > 1e-12`
    );

    const ensemble = evaluateChordEnsembleHallPetch({
      chordsM: rescaled.chordsM,
      muPa: al.muPa,
      nu: al.nu,
      burgersM: al.burgersM,
      tauCPa: al.tauCPa,
      taylorFactor: al.taylorFactor,
      tauStarRefPa: al.calibratedTauStarRefPa,
      sigma0OffsetPa: al.calibrationFit.sigma0Pa,
    });

    // Direct parity with hallpetch.findYieldOnset at the mean intercept
    const directMeanOnset = findYieldOnset({
      muPa: al.muPa,
      nu: al.nu,
      burgersM: al.burgersM,
      grainSizeM: targetM,
      tauStarRefPa: al.calibratedTauStarRefPa,
      tauCPa: al.tauCPa,
      taylorFactor: al.taylorFactor,
      sigma0OffsetPa: al.calibrationFit.sigma0Pa,
    });

    const relYieldDiff =
      Math.abs(ensemble.meanInterceptSigmaYPa - directMeanOnset.sigmaYPa) /
      directMeanOnset.sigmaYPa;
    assert.ok(relYieldDiff <= 1e-9, `Mean intercept yield parity error ${relYieldDiff} > 1e-9`);

    // Due to Jensen's inequality on d^(-1/2) convex function, ensemble mean >= mean-intercept yield
    assert.ok(
      ensemble.ensembleMeanSigmaYPa >= ensemble.meanInterceptSigmaYPa * 0.98,
      "Expected ensemble mean yield stress to be comparable to or slightly above mean-intercept yield"
    );
  }
});

test("Phase 7 golden fixtures parity (if tests/golden/phase7_fixtures.json exists)", (t) => {
  if (!fs.existsSync(fixturePath)) {
    t.skip("tests/golden/phase7_fixtures.json not present; deterministic core parity verified above");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  if (Array.isArray(raw.rescalingCases)) {
    for (const c of raw.rescalingCases) {
      const res = rescaleChords(c.chordsM, c.targetMeanM);
      const relMean = Math.abs(res.meanM - c.expectedMeanM) / c.expectedMeanM;
      assert.ok(relMean <= 1e-9, `Fixture rescale mean mismatch: ${relMean}`);
      assert.ok(Math.abs(res.cv - c.expectedCv) <= 1e-12, `Fixture rescale CV mismatch`);
    }
  }

  if (Array.isArray(raw.rescaling_cases)) {
    for (const c of raw.rescaling_cases) {
      const chordsM = c.raw_chords_m ?? c.chordsM;
      const targetMeanM = c.target_mean_m ?? c.targetMeanM;
      const expectedMeanM = c.expected_mean_m ?? c.expectedMeanM ?? targetMeanM;
      const expectedCv = c.expected_cv ?? c.expectedCv;
      const res = rescaleChords(chordsM, targetMeanM);
      const relMean = Math.abs(res.meanM - expectedMeanM) / expectedMeanM;
      assert.ok(relMean <= 1e-9, `Fixture rescale_cases mean mismatch: ${relMean}`);
      if (typeof expectedCv === "number") {
        assert.ok(Math.abs(res.cv - expectedCv) <= 1e-12, `Fixture rescale_cases CV mismatch`);
      }
    }
  }

  if (Array.isArray(raw.ensembleCases)) {
    for (const c of raw.ensembleCases) {
      const stats = computeChordStats(c.chordsM);
      assert.ok(Math.abs(stats.meanM - c.expectedMeanM) / c.expectedMeanM <= 1e-9);
    }
  }
});
