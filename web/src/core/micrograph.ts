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
}

export interface MicrographInterceptLine {
  id: string;
  positionUm: number;
  orientation: "horizontal" | "vertical";
  crossingsUm: [number, number][];
  segmentChordsUm: number[];
}

export interface MicrographPopulationStats {
  numGrainsTotal: number;
  numGrainsExported: number;
  astmMeanInterceptM: number;
  astmMeanInterceptUm: number;
  chordMeanM: number;
  chordMeanUm: number;
  stdInterceptM: number;
  stdInterceptUm: number;
  chordCv: number;
  p10M: number;
  p50M: number;
  p90M: number;
  p10Um: number;
  p50Um: number;
  p90Um: number;
  totalCrossings: number;
  totalChords: number;
  totalLineLengthUm: number;
}

export interface MicrographPreset {
  key: string;
  name: string;
  materialKey: string;
  source: string;
  licenseNote: string;
  methodologyNote: string;
  segmentationPolicy?: string;
  segmentationUncertaintyNote?: string;
  pearliteMaskedFraction?: number;
  isRealSegmentedFixture?: boolean;
  widthUm: number;
  heightUm: number;
  scaleBarUm: number;
  pxPerUm: number;
  grains: MicrographGrainPolygon[];
  interceptLines: MicrographInterceptLine[];
  chordsM: number[];
  stats: ChordStats;
  populationStats?: MicrographPopulationStats;
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
  segmentationPolicy: string;
  pearliteMaskedFraction: number;
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
    name: `${SYNTHETIC_DEMO_LABEL} (${spec.materialKey} look-alike)`,
    materialKey: spec.materialKey,
    source: SYNTHETIC_DEMO_LABEL,
    licenseNote: `${SYNTHETIC_DEMO_LABEL}. Generated geometry only; no source image data was used.`,
    methodologyNote:
      "Synthetic jittered-grid Voronoi (seeded RNG). Chords rescaled to an illustrative mean for sensitivity only. " +
      "No twin/pearlite classification was applied. Orientations are seeded random, not measured.",
    segmentationPolicy: "synthetic_demo_none",
    pearliteMaskedFraction: 0,
    isRealSegmentedFixture: false,
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

/**
 * Convert a real segmented micrograph JSON fixture (`web/public/data/micrographs/*.json`)
 * into a strongly-typed `MicrographPreset` with micrometer coordinates and exact chord statistics.
 */
export function parseSegmentedMicrographFixture(raw: Record<string, unknown>): MicrographPreset {
  const key = String(raw.key ?? "aluminium");
  const materialName = String(raw.material_name ?? key);
  const cal = (raw.calibration ?? {}) as Record<string, unknown>;
  const pixelSizeUm = Number(cal.pixel_size_um ?? 0.5);
  const scaleBarUm = Number(cal.scale_bar_um ?? 50.0);
  const pxPerUm = pixelSizeUm > 0 ? 1.0 / pixelSizeUm : 2.0;

  const dims = (raw.image_dimensions_px ?? {}) as Record<string, unknown>;
  const widthPx = Number(dims.width ?? 600);
  const heightPx = Number(dims.height ?? 450);
  const widthUm = widthPx * pixelSizeUm;
  const heightUm = heightPx * pixelSizeUm;

  const phaseStr = String(raw.phase_of_interest ?? "Synthetic");
  const phase: "alpha-Al" | "alpha-Cu" | "Ferrite" | "Synthetic" =
    phaseStr === "alpha-Al" || phaseStr === "alpha-Cu" || phaseStr === "Ferrite"
      ? phaseStr
      : "Synthetic";

  const rawGrains = Array.isArray(raw.grains) ? raw.grains : [];
  const grains: MicrographGrainPolygon[] = rawGrains.map((gObj, idx) => {
    const g = gObj as Record<string, unknown>;
    const id = Number(g.grain_id ?? idx + 1);
    const polyPx = Array.isArray(g.polygon_px) ? (g.polygon_px as [number, number][]) : [];
    const verticesUm: [number, number][] = polyPx.map(([px, py]) => [
      px * pixelSizeUm,
      py * pixelSizeUm,
    ]);
    const centUmRaw = Array.isArray(g.centroid_um) ? (g.centroid_um as [number, number]) : [0, 0];
    const slipRad = Number(g.slip_trace_angle_rad ?? 0.0);
    const slipTraceAngleDeg = (slipRad * 180.0) / Math.PI;
    const rot = Array.isArray(g.rotation_matrix) ? (g.rotation_matrix as number[][]) : null;
    const phi1 = rot
      ? Math.round(((Math.atan2(rot[0][1], rot[0][0]) * 180) / Math.PI + 360) % 360)
      : (id * 37) % 360;

    return {
      id,
      verticesUm,
      centroidUm: [Number(centUmRaw[0] ?? 0), Number(centUmRaw[1] ?? 0)],
      areaUm2: Number(g.area_um2 ?? 0),
      equivalentDiameterUm: Number(g.equiv_diameter_um ?? 10),
      eulerDeg: [phi1, 45, 30],
      slipTraceAngleDeg,
      phase,
    };
  });

  const rawLines = Array.isArray(raw.sample_intercept_lines) ? raw.sample_intercept_lines : [];
  const interceptLines: MicrographInterceptLine[] = rawLines.map((lObj, idx) => {
    const l = lObj as Record<string, unknown>;
    const orientation: "horizontal" | "vertical" =
      l.orientation === "vertical" ? "vertical" : "horizontal";
    const positionPx = orientation === "horizontal" ? Number(l.y1 ?? 0) : Number(l.x1 ?? 0);
    const positionUm = positionPx * pixelSizeUm;
    const crossingsPx = Array.isArray(l.crossings_px) ? (l.crossings_px as [number, number][]) : [];
    const crossingsUm: [number, number][] = crossingsPx.map(([cx, cy]) => [
      cx * pixelSizeUm,
      cy * pixelSizeUm,
    ]);
    return {
      id: `${orientation === "horizontal" ? "H" : "V"}${idx + 1}`,
      positionUm,
      orientation,
      crossingsUm,
      segmentChordsUm: [],
    };
  });

  const rawChordsM = Array.isArray(raw.chords_m)
    ? (raw.chords_m as number[]).map(Number).filter((v) => Number.isFinite(v) && v > 0)
    : [];
  const stats = computeChordStats(rawChordsM);
  const segPolicy = String(raw.segmentation_policy ?? "standard_watershed");
  const segUncertainty = String(raw.segmentation_uncertainty_note ?? "");
  const pearliteFrac = Number(raw.pearlite_masked_fraction ?? 0.0);

  const rawStats = (raw.statistics ?? {}) as Record<string, unknown>;
  let populationStats: MicrographPopulationStats | undefined;
  if (rawStats && Object.keys(rawStats).length > 0) {
    populationStats = {
      numGrainsTotal: Number(rawStats.num_grains_total ?? grains.length),
      numGrainsExported: Number(rawStats.num_grains_exported ?? grains.length),
      astmMeanInterceptM: Number(rawStats.astm_mean_intercept_m ?? rawStats.mean_intercept_m ?? stats.meanM),
      astmMeanInterceptUm: Number(rawStats.astm_mean_intercept_um ?? rawStats.mean_intercept_um ?? stats.meanM * 1e6),
      chordMeanM: Number(rawStats.chord_mean_m ?? stats.meanM),
      chordMeanUm: Number(rawStats.chord_mean_um ?? stats.meanM * 1e6),
      stdInterceptM: Number(rawStats.std_intercept_m ?? stats.stdM),
      stdInterceptUm: Number(rawStats.std_intercept_um ?? stats.stdM * 1e6),
      chordCv: Number(rawStats.chord_cv ?? stats.cv),
      p10M: Number(rawStats.p10_m ?? 0),
      p50M: Number(rawStats.p50_m ?? 0),
      p90M: Number(rawStats.p90_m ?? 0),
      p10Um: Number(rawStats.p10_um ?? 0),
      p50Um: Number(rawStats.p50_um ?? 0),
      p90Um: Number(rawStats.p90_um ?? 0),
      totalCrossings: Number(rawStats.total_crossings ?? 0),
      totalChords: Number(rawStats.total_chords ?? rawChordsM.length),
      totalLineLengthUm: Number(rawStats.total_line_length_um ?? 0),
    };
  }

  const astmDisplayUm = populationStats
    ? populationStats.astmMeanInterceptUm.toFixed(2)
    : (stats.meanM * 1e6).toFixed(2);
  const chordDisplayUm = populationStats
    ? populationStats.chordMeanUm.toFixed(2)
    : (stats.meanM * 1e6).toFixed(2);
  const totalCount = populationStats?.totalChords ?? stats.count;

  return {
    key,
    name: `${materialName} — Real Segmented Micrograph (${grains.length} Contours, ℓ̄_ASTM = ${astmDisplayUm} μm, ℓ̄_chord = ${chordDisplayUm} μm, n = ${totalCount})`,
    materialKey: key === "synthetic_voronoi_30um" ? "aluminium" : key,
    source: String(raw.license_note ?? materialName),
    licenseNote: String(raw.license_note ?? ""),
    methodologyNote: `${segPolicy}: ${segUncertainty}`,
    segmentationPolicy: segPolicy,
    segmentationUncertaintyNote: segUncertainty,
    pearliteMaskedFraction: pearliteFrac,
    isRealSegmentedFixture: key !== "synthetic_voronoi_30um",
    widthUm,
    heightUm,
    scaleBarUm,
    pxPerUm,
    grains,
    interceptLines,
    chordsM: rawChordsM,
    stats,
    populationStats,
  };
}

export const SYNTHETIC_DEMO_LABEL = "SYNTHETIC DEMONSTRATION — NOT MEASURED FROM SOURCE MICROGRAPH";

export const BUILTIN_MICROGRAPH_PRESETS: Record<string, MicrographPreset> = {
  aluminium: {
    ...buildVoronoiMicrographPreset({
      key: "aluminium",
      name: "Synthetic Voronoi (Model Fallback — Load web/public/data/micrographs/aluminium.json for Segmented Micrograph)",
      materialKey: "aluminium",
      source: "Synthetic Voronoi Model Fallback (Target: DoITPoMS #609 Al 99.5%, ℓ̄_ASTM = 8.112 μm, ℓ̄_chord = 7.847 μm, n = 963)",
      licenseNote:
        "Decision D6: Raw DoITPoMS image not bundled; runtime loads real watershed polygons & 963 chords from /data/micrographs/aluminium.json.",
      methodologyNote:
        "Synthetic Voronoi fallback until /data/micrographs/aluminium.json (standard_watershed, ℓ̄_ASTM = 8.112 μm, 932 crossings) is fetched.",
      segmentationPolicy: "standard_watershed",
      pearliteMaskedFraction: 0.0,
      widthUm: 196.0,
      heightUm: 182.0,
      scaleBarUm: 40.0,
      pxPerUm: 2.5,
      gridCols: 6,
      gridRows: 5,
      jitter: 0.55,
      targetMeanUm: 8.112,
      seed: 609,
      phase: "alpha-Al",
    }),
    populationStats: {
      numGrainsTotal: 158,
      numGrainsExported: 140,
      astmMeanInterceptM: 8.111588e-6,
      astmMeanInterceptUm: 8.112,
      chordMeanM: 7.847e-6,
      chordMeanUm: 7.847,
      stdInterceptM: 10.162e-6,
      stdInterceptUm: 10.162,
      chordCv: 1.2951,
      p10M: 1.6e-6,
      p50M: 4.8e-6,
      p90M: 16.72e-6,
      p10Um: 1.6,
      p50Um: 4.8,
      p90Um: 16.72,
      totalCrossings: 932,
      totalChords: 963,
      totalLineLengthUm: 7560.0,
    },
  },
  copper: {
    ...buildVoronoiMicrographPreset({
      key: "copper",
      name: "Synthetic Voronoi (Model Fallback — Load web/public/data/micrographs/copper.json for Segmented Micrograph)",
      materialKey: "copper",
      source: "Synthetic Voronoi Model Fallback (Target: DoITPoMS #436 Cu 99.7%, ℓ̄_ASTM = 17.267 μm, ℓ̄_chord = 16.717 μm, n = 1044)",
      licenseNote:
        "Decision D6: Raw DoITPoMS image not bundled; runtime loads real twin-filtered polygons & 1044 chords from /data/micrographs/copper.json.",
      methodologyNote:
        "Synthetic Voronoi fallback until /data/micrographs/copper.json (M4_copper_twin_exclusion, ℓ̄_ASTM = 17.267 μm, 1011 crossings) is fetched.",
      segmentationPolicy: "M4_copper_twin_exclusion",
      pearliteMaskedFraction: 0.0,
      widthUm: 536.0,
      heightUm: 336.0,
      scaleBarUm: 200.0,
      pxPerUm: 1.455,
      gridCols: 6,
      gridRows: 4,
      jitter: 0.52,
      targetMeanUm: 17.267,
      seed: 436,
      phase: "alpha-Cu",
    }),
    populationStats: {
      numGrainsTotal: 252,
      numGrainsExported: 140,
      astmMeanInterceptM: 17.267e-6,
      astmMeanInterceptUm: 17.267,
      chordMeanM: 16.717e-6,
      chordMeanUm: 16.717,
      stdInterceptM: 12.639e-6,
      stdInterceptUm: 12.639,
      chordCv: 0.7561,
      p10M: 2.955e-6,
      p50M: 14.433e-6,
      p90M: 33.677e-6,
      p10Um: 2.955,
      p50Um: 14.433,
      p90Um: 33.677,
      totalCrossings: 1011,
      totalChords: 1044,
      totalLineLengthUm: 17457.04,
    },
  },
  pure_iron: {
    ...buildVoronoiMicrographPreset({
      key: "pure_iron",
      name: "Synthetic Voronoi (Model Fallback — Load web/public/data/micrographs/pure_iron.json for Segmented Micrograph)",
      materialKey: "pure_iron",
      source: "Synthetic Voronoi Model Fallback (Target: Wikimedia Fer_pur_100x.jpg α-Fe, ℓ̄_ASTM = 7.599 μm, ℓ̄_chord = 7.261 μm, n = 855)",
      licenseNote:
        "CC BY-SA 3.0 open license; runtime loads real watershed polygons & 855 chords from /data/micrographs/pure_iron.json.",
      methodologyNote:
        "Synthetic Voronoi fallback until /data/micrographs/pure_iron.json (standard_watershed, ℓ̄_ASTM = 7.599 μm, 817 crossings) is fetched.",
      segmentationPolicy: "standard_watershed",
      pearliteMaskedFraction: 0.0,
      widthUm: 177.4,
      heightUm: 133.0,
      scaleBarUm: 100.0,
      pxPerUm: 4.51,
      gridCols: 6,
      gridRows: 5,
      jitter: 0.58,
      targetMeanUm: 7.599,
      seed: 100,
      phase: "Ferrite",
    }),
    populationStats: {
      numGrainsTotal: 137,
      numGrainsExported: 137,
      astmMeanInterceptM: 7.599e-6,
      astmMeanInterceptUm: 7.599,
      chordMeanM: 7.261e-6,
      chordMeanUm: 7.261,
      stdInterceptM: 6.001e-6,
      stdInterceptUm: 6.001,
      chordCv: 0.8265,
      p10M: 0.887e-6,
      p50M: 5.987e-6,
      p90M: 15.521e-6,
      p10Um: 0.887,
      p50Um: 5.987,
      p90Um: 15.521,
      totalCrossings: 817,
      totalChords: 855,
      totalLineLengthUm: 6208.43,
    },
  },
  ferritic_steel: {
    ...buildVoronoiMicrographPreset({
      key: "ferritic_steel",
      name: "Synthetic Voronoi (Model Fallback — Load web/public/data/micrographs/ferritic_steel.json for Segmented Micrograph)",
      materialKey: "ferritic_steel",
      source: "Synthetic Voronoi Model Fallback (Target: DoITPoMS #202 Ferritic Steel, ℓ̄_ASTM = 13.139 μm, ℓ̄_chord = 11.368 μm, n = 1301)",
      licenseNote:
        "Decision D6: Raw DoITPoMS image not bundled; runtime loads ferrite-masked polygons & 1301 chords from /data/micrographs/ferritic_steel.json.",
      methodologyNote:
        "Synthetic Voronoi fallback until /data/micrographs/ferritic_steel.json (M5_ferrite_only_mask, pearlite masked, ℓ̄_ASTM = 13.139 μm, 1129 crossings) is fetched.",
      segmentationPolicy: "M5_ferrite_only_mask",
      pearliteMaskedFraction: 0.1378,
      widthUm: 534.0,
      heightUm: 335.6,
      scaleBarUm: 200.0,
      pxPerUm: 1.46,
      gridCols: 7,
      gridRows: 5,
      jitter: 0.6,
      targetMeanUm: 13.139,
      seed: 202,
      phase: "Ferrite",
    }),
    populationStats: {
      numGrainsTotal: 406,
      numGrainsExported: 140,
      astmMeanInterceptM: 13.139e-6,
      astmMeanInterceptUm: 13.139,
      chordMeanM: 11.368e-6,
      chordMeanUm: 11.368,
      stdInterceptM: 8.575e-6,
      stdInterceptUm: 8.575,
      chordCv: 0.7542,
      p10M: 2.055e-6,
      p50M: 9.589e-6,
      p90M: 23.288e-6,
      p10Um: 2.055,
      p50Um: 9.589,
      p90Um: 23.288,
      totalCrossings: 1129,
      totalChords: 1301,
      totalLineLengthUm: 14833.56,
    },
  },
  synthetic_voronoi_30um: {
    ...buildVoronoiMicrographPreset({
      key: "synthetic_voronoi_30um",
      name: "Synthetic Voronoi Tessellation (V-11 Stereology Verification Target, ℓ̄_ASTM = 27.907 μm, 215 crossings)",
      materialKey: "aluminium",
      source: "Mathematical 2-step Lloyd-relaxed Voronoi tessellation (CC0 1.0 Public Domain, V-11)",
      licenseNote: "CC0 1.0 Public Domain — Synthetic stereology verification target (NOT an experimental micrograph).",
      methodologyNote:
        "Benchmark V-11: Synthetic Voronoi verification target (ℓ̄_ASTM = 27.907 μm, 215 crossings, 231 chords from /data/micrographs/synthetic_voronoi_30um.json).",
      segmentationPolicy: "V11_synthetic_voronoi_target",
      pearliteMaskedFraction: 0.0,
      widthUm: 250.0,
      heightUm: 350.0,
      scaleBarUm: 50.0,
      pxPerUm: 2.0,
      gridCols: 6,
      gridRows: 4,
      jitter: 0.45,
      targetMeanUm: 27.907,
      seed: 8,
      phase: "Synthetic",
    }),
    populationStats: {
      numGrainsTotal: 90,
      numGrainsExported: 90,
      astmMeanInterceptM: 27.907e-6,
      astmMeanInterceptUm: 27.907,
      chordMeanM: 25.965e-6,
      chordMeanUm: 25.965,
      stdInterceptM: 13.677e-6,
      stdInterceptUm: 13.677,
      chordCv: 0.5267,
      p10M: 7.0e-6,
      p50M: 26.0e-6,
      p90M: 43.5e-6,
      p10Um: 7.0,
      p50Um: 26.0,
      p90Um: 43.5,
      totalCrossings: 215,
      totalChords: 231,
      totalLineLengthUm: 6000.0,
    },
  },
};
