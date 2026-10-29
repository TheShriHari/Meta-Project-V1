# Roadmap: Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)

## Milestones

- 🚧 **v1.0 Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator** - Phases 1-8 (in progress)

## Overview

Build and validate `hpsim` across 8 phases: from audited literature/micrograph data and the crystallographic math kernel (Phases 1–3), through grain-boundary transmission and 1D discrete dislocation pile-ups (Phases 4–5, complete), to emergent Hall–Petch derivation (Phase 6), real micrograph segmentation & chord-distribution integration (Phase 7), and final web packaging & validation report generation (Phase 8).

## Phases

- [x] **Phase 1: Math Kernel & Cross-Language Parity** - Vectors, Euler ZXZ rotations, FCC/BCC slip systems, Cauchy stress tensor RSS, and audited materials loader (`V-01`, `V-02`, `V-17`)
- [x] **Phase 2: Lattice & Dislocation Field Visualization** - 3D FCC lattice generator, regularized isotropic edge displacement field, Burgers circuit validation (`V-03`), and Three.js `InstancedMesh` viewer (`V-14`)
- [x] **Phase 3: Stress-Driven Glide & Playback Controls** - Overdamped dislocation glide kinematics (`V-04`), swept-boundary intersection (`V-05`), and trajectory playback HUD
- [x] **Phase 4: Grain Boundary Transmission & Explainable Event Log** - Livingston–Gorczyca $m'$, residual Burgers vector $|\mathbf{b}_r|$, outgoing RSS $\tau_{\text{out}}$ (`V-06`), and two-grain 3D boundary scene
- [x] **Phase 5: Discrete Dislocation Pile-Up Engine** - 1D pile-up equilibrium solver, Golub–Welsch EFN Laguerre benchmark, tip stress identity $\tau_{\text{tip}} = N\tau_{\text{eff}}$ (`V-07`, `V-08`), and interactive 1D pile-up SVG card
- [x] **Phase 6: Emergent Hall–Petch Derivation** - Source-shutoff pile-up yield-onset bisection, grain-size sweep, emergent $d^{-1/2}$ scaling (`V-09`), analytic $k_y$ consistency (`V-10`), $\tau^*_{\text{ref}}$ calibration & literature comparison (`V-15`), and interactive `HallPetchChart`
- [ ] **Phase 7: Micrograph Preprocessing & Web Data Integration** - Offline Python CV pipeline (`src/hpsim/micro/`), synthetic Voronoi intercept validation (`V-11`), real micrograph segmentation & QA overlays (`V-12`), chord rescaling (`V-16`), and web micrograph overlay + JSON/CSV importer
- [ ] **Phase 8: Final Packaging, Validation Report & Static Build Verification** - Complete multi-panel web app integration, deterministic experiment presets, auto-generated `docs/validation_report.md` & `docs/limitations.md`, and full 10-level test ladder verification

## Phase Details

### Phase 1: Math Kernel & Cross-Language Parity
**Goal**: Implement and verify pure Python and TypeScript crystallographic math modules (`vectors`, `rotations`, `slipsystems`, `stress`, `units`, `rng`, `materials/loader`) with cross-language golden parity.
**Depends on**: Nothing (first phase)
**Requirements**: [FR-02, FR-03, FR-12]
**Success Criteria** (what must be TRUE):
  1. FCC and BCC each produce 12 unique orthonormal slip systems (`V-01`).
  2. Tensor resolved shear stress matches uniaxial Schmid factor oracle within $10^{-12}$ (`V-02`).
  3. Python and TypeScript cores match across `tests/golden/phase1_fixtures.json`.
**Plans**: 1 plan

Plans:
- [x] 01-01: Math kernel, slip systems, stress tensor, and cross-runtime parity fixtures

### Phase 2: Lattice & Dislocation Field Visualization
**Goal**: Generate 3D FCC atomic lattices and regularized isotropic edge-dislocation continuum displacement fields verified by Burgers circuit integration, rendered interactively in Three.js.
**Depends on**: Phase 1
**Requirements**: [FR-01, FR-05]
**Success Criteria** (what must be TRUE):
  1. Counter-clockwise Volterra Burgers circuit enclosing the dislocation core integrates to $+b$ within $10^{-3}b$ and $0$ outside (`V-03`).
  2. Three.js `InstancedMesh` renders $\le 4,000$ atoms without mutating physics state (`V-14`).
