# Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)

## What This Is

`hpsim` is a scientific simulation, metallographic image analysis, and interactive 3D/2D teaching and research tool that simulates discrete edge-dislocation pile-ups at grain boundaries, drives them with real grain-size statistics extracted from optical micrographs (aluminium, copper, pure α-iron, ferritic steel), and demonstrates how the Hall–Petch $d^{-1/2}$ strengthening relation emerges from dislocation pile-up mechanics. It uses a dual-stack architecture: a pure Python scientific reference and computer-vision toolchain (`src/hpsim/`) paired with a zero-server React + TypeScript + Vite + Three.js browser runtime (`web/`).

## Core Value

Show that the Hall–Petch $d^{-1/2}$ relationship and slope $k_y$ emerge quantitatively from 1D discrete edge-dislocation pile-up mechanics (verified against Eshelby–Frank–Nabarro analytical benchmarks and cited literature fits) with zero fabricated material constants and strict cross-language parity between Python and TypeScript.

## Requirements

### Validated

- ✓ **FR-01 / FR-02 / FR-03**: FCC lattice generation, 12 $\{111\}\langle 110\rangle$ slip systems, Euler ZXZ grain rotations, and tensor resolved shear stress (Schmid oracle) — Phases 1–2
- ✓ **FR-04 / FR-05**: Regularized isotropic edge-dislocation displacement field (Burgers circuit closure $< 10^{-14}b$) and overdamped single-dislocation glide with swept-boundary collision detection — Phases 2–3
- ✓ **FR-06**: Deterministic grain-boundary transmission/pinning engine using Livingston–Gorczyca $m'$, residual Burgers vector $|\mathbf{b}_r|$, outgoing RSS $\tau_{\text{out}}$, and explainable event log — Phase 4
- ✓ **FR-07**: 1D discrete dislocation pile-up force-balance solver, Golub–Welsch associated Laguerre polynomial root benchmark (Eshelby–Frank–Nabarro 1951), and tip stress identity $\tau_{\text{tip}} = N\tau_{\text{eff}}$ — Phase 5
- ✓ **FR-12**: Audited material property database (`src/hpsim/materials/materials.yaml`) and verified literature fits (`data/literature/hall_petch_verified_fits.csv`) — Phase 0

### Active

- [ ] **FR-08**: Yield-onset bisection finder, grain-size sweep, emergent $d^{-1/2}$ exponent verification (`V-09`), analytic $k_y$ consistency (`V-10`), calibration of $\tau^*_{\text{ref}}$ per material, and literature comparison (`V-15`) — Phase 6
- [ ] **FR-09 / FR-10 / FR-11**: Offline Python micrograph segmentation pipeline (`src/hpsim/micro/`: scale calibration, CLAHE/denoise, boundary segmentation, QA overlays, ASTM E112 lineal intercept $\bar{\ell}$, chord distributions, rescaled sweep `V-16`, Voronoi validation `V-11`, manual cross-check `V-12`) and exported JSON fixtures for browser overlay — Phase 7
- [ ] **FR-13 / FR-14 / FR-15 / FR-16 / FR-17 / FR-18 / FR-19**: End-to-end web application wiring (Hall–Petch chart, Micrograph overlay, JSON/CSV drag-and-drop import, presets, About/Limitations modal) and auto-generated `docs/validation_report.md` and `docs/limitations.md` — Phase 8

### Out of Scope

- Molecular dynamics / atomistic interatomic potentials — 3D atomic positions are strictly an analytical continuum-elasticity displacement visualization (`A8`).
- Nanocrystalline inverse Hall–Petch regime ($d \lesssim 1\,\mu\text{m}$) — restricted to micron-scale Hall–Petch regime (`A7`).
- Bundling CC BY-NC-SA 4.0 DoITPoMS raw micrographs in public web assets — kept strictly in local `data/micrographs/`; only derived geometry/synthetic/CC-BY-SA fixtures are bundled (`D6`).
- Inventing or fabricating material parameters ($\sigma_0, k_y, \tau_c, \tau^*_{\text{ref}}$) or claiming reconstructed regression points are raw experimental tensile measurements (`D4`, `D5`).

## Context

- `spec.md` (repo root) and `openspec/changes/hpsim-static-hosting/` define all mathematical models, validation benchmarks (`V-01` through `V-17`), and scientific honesty rules.
- Python test suite (`pytest`) currently has 136 passing tests; TypeScript test suite (`node --test`) has 56 passing tests; data audit (`scripts/validate_data_acquisition.py`) passes 6/6 checks.

## Constraints

- **Pure Core Separation (NFR-04)**: `src/hpsim/core`, `src/hpsim/micro`, and `web/src/core` MUST NOT import UI, DOM, or rendering modules.
- **Cross-Language Parity (NFR-10)**: TypeScript core calculations must match Python reference calculations across golden fixtures (`tests/golden/`).
- **Scientific Integrity**: Every figure and UI control must display units and parameter provenance badges (`sourced`, `calibrated`, `illustrative`, `needs_citation`).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dual-stack Python reference + React/TS/Three.js static web client (`ADR-009`) | Enables zero-server static hosting while keeping Python NumPy/SciPy/scikit-image as scientific ground truth | ✓ Good |
| Golub–Welsch tridiagonal Jacobi eigensolver for EFN Laguerre roots | Exact analytical benchmark for 1D pile-up positions without root-finding instability | ✓ Good |
| Segregate `hall_petch_verified_fits.csv` from `RECONSTRUCTED_FROM_FIT` points | Prevents circular validation on synthetic points sampled from published regression lines | ✓ Good |
| Exclude annealing twins in Cu (`M4`) and mask pearlite in ferritic steel (`M5`) | Follows ASTM E112 and Hansen & Ralph (1982) conventions | ✓ Good |

---
*Last updated: 2026-10-29 during GSD initialization at Phase 6 entry*
