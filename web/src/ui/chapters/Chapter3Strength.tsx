/**
 * web/src/ui/chapters/Chapter3Strength.tsx
 * Chapter 3: More Walls, More Strength — Discover how smaller grains make metals stronger.
 *
 * Implements:
 * 1. True non-overlapping Voronoi polygon mosaic with shared grain boundaries (Lloyd-relaxed).
 * 2. Distinct grain boundary interfaces with warm metallic etched contrast and boundary glow.
 * 3. Warm metallic palette (bronze, brass, copper, gold) with subtle crystallographic orientations.
 * 4. Microstructure with slip traces, edge dislocations (⟂), and boundary pile-up mechanics.
 * 5. Monotonic physical grain-size scaling (10 to 300 μm, fine to coarse).
 * 6. Dominant viewer with non-overlapping strength meter, control island, and narration strip.
 * 7. Context-aware Microstructure Legend explaining grains, interfaces, dislocations, and strength.
 * 8. Owns its narration and simulation-result state (no stale Chapter 2 narration).
 * 9. Exact agreement between displayed grain count and visual structure.
 * 10. Direct connection to calibrated Hall–Petch physics model (findYieldOnset).
 * Scientific constraint: Explicitly labeled as a Schematic Voronoi Microstructure.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { CALIBRATED_MATERIALS, findYieldOnset } from "../../core/hallpetch.ts";
import type { ChapterProps } from "../learning/learningTypes.ts";
import { CHAPTER_INITIAL_NARRATION } from "../learning/learningState.ts";

// --- Voronoi Polygon Geometry Engine ---

/**
 * Clips a convex polygon against the half-plane closer to site A than site B:
 * (p - mid) . (B - A) <= 1e-9.
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
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

/**
 * Computes polygon area and centroid.
 */
function polygonAreaAndCentroid(poly: [number, number][]): {
  area: number;
  centroid: [number, number];
} {
  const n = poly.length;
  if (n < 3) return { area: 0, centroid: [poly[0] ? poly[0][0] : 50, poly[0] ? poly[0][1] : 50] };
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const area = 0.5 * Math.abs(a2);
  if (area < 1e-12) return { area: 0, centroid: poly[0] };
  return {
    area,
    centroid: [cx / (3 * a2), cy / (3 * a2)],
  };
}

// Warm metallic palette with subtle variations for adjacent grains
const WARM_METALLIC_PALETTE = [
  { base: "#45311f", highlight: "#6b4e32", name: "Deep Bronze" },
  { base: "#543d26", highlight: "#7c5c3b", name: "Cast Bronze" },
  { base: "#5d432a", highlight: "#896440", name: "Warm Brass" },
  { base: "#4a321b", highlight: "#74502d", name: "Burnished Copper" },
  { base: "#513b25", highlight: "#7f5d3d", name: "Amber Metal" },
  { base: "#60472e", highlight: "#916c48", name: "Light Bronze" },
  { base: "#3c2a1a", highlight: "#64442b", name: "Dark Copper" },
  { base: "#584128", highlight: "#8a663e", name: "Gilded Alloy" },
  { base: "#4d3822", highlight: "#795836", name: "Antique Brass" },
  { base: "#644b30", highlight: "#96724a", name: "Tuscan Gold" },
  { base: "#432f1c", highlight: "#6d4d2f", name: "Oxidized Bronze" },
  { base: "#563e26", highlight: "#83613c", name: "Warm Titanium" },
];

export interface VoronoiGrain {
  id: number;
  vertices: [number, number][];
  centroid: [number, number];
  area: number;
  radius: number;
  baseColor: string;
  highlightColor: string;
  slipAngleDeg: number;
  slipLines: { x1: number; y1: number; x2: number; y2: number }[];
  dislocations: {
    origin: [number, number];
    pinned: [number, number];
    pileup: [number, number][];
  };
}

/**
 * Deterministic Voronoi generator with 1-pass Lloyd relaxation.
 * Creates an authentic, equiaxed polycrystalline grain mosaic.
 */
