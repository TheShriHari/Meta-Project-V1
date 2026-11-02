/**
 * web/src/ui/HallPetchChart.tsx
 * Simple inline SVG Hall–Petch line chart for the beginner screen.
 * Data source: runHallPetchSweep + CALIBRATED_MATERIALS (Phase 6, V-09/V-10).
 * Provenance: Calibrated model trend only — NOT raw experimental data.
 * No external charting library. Pure SVG.
 */
import { useMemo } from "react";
import { runHallPetchSweep, CALIBRATED_MATERIALS, type CalibratedMaterialEntry } from "../core/hallpetch.ts";

const GRAIN_SIZES_M: number[] = (() => {
  const pts = 16;
  const logMin = Math.log10(10e-6);   // 10 μm
  const logMax = Math.log10(400e-6);  // 400 μm
  return Array.from({ length: pts }, (_, i) =>
    Math.pow(10, logMin + (i / (pts - 1)) * (logMax - logMin))
  );
})();

interface HallPetchChartProps {
  materialKey?: string;
}

export function HallPetchChart({ materialKey = "aluminium" }: HallPetchChartProps) {
  const mat: CalibratedMaterialEntry = CALIBRATED_MATERIALS[materialKey] ?? CALIBRATED_MATERIALS.aluminium;

  const sweep = useMemo(() => {
    return runHallPetchSweep({
      muPa: mat.muPa,
      nu: mat.nu,
      burgersM: mat.burgersM,
      tauCPa: mat.tauCPa,
      taylorFactor: mat.taylorFactor,
      tauStarRefPa: mat.calibratedTauStarRefPa,
      grainSizesM: GRAIN_SIZES_M,
      sigma0OffsetPa: mat.calibrationFit.sigma0Pa,
      bootstrapSamples: 50,
      seed: 42,
    });
  }, [mat]);

  // Convert to display units:
  // X = invSqrtDM05 (m^-0.5) → μm^-0.5 = × 1e-3 (1 m^-0.5 = 1e-3 μm^-0.5)
  // Y = sigmaYPa (Pa)         → MPa = ÷ 1e6
  const points = useMemo(() => {
    return sweep.points.map((p) => ({
      x: p.invSqrtDM05 * 1e-3,    // μm^{-0.5}
      y: p.sigmaYPa / 1e6,        // MPa
    }));
  }, [sweep]);

  // SVG layout dimensions
  const W = 360, H = 250;
  const PAD = { top: 26, right: 20, bottom: 44, left: 56 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xMin = 0;
  const xMax = Math.max(...points.map((p) => p.x), 0.1) * 1.05;
  const yMin = Math.min(...points.map((p) => p.y), 0) * 0.9;
  const yMax = Math.max(...points.map((p) => p.y), 50) * 1.05;

  const toSvgX = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const polylinePoints = points
    .map((p) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`)
    .join(" ");

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 1, 2, 3].map((i) => yMin + (i / 3) * (yMax - yMin));
  // X-axis ticks (4 ticks)
  const xTicks = [0, 1, 2, 3].map((i) => xMin + (i / 3) * (xMax - xMin));

  return (
    <div className="hp-chart-wrapper" id="hall-petch-chart-area">
      <div className="hp-chart-header">
        <h3 className="hp-chart-title">Hall–Petch Strengthening</h3>
        <span className="hp-chart-formula">
          &sigma;<sub>y</sub> = &sigma;<sub>0</sub> + k<sub>y</sub> &middot; d<sup>&minus;&frac12;</sup>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="hp-chart-svg"
        aria-label={`Hall-Petch line chart: yield strength vs inverse square root of grain size for ${mat.name}`}
        role="img"
      >
        {/* Plot area background */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="rgba(15, 23, 42, 0.7)"
          stroke="#1e293b"
          rx="4"
        />

        {/* Grid lines */}
        {yTicks.map((y, i) => (
          <line
            key={`y-grid-${i}`}
            x1={PAD.left}
            y1={toSvgY(y)}
            x2={PAD.left + plotW}
            y2={toSvgY(y)}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        {xTicks.map((x, i) => (
          <line
            key={`x-grid-${i}`}
            x1={toSvgX(x)}
            y1={PAD.top}
            x2={toSvgX(x)}
            y2={PAD.top + plotH}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + plotH}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={PAD.left + plotW}
          y2={PAD.top + plotH}
          stroke="#64748b"
          strokeWidth="1.5"
        />

        {/* Hall-Petch model trend line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* End data points for visual clarity */}
        {points.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={i === 0 || i === points.length - 1 ? 3.5 : 2}
            fill="#38bdf8"
            opacity={0.85}
          />
        ))}

        {/* Y-axis label */}
        <text
          x={14}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="11"
          fontWeight="500"
          transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
        >
          Yield Strength &sigma;<sub>y</sub> (MPa)
        </text>

        {/* X-axis label */}
        <text
          x={PAD.left + plotW / 2}
          y={H - 8}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="11"
          fontWeight="500"
        >
          Inverse Grain Size d<sup>&minus;&frac12;</sup> (&mu;m<sup>&minus;&frac12;</sup>)
        </text>

        {/* Y tick labels */}
        {yTicks.map((y, i) => (
          <text
            key={`ytick-${i}`}
            x={PAD.left - 6}
            y={toSvgY(y) + 3.5}
            textAnchor="end"
            fill="#64748b"
            fontSize="9.5"
            fontFamily="monospace"
          >
            {y.toFixed(0)}
          </text>
        ))}

        {/* X tick labels */}
        {xTicks.map((x, i) => (
          <text
            key={`xtick-${i}`}
            x={toSvgX(x)}
            y={PAD.top + plotH + 14}
            textAnchor="middle"
            fill="#64748b"
            fontSize="9.5"
            fontFamily="monospace"
          >
            {x.toFixed(3)}
          </text>
        ))}
      </svg>

      {/* Scientific provenance note */}
      <div className="hp-chart-provenance" id="hp-chart-provenance">
        <p className="hp-provenance-text">
          <strong>Calibrated model trend:</strong> Derived bottom-up from discrete pile-up mechanics.
          Calibrated to {mat.calibrationFit.sourceId} ({mat.name}).
          Not raw experimental scatter.
        </p>
        <p className="hp-provenance-params">
          <span>&sigma;<sub>0</sub> = {(mat.calibrationFit.sigma0Pa / 1e6).toFixed(1)} MPa</span>
          <span>&bull;</span>
          <span>k<sub>y</sub> = {(mat.calibrationFit.kyPaM05 / 1000).toFixed(1)} MPa&middot;&mu;m<sup>&frac12;</sup></span>
          <span>&bull;</span>
          <span>Slope = {sweep.logLogSlope.toFixed(3)} (theory &minus;0.5)</span>
        </p>
      </div>
    </div>
  );
}
