# Reconciled Requirements: `hpsim-static-hosting`

This document details the functional and non-functional requirements for HPSim adapted for zero-server static hosting on Vercel and GitHub Pages.

---

## 1. Functional Requirements (FR)

| ID | Status | Requirement | Implementation Target |
|---|---|---|---|
| **FR-01** | Retained (Dual) | Generate an FCC lattice (and BCC at Phase 8 if time permits) with correct basis, unit cell, and neighbour pairs. | Python reference (`src/hpsim/core/lattice.py`) & TypeScript (`web/src/core/lattice.ts`) |
| **FR-02** | Retained (Dual) | Define slip systems per structure (FCC {111}⟨110⟩ = 12; BCC {110}⟨111⟩ = 12) and transform them by grain rotation. | Python reference (`slipsystems.py`) & TypeScript (`slipsystems.ts`) |
| **FR-03** | Retained (Dual) | Compute resolved shear stress (RSS) from full stress tensor; expose uniaxial Schmid-factor oracle. | Python reference (`stress.py`) & TypeScript (`stress.ts`) |
| **FR-04** | Retained (Dual) | Single edge dislocation glide with threshold, mobility law, sign reversal, and fixed time stepping. | Python reference (`glide.py`) & TypeScript (`glide.ts`) |
| **FR-05** | Retained (Dual) | Isotropic edge (and screw) displacement field with core regularization; Burgers-circuit validation. | Python reference (`fields.py`) & TypeScript (`fields.ts`) |
| **FR-06** | Retained (Dual) | Boundary encounter detection by swept path; transmission/pinning decision using m′, residual Burgers vector, and outgoing RSS; every decision logged with numbers. | Python reference (`transmission.py`) & TypeScript (`transmission.ts`) |
| **FR-07** | Retained (Dual) | Discrete 1D pile-up solver with source shut-off; returns N, positions, tip stress, back stress. | Python reference (`pileup.py`) & TypeScript client solver (`pileup.ts`) |
| **FR-08** | Retained (Dual) | Yield-onset finder (bisection on applied stress) and grain-size sweep; Hall–Petch fit with uncertainty. | Python reference (`hallpetch.py`) & TypeScript client sweep (`hallpetch.ts`) |
| **FR-09** | **Modified** | Micrograph pipeline: scale calibration, preprocessing, segmentation, QA overlay, line-intercept and area-equivalent grain size, chord distribution, adjacency graph. Offline in Python; outputs versioned static JSON fixtures to `web/public/data/micrographs/`. | Python offline toolchain (`src/hpsim/micro/`) |
| **FR-10** | Retained (Dual) | Rescaled-micrograph sweep: scale measured chord distribution to emulate other mean grain sizes. | Python reference & TypeScript client-side synthetic scaling |
| **FR-11** | Retained (Dual) | Orientation assignment from a seed; optional EBSD import. | Python reference & TypeScript seeded SO(3) generator |
| **FR-12** | **Modified** | Material database (`materials.yaml` / `materials.json`) with per-parameter source and verification status. Exported to typed static JSON for the web client. | Python offline loader + `web/public/data/materials.json` |
| **FR-13** | **Modified** | **Interactive Web Application (supersedes Streamlit):** Built with React + TypeScript + Vite. Features 3D lattice (Three.js `InstancedMesh` with orbit/pan/zoom, replay slider with play/pause), pile-up view, preprocessed micrograph overlay, emergent Hall–Petch SVG/Canvas plots, and explainable event log. | Web app (`web/src/app/`) |
| **FR-14** | **Modified** | Deterministic experiment presets and CLI `hpsim run <preset>` in Python, plus pre-bundled JSON presets in `web/public/data/presets/` runnable with one click in the web app. | Python CLI + Web client presets |
| **FR-15** | Retained | Validation report generator producing `docs/validation_report.md` from test/experiment outputs. | Python offline generator (`src/hpsim/experiments/report.py`) |
| **FR-16** | Retained | Visible labels: every plotted quantity states units, or is marked *normalized/illustrative*, and every parameter set is marked *sourced*, *calibrated*, or *illustrative*. | Both Python figures and Web UI |
| **FR-17** | **NEW** | **Base-Path Portability:** Vite build configuration supports both root deployment (`/`) on Vercel and subpath deployment (`/<repo-name>/`) on GitHub Pages via single environment variable `BASE_URL`. | Web build (`web/vite.config.ts`) |
| **FR-18** | **NEW** | **Zero-Network Client Execution:** Web application executes all core interactive physics and visualizations fully offline after the initial page load, without requiring credentials, API keys, or backend network requests. | Web app architecture |
| **FR-19** | **NEW** | **In-Browser User Data Import:** Custom micrograph analysis results or chord datasets can be imported via local client-side JSON/CSV drag-and-drop without server storage or network upload. | Web app (`web/src/components/DataImport.tsx`) |

---

## 2. Non-Functional Requirements (NFR)

| ID | Requirement | Static Hosting Specification |
|---|---|---|
| **NFR-01** | **Determinism** | Same seed + parameters ⇒ identical numerical results and event log across both Python and TypeScript runtimes. |
| **NFR-02** | **Units** | SI internally; conversions only at I/O boundaries; variable names carry unit suffixes (`_pa`, `_m`, `_mpa`). |
| **NFR-03** | **Performance** | Web 3D lattice interactive at 60 FPS for ≤ 4,000 atoms (Three.js `InstancedMesh`). Client-side pile-up solver runs in < 50 ms for N ≤ 100 on standard laptop browser. Web production gzip bundle size < 2 MB (excluding images). |
| **NFR-04** | **Separation** | `src/hpsim/core` and `web/src/core` MUST NOT import UI, rendering, or DOM modules. Pure functional contracts. |
| **NFR-05** | **Typing & Style** | Python: `ruff` clean, `mypy --strict` on `core`. TypeScript: `eslint` clean, `tsc --noEmit` strict mode with 0 errors. |
| **NFR-06** | **Reproducibility** | Python: `pip install -e . && pytest`. Web: `npm install && npm test && npm run build`. Both build cleanly from scratch. |
| **NFR-07** | **Honest Labelling** | Prominent "About & Scientific Limitations" drawer/modal in the web app explaining that atom positions are an analytic continuum displacement visualization, not MD, and identifying synthetic vs. experimental datasets. |
| **NFR-08** | **Accessibility** | High-contrast controls, labeled interactive elements, accessible SVGs, WCAG AA compliance, and no data conveyed by color alone. |
| **NFR-09** | **Security & Privacy** | Zero network telemetry, zero third-party tracking scripts, zero runtime secrets/APIs. User files remain strictly within browser memory. |
| **NFR-10** | **Cross-Language Parity** | Parity benchmark suite (V-17) verifies that TypeScript implementations of equations agree with Python reference solutions within declared tolerances. |
| **NFR-11** | **Asset Licensing** | All images, literature datasets, and presets bundled in `web/public/` must have documented open-access licenses (e.g. CC-BY, Public Domain) and attribution in `web/public/data/SOURCES.md`. |
