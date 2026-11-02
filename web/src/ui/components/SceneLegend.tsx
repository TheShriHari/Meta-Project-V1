/**
 * web/src/ui/components/SceneLegend.tsx
 *
 * Context-aware scientific legend for HPSim 3D viewer.
 * Provides clear, unambiguous identification of all visible colours, lines,
 * planes, atoms, and vectors across all 4 learning chapters and Research Mode.
 */
import { useState } from "react";

export interface LegendItem {
  id: string;
  label: string;
  description: string;
  color: string;
  type: "sphere" | "plane" | "line" | "arrow" | "gradient" | "sheet";
  visible: boolean;
}

export interface SceneLegendProps {
  chapterId: "defect" | "wall" | "strength" | "equation" | "research";
  hasGrainBoundary?: boolean;
  hasExtraHalfPlane?: boolean;
  hasDisplacedAtoms?: boolean;
  hasGhostLattice?: boolean;
  hasBurgersVector?: boolean;
  hasBonds?: boolean;
}

export function SceneLegend({
  chapterId,
  hasGrainBoundary = false,
  hasExtraHalfPlane = true,
  hasDisplacedAtoms = true,
  hasGhostLattice = true,
  hasBurgersVector = true,
  hasBonds = false,
}: SceneLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Build context-aware legend items
  const items: LegendItem[] = [];

  // Crystal atoms
  if (chapterId === "defect" || chapterId === "research" || chapterId === "equation") {
    items.push({
      id: "atoms-grain1",
      label: "Crystal Atoms",
      description: "Gold spheres (#D4A843) representing FCC crystal lattice",
      color: "#D4A843",
      type: "sphere",
      visible: true,
    });
  }

  if (chapterId === "wall" || hasGrainBoundary) {
    items.push({
      id: "atoms-grain1-wall",
      label: "Grain 1 Atoms",
      description: "Base crystal orientation (#D4A843)",
      color: "#D4A843",
      type: "sphere",
      visible: true,
    });
    items.push({
      id: "atoms-grain2",
      label: "Grain 2 Atoms",
      description: "Adjacent grain with tilted orientation (#B8912E, same material)",
      color: "#B8912E",
      type: "sphere",
      visible: true,
    });
  }

  // Displaced atoms
  if (hasDisplacedAtoms && chapterId !== "strength") {
    items.push({
      id: "displaced-atoms",
      label: "Displaced Atoms",
      description: "Cyan-white highlight indicating displacement magnitude |u|",
      color: "#38bdf8",
      type: "gradient",
      visible: true,
    });
  }

  // Ghost reference lattice
  if (hasGhostLattice && (chapterId === "defect" || chapterId === "wall" || chapterId === "research")) {
    items.push({
      id: "ghost-lattice",
      label: "Reference Lattice",
      description: "Faint white spheres: original undisplaced atom positions",
      color: "#ffffff",
      type: "sphere",
      visible: true,
    });
  }

  // Extra half-plane of atoms
  if (hasExtraHalfPlane && (chapterId === "defect" || chapterId === "research")) {
    items.push({
      id: "extra-half-plane",
      label: "Extra Half-Plane",
      description: "Inserted atomic half-plane terminating inside crystal",
      color: "#e2b14e",
      type: "sheet",
      visible: true,
    });
  }

  // Dislocation core and line
  if (chapterId === "defect" || chapterId === "wall" || chapterId === "research" || chapterId === "equation") {
    items.push({
      id: "dislocation-line",
      label: "Dislocation Line (ξ)",
      description: "Pink line: terminating bottom edge of the extra half-plane",
      color: "#ff3b5c",
      type: "line",
      visible: true,
    });
    items.push({
      id: "dislocation-core",
      label: "Dislocation Core (⊥)",
      description: "Pink sphere marking the defect center on the slip plane",
      color: "#ff3b5c",
      type: "sphere",
      visible: true,
    });
  }

  // Grain boundary plane (ONLY when present!)
  if (hasGrainBoundary || chapterId === "wall") {
    items.push({
      id: "grain-boundary",
      label: "Grain Boundary",
      description: "Indigo translucent plane (0x818cf8) with bright violet border",
      color: "#818cf8",
      type: "plane",
      visible: true,
    });
  }

  // Slip plane
  if (chapterId === "defect" || chapterId === "wall" || chapterId === "research" || chapterId === "equation") {
    items.push({
      id: "slip-plane",
      label: "Slip Plane {111}",
      description: "Translucent amber plane where dislocation glide occurs",
      color: "#f59e0b",
      type: "plane",
      visible: true,
    });
  }

  // Burgers vector
  if (hasBurgersVector && (chapterId === "defect" || chapterId === "wall" || chapterId === "research")) {
    items.push({
      id: "burgers-vector",
      label: "Burgers Vector (b)",
      description: "Amber arrow: slip direction (b ⟂ dislocation line)",
      color: "#f59e0b",
      type: "arrow",
      visible: true,
    });
  }

  // Atomic bonds
  if (hasBonds) {
    items.push({
      id: "bonds",
      label: "Atomic Bonds",
      description: "Nearest-neighbour connectivity lines",
      color: "#8aa0c8",
      type: "line",
      visible: true,
    });
  }

  // Chapter 3 specific items (Polycrystal mosaic)
  if (chapterId === "strength") {
    items.push({
      id: "mosaic-grains",
      label: "Grain Regions",
      description: "Polycrystalline grains with independent crystallographic orientations",
      color: "#3b82f6",
      type: "plane",
      visible: true,
    });
    items.push({
      id: "mosaic-boundaries",
      label: "Grain Boundaries",
      description: "Internal interfaces that block dislocation movement",
      color: "#cbd5e1",
      type: "line",
      visible: true,
    });
    items.push({
      id: "strength-indicator",
      label: "Strength Meter",
      description: "Emergent yield stress from pile-up mechanics",
      color: "#10b981",
      type: "gradient",
      visible: true,
    });
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        className="scene-legend-toggle-btn"
        onClick={() => setIsCollapsed(false)}
        title="Open Scene Legend"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 25,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          color: "#94a3b8",
          padding: "5px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span>ℹ Legend</span>
      </button>
    );
  }

  return (
    <aside
      className="scene-legend-panel"
      aria-label="Scene Legend"
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        zIndex: 25,
        width: "250px",
        maxHeight: "calc(100% - 100px)",
        overflowY: "auto",
        background: "rgba(15, 23, 42, 0.90)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderRadius: "8px",
        padding: "10px 12px",
        boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.4)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          paddingBottom: "6px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#38bdf8",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#e2e8f0",
              textTransform: "uppercase",
            }}
          >
            Scene Legend
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          title="Minimize Legend"
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: "12px",
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <div
              style={{
                marginTop: "2px",
                flexShrink: 0,
                width: "12px",
                height: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.type === "sphere" && (
                <div
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: item.color,
                    border: item.id === "ghost-lattice" ? "1px dashed rgba(255,255,255,0.7)" : "none",
                    boxShadow: item.id !== "ghost-lattice" ? "0 0 4px " + item.color + "88" : "none",
                    opacity: item.id === "ghost-lattice" ? 0.6 : 1,
                  }}
                />
              )}
              {item.type === "plane" && (
                <div
                  style={{
                    width: "10px",
                    height: "8px",
                    background: item.color + "44",
                    border: "1px solid " + item.color,
                    borderRadius: "1px",
                  }}
                />
              )}
              {item.type === "sheet" && (
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    background: item.color + "55",
                    border: "1px solid " + item.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: item.color }} />
                </div>
              )}
              {item.type === "line" && (
                <div
                  style={{
                    width: "11px",
                    height: "2px",
                    background: item.color,
                    boxShadow: "0 0 3px " + item.color,
                  }}
                />
              )}
              {item.type === "arrow" && (
                <div
                  style={{
                    fontSize: "11px",
                    lineHeight: "10px",
                    color: item.color,
                    fontWeight: 900,
                  }}
                >
                  ➔
                </div>
              )}
              {item.type === "gradient" && (
                <div
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #38bdf8, #e0f2fe)",
                    boxShadow: "0 0 4px #38bdf8aa",
                  }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#f1f5f9",
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "9.5px",
                  color: "#94a3b8",
                  lineHeight: 1.25,
                  marginTop: "1px",
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
