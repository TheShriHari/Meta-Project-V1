/**
 * web/src/ui/learning/ExperimentLog.tsx
 * Bottom-left collapsible drawer recording real student experiments throughout the journey.
 */
import type { ExperimentRun } from "./learningTypes.ts";

interface ExperimentLogProps {
  runs: ExperimentRun[];
  isOpen: boolean;
  onToggle: () => void;
}

export function ExperimentLog({ runs, isOpen, onToggle }: ExperimentLogProps) {
  return (
    <aside className={`experiment-log-drawer ${isOpen ? "open" : "collapsed"}`}>
      <button
        className="experiment-log-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="log-icon">🔬</span>
        <span className="log-title">
          Experiment Log ({runs.length} run{runs.length === 1 ? "" : "s"})
        </span>
        <span className="log-chevron">{isOpen ? "▼" : "▲"}</span>
      </button>

      {isOpen && (
        <div className="experiment-log-body">
          {runs.length === 0 ? (
            <p className="experiment-log-empty">
              No simulation experiments recorded yet. Complete experiments in Chapters 1–3 to collect real data.
            </p>
          ) : (
            <div className="experiment-log-table-wrap">
              <table className="experiment-log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Chapter</th>
                    <th>Condition</th>
                    <th>Result / Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="run-num">{r.runNumber}</td>
                      <td className="run-ch">{r.chapter}</td>
                      <td className="run-cond">
                        {r.grainSizeUm ? `${r.grainSizeUm} μm grain` : ""}
                        {r.appliedStressMpa ? `τ = ${r.appliedStressMpa} MPa` : ""}
                        {r.misalignmentDeg !== undefined ? `θ = ${r.misalignmentDeg}°` : ""}
                        <span className="run-mat">({r.materialKey === "aluminium" ? "Al" : "Cu"})</span>
                      </td>
                      <td className="run-outcome">
                        {r.calculatedStrengthMpa ? (
                          <span className="outcome-strength">
                            {r.calculatedStrengthMpa.toFixed(1)} MPa
                          </span>
                        ) : (
                          <span className="outcome-text">{r.outcome}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
