# Requirements: Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)

**Defined:** 2026-10-29
**Core Value:** Emergent Hall–Petch $d^{-1/2}$ scaling from discrete dislocation pile-up mechanics with strict Python/TypeScript parity and verified scientific provenance.

## v1 Requirements

### Core Physics & Crystallography (Completed in Phases 1–5)

- [x] **FR-01**: Generate FCC lattice with correct basis, unit cell, and neighbour pairs (`V-01`, `V-14`).
- [x] **FR-02**: Define slip systems per structure (FCC $\{111\}\langle 110\rangle = 12$; BCC $\{110\}\langle 111\rangle = 12$) and transform by grain rotation (`V-01`).
- [x] **FR-03**: Compute resolved shear stress from full stress tensor and verify against Schmid factor oracle (`V-02`).
- [x] **FR-04**: Single edge dislocation overdamped glide with threshold $\tau_c$, linear mobility, sign reversal, and swept-boundary collision detection (`V-04`, `V-05`).
- [x] **FR-05**: Regularized isotropic edge displacement field with Burgers-circuit validation (`V-03`).
- [x] **FR-06**: Grain-boundary transmission/pinning decision using $m'$, residual Burgers vector $|\mathbf{b}_r|$, and outgoing RSS $\tau_{\text{out}}$ with explainable numeric event log (`V-06`).
- [x] **FR-07**: Discrete 1D pile-up solver with source shut-off, tip stress $\tau_{\text{tip}} = N\tau_{\text{eff}}$, and Eshelby–Frank–Nabarro benchmark (`V-07`, `V-08`).
- [x] **FR-12**: Audited material database (`materials.yaml`) with per-parameter source and verification status.

### Emergent Hall–Petch & Calibration (Phase 6)

- [x] **FR-08**: Yield-onset finder (bisection on applied stress for $\tau_{\text{tip}}(L, \tau_{\text{eff}}) \ge \tau^*$) and grain-size sweep; OLS + bootstrap Hall–Petch fit ($\sigma_y = \sigma_0 + k_y d^{-1/2}$) and log–log slope verification (`V-09`, `V-10`).
- [x] **FR-08B**: Calibrate single scalar $\tau^*_{\text{ref}}$ per material against verified literature fits (`hall_petch_verified_fits.csv`), update `materials.yaml` / `materials.json` with `calibrated` status badge, and evaluate held-out comparison (`V-15`) and interactive `HallPetchChart` in web UI.

### Micrograph Computer Vision Pipeline & Overlays (Phase 7)

- [x] **FR-09**: Offline Python micrograph pipeline (`src/hpsim/micro/`): scale calibration, CLAHE/denoise preprocessing, boundary segmentation, mandatory QA overlays, ASTM E112 lineal intercept $\bar{\ell}$ with 95% CI, area-equivalent diameter, chord-length distribution, and grain adjacency graph (`V-11`, `V-12`).
- [x] **FR-10**: Rescaled-micrograph sweep scaling measured chord distributions to target mean grain sizes while preserving coefficient of variation (`V-16`).
- [x] **FR-11**: Seeded grain orientation assignment from $\mathrm{SO}(3)$ (`V-13`).
- [x] **FR-19**: Export sanitized/open-licensed micrograph geometry fixtures to `web/public/data/micrographs/`, render interactive Micrograph Overlay (`MicrographView`), and support client-side JSON/CSV chord distribution drag-and-drop import (`DataImport`).

### Packaging, Validation Report & Final Verification (Phase 8)

- [x] **FR-13**: Complete unified React + TypeScript + Three.js web application wiring all views (3D Lattice & Glide, Boundary Transmission, 1D Pile-Up, Emergent Hall–Petch Chart, Micrograph Overlay & Data Import, Explainable Event Log, and About/Limitations modal).
- [x] **FR-14**: Deterministic experiment presets and CLI/script runner (`scripts/run_presets.py`) plus one-click web presets.
- [x] **FR-15**: Auto-generated `docs/validation_report.md`, `docs/limitations.md`, and `docs/user_guide.md` summarizing all validation benchmarks (`V-01`–`V-17`).
- [x] **FR-16**: Visible units and parameter provenance badges (`sourced`, `calibrated`, `illustrative`, `needs_citation`) across all plots and UI panels.
- [x] **FR-17 / FR-18**: Base-path portable static build (`vite build`) verified with headless smoke tests and zero runtime network calls.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Atomistic MD / EAM potentials | Continuum elasticity analytical visualization only (`A8`) |
| Inverse Hall–Petch nanocrystalline regime | Restricted to $d \gtrsim 1\,\mu\text{m}$ pile-up regime (`A7`) |
| Public redistribution of CC BY-NC-SA 4.0 raw micrographs | Retained locally in `data/micrographs/` per licence (`D6`) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FR-01 | Phase 2 | Complete |
| FR-02 | Phase 1 | Complete |
| FR-03 | Phase 1 | Complete |
| FR-04 | Phase 3 | Complete |
| FR-05 | Phase 2 | Complete |
| FR-06 | Phase 4 | Complete |
| FR-07 | Phase 5 | Complete |
| FR-12 | Phase 1 | Complete |
| FR-08 | Phase 6 | Complete |
| FR-08B | Phase 6 | Complete |
| FR-09 | Phase 7 | Complete |
| FR-10 | Phase 7 | Complete |
| FR-11 | Phase 7 | Complete |
| FR-19 | Phase 7 | Complete |
| FR-13 | Phase 8 | Complete |
| FR-14 | Phase 8 | Complete |
| FR-15 | Phase 8 | Complete |
| FR-16 | Phase 8 | Complete |
| FR-17 | Phase 8 | Complete |
| FR-18 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-29*
*Last updated: 2026-10-29 after OpenSpec-to-GSD migration*
