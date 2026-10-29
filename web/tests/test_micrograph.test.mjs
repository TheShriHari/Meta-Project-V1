/**
 * web/tests/test_micrograph.test.mjs - Unit tests for web/src/core/micrograph.ts (V-16 & chord import).
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeChordStats,
  rescaleChords,
  parseUserChordDataset,
  evaluateChordEnsembleHallPetch,
  BUILTIN_MICROGRAPH_PRESETS,
} from "../src/core/micrograph.ts";
import { CALIBRATED_MATERIALS } from "../src/core/hallpetch.ts";

test("rescaleChords satisfies V-16: target mean within 1e-9 and CV invariant within 1e-12", () => {
  const rawChordsM = [12e-6, 18e-6, 25e-6, 31e-6, 42e-6, 15e-6, 22e-6, 29e-6];
  const rawStats = computeChordStats(rawChordsM);

  for (const targetUm of [10.0, 35.0, 95.0]) {
    const targetM = targetUm * 1e-6;
    const rescaled = rescaleChords(rawChordsM, targetM);
    const relMeanErr = Math.abs(rescaled.meanM - targetM) / targetM;
    assert.ok(relMeanErr <= 1e-9, `Expected relMeanErr <= 1e-9, got ${relMeanErr}`);
    assert.ok(
      Math.abs(rescaled.cv - rawStats.cv) <= 1e-12,
      `Expected CV difference <= 1e-12, got ${Math.abs(rescaled.cv - rawStats.cv)}`
    );
  }
});

test("parseUserChordDataset parses both JSON and CSV chord files in meters or micrometers", () => {
  const jsonText = JSON.stringify({
    name: "Custom Al Sample",
    unit: "um",
    chords: [20.0, 25.0, 30.0, 35.0, 40.0],
  });
  const parsedJson = parseUserChordDataset(jsonText, "sample.json");
  assert.equal(parsedJson.chordsM.length, 5);
  assert.ok(Math.abs(parsedJson.stats.meanM - 30.0e-6) < 1e-12);

  const csvText = "chord_um\n15.0\n25.0\n35.0\n45.0\n";
  const parsedCsv = parseUserChordDataset(csvText, "chords.csv");
  assert.equal(parsedCsv.chordsM.length, 4);
  assert.ok(Math.abs(parsedCsv.stats.meanM - 30.0e-6) < 1e-12);
});

test("evaluateChordEnsembleHallPetch computes chord-by-chord and mean-intercept yield stress", () => {
  const al = CALIBRATED_MATERIALS.aluminium;
  const chordsM = [18e-6, 24e-6, 30e-6, 36e-6, 42e-6];
  const res = evaluateChordEnsembleHallPetch({
    chordsM,
    muPa: al.muPa,
    nu: al.nu,
    burgersM: al.burgersM,
    tauCPa: al.tauCPa,
    taylorFactor: al.taylorFactor,
    tauStarRefPa: al.calibratedTauStarRefPa,
    sigma0OffsetPa: al.calibrationFit.sigma0Pa,
  });
  assert.ok(res.ensembleMeanSigmaYPa > al.calibrationFit.sigma0Pa);
  assert.ok(res.meanInterceptSigmaYPa > al.calibrationFit.sigma0Pa);
  assert.equal(res.chordYieldsPa.length, 5);
});

test("BUILTIN_MICROGRAPH_PRESETS provides all 5 presets and parseUserChordDataset rejects invalid inputs", () => {
  for (const key of ["aluminium", "copper", "pure_iron", "ferritic_steel", "synthetic_voronoi_30um"]) {
    const preset = BUILTIN_MICROGRAPH_PRESETS[key];
    assert.ok(preset, `Missing preset ${key}`);
    assert.ok(preset.grains.length >= 16);
    assert.ok(preset.interceptLines.length >= 4);
    assert.ok(preset.chordsM.length >= 10);
    assert.ok(preset.stats.meanM > 0);
  }
  assert.throws(() => parseUserChordDataset(""), /empty/i);
  assert.throws(() => parseUserChordDataset(JSON.stringify({ chords: [-5, 10] })), /Non-positive/i);
});
