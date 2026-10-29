# Implementation Tasks: `hpsim-static-hosting`

**Change ID:** `hpsim-static-hosting`  
**Execution Order:** Never go PLAN -> IMPLEMENT. Every phase requires failing tests first (red -> green), followed by Quality Gate approval.

---

## Phase 0: Foundations & Dual-Stack Setup (1–2 days)
- [x] **TASK-001**: Configure Python environment (`pyproject.toml`, `requirements.txt`, `Makefile`, `ruff`, `mypy`).
- [x] **TASK-002**: Initialize web frontend scaffolding (`web/package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`).
- [x] **TASK-003**: Implement base-path configurable build script supporting `/` (Vercel) and `/<repo>/` (GitHub Pages).
- [ ] **TASK-004**: Create GitHub Actions CI workflow (`.github/workflows/ci.yml`) to test Python and Web builds on PRs.
- [x] **TASK-005**: Compile initial `materials.yaml` with provenance and status badges (`sourced`, `calibrated`, `illustrative`, `needs_citation`) and export to `web/public/data/materials.json`.
- [x] **TASK-006**: Document missing inputs M1–M7 and present for human review.
- **GATE 0**: Foundations configured, base-path CI verified, materials table cited and approved by human.

---

## Phase 1: Math Kernel & Cross-Language Parity (3–4 days)
- [x] **TASK-101**: Write failing Python unit/property tests for vectors, rotations, FCC slip systems, and resolved shear stress (`V-01`, `V-02`).
- [x] **TASK-102**: Implement Python reference math modules in `src/hpsim/core/`.
- [x] **TASK-103**: Write failing TypeScript unit tests for equivalent modules in `web/src/core/`.
- [x] **TASK-104**: Implement pure TypeScript math modules (`vectors.ts`, `rotations.ts`, `slipsystems.ts`, `stress.ts`).
- [x] **TASK-105**: Create golden parity export script (`scripts/export_golden_fixtures.py`) and write cross-language parity tests (`V-17`).
- **GATE 1**: V-01, V-02, and V-17 green; mypy strict clean on Python core; tsc strict clean on TypeScript core.

---

## Phase 2: Lattice & Dislocation Field Visualization (4–5 days)
- [x] **TASK-201**: Implement regularized isotropic displacement fields in Python (`fields.py`) and verify Burgers circuit (`V-03`).
- [x] **TASK-202**: Port displacement fields to TypeScript (`fields.ts`) with core regularization and parity test against Python.
- [x] **TASK-203**: Build Three.js instanced lattice renderer (`InstancedAtoms.ts`) supporting ≤ 4,000 atoms at 60 FPS with unit cell axes and slip plane overlays.
- [x] **TASK-204**: Add camera controls (`OrbitControls`) with standard view buttons (front, top, side, isometric, reset).
- [x] **TASK-205**: Verify visualization isolation test (`V-14`) ensuring Three.js renders do not mutate simulation state.
- **GATE 2**: V-03 and V-14 green; 3D lattice interactive in browser; camera controls responsive; approved by human.

---

## Phase 3: Stress-Driven Glide & Playback Controls — **STATIC MVP** (3–4 days)
- [x] **TASK-301**: Implement overdamped single-dislocation glide law in Python (`glide.py`) and TypeScript (`glide.ts`); verify V-04 (threshold, linearity, sign reversal, time-step invariance).
- [x] **TASK-302**: Implement swept-boundary collision detection; verify V-05 (step-size invariance).
- [x] **TASK-303**: Build client-side simulation loop and timeline trajectory playback (`TimelineSlider.tsx`) with play, pause, step, and reset.
- [x] **TASK-304**: Add live telemetry HUD (displaying resolved shear stress, dislocation velocity, slip plane status).
- [ ] **TASK-305**: Deploy standalone Static MVP build to preview URL (Vercel) and verify browser operation without backend.
- **GATE 3**: V-04 and V-05 green; static MVP independently deployable and usable on Vercel/GitHub Pages; approved by human.

---

## Phase 4: Grain Boundary Transmission & Explainable Event Log (4–5 days)
- [x] **TASK-401**: Implement boundary transmission logic (m′, residual Burgers vector |b_r|, outgoing RSS, tip stress) in Python (`boundary.py`) and TypeScript (`boundary.ts`).
- [x] **TASK-402**: Verify V-06 (compatibility, residual Burgers minimization, and known misorientation test cases).
- [x] **TASK-403**: Build two-grain 3D scene in Three.js showing controlled columnar boundary plane, adjacent grain wireframe, outcome marker, and candidate outgoing slip arrows.
- [x] **TASK-404**: Implement explainable event log UI in `App.tsx` displaying plain-language explanations with exact numerical metrics for pin vs. transmit decisions, candidate table, and explicit handling of uncalibrated $\tau^*_{\text{ref}}$.
- **GATE 4**: V-06 green; transmission decisions deterministically logged and verified cross-runtime; awaiting human sign-off.