**Plans**: 1 plan

Plans:
- [x] 02-01: FCC lattice, regularized edge displacement field, Burgers circuit, and Three.js viewer

### Phase 3: Stress-Driven Glide & Playback Controls
**Goal**: Implement overdamped single-dislocation glide kinematics with threshold $\tau_c$, swept-segment boundary collision detection, and interactive timeline playback controls.
**Depends on**: Phase 2
**Requirements**: [FR-04]
**Success Criteria** (what must be TRUE):
  1. Dislocation velocity is zero for $|\tau| \le \tau_c$, linear above, reverses with stress sign, and is $\Delta t$-invariant (`V-04`).
  2. Swept-boundary test detects boundary crossing accurately even when single step is $100\times$ larger than distance to boundary (`V-05`).
**Plans**: 1 plan

Plans:
- [x] 03-01: Overdamped glide law, swept-boundary intersection, and timeline playback controls

### Phase 4: Grain Boundary Transmission & Explainable Event Log
**Goal**: Implement deterministic grain-boundary transmission/pinning criteria ($m'$, $|\mathbf{b}_r|$, $\tau_{\text{out}}$, $\tau^*(m')$) with tie-breaking, golden parity fixtures, and explainable UI event logging.
**Depends on**: Phase 3
**Requirements**: [FR-06]
**Success Criteria** (what must be TRUE):
  1. Identical grain orientations yield $m' = 1, |\mathbf{b}_r| = 0$ and rotated pairs match analytical $m'$ (`V-06`).
  2. Missing/uncalibrated $\tau^*_{\text{ref}}$ explicitly reports `unresolved_threshold` without fabricated defaults.
**Plans**: 1 plan

Plans:
- [x] 04-01: Boundary transmission engine, golden parity fixtures, and two-grain 3D boundary UI

### Phase 5: Discrete Dislocation Pile-Up Engine
**Goal**: Implement 1D discrete edge-dislocation pile-up solver and Golub–Welsch associated Laguerre polynomial root benchmark (Eshelby–Frank–Nabarro 1951) in Python and TypeScript with interactive 1D pile-up visualization.
**Depends on**: Phase 4
**Requirements**: [FR-07]
**Success Criteria** (what must be TRUE):
  1. Force-balance residual on mobile dislocations is $< 10^{-9}\tau_{\text{eff}}$ and tip stress satisfies $\tau_{\text{tip}} = N\tau_{\text{eff}}$ within $10^{-6}$ relative (`V-07`).
  2. Discrete equilibrium positions match exact EFN Laguerre zeros and asymptotic continuum scaling $N_{\text{asymp}} = \pi(1-\nu)L\tau_{\text{eff}}/(Gb)$ is tabulated (`V-08`).
**Plans**: 1 plan

Plans:
- [x] 05-01: Python & TypeScript 1D pile-up engine, EFN Golub–Welsch benchmark, golden fixtures, and UI card

