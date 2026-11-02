# Phase 9 Research: One-Click Beginner Experience

## 1. Engine Capability — Edge vs Screw

**Verdict: The existing engine supports EDGE dislocations only. Screw is not implemented.**

Evidence:
- `web/src/core/fields.ts`: Only exports `edgeDisplacement(x, y, b, nu, rc)` (plane-strain Volterra edge field). No `screwDisplacement` or anti-plane function exists.
- `web/src/core/dislocation.ts`: `displacedPositions()` calls only `edgeDisplacement()`. The local frame docstring explicitly states this is the edge convention (`x → b/glide, y → n`).
- `web/src/core/glide.ts`: `calculateGlideVelocity(tauRss, tauC, Md, b)` is character-agnostic (scalar overdamped law), but it is always driven by an edge-frame resolved shear stress.
- `web/src/model/demo.ts`: `buildDemo()` hardcodes FCC edge geometry via `makeDislocationGeometry(s, n, a, box)` and `edgeDisplacement` via the field param.

**Implementation consequence for AC-4 / acceptance criterion 4:**
- Only edge dislocation can be simulated and correctly labelled.
- Screw dislocation visualization would require adding `screwDisplacement(x, y, z, b, nu, rc)` (anti-plane + in-plane Volterra screw field) and extending `displacedPositions()` to accept dislocation character — a non-trivial engine change.
- Per the phase spec: "If the engine cannot physically simulate one of the two dislocation types, do not label an edge-dislocation animation as a screw dislocation. Report the limitation."
- **Recommendation**: Phase 9 implements edge only. The beginner UI labels it "edge dislocation (straight line defect, ⊥ symbol)" with a visible note: "Screw dislocation visualization not yet implemented — the current engine solves the edge (plane-strain) Volterra field only." This is scientifically honest.

---

## 2. Simulation API Contract

### `buildDemo(opts: DemoOptions): DemoBuild`

File: `web/src/model/demo.ts`

```typescript
interface DemoOptions {
  cells: number;          // e.g. 5 (controls lattice size)
  systemIndex: number;    // FCC slip system index (0–11)
  axisKey: string;        // "[001]" | "[011]" | "[111]" | "[123]"
  appliedStress_pa: number;
  grain2TiltDeg?: number;
  mPrimeMin?: number;
  useIllustrativeTauStar?: boolean;
  illustrativeTauStarRef_pa?: number;
  illustrativeTauTip_pa?: number;
  beta?: number;
}
```

Returns: `{ controller: SimulationController, b_m, ideal, geom, field, ... }`

All illustrative parameters (tau_c = 5 MPa, M_d = 1e4, dt = 2e-13 s) are baked into `ILLUSTRATIVE` constants. The beginner UI calls `buildDemo` exactly like the existing `App.tsx` does.

### `bestSystemIndex(axis: Vec3): number`

Returns the FCC slip system index with highest Schmid factor for the given loading axis.

Best axis for single-slip beginner demo: `[001]` (system 0, m ≈ 0.408, cleanest single-slip FCC).

### `LOADING_AXES` map

```typescript
{ "[001]": [0,0,1], "[011]": [0,1,1], "[111]": [1,1,1], "[123]": [1,2,3] }
```

### `SimulationController`

```typescript
class SimulationController {
  constructor(cfg: ControllerConfig)  // cfg: { params, s, n, loadingAxis, appliedStress_pa }
  step(): void                         // advance one fixed dt
  seek(i: number): void               // replay to step i
  reset(): void                       // back to start
  setAppliedStress(pa: number): void
  readout(): Readout                  // { tauRss_pa, tauC_pa, velocity_mps, pos_m, status, step, t_s, replaying }
  state: SimState                     // { pos_m, status: "initial"|"gliding"|"at_domain_limit" }
  history: SimState[]
}
```

Simulation ends when `state.status === "at_domain_limit"` (dislocation hits grain boundary).

### `Viewer`

```typescript
class Viewer {
  constructor(hostElement: HTMLDivElement)
  loadStructure(demo: DemoBuild): void
  setCorePosition(pos_m: number): void
  setView(v: "front"|"top"|"side"|"isometric"): void
  setLayer(l: Layer, on: boolean): void
  resetCamera(): void
  updateTransmission(result: TransmissionResult): void
  dispose(): void
}
```

