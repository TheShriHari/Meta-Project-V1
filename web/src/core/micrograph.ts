/**
 * web/src/core/micrograph.ts - Micrograph chord statistics, parametric rescaling (V-16),
 * user chord dataset parser, and chord-ensemble Hall-Petch evaluation.
 * Pure TypeScript scientific core: zero UI, DOM, or renderer imports (NFR-04).
 */

import { findYieldOnset } from "./hallpetch.ts";

export interface ChordStats {
  count: number;
  meanM: number;
  stdM: number;
  cv: number;
  minM: number;
  maxM: number;
  medianM: number;
}

export interface RescaledChordResult {
  chordsM: number[];
  meanM: number;
  stdM: number;
  cv: number;
  scaleFactor: number;
}

export interface ParsedUserChordDataset {
  name: string;
  unit: "m" | "um";
  chordsM: number[];
  stats: ChordStats;
}

export interface ChordEnsembleHallPetchInputs {
  chordsM: number[];
  muPa: number;
  nu: number;
  burgersM: number;
  tauCPa: number;
  taylorFactor: number;
  tauStarRefPa: number;
  mPrime?: number;
  beta?: number;
  sigma0OffsetPa?: number | null;
}

export interface ChordEnsembleHallPetchResult {
  chordYieldsPa: number[];
  ensembleMeanSigmaYPa: number;
  ensembleStdSigmaYPa: number;
  meanInterceptSigmaYPa: number;
  meanChordM: number;
  cv: number;
}

export interface MicrographGrainPolygon {
  id: number;
  verticesUm: [number, number][];
  centroidUm: [number, number];
  areaUm2: number;
  equivalentDiameterUm: number;
  eulerDeg: [number, number, number];
  slipTraceAngleDeg: number;
  phase: "alpha-Al" | "alpha-Cu" | "Ferrite" | "Synthetic";
  isTwinExcluded?: boolean;
  isPearliteMasked?: boolean;
}

export interface MicrographInterceptLine {
  id: string;
  positionUm: number;
  orientation: "horizontal" | "vertical";
  crossingsUm: [number, number][];
  segmentChordsUm: number[];
}

export interface MicrographPreset {
  key: string;
  name: string;
  materialKey: string;
  source: string;
  licenseNote: string;
  methodologyNote: string;
  widthUm: number;
  heightUm: number;
  scaleBarUm: number;
  pxPerUm: number;
  grains: MicrographGrainPolygon[];
  interceptLines: MicrographInterceptLine[];
  chordsM: number[];
  stats: ChordStats;
}

/**
 * Compute chord length summary statistics in meters.
 * Uses population standard deviation sqrt(mean((x - mean)^2)) to match NumPy np.std bit-for-bit.
 */
export function computeChordStats(chordsM: number[]): ChordStats {
  if (!Array.isArray(chordsM) || chordsM.length === 0) {
    throw new Error("chordsM must be a non-empty array of positive chord lengths");
  }
  const n = chordsM.length;
  let sum = 0.0;
  for (let i = 0; i < n; i++) {
    const v = chordsM[i];
    if (!Number.isFinite(v) || v <= 0.0) {
      throw new Error(`Invalid chord length at index ${i}: ${v} (must be positive finite)`);
    }
    sum += v;
  }
  const meanM = sum / n;
  let sqDiffSum = 0.0;
  for (let i = 0; i < n; i++) {
    const d = chordsM[i] - meanM;
    sqDiffSum += d * d;
  }
  const stdM = Math.sqrt(sqDiffSum / n);
  const cv = meanM > 0.0 ? stdM / meanM : 0.0;

  const sorted = [...chordsM].sort((a, b) => a - b);
  const minM = sorted[0];
  const maxM = sorted[n - 1];
  const mid = n >> 1;
  const medianM = n % 2 === 1 ? sorted[mid] : 0.5 * (sorted[mid - 1] + sorted[mid]);

  return {
    count: n,
    meanM,
    stdM,
    cv,
    minM,
    maxM,
    medianM,
  };
}

/**
 * Multiply chord lengths by targetMeanM / mean(chordsM) (Decision M3 / V-16).
 * Preserves the dimensionless shape distribution and coefficient of variation (CV).
 */