### Phase 6: Emergent Hall–Petch Derivation
**Goal**: Derive emergent Hall–Petch $d^{-1/2}$ strengthening from discrete pile-ups with source shut-off and yield-onset bisection, verify `V-09` (log–log slope $-0.5 \pm 0.05$) and `V-10` ($k_y$ consistency within 15%), calibrate $\tau^*_{\text{ref}}$ per material against verified literature fits (`V-15`), and integrate an interactive Hall–Petch chart in the browser UI.
**Depends on**: Phase 5
**Requirements**: [FR-08, FR-08B]
**Success Criteria** (what must be TRUE):
  1. Quasi-static source shut-off (`solve_pileup_with_source`) and yield-onset bisection (`find_yield_onset`) find the critical effective shear stress $\tau_{\text{eff,crit}}(d)$ where $\tau_{\text{tip}}(L=d/2) \ge \tau^*(m')$ in both Python (`src/hpsim/core/hallpetch.py`) and TypeScript (`web/src/core/hallpetch.ts`) with golden parity (`tests/golden/phase6_fixtures.json`).
  2. Log–log slope of $\tau_{\text{eff,crit}}$ vs $d$ over $\ge 1.5$ decades of grain size equals $-0.5 \pm 0.05$ (`V-09`), and OLS + bootstrap fitted $k_y$ agrees within 15% of the analytical continuum formula $k_y = M_T\sqrt{2Gb\tau^*/(\pi(1-\nu))}$ (`V-10`).
  3. Single scalar $\tau^*_{\text{ref}}$ is calibrated per material against verified literature fits (`data/literature/hall_petch_verified_fits.csv`), recorded as `calibrated` in `materials.yaml` / `web/public/data/materials.json`, and evaluated honestly against held-out literature fits (`V-15`).
  4. Interactive `HallPetchChart` in `web/src/ui/` plots simulated discrete pile-up yield points, OLS regression line with CI, continuum EFN analytical curve, and cited literature fits with clear provenance badges (`sourced`, `calibrated`, `illustrative`).
**Plans**: 1 plan

Plans:
- [x] 06-01: Python & TypeScript source shut-off, yield-onset bisection, Hall–Petch sweep, calibration (`V-09`, `V-10`, `V-15`), golden parity fixtures, and interactive SVG chart

### Phase 7: Micrograph Preprocessing & Web Data Integration
**Goal**: Implement the offline Python micrograph analysis pipeline (`src/hpsim/micro/`) for synthetic Voronoi validation (`V-11`), real metallographic image segmentation, QA overlays, and ASTM E112 lineal intercept grain-size measurement (`V-12`), chord-length distribution extraction and rescaling (`V-16`), seeded grain orientations (`V-13`), and interactive browser micrograph overlay + local JSON/CSV chord import.
**Depends on**: Phase 6
**Requirements**: [FR-09, FR-10, FR-11, FR-19]
**Success Criteria** (what must be TRUE):
  1. Synthetic Voronoi microstructures of known mean grain size recover mean lineal intercept $\bar{\ell}$ within 10% across $\ge 3$ sizes and seeds (`V-11`), and rescaled chord distributions match target mean within $10^{-9}$ relative while preserving coefficient of variation (`V-16`).
  2. Real micrographs in `data/micrographs/` are calibrated, segmented (respecting `M4` Cu twin exclusion and `M5` steel ferrite-only masking), produce QA boundary overlays in `docs/screenshots/`, and compare automated vs manual intercept counts on $\ge 3$ reference lines (`V-12`).
  3. Sanitized/open-licensed micrograph geometry and chord distributions are exported to `web/public/data/micrographs/` (never bundling raw CC BY-NC-SA DoITPoMS images), and the web UI displays the interactive Micrograph Overlay (`MicrographView`) plus client-side JSON/CSV drag-and-drop import (`DataImport`) feeding the Hall–Petch simulator.
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: Final Packaging, Validation Report & Static Build Verification
**Goal**: Wire all simulation layers, presets, and documentation into the unified web application and Python CLI/report generator, auto-generate `docs/validation_report.md`, `docs/limitations.md`, and `docs/user_guide.md`, and pass all 10 levels of the verification ladder.
**Depends on**: Phase 7
**Requirements**: [FR-13, FR-14, FR-15, FR-16, FR-17, FR-18]
**Success Criteria** (what must be TRUE):
  1. Auto-generated `docs/validation_report.md` and `docs/limitations.md` report all benchmarks `V-01` through `V-17` with exact numbers, tolerances, and honest provenance status.
  2. Deterministic experiment presets run via Python CLI (`scripts/run_presets.py`) and one-click web UI selector, with prominent About & Scientific Limitations modal.
  3. Full test ladder (Python `pytest`, scientific data audit, Node/TS parity tests, `tsc --noEmit`, `vite build` with base-path portability, and headless Playwright browser smoke/console checks) passes with 0 errors.
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Math Kernel & Cross-Language Parity | 1/1 | Complete | 2026-10-20 |
| 2. Lattice & Dislocation Field Visualization | 1/1 | Complete | 2026-10-20 |
| 3. Stress-Driven Glide & Playback Controls | 1/1 | Complete | 2026-10-20 |
| 4. Grain Boundary Transmission & Explainable Event Log | 1/1 | Complete | 2026-10-21 |
| 5. Discrete Dislocation Pile-Up Engine | 1/1 | Complete | 2026-10-21 |
| 6. Emergent Hall–Petch Derivation | 1/1 | Complete | 2026-10-29 |
| 7. Micrograph Preprocessing & Web Data Integration | 0/1 | Not started | - |
| 8. Final Packaging, Validation Report & Static Build Verification | 0/1 | Not started | - |