**Layer names** (from `LAYERS`): `atoms`, `bonds`, `cell`, `axes`, `slipPlane`, `burgers`, `core`, `boundary`, `outgoingCandidates`.

For the beginner view, turn on: `atoms`, `slipPlane`, `core`. Turn off: `bonds`, `cell`, `axes`, `boundary`, `outgoingCandidates`, `burgers` (too cluttered for a beginner).

**Slow motion**: Achieved by reducing `speed` multiplier in the `framesToSteps()` playback loop — NOT by changing `dt_s` or material parameters. Speed = 0.15–0.25 gives visible slow motion.

---

## 3. Hall–Petch API Contract

### `runHallPetchSweep(inputs: HallPetchSweepInputs): HallPetchSweepResult`

File: `web/src/core/hallpetch.ts`

Key output fields:
```typescript
interface HallPetchSweepResult {
  points: HallPetchPoint[];     // array of 16 grain-size sweep points
  logSlope: number;             // emergent power-law exponent (~-0.483)
  olsKyPaM05: number;           // fitted k_y in Pa·m^0.5
  sigma0Pa: number;             // σ₀ in Pa
  bootstrapCIKy: [number, number]; // 95% CI
}
interface HallPetchPoint {
  grainSizeM: number;           // d in metres
  invSqrtDM05: number;          // d^{-1/2} in m^{-0.5} → convert to μm^{-0.5} for display
  sigmaYPa: number;             // σ_y from discrete pile-up (in Pa → convert to MPa)
  sigmaYAnalyticPa: number;     // σ_y from continuum analytic formula
}
```

### `CALIBRATED_MATERIALS` — recommended material for beginner

**Use `aluminium`**:
- `tauCStatus: "sourced"` (no unresolved citations)
- `calibratedTauStarRefPa` is set (fully calibrated)
- Provenance: calibrated against Hansen & Ralph (1982), verified against held-out Feltham & Meakin (1957)
- Log slope ~-0.483 (within V-09 tolerance)
- Held-out error: 3.34% (best of all materials)

**Graph provenance label**: "Calibrated model trend (Hansen & Ralph 1982 / aluminium)" — NOT raw experimental data.

**Axis labels**:
- X: `d⁻¹/² (μm⁻¹/²)` — convert from m⁻⁰·⁵ by × 1e-3 (since 1 m⁻⁰·⁵ = 1e-3 μm⁻⁰·⁵)
- Y: `σ_y (MPa)` — convert from Pa by ÷ 1e6

**Hall–Petch line equation notation in graph**: `σ_y = σ₀ + k_y · d⁻¹/²` (shear strength σ_y, as used by the engine).

---

## 4. Current App.tsx Routing / Layout

- **No router**: `App.tsx` is a single monolithic React component (~2200 lines). There is no React Router or any client-side routing.
- **Entry point**: `web/index.html` → `web/src/main.tsx` (or similar) → `<App />`
- **Layout**: `.app` flex column → `.banner` (header with controls) → `.layout` (2-column grid: `.viewport` + `.panel` aside)
- **All scientific controls** live in `<aside className="panel">` containing multiple `.card` divs

**Strategy for Phase 9**: Add a new top-level `view` state to `App.tsx`:
```typescript
type AppView = "beginner" | "advanced";
const [appView, setAppView] = useState<AppView>("beginner");
```
When `appView === "beginner"`, render `<BeginnerScreen />` component (new file). When `appView === "advanced"`, render the existing dense layout. This avoids routing library and keeps the file structure minimal.

Alternatively: Move the advanced layout to `<AdvancedApp />` in a new file and have `App.tsx` orchestrate the routing.

---

## 5. Tests at Risk

All 15 `.test.mjs` files in `web/tests/` are **pure scientific/math unit tests**. None render the React DOM or check element IDs. They test:

| File | Tests |
|------|-------|
| `phase1_parity.test.mjs` | Vectors, rotations, slip systems, stress tensor |
| `phase23_field.test.mjs` | Edge displacement field, Burgers circuit |
| `phase23_parity.test.mjs` | Cross-language golden fixtures |
| `phase3_glide.test.mjs` | Glide velocity, overdamped law |
| `phase4_parity.test.mjs` | Boundary transmission, m', b_r |
| `phase5_parity.test.mjs` | EFN pile-up eigensolver |
| `phase6_parity.test.mjs` | Hall–Petch sweep golden parity |
| `phase7_parity.test.mjs` | Micrograph chords, ASTM E112 |
| `test_hallpetch.test.mjs` | Hall–Petch calibration and provenance |
| `test_pileup.test.mjs` | Pile-up equilibrium |
| `test_boundary.test.mjs` | LRB boundary transmission |
| `test_micrograph.test.mjs` | Chord stats and rescaling |
| `test_local_frame_parity.test.mjs` | Local frame orthonormality |
| `static_smoke.test.mjs` | File existence, `.nojekyll`, build artifacts |
| `isolation.test.mjs` | Module isolation |

**No test checks React rendering or DOM IDs** → Phase 9 UI changes carry zero Node.js test risk.

**`static_smoke.test.mjs`** checks that `web/public/data/materials.json` and `web/public/data/micrographs/` exist — not affected by UI refactor.

Python `pytest` suite: 173 tests, all pure scientific — not affected.

**`tsc --noEmit`** will validate any new `.ts`/`.tsx` files against the existing strict TypeScript config.

---

## 6. Recommended Architecture

### New files (beginner UI only, never touch scientific engine)
```
web/src/ui/
  BeginnerScreen.tsx    — top-level beginner landing + simulation view
  HallPetchChart.svg.tsx — simple inline SVG Hall–Petch line chart
  beginner.css          — minimal additional styles for beginner screen
```

### Modified files
```
web/src/ui/App.tsx      — add `appView` state, conditional render
web/src/ui/styles.css   — add .beginner-* CSS classes (non-breaking additions only)
```

### Do not modify
- Any file under `web/src/core/`
- Any file under `web/src/render/`
- `web/src/model/demo.ts`
- All test files
- `pyproject.toml`, `src/hpsim/`, `tests/`

### Routing pattern (no router library)
```tsx
// App.tsx
const [appView, setAppView] = useState<"beginner" | "advanced">("beginner");
if (appView === "beginner") return <BeginnerScreen onGoAdvanced={() => setAppView("advanced")} />;
return <AdvancedDashboard onGoHome={() => setAppView("beginner")} />;
```

`BeginnerScreen` owns its own `Viewer` ref, `SimulationController` ref, and playback loop — clean isolation from the advanced state.

---

## 7. Screw Dislocation Conclusion

**Screw dislocation visualization is NOT supported by the existing engine and CANNOT be done without engine changes.**

To add screw:
1. `fields.ts`: Add `screwDisplacement(x, z, b)` — anti-plane field `u_z = (b/2π) × atan2(z, x)` with regularization
2. `dislocation.ts`: Accept `character: "edge" | "screw"` and branch between `edgeDisplacement` and `screwDisplacement`
3. `controller.ts` / `glide.ts`: Screw uses the same overdamped glide law (character-agnostic), but the viewer would need to show the anti-plane distortion rather than in-plane ⊥ distortion

This is a legitimate engine extension (not difficult scientifically), but it requires touching verified core files with golden fixtures. The risk of breaking `V-03` (Burgers circuit) or cross-language parity tests is non-trivial.

**Phase 9 plan**: Implement edge only with honest labelling. Note in the UI: "Edge dislocation shown (⊥). Screw dislocation support planned." This preserves scientific integrity per the spec's explicit instruction.

---

## RESEARCH COMPLETE

Phase 9 research complete. Output: `.planning/phases/09-one-click-beginner-experience/09-RESEARCH.md`

Key findings:
1. **Edge only** — engine does not support screw; label honestly
2. **buildDemo + SimulationController + Viewer** are the complete API for the beginner animation
3. **aluminium preset** from `CALIBRATED_MATERIALS` for Hall–Petch chart (best provenance)
4. **No router needed** — simple `appView` state in App.tsx routes between beginner and advanced
5. **Zero test risk** — all 15 Node tests are pure math, no DOM/React rendering
6. **Slow motion** via `speed` multiplier in playback loop, NOT physics changes

