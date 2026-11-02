/**
 * web/tests/test_micrograph.test.mjs - Unit tests for web/src/core/micrograph.ts (V-16 & chord import).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeChordStats,
  rescaleChords,
  parseUserChordDataset,
  parseSegmentedMicrographFixture,
  evaluateChordEnsembleHallPetch,
  BUILTIN_MICROGRAPH_PRESETS,
} from "../src/core/micrograph.ts";
import { CALIBRATED_MATERIALS } from "../src/core/hallpetch.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

test("parseSegmentedMicrographFixture parses all 5 real segmented fixtures and enforces exact image-specific counts", () => {
  const expectedCounts = {
    aluminium: { chords: 963, crossings: 932, astmUm: 8.112, chordUm: 7.847 },
    copper: { chords: 1044, crossings: 1011, astmUm: 17.267, chordUm: 16.717 },
    ferritic_steel: { chords: 1301, crossings: 1129, astmUm: 13.139, chordUm: 11.368 },
    pure_iron: { chords: 855, crossings: 817, astmUm: 7.599, chordUm: 7.261 },
    synthetic_voronoi_30um: { chords: 231, crossings: 215, astmUm: 27.907, chordUm: 25.965 },
  };

  for (const [key, exp] of Object.entries(expectedCounts)) {
    const filePath = path.resolve(__dirname, `../public/data/micrographs/${key}.json`);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const parsed = parseSegmentedMicrographFixture(raw);
    assert.equal(parsed.key, key);
    // The synthetic Voronoi verification target is NOT a real micrograph measurement.
    assert.equal(parsed.isRealSegmentedFixture, key !== "synthetic_voronoi_30um");
    assert.ok(parsed.grains.length >= 70, `Expected >= 70 segmented grains for ${key}`);

    // Exact pipeline counts and complete chord population (no [:250] truncation slice)
    assert.equal(parsed.chordsM.length, exp.chords, `Expected ${exp.chords} chords for ${key}, got ${parsed.chordsM.length}`);
    assert.equal(parsed.populationStats?.totalChords, exp.chords);
    assert.equal(parsed.populationStats?.totalCrossings, exp.crossings);
    assert.equal(parsed.populationStats?.astmMeanInterceptUm, exp.astmUm);
    assert.equal(parsed.populationStats?.chordMeanUm, exp.chordUm);

    // Enriched population statistics presence
    assert.ok(parsed.populationStats?.stdInterceptUm != null && parsed.populationStats.stdInterceptUm > 0);
    assert.ok(parsed.populationStats?.chordCv != null && parsed.populationStats.chordCv > 0);
    assert.ok(parsed.populationStats?.p10Um != null && parsed.populationStats.p10Um > 0);
    assert.ok(parsed.populationStats?.p50Um != null && parsed.populationStats.p50Um > 0);
    assert.ok(parsed.populationStats?.p90Um != null && parsed.populationStats.p90Um > 0);
    assert.ok(parsed.populationStats?.totalLineLengthUm != null && parsed.populationStats.totalLineLengthUm > 0);
  }
});