---

## Phase 5: Discrete Dislocation Pile-Up Engine (5–6 days)
- [x] **TASK-501**: Implement 1D discrete pile-up force balance solver and Eshelby–Frank–Nabarro (EFN 1951) associated Laguerre polynomial root benchmark in Python (`src/hpsim/core/pileup.py`).
- [x] **TASK-502**: Validate V-07 (force balance residual < 1e-5 Pa, tip stress τ_tip = N·τ_app) and V-08 (comparison against exact EFN Laguerre roots and continuum scaling with finite-N discrete effects).
- [x] **TASK-503**: Implement matching pure TypeScript client-side pile-up solver (`web/src/core/pileup.ts`) with Golub–Welsch tridiagonal eigensolver and damped Newton relaxation.
- [x] **TASK-504**: Verify cross-language parity for pile-up positions, residuals, and tip stresses across golden fixtures (`tests/golden/phase5_fixtures.json`, `web/tests/phase5_parity.test.mjs`, `tests/test_pileup.py`).
- [x] **TASK-505**: Build interactive 1D pile-up diagram and readout in browser (`App.tsx`) displaying equilibrium dislocation positions, obstacle boundary at x=0, tip stress concentration, and EFN comparison.
- **GATE 5**: V-07, V-08, and pile-up parity tests green; analytical EFN benchmark and finite-size scaling verified; stopped at Quality Gate 5 awaiting human review.


---

## Phase 6: Emergent Hall–Petch Derivation (3–4 days)
- [x] **TASK-601**: Implement yield-onset bisection and grain-size sweep in Python (`hallpetch.py`) and TypeScript (`hallpetch.ts`).
- [x] **TASK-602**: Validate V-09 (emergent log–log slope of τ_eff,crit vs d equals −0.5 ± 0.05 over 1.5 decades).
- [x] **TASK-603**: Validate V-10 (fitted k_y consistency within 15% of analytic Hall–Petch formula).
- [x] **TASK-604**: Calibrate single scalar τ*_ref on calibration dataset; compare against held-out literature data (`V-15`).
- [x] **TASK-605**: Build responsive Hall–Petch chart in web app (`HallPetchChart.tsx` / `App.tsx`) showing discrete simulation points, fitted line, analytic continuum curve, and cited literature points.
- **GATE 6**: V-09, V-10, and V-15 evaluated and reported; headline Hall–Petch chart operational in browser; approved by human.

---

## Phase 7: Micrograph Preprocessing & Web Data Integration (4–5 days)
- [ ] **TASK-701**: Implement Python CV pipeline in `src/hpsim/micro/` (scale calibration, CLAHE/denoise, ridge/Canny edge enhancement, watershed segmentation, ASTM E112 intercept method).
- [ ] **TASK-702**: Verify V-11 (synthetic Voronoi intercept accuracy) and V-12 (segmentation cross-check).
- [ ] **TASK-703**: Export preprocessed micrograph JSON fixtures (grain boundaries, chord distributions, scale info) to `web/public/data/micrographs/`.
- [ ] **TASK-704**: Build Micrograph Overlay component in web app (`MicrographView.tsx`) displaying grain outlines, chord sampling, and slip traces.
- [ ] **TASK-705**: Implement client-side JSON/CSV drag-and-drop data importer (`DataImport.tsx`) for user chord distributions.
- **GATE 7**: V-11, V-12, V-16 evaluated; QA overlays approved; web app successfully loads precomputed micrograph fixtures and custom JSON files; approved by human.

---

## Phase 8: Final Packaging, Static Deployment & Documentation (4–5 days)
- [ ] **TASK-801**: Wire complete React web application layout with Material selector, Preset manager, 3D viewport, 2D charts, Event Log, and About/Limitations modal.
- [ ] **TASK-802**: Generate offline scientific validation report (`docs/validation_report.md`) from Python test suite.
- [ ] **TASK-803**: Create static-host smoke tests verifying all asset paths and JSON fixtures in `dist/` build.
- [ ] **TASK-804**: Deploy production build to Vercel and verify GitHub Pages secondary deployment.
- [ ] **TASK-805**: Record 3-minute demonstration walkthrough video and complete user guide (`docs/user_guide.md`).
- **GATE 8**: Levels 1–10 test ladder green; production URLs operational on Vercel and GitHub Pages; final human sign-off.