function generateVoronoiPolycrystal(targetCount: number): VoronoiGrain[] {
  const w = 100;
  const h = 100;
  const baseBox: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];

  // Jittered grid seeding
  const cols = Math.ceil(Math.sqrt(targetCount));
  const rows = Math.ceil(targetCount / cols);
  const cellW = w / cols;
  const cellH = h / rows;

  let sites: [number, number][] = [];
  let count = 0;
  for (let r = 0; r < rows && count < targetCount; r++) {
    for (let c = 0; c < cols && count < targetCount; c++) {
      const jx = ((((count * 9301 + 49297) % 233280) / 233280) - 0.5) * 0.62;
      const jy = ((((count * 49297 + 9301) % 233280) / 233280) - 0.5) * 0.62;
      const sx = Math.max(1.5, Math.min(w - 1.5, (c + 0.5 + jx) * cellW));
      const sy = Math.max(1.5, Math.min(h - 1.5, (r + 0.5 + jy) * cellH));
      sites.push([sx, sy]);
      count++;
    }
  }

  // 1-pass Lloyd relaxation to create equiaxed grains with ~120° triple junctions
  const relaxedSites: [number, number][] = [];
  for (let i = 0; i < sites.length; i++) {
    let poly = baseBox;
    const [ax, ay] = sites[i];
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const [bx, by] = sites[j];
      poly = clipPolygonHalfPlane(poly, ax, ay, bx, by);
      if (poly.length === 0) break;
    }
    const { centroid } = polygonAreaAndCentroid(poly);
    relaxedSites.push(centroid);
  }
  sites = relaxedSites;

  // Final Voronoi cells and crystallographic features
  const grains: VoronoiGrain[] = [];
  for (let i = 0; i < sites.length; i++) {
    let poly = baseBox;
    const [ax, ay] = sites[i];
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const [bx, by] = sites[j];
      poly = clipPolygonHalfPlane(poly, ax, ay, bx, by);
      if (poly.length === 0) break;
    }

    if (poly.length >= 3) {
      const { area, centroid } = polygonAreaAndCentroid(poly);
      const r = Math.sqrt(area / Math.PI);
      const palette = WARM_METALLIC_PALETTE[i % WARM_METALLIC_PALETTE.length];
      const slipAngleDeg = ((i * 47) % 150) - 75;

      // Calculate crystallographic slip lines inside grain
      const rad = (slipAngleDeg * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);
      const nx = -uy;
      const ny = ux;

      const slipLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const lineOffsets = targetCount > 40 ? [0] : [-0.3, 0, 0.3];
      const lineLen = Math.max(r * 0.75, 1.5);

      for (const off of lineOffsets) {
        const mx = centroid[0] + off * r * nx;
        const my = centroid[1] + off * r * ny;
        slipLines.push({
          x1: mx - lineLen * ux,
          y1: my - lineLen * uy,
          x2: mx + lineLen * ux,
          y2: my + lineLen * uy,
        });
      }

      // Dislocation positions: origin (idle), pinned (at boundary), pileup (3 dislocations)
      const primaryLine = slipLines[Math.floor(slipLines.length / 2)] ?? slipLines[0];
      const origin: [number, number] = [
        centroid[0] - lineLen * 0.25 * ux,
        centroid[1] - lineLen * 0.25 * uy,
      ];
      const pinned: [number, number] = [
        primaryLine.x2 - lineLen * 0.08 * ux,
        primaryLine.y2 - lineLen * 0.08 * uy,
      ];
      const pileup: [number, number][] = [
        pinned,
        [primaryLine.x2 - lineLen * 0.28 * ux, primaryLine.y2 - lineLen * 0.28 * uy],
        [primaryLine.x2 - lineLen * 0.52 * ux, primaryLine.y2 - lineLen * 0.52 * uy],
      ];

      grains.push({
        id: i + 1,
        vertices: poly,
        centroid,
        area,
        radius: r,
        baseColor: palette.base,
        highlightColor: palette.highlight,
        slipAngleDeg,
        slipLines,
        dislocations: { origin, pinned, pileup },
      });
    }
  }

  return grains;
}