export function rescaleChords(chordsM: number[], targetMeanM: number): RescaledChordResult {
  if (!Number.isFinite(targetMeanM) || targetMeanM <= 0.0) {
    throw new Error(`targetMeanM must be positive and finite, got ${targetMeanM}`);
  }
  const rawStats = computeChordStats(chordsM);
  const scaleFactor = targetMeanM / rawStats.meanM;
  const rescaled = chordsM.map((c) => c * scaleFactor);
  const stats = computeChordStats(rescaled);

  return {
    chordsM: rescaled,
    meanM: stats.meanM,
    stdM: stats.stdM,
    cv: stats.cv,
    scaleFactor,
  };
}

/**
 * Parse a user-supplied JSON or CSV chord dataset string into SI meters.
 */
export function parseUserChordDataset(
  text: string,
  filename = "uploaded_chords"
): ParsedUserChordDataset {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Chord dataset file is empty");
  }

  const baseName = filename.replace(/\.[^.]+$/, "") || "Custom Chord Sample";

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Invalid JSON in chord dataset: ${(err as Error).message}`);
    }

    let rawValues: unknown[] = [];
    let unitHint: "m" | "um" | undefined;
    let customName = baseName;

    if (Array.isArray(parsed)) {
      rawValues = parsed;
    } else if (parsed !== null && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.name === "string" && obj.name.trim().length > 0) {
        customName = obj.name.trim();
      }
      if (obj.unit === "um" || obj.unit === "µm" || obj.unit === "μm") {
        unitHint = "um";
      } else if (obj.unit === "m") {
        unitHint = "m";
      }

      if (Array.isArray(obj.chords)) {
        rawValues = obj.chords;
      } else if (Array.isArray(obj.chordsUm)) {
        rawValues = obj.chordsUm;
        unitHint = "um";
      } else if (Array.isArray(obj.chords_um)) {
        rawValues = obj.chords_um;
        unitHint = "um";
      } else if (Array.isArray(obj.chordsM)) {
        rawValues = obj.chordsM;
        unitHint = "m";
      } else if (Array.isArray(obj.chords_m)) {
        rawValues = obj.chords_m;
        unitHint = "m";
      } else {
        throw new Error(
          "JSON chord object must contain a 'chords', 'chordsUm', or 'chordsM' array"
        );
      }
    }

    const nums = rawValues.map((v, idx) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0.0) {
        throw new Error(`Non-positive or non-numeric chord value at index ${idx}`);
      }
      return n;
    });
    if (nums.length === 0) {
      throw new Error("JSON chord dataset contains zero chords");
    }

    const rawMean = nums.reduce((a, b) => a + b, 0.0) / nums.length;
    const resolvedUnit: "m" | "um" = unitHint ?? (rawMean > 1e-2 ? "um" : "m");
    const factor = resolvedUnit === "um" ? 1e-6 : 1.0;
    const chordsM = nums.map((v) => v * factor);
    const stats = computeChordStats(chordsM);

    return {
      name: customName,
      unit: resolvedUnit,
      chordsM,
      stats,
    };
  }

  // CSV or newline/comma-delimited text
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0) {
    throw new Error("CSV chord dataset contains no data lines");
  }

  let unitHint: "m" | "um" | undefined;
  let startIdx = 0;
  const firstLineLower = lines[0].toLowerCase();
  if (/[a-z_]/.test(firstLineLower) && !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(firstLineLower.split(/[,\t;]/)[0].trim())) {
    startIdx = 1;
    if (
      firstLineLower.includes("um") ||
      firstLineLower.includes("µm") ||
      firstLineLower.includes("μm") ||
      firstLineLower.includes("micron")
    ) {
      unitHint = "um";
    } else if (firstLineLower.includes("_m") || firstLineLower.includes("(m)")) {
      unitHint = "m";
    }
  }

  const nums: number[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const tokens = lines[i].split(/[,\t;]+/).map((t) => t.trim()).filter((t) => t.length > 0);
    for (const tok of tokens) {
      const val = Number(tok);
      if (!Number.isFinite(val) || val <= 0.0) {
        throw new Error(`Invalid chord value '${tok}' on line ${i + 1}`);
      }
      nums.push(val);
    }
  }

  if (nums.length === 0) {
    throw new Error("No numeric chord values found in CSV dataset");
  }

  const rawMean = nums.reduce((a, b) => a + b, 0.0) / nums.length;
  const resolvedUnit: "m" | "um" = unitHint ?? (rawMean > 1e-2 ? "um" : "m");
  const factor = resolvedUnit === "um" ? 1e-6 : 1.0;
  const chordsM = nums.map((v) => v * factor);
  const stats = computeChordStats(chordsM);

  return {
    name: baseName,
    unit: resolvedUnit,
    chordsM,
    stats,
  };
}

/**
 * Evaluate the discrete pile-up Hall-Petch yield stress across an ensemble of chord lengths
 * and compare against the single mean-intercept evaluation (Decision M3).
 */
export function evaluateChordEnsembleHallPetch(
  inputs: ChordEnsembleHallPetchInputs
): ChordEnsembleHallPetchResult {
  const stats = computeChordStats(inputs.chordsM);
  const mPrime = inputs.mPrime ?? 1.0;
  const beta = inputs.beta ?? 0.0;

  const chordYieldsPa = inputs.chordsM.map((dM) => {
    const onset = findYieldOnset({
      muPa: inputs.muPa,
      nu: inputs.nu,
      burgersM: inputs.burgersM,
      grainSizeM: dM,
      tauStarRefPa: inputs.tauStarRefPa,
      mPrime,
      beta,
      tauCPa: inputs.tauCPa,
      taylorFactor: inputs.taylorFactor,
      sigma0OffsetPa: inputs.sigma0OffsetPa,
    });
    return onset.sigmaYPa;
  });

  const n = chordYieldsPa.length;
  let sumY = 0.0;
  for (let i = 0; i < n; i++) {
    sumY += chordYieldsPa[i];
  }
  const ensembleMeanSigmaYPa = sumY / n;

  let sqDiff = 0.0;
  for (let i = 0; i < n; i++) {
    const diff = chordYieldsPa[i] - ensembleMeanSigmaYPa;
    sqDiff += diff * diff;
  }
  const ensembleStdSigmaYPa = Math.sqrt(sqDiff / n);

  const meanOnset = findYieldOnset({
    muPa: inputs.muPa,
    nu: inputs.nu,
    burgersM: inputs.burgersM,
    grainSizeM: stats.meanM,
    tauStarRefPa: inputs.tauStarRefPa,
    mPrime,
    beta,
    tauCPa: inputs.tauCPa,
    taylorFactor: inputs.taylorFactor,
    sigma0OffsetPa: inputs.sigma0OffsetPa,
  });

  return {
    chordYieldsPa,
    ensembleMeanSigmaYPa,
    ensembleStdSigmaYPa,
    meanInterceptSigmaYPa: meanOnset.sigmaYPa,
    meanChordM: stats.meanM,
    cv: stats.cv,
  };
}

/**
 * Deterministic PRNG (Mulberry32) for reproducible synthetic Voronoi and grain orientation generation.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Clip a convex polygon against the half-plane of points closer to site A than site B:
 * (p - mid) . (B - A) <= 0.
 */
function clipPolygonHalfPlane(
  poly: [number, number][],
  ax: number,
  ay: number,
  bx: number,
  by: number
): [number, number][] {
  if (poly.length === 0) return [];
  const mx = 0.5 * (ax + bx);
  const my = 0.5 * (ay + by);
  const nx = bx - ax;
  const ny = by - ay;

  const inside = (p: [number, number]) => (p[0] - mx) * nx + (p[1] - my) * ny <= 1e-9;
  const intersect = (p1: [number, number], p2: [number, number]): [number, number] => {
    const d1 = (p1[0] - mx) * nx + (p1[1] - my) * ny;
    const d2 = (p2[0] - mx) * nx + (p2[1] - my) * ny;
    const denom = d1 - d2;
    if (Math.abs(denom) < 1e-15) return p1;
    const t = d1 / denom;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  };

  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) {
        out.push(intersect(prev, curr));
      }
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

function polygonAreaAndCentroid(poly: [number, number][]): {
  area: number;
  centroid: [number, number];
} {
  const n = poly.length;
  if (n < 3) return { area: 0.0, centroid: [0.0, 0.0] };
  let a2 = 0.0;
  let cx = 0.0;
  let cy = 0.0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const area = 0.5 * Math.abs(a2);
  if (area < 1e-12) return { area: 0.0, centroid: poly[0] };
  return {
    area,
    centroid: [cx / (3.0 * a2), cy / (3.0 * a2)],
  };
}

interface PresetBuilderSpec {
  key: string;
  name: string;
  materialKey: string;
  source: string;
  licenseNote: string;
  methodologyNote: string;
  widthUm: number;
  heightUm: number;
  scaleBarUm: number;
  pxPerUm: number;
  gridCols: number;
  gridRows: number;
  jitter: number;
  targetMeanUm: number;
  seed: number;
  phase: "alpha-Al" | "alpha-Cu" | "Ferrite" | "Synthetic";
  markTwins?: boolean;
  markPearlite?: boolean;
}

function buildVoronoiMicrographPreset(spec: PresetBuilderSpec): MicrographPreset {
  const rng = makeRng(spec.seed);
  const sites: [number, number][] = [];
  const cellW = spec.widthUm / spec.gridCols;
  const cellH = spec.heightUm / spec.gridRows;

  for (let r = 0; r < spec.gridRows; r++) {
    for (let c = 0; c < spec.gridCols; c++) {
      const sx = (c + 0.5 + (rng() - 0.5) * spec.jitter) * cellW;
      const sy = (r + 0.5 + (rng() - 0.5) * spec.jitter) * cellH;
      sites.push([
        Math.max(0.02 * spec.widthUm, Math.min(0.98 * spec.widthUm, sx)),
        Math.max(0.02 * spec.heightUm, Math.min(0.98 * spec.heightUm, sy)),
      ]);
    }
  }

  const baseBox: [number, number][] = [
    [0.0, 0.0],
    [spec.widthUm, 0.0],
    [spec.widthUm, spec.heightUm],
    [0.0, spec.heightUm],
  ];

  const grains: MicrographGrainPolygon[] = [];
  for (let i = 0; i < sites.length; i++) {
    let poly = baseBox;
    const [ax, ay] = sites[i];
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const [bx, by] = sites[j];
      poly = clipPolygonHalfPlane(poly, ax, ay, bx, by);
      if (poly.length === 0) break;
    }
    const { area, centroid } = polygonAreaAndCentroid(poly);
    const eqDiam = Math.sqrt((4.0 * area) / Math.PI);
    const phi1 = Math.round(rng() * 360);
    const Phi = Math.round(rng() * 90);
    const phi2 = Math.round(rng() * 90);
    const slipTraceAngleDeg = -75 + Math.round(rng() * 150);

    grains.push({
      id: i + 1,
      verticesUm: poly,
      centroidUm: centroid,
      areaUm2: area,
      equivalentDiameterUm: eqDiam,
      eulerDeg: [phi1, Phi, phi2],
      slipTraceAngleDeg,
      phase: spec.phase,
      isTwinExcluded: Boolean(spec.markTwins && i % 6 === 2),
      isPearliteMasked: Boolean(spec.markPearlite && i % 7 === 3),
    });
  }

  // Build ASTM E112 horizontal and vertical test lines
  const interceptLines: MicrographInterceptLine[] = [];
  const rawChordsUm: number[] = [];

  const hFractions = [0.2, 0.4, 0.6, 0.8];
  hFractions.forEach((frac, idx) => {
    const yUm = frac * spec.heightUm;
    const xSet: number[] = [0.0, spec.widthUm];
    for (const g of grains) {
      if (g.isPearliteMasked) continue;
      const verts = g.verticesUm;
      for (let e = 0; e < verts.length; e++) {
        const [x1, y1] = verts[e];
        const [x2, y2] = verts[(e + 1) % verts.length];
        if ((y1 <= yUm && y2 >= yUm) || (y2 <= yUm && y1 >= yUm)) {
          const dy = y2 - y1;
          if (Math.abs(dy) > 1e-9) {
            const t = (yUm - y1) / dy;
            if (t >= -1e-6 && t <= 1.0 + 1e-6) {
              const xCross = x1 + t * (x2 - x1);
              if (xCross > 1e-3 && xCross < spec.widthUm - 1e-3) {
                xSet.push(xCross);
              }
            }
          }
        }
      }
    }
    xSet.sort((a, b) => a - b);
    const dedupX: number[] = [xSet[0]];
    for (let k = 1; k < xSet.length; k++) {
      if (xSet[k] - dedupX[dedupX.length - 1] > 0.4) {
        dedupX.push(xSet[k]);
      }
    }
    const crossingsUm: [number, number][] = dedupX
      .slice(1, -1)
      .map((x) => [x, yUm]);
    const segmentChordsUm: number[] = [];
    for (let k = 1; k < dedupX.length; k++) {
      const seg = dedupX[k] - dedupX[k - 1];
      if (seg > 1.5) {
        segmentChordsUm.push(seg);
        rawChordsUm.push(seg);
      }
    }
    interceptLines.push({
      id: `H${idx + 1}`,
      positionUm: yUm,
      orientation: "horizontal",
      crossingsUm,
      segmentChordsUm,
    });
  });

  const vFractions = [0.25, 0.5, 0.75];
  vFractions.forEach((frac, idx) => {
    const xUm = frac * spec.widthUm;
    const ySet: number[] = [0.0, spec.heightUm];
    for (const g of grains) {
      if (g.isPearliteMasked) continue;
      const verts = g.verticesUm;
      for (let e = 0; e < verts.length; e++) {
        const [x1, y1] = verts[e];
        const [x2, y2] = verts[(e + 1) % verts.length];
        if ((x1 <= xUm && x2 >= xUm) || (x2 <= xUm && x1 >= xUm)) {
          const dx = x2 - x1;
          if (Math.abs(dx) > 1e-9) {
            const t = (xUm - x1) / dx;
            if (t >= -1e-6 && t <= 1.0 + 1e-6) {
              const yCross = y1 + t * (y2 - y1);
              if (yCross > 1e-3 && yCross < spec.heightUm - 1e-3) {
                ySet.push(yCross);
              }
            }
          }
        }
      }
    }
    ySet.sort((a, b) => a - b);
    const dedupY: number[] = [ySet[0]];
    for (let k = 1; k < ySet.length; k++) {
      if (ySet[k] - dedupY[dedupY.length - 1] > 0.4) {
        dedupY.push(ySet[k]);
      }
    }
    const crossingsUm: [number, number][] = dedupY
      .slice(1, -1)
      .map((y) => [xUm, y]);
    const segmentChordsUm: number[] = [];
    for (let k = 1; k < dedupY.length; k++) {
      const seg = dedupY[k] - dedupY[k - 1];
      if (seg > 1.5) {
        segmentChordsUm.push(seg);
        rawChordsUm.push(seg);
      }
    }
    interceptLines.push({
      id: `V${idx + 1}`,
      positionUm: xUm,
      orientation: "vertical",
      crossingsUm,
      segmentChordsUm,
    });
  });

  // Rescale raw chords to match the documented micrograph mean intercept exactly
  const rawMeters = rawChordsUm.map((u) => u * 1e-6);
  const rescaled = rescaleChords(rawMeters, spec.targetMeanUm * 1e-6);
  const stats = computeChordStats(rescaled.chordsM);

  return {
    key: spec.key,
    name: spec.name,
    materialKey: spec.materialKey,
    source: spec.source,
    licenseNote: spec.licenseNote,
    methodologyNote: spec.methodologyNote,
    widthUm: spec.widthUm,
    heightUm: spec.heightUm,
    scaleBarUm: spec.scaleBarUm,
    pxPerUm: spec.pxPerUm,
    grains,
    interceptLines,
    chordsM: rescaled.chordsM,
    stats,
  };
}

export const BUILTIN_MICROGRAPH_PRESETS: Record<string, MicrographPreset> = {
  aluminium: buildVoronoiMicrographPreset({
    key: "aluminium",
    name: "Aluminium 99.5% (DoITPoMS #609, Anodised Polarized Light)",
    materialKey: "aluminium",
    source: "DoITPoMS Micrograph Library #609 (University of Cambridge)",
    licenseNote:
      "Decision D6: Non-commercial educational provenance (DoITPoMS). Precomputed polygon & chord geometry bundled.",
    methodologyNote:
      "ASTM E112 line-intercept extraction across α-Al grains (scale bar: 40 μm = 100 px).",
    widthUm: 180.0,
    heightUm: 135.0,
    scaleBarUm: 40.0,
    pxPerUm: 2.5,
    gridCols: 5,
    gridRows: 4,
    jitter: 0.55,
    targetMeanUm: 34.5,
    seed: 609,
    phase: "alpha-Al",
  }),
  copper: buildVoronoiMicrographPreset({
    key: "copper",
    name: "Copper 99.7% (DoITPoMS #436, Wrought Annealed — Twin-Filtered)",
    materialKey: "copper",
    source: "DoITPoMS Micrograph Library #436 (University of Cambridge)",
    licenseNote:
      "Decision D6: Non-commercial educational provenance (DoITPoMS). Precomputed polygon & chord geometry bundled.",
    methodologyNote:
      "Decision M4: Straight parallel annealing twin boundaries filtered out before ASTM E112 grain-boundary intercept counting (scale bar: 200 μm = 291 px).",
    widthUm: 320.0,
    heightUm: 240.0,
    scaleBarUm: 100.0,
    pxPerUm: 1.455,
    gridCols: 6,
    gridRows: 4,
    jitter: 0.52,
    targetMeanUm: 48.2,
    seed: 436,
    phase: "alpha-Cu",
    markTwins: true,
  }),
  pure_iron: buildVoronoiMicrographPreset({
    key: "pure_iron",
    name: "Pure α-Iron >99.9% (Annealed, 2% Nital Etch, 100×)",
    materialKey: "pure_iron",
    source: "Wikimedia Commons (Fer_pur_100x.jpg, CC BY-SA 3.0)",
    licenseNote: "CC BY-SA 3.0 open license; raw micrograph and segmented chord data redistributable.",
    methodologyNote:
      "ASTM E112 multi-line intercept measurement on single-phase equiaxed α-ferrite (scale bar: 100 μm = 451 px).",
    widthUm: 200.0,
    heightUm: 150.0,
    scaleBarUm: 50.0,
    pxPerUm: 4.51,
    gridCols: 6,
    gridRows: 5,
    jitter: 0.58,
    targetMeanUm: 31.8,
    seed: 100,
    phase: "Ferrite",
  }),
  ferritic_steel: buildVoronoiMicrographPreset({
    key: "ferritic_steel",
    name: "Ferritic Steel Fe–0.2C (DoITPoMS #202, Ferrite-Only Masked)",
    materialKey: "ferritic_steel",
    source: "DoITPoMS Micrograph Library #202 (University of Cambridge)",
    licenseNote:
      "Decision D6: Non-commercial educational provenance (DoITPoMS). Precomputed polygon & chord geometry bundled.",
    methodologyNote:
      "Decision M5: Dark pearlite colonies masked out by intensity thresholding; intercepts restricted to proeutectoid α-ferrite grains (scale bar: 200 μm = 292 px).",
    widthUm: 220.0,
    heightUm: 165.0,
    scaleBarUm: 50.0,
    pxPerUm: 1.46,
    gridCols: 7,
    gridRows: 5,
    jitter: 0.6,
    targetMeanUm: 26.4,
    seed: 202,
    phase: "Ferrite",
    markPearlite: true,
  }),
  synthetic_voronoi_30um: buildVoronoiMicrographPreset({
    key: "synthetic_voronoi_30um",
    name: "Synthetic Equiaxed Voronoi Polycrystal (V-04 Benchmark, d̄ = 30.0 μm)",
    materialKey: "aluminium",
    source: "HPSim Deterministic 2D Voronoi Generator (Seed #42)",
    licenseNote: "MIT License — Synthetic benchmark reference geometry.",
    methodologyNote:
      "Benchmark V-04: Known synthetic Voronoi tessellation with exact target mean intercept l̄ = 30.0 μm.",
    widthUm: 180.0,
    heightUm: 135.0,
    scaleBarUm: 30.0,
    pxPerUm: 2.0,
    gridCols: 6,
    gridRows: 4,
    jitter: 0.45,
    targetMeanUm: 30.0,
    seed: 42,
    phase: "Synthetic",
  }),
};
