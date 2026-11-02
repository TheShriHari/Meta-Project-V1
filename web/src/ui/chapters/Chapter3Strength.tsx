/**
 * web/src/ui/chapters/Chapter3Strength.tsx
 * Chapter 3: More Walls, More Strength — Discover how smaller grains make metals stronger.
 * Interactive Voronoi polycrystalline mosaic, prediction interaction, real Hall–Petch model calculation,
 * and live ExperimentLog collection.
 */
import { useState, useMemo, useCallback } from "react";
import { CALIBRATED_MATERIALS, findYieldOnset } from "../../core/hallpetch.ts";
import type { ChapterProps } from "../learning/learningTypes.ts";
import { SceneLegend } from "../components/SceneLegend.tsx";

// Deterministic seedable Voronoi generator for clean, beautiful grain mosaics
function generateGrainSites(grainCount: number) {
  const sites: { x: number; y: number; color: string }[] = [];
  const palette = [
    "#1e293b", "#334155", "#475569", "#1e3a8a", "#172554", "#0f172a", "#1e293b", "#27272a"
  ];

  for (let i = 0; i < grainCount; i++) {
    // Distribute with low-discrepancy pattern (Halton sequence approximation)
    const phi = 0.618033988749895;
    const x = ((i * phi * 1000) % 1000) / 10; // 0 to 100%
    const y = ((i * 0.7548776662 * 1000) % 1000) / 10;
    sites.push({
      x: Math.max(Math.min(x, 95), 5),
      y: Math.max(Math.min(y, 95), 5),
      color: palette[i % palette.length],
    });
  }
  return sites;
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
  const [lastCalculatedStrength, setLastCalculatedStrength] = useState<number | null>(null);
  const [runSuccessCount, setRunSuccessCount] = useState<number>(0);

  const mat = CALIBRATED_MATERIALS[material] ?? CALIBRATED_MATERIALS.aluminium;

  // Number of visual grains scales inversely with grain size
  const visualGrainCount = useMemo(() => {
    // 300 μm -> ~12 grains; 10 μm -> ~70 grains
    const norm = (300 - grainSizeUm) / 290;
    return Math.round(12 + norm * 58);
  }, [grainSizeUm]);

  const grainSites = useMemo(() => {
    return generateGrainSites(visualGrainCount);
  }, [visualGrainCount]);

  // Real calculation from Hall–Petch model
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

  const ch3Runs = useMemo(() => {
    return experimentLog.filter((r) => r.chapter === "strength");
  }, [experimentLog]);

  const handleRunExperiment = useCallback(() => {
    if (!prediction) return;

    setIsRunning(true);
    setNarration(`Stressing polycrystal with ${grainSizeUm} μm grains...`);

    setTimeout(() => {
      setIsRunning(false);
      setLastCalculatedStrength(calculatedStrength);
      const isCorrect = prediction === "stronger";

      setNarration(
        isCorrect
          ? `Correct! Smaller ${grainSizeUm} μm grains create more boundaries, raising strength to ${calculatedStrength.toFixed(1)} MPa.`
          : `Observe: Smaller ${grainSizeUm} μm grains have more boundaries, which actually made the metal STRONGER (${calculatedStrength.toFixed(1)} MPa).`
      );

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
        notes: `${grainSizeUm} μm grain polycrystal`,
      });
    }, 800);
  }, [prediction, grainSizeUm, calculatedStrength, material, setNarration, onCompleteChapter, onLogExperiment]);

  return (
    <div className="chapter-scene chapter-3-strength">
      {/* Polycrystal Mosaic Viewport */}
      <div className="polycrystal-viewport-wrapper">
        <svg
          viewBox="0 0 100 100"
          className="polycrystal-svg"
          preserveAspectRatio="none"
          aria-label="Polycrystalline microstructure mosaic"
        >
          <defs>
            <radialGradient id="grain-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
            </radialGradient>
          </defs>

          {/* Grain backgrounds */}
          <rect width="100" height="100" fill="#070b16" />

          {/* Voronoi grain nodes with boundary web */}
          {grainSites.map((site, i) => (
            <g key={`grain-${i}`}>
              <circle
                cx={site.x}
                cy={site.y}
                r={100 / Math.sqrt(visualGrainCount)}
                fill="url(#grain-grad)"
                stroke="#38bdf8"
                strokeWidth="0.4"
                strokeOpacity="0.45"
              />
              <circle cx={site.x} cy={site.y} r="0.6" fill="#f59e0b" opacity="0.6" />
            </g>
          ))}

          {/* Running dislocation wave effect */}
          {isRunning && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              className="pulse-wave"
            />
          )}
        </svg>

        {/* Context-Aware Scene Legend */}
        <SceneLegend
          chapterId="strength"
          hasGrainBoundary={true}
        />

        {/* In-Scene Polycrystal Metadata */}
        <div className="scene-overlay-badge polycrystal-badge">
          <span className="amber-dot-pulse" />
          <span className="polycrystal-label">
            Polycrystal Model: ~{visualGrainCount} grains visible (Mean size: {grainSizeUm} μm)
          </span>
        </div>

        {/* Mini Data Discovery Graph in Corner (reveals after 2+ runs) */}
        {ch3Runs.length >= 2 && (
          <div className="corner-pattern-card">
            <span className="pattern-badge">Pattern Emerging</span>
            <div className="mini-scatter-box">
              {ch3Runs.map((r, i) => {
                const normX = ((300 - (r.grainSizeUm ?? 50)) / 290) * 80 + 10;
                const normY = 90 - (((r.calculatedStrengthMpa ?? 80) - 50) / 100) * 80;
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

      {/* Right Side: Strength Meter Bar */}
      <aside className="strength-meter-panel">
        <h3 className="meter-heading">Yield Resistance</h3>
        <p className="meter-sub">Resistance to dislocation movement</p>

        <div className="vertical-meter-track">
          <div
            className="vertical-meter-fill"
            style={{
              height: lastCalculatedStrength
                ? `${Math.min(Math.max(((lastCalculatedStrength - 40) / 100) * 100, 15), 100)}%`
                : "20%",
            }}
          />
          <div
            className="vertical-meter-needle"
            style={{
              bottom: lastCalculatedStrength
                ? `${Math.min(Math.max(((lastCalculatedStrength - 40) / 100) * 100, 15), 100)}%`
                : "20%",
            }}
          >
            <span className="needle-pointer">&#9664;</span>
            <span className="needle-value">
              {lastCalculatedStrength ? `${lastCalculatedStrength.toFixed(0)} MPa` : "—"}
            </span>
          </div>
        </div>

        <div className="meter-labels">
          <span>High Strength</span>
          <span>Low Strength</span>
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
                  {grainSizeUm <= 30 ? "(Very fine grains)" : grainSizeUm >= 150 ? "(Coarse grains)" : "(Medium)"}
                </span>
              </label>
              <input
                id="ch3-grain-slider"
                type="range"
                min={10}
                max={300}
                step={10}
                value={grainSizeUm}
                onChange={(e) => {
                  setGrainSizeUm(Number(e.target.value));
                  setLastCalculatedStrength(null);
                }}
              />
            </div>

            {/* Prediction Prompt */}
            <div className="prediction-box">
              <span className="prediction-question">
                Smaller grains make the metal:
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
            >
              Stress it &rarr;
            </button>
          </div>
        )}

        {isRunning && (
          <div className="island-running-group">
            <span className="spinner-orbit cyan" />
            <span className="island-running-text">
              Testing pile-up stress barrier across {visualGrainCount} grains...
            </span>
          </div>
        )}

        {runSuccessCount >= 2 && !isRunning && (
          <div className="ch3-next-row">
            <button
              className="chapter-primary-btn pulse"
              onClick={() => onNavigateChapter("equation")}
              id="btn-goto-equation"
            >
              Discover the pattern &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