export function Chapter3Strength({
  onCompleteChapter,
  onNavigateChapter,
  onLogExperiment,
  setNarration,
  experimentLog,
  material,
}: ChapterProps) {
  // Grain size in micrometers (10 μm to 300 μm)
  const [grainSizeUm, setGrainSizeUm] = useState<number>(50);
  const [prediction, setPrediction] = useState<"stronger" | "weaker" | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isStressed, setIsStressed] = useState<boolean>(false);
  const [lastCalculatedStrength, setLastCalculatedStrength] = useState<number | null>(null);
  const [runSuccessCount, setRunSuccessCount] = useState<number>(0);

  const mat = CALIBRATED_MATERIALS[material] ?? CALIBRATED_MATERIALS.aluminium;

  // Ensure Chapter 3 establishes its own initial narration on mount
  useEffect(() => {
    setNarration(CHAPTER_INITIAL_NARRATION.strength);
  }, [setNarration]);

  // Physical area scaling: N scales inversely with d^2
  // Calibrated target counts: 230 μm -> ~7 grains; 130 μm -> ~18 grains; 50 μm -> ~68 grains
  const targetGrainCount = useMemo(() => {
    const n = Math.round(220000 / (grainSizeUm * grainSizeUm + 800));
    return Math.max(6, Math.min(100, n));
  }, [grainSizeUm]);

  // Generate non-overlapping Voronoi grain mosaic
  const grains = useMemo(() => {
    return generateVoronoiPolycrystal(targetGrainCount);
  }, [targetGrainCount]);

  // Real calculation from Hall–Petch dislocation pile-up model
  const calculatedStrength = useMemo(() => {
    const res = findYieldOnset({
      muPa: mat.muPa,
      nu: mat.nu,
      burgersM: mat.burgersM,
      grainSizeM: grainSizeUm * 1e-6,
      tauCPa: mat.tauCPa,
      taylorFactor: mat.taylorFactor,
      tauStarRefPa: mat.calibratedTauStarRefPa,
      sigma0OffsetPa: mat.calibrationFit.sigma0Pa,
    });
    return res.sigmaYPa / 1e6; // in MPa
  }, [mat, grainSizeUm]);

  // Calibrate strength meter dynamic range to current material
  const minYieldMpa = useMemo(() => {
    const res = findYieldOnset({
      muPa: mat.muPa,
      nu: mat.nu,
      burgersM: mat.burgersM,
      grainSizeM: 300e-6,
      tauCPa: mat.tauCPa,
      taylorFactor: mat.taylorFactor,
      tauStarRefPa: mat.calibratedTauStarRefPa,
      sigma0OffsetPa: mat.calibrationFit.sigma0Pa,
    });
    return res.sigmaYPa / 1e6;
  }, [mat]);

  const maxYieldMpa = useMemo(() => {
    const res = findYieldOnset({
      muPa: mat.muPa,
      nu: mat.nu,
      burgersM: mat.burgersM,
      grainSizeM: 10e-6,
      tauCPa: mat.tauCPa,
      taylorFactor: mat.taylorFactor,
      tauStarRefPa: mat.calibratedTauStarRefPa,
      sigma0OffsetPa: mat.calibrationFit.sigma0Pa,
    });
    return res.sigmaYPa / 1e6;
  }, [mat]);

  // Dynamic meter position percentage based on calibrated material range
  const meterPercent = useMemo(() => {
    const strength = lastCalculatedStrength ?? calculatedStrength;
    const fraction = (strength - minYieldMpa) / Math.max(maxYieldMpa - minYieldMpa, 1e-3);
    return Math.min(Math.max(fraction * 78 + 12, 12), 92);
  }, [lastCalculatedStrength, calculatedStrength, minYieldMpa, maxYieldMpa]);

  const ch3Runs = useMemo(() => {
    return experimentLog.filter((r) => r.chapter === "strength");
  }, [experimentLog]);

  const handleSliderChange = (newVal: number) => {
    setGrainSizeUm(newVal);
    setLastCalculatedStrength(null);
    setIsStressed(false);
    setNarration(
      `Grain size set to ${newVal} μm (${
        newVal <= 40 ? "fine grains with dense boundaries" : newVal >= 150 ? "coarse grains with sparse boundaries" : "medium grains"
      }). Predict: will this metal be stronger or weaker?`
    );
  };

  const handleRunExperiment = useCallback(() => {
    if (!prediction) return;

    setIsRunning(true);
    setNarration(
      `Applying shear stress: dislocations glide across crystal grains and pile up against grain boundaries...`
    );

    setTimeout(() => {
      setIsRunning(false);
      setIsStressed(true);
      setLastCalculatedStrength(calculatedStrength);
      const expectedPrediction: "stronger" | "weaker" = grainSizeUm <= 80 ? "stronger" : "weaker";
      const isCorrect = prediction === expectedPrediction;

      if (grainSizeUm <= 60) {
        setNarration(
          isCorrect
            ? `Correct! Fine ${grainSizeUm} μm grains create a dense network of boundary obstacles, shortening dislocation pile-ups and raising yield strength to ${calculatedStrength.toFixed(1)} MPa.`
            : `Observe: Fine ${grainSizeUm} μm grains create dense boundary obstacles, which actually made the metal STRONGER (${calculatedStrength.toFixed(1)} MPa).`
        );
      } else if (grainSizeUm >= 140) {
        setNarration(
          isCorrect
            ? `Correct! Coarse ${grainSizeUm} μm grains have sparse boundary obstacles, allowing dislocations to glide longer distances and yielding at a lower strength of ${calculatedStrength.toFixed(1)} MPa.`
            : `Observe: Coarse ${grainSizeUm} μm grains have fewer boundary obstacles, resulting in a lower yield strength of ${calculatedStrength.toFixed(1)} MPa.`
        );
      } else {
        setNarration(
          isCorrect
            ? `Correct! Intermediate ${grainSizeUm} μm grains provide moderate boundary resistance, yielding at ${calculatedStrength.toFixed(1)} MPa.`
            : `Observe: Intermediate ${grainSizeUm} μm grains yield at ${calculatedStrength.toFixed(1)} MPa as dislocations pile up against boundaries.`
        );
      }

      setRunSuccessCount((c) => c + 1);
      onCompleteChapter();
      onLogExperiment({
        chapter: "strength",
        materialKey: material,
        grainSizeUm,
        calculatedStrengthMpa: calculatedStrength,
        prediction,
        wasPredictionCorrect: isCorrect,
        outcome: `Yield strength: ${calculatedStrength.toFixed(1)} MPa`,
        notes: `${grainSizeUm} μm grain polycrystal (${grains.length} visible grains)`,
      });
    }, 900);
  }, [prediction, grainSizeUm, calculatedStrength, grains.length, material, setNarration, onCompleteChapter, onLogExperiment]);

  return (
    <div className="chapter-scene chapter-3-strength">
      {/* Polycrystal Mosaic Viewport */}
      <div className="polycrystal-viewport-wrapper">
        <svg
          viewBox="0 0 100 100"
          className="polycrystal-svg"
          preserveAspectRatio="none"
          aria-label="Polycrystalline microstructure Voronoi mosaic"
        >
          <defs>
            {/* Grain orientation gradients in warm metallic tones */}
            {grains.map((g) => (
              <linearGradient
                key={`grad-${g.id}`}
                id={`grad-${g.id}`}
                gradientTransform={`rotate(${g.slipAngleDeg})`}
              >
                <stop offset="0%" stopColor={g.highlightColor} stopOpacity="0.95" />
                <stop offset="100%" stopColor={g.baseColor} stopOpacity="0.9" />
              </linearGradient>
            ))}

            {/* Glowing boundary interface filter */}
            <filter id="boundary-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Stress concentration bloom filter */}
            <filter id="pileup-bloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.0" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background domain */}
          <rect width="100" height="100" fill="#060911" />

          {/* Voronoi Grain Mosaic: Non-overlapping polygons tiling the space */}
          <g className="grain-mosaic-layer">
            {grains.map((g) => {
              const pts = g.vertices.map((v) => `${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(" ");
              return (
                <polygon
                  key={`grain-${g.id}`}
                  points={pts}
                  fill={`url(#grad-${g.id})`}
                  stroke="#170f07"
                  strokeWidth="0.7"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Crystallographic Slip Traces within Grains */}
          <g className="slip-traces-layer" opacity="0.35">
            {grains.map((g) =>
              g.slipLines.map((line, idx) => (
                <line
                  key={`slip-${g.id}-${idx}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#fde68a"
                  strokeWidth="0.25"
                  strokeDasharray="0.8 0.6"
                />
              ))
            )}
          </g>

          {/* Grain Boundaries: Visible Interfaces Between Adjacent Grains */}
          <g
            className="grain-boundaries-layer"
            filter={isRunning || isStressed ? "url(#boundary-glow)" : undefined}
          >
            {grains.map((g) => {
              const pts = g.vertices.map((v) => `${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(" ");
              return (
                <polygon
                  key={`bound-${g.id}`}
                  points={pts}
                  fill="none"
                  stroke={isRunning ? "#f59e0b" : "#d97706"}
                  strokeWidth={isRunning ? 0.8 : 0.45}
                  strokeOpacity={isRunning ? 0.95 : 0.65}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Mobile Dislocations and Pile-Up Queues at Boundaries */}
          <g className="dislocations-layer">
            {grains.map((g) => {
              const d = g.dislocations;
              const curPos = isRunning || isStressed ? d.pinned : d.origin;

              return (
                <g key={`disl-${g.id}`}>
                  {/* Lead Dislocation Core with ⟂ symbol */}
                  <g transform={`translate(${curPos[0]}, ${curPos[1]})`}>
                    <circle r="0.75" fill="#38bdf8" />
                    {/* Dislocation inverted-T mark */}
                    <line x1="-0.9" y1="0.6" x2="0.9" y2="0.6" stroke="#38bdf8" strokeWidth="0.4" />
                    <line x1="0" y1="0.6" x2="0" y2="-0.6" stroke="#38bdf8" strokeWidth="0.4" />
                  </g>

                  {/* Dislocation Pile-Up Queue: Appears when stressed against the boundary */}
                  {isStressed && (
                    <>
                      {d.pileup.slice(1).map((pos, pIdx) => (
                        <g
                          key={`pile-${g.id}-${pIdx}`}
                          transform={`translate(${pos[0]}, ${pos[1]})`}
                          opacity="0.85"
                        >
                          <circle r="0.55" fill="#38bdf8" />
                          <line x1="-0.6" y1="0.4" x2="0.6" y2="0.4" stroke="#38bdf8" strokeWidth="0.3" />
                          <line x1="0" y1="0.4" x2="0" y2="-0.4" stroke="#38bdf8" strokeWidth="0.3" />
                        </g>
                      ))}

                      {/* Stress concentration bloom at the grain boundary */}
                      <circle
                        cx={d.pinned[0]}
                        cy={d.pinned[1]}
                        r="1.6"
                        fill="rgba(245, 158, 11, 0.4)"
                        filter="url(#pileup-bloom)"
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* Running Dislocation Stress Wave Effect */}
          {isRunning && (
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.2"
              className="pulse-wave"
            />
          )}
        </svg>

        {/* In-Scene Top-Left Badge (Scientific Voronoi Label) */}
        <div className="scene-overlay-badge polycrystal-badge">
          <span className="amber-dot-pulse" />
          <span className="polycrystal-label">
            Schematic Voronoi Microstructure: {grains.length} grains visible (Mean size: {grainSizeUm} μm)
          </span>
        </div>

        {/* Context-Aware Microstructure Legend */}
        <aside className="microstructure-legend-card" aria-label="Microstructure Legend">
          <div className="legend-title">Microstructure Guide</div>
          <ul className="legend-items">
            <li className="legend-item">
              <span className="legend-swatch grain-swatch" />
              <div className="legend-text">
                <strong>Grain Matrix</strong>
                <span>Warm metallic crystal domains</span>
              </div>
            </li>
            <li className="legend-item">
              <span className="legend-swatch boundary-swatch" />
              <div className="legend-text">
                <strong>Grain Boundaries</strong>
                <span>Interfaces blocking dislocation glide</span>
              </div>
            </li>
            <li className="legend-item">
              <span className="legend-swatch dislocation-swatch">⟂</span>
              <div className="legend-text">
                <strong>Dislocations</strong>
                <span>Mobile slip defects</span>
              </div>
            </li>
            {isStressed && (
              <li className="legend-item highlight-pileup">
                <span className="legend-swatch pileup-swatch">●</span>
                <div className="legend-text">
                  <strong>Boundary Pile-Up</strong>
                  <span>Dislocations blocked at interface</span>
                </div>
              </li>
            )}
            <li className="legend-item">
              <span className="legend-swatch meter-swatch" />
              <div className="legend-text">
                <strong>Yield Resistance</strong>
                <span>Hall–Petch strength (σ_y)</span>
              </div>
            </li>
          </ul>
          <div className="legend-footnote">
            Schematic 2D Voronoi representation. Yield strength calculated from calibrated pile-up physics model.
          </div>
        </aside>

        {/* Mini Data Discovery Graph in Corner (reveals after 2+ runs) */}
        {ch3Runs.length >= 2 && (
          <div className="corner-pattern-card">
            <span className="pattern-badge">Pattern Emerging</span>
            <div className="mini-scatter-box">
              {ch3Runs.map((r) => {
                const normX = ((300 - (r.grainSizeUm ?? 50)) / 290) * 80 + 10;
                const normY = 90 - (((r.calculatedStrengthMpa ?? 18) - 12) / 25) * 80;
                return (
                  <div
                    key={r.id}
                    className="scatter-dot"
                    style={{ left: `${normX}%`, top: `${normY}%` }}
                    title={`Run #${r.runNumber}: ${r.grainSizeUm} μm → ${r.calculatedStrengthMpa?.toFixed(1)} MPa`}
                  />
                );
              })}
            </div>
            <p className="pattern-subtext">
              {ch3Runs.length} data point{ch3Runs.length > 1 ? "s" : ""} recorded
            </p>
          </div>
        )}
      </div>

      {/* Right Side: Cleanly Integrated Strength Meter Bar */}
      <aside className="strength-meter-panel">
        <div className="meter-header">
          <h3 className="meter-heading">Yield Resistance</h3>
          <p className="meter-sub">Hall–Petch model (σ_y)</p>
        </div>

        {/* Central Track & Scale Labels Row */}
        <div className="meter-gauge-row">
          <div className="meter-scale-column">
            <span className="scale-high">High Strength (Fine grains)</span>
            <span className="scale-mid">Medium</span>
            <span className="scale-low">Low Strength (Coarse grains)</span>
          </div>

          <div className="vertical-meter-track">
            <div
              className="vertical-meter-fill"
              style={{
                height: isStressed || lastCalculatedStrength ? `${meterPercent}%` : "14%",
              }}
            />
            <div
              className="vertical-meter-needle"
              style={{
                bottom: isStressed || lastCalculatedStrength ? `${meterPercent}%` : "14%",
              }}
            >
              <span className="needle-pointer">&#9664;</span>
              <span className="needle-value">
                {lastCalculatedStrength
                  ? `${lastCalculatedStrength.toFixed(1)} MPa`
                  : isRunning
                  ? "Testing..."
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Readout */}
        <div className="meter-footer-readout">
          <span className="meter-readout-label">Calculated Yield:</span>
          <span className="meter-readout-value">
            {lastCalculatedStrength
              ? `${lastCalculatedStrength.toFixed(1)} MPa`
              : `${calculatedStrength.toFixed(1)} MPa`}
          </span>
          <span className="meter-material-badge">{mat.name ?? material}</span>
        </div>
      </aside>

      {/* Bottom Floating Control Island */}
      <div className="chapter-control-island ch3-island">
        {!isRunning && (
          <div className="ch3-action-row">
            {/* Grain size slider */}
            <div className="island-slider-wrap grain-slider">
              <label htmlFor="ch3-grain-slider">
                Average Grain Size: <strong>{grainSizeUm} μm</strong>{" "}
                <span className="grain-hint">
                  {grainSizeUm <= 35
                    ? "(Very fine grains)"
                    : grainSizeUm >= 180
                    ? "(Coarse grains)"
                    : "(Medium grains)"}
                </span>
              </label>
              <input
                id="ch3-grain-slider"
                type="range"
                min={10}
                max={300}
                step={10}
                value={grainSizeUm}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
              />
            </div>

            {/* Prediction Prompt */}
            <div className="prediction-box">
              <span className="prediction-question">
                {grainSizeUm <= 60
                  ? `Fine grains (${grainSizeUm} μm with dense walls) make metal:`
                  : grainSizeUm >= 140
                  ? `Coarse grains (${grainSizeUm} μm with few walls) make metal:`
                  : `Compared to coarse grains, ${grainSizeUm} μm grains make metal:`}
              </span>
              <div className="prediction-buttons">
                <button
                  className={`pred-btn ${prediction === "stronger" ? "selected" : ""}`}
                  onClick={() => setPrediction("stronger")}
                >
                  Stronger ▲
                </button>
                <button
                  className={`pred-btn ${prediction === "weaker" ? "selected" : ""}`}
                  onClick={() => setPrediction("weaker")}
                >
                  Weaker ▼
                </button>
              </div>
            </div>

            {/* Run button */}
            <button
              className="chapter-primary-btn glow"
              disabled={!prediction}
              onClick={handleRunExperiment}
              id="btn-stress-polycrystal"
              title="Measure Strength / Stress it"
            >
              Stress it &rarr;
            </button>
          </div>
        )}

        {isRunning && (
          <div className="island-running-group">
            <span className="spinner-orbit amber" />
            <span className="island-running-text">
              Stressing microstructure across {grains.length} grains...
            </span>
          </div>
        )}

        {runSuccessCount >= 2 && !isRunning && (
          <div className="ch3-next-row">
            <button
              className="chapter-primary-btn pulse"
              onClick={() => onNavigateChapter("equation")}
              id="btn-goto-equation"
              title="Next: Hall-Petch"
            >
              Discover the pattern (Hall-Petch) &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
