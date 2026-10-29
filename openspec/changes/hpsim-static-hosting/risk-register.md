# Risk Register: `hpsim-static-hosting`

**Change ID:** `hpsim-static-hosting`

| ID | Description | Prob. | Impact | Mitigation Strategy | Owner |
|---|---|---|---|---|---|
| **R-001** | Pile-up solver fails to converge or loses position ordering for large N | Med | High | Gap parametrization, analytic Jacobian, continuation in N, damped-dynamics fallback; tested up to N = 300. | Agent |
| **R-002** | Constant-factor mismatch with analytic EFN result (edge vs screw, ν factor, L = d/2 vs d) | High | High | Document every convention explicitly in `docs/model.md`; V-07/V-08 tests; discrepancies trigger bug remediation, never silent tolerance changes. | Agent |
| **R-003** | Segmentation errors (under/over-segmentation, twins, second phases) bias grain size | High | High | Mandatory QA overlay, manual-intercept cross-check on ≥ 3 lines, twin/phase policy fixed at Gate 0, sensitivity reporting. | Human + Agent |
| **R-004** | Agent tunes parameters until plots "look right" | Med | High | One calibrated scalar per material (τ*_ref), strict calibration vs. held-out dataset split, visible parameter status badges. | Agent |
| **R-005** | Literature data for validation missing or inconsistent | Med | Med | Cite each dataset with conditions; skip rather than invent; report spread between sources honestly. | Human + Agent |
| **R-006** | Optical micrographs give no orientation, so m′ statistics are artefacts of random draw | High | Med | State Assumption A4 prominently; report m′ results as distributions over seeds; provide EBSD upgrade path. | Agent |
| **R-007** | Scope creep into 3D polish before core physics is validated | Med | Med | Strict phase gates; Phase 3 MVP locks basic functionality; advanced visual polish deferred to Phase 8. | Human |
| **R-008** | 3D rendering laggy with many atoms | Low | Low | Three.js `InstancedMesh` (single draw call for 4,000+ atoms); optional bond lines; level-of-detail slider. | Agent |
| **R-009** | Floating-point nondeterminism across machines/browsers | Low | Med | Seeded RNG, fixed IEEE-754 float64 types, cross-platform parity tests with declared relative tolerances (1e-12 math, 1e-5 solver). | Agent |
| **R-010** | Project timeline overrun | Med | Med | Static MVP at Gate 3, strong project at Gate 6; cut Phase 8 non-essential polish first, never scientific validation phases. | Human |
| **R-011** | **Bundle size bloat from raw micrographs or heavy libraries (NEW)** | Med | High | Keep high-res raw images (e.g. 9.5MB copper scan) outside `web/public/`; ship only downscaled, pre-processed JSON fixtures; use lightweight SVG charts instead of heavyweight math packages in web bundle; keep gzip bundle < 2 MB. | Agent |
| **R-012** | **Broken asset and data paths on GitHub Pages subpath deployment (NEW)** | High | Med | Centralize URL resolution using Vite `import.meta.env.BASE_URL`; configure automated Playwright smoke test (`V-18`) against both root and subpath builds in CI. | Agent |
| **R-013** | **Mathematical drift between Python reference and TypeScript engine (NEW)** | Med | High | Implement automated cross-language golden parity fixture generator (`V-17`); CI fails if TypeScript diverges from Python beyond tolerance. | Agent |
| **R-014** | **Confusion over client-side data privacy vs server upload (NEW)** | Low | Med | Explicit UI disclaimer stating that imported user micrographs or CSV files are processed exclusively in client-side memory and never uploaded to any server. | Agent |
| **R-015** | **Licensing violation of bundled research images (NEW)** | Med | High | Strict audit of `web/public/data/`: include only openly licensed (CC-BY, CC0, or public domain) images and datasets with full citations in `SOURCES.md`. | Human + Agent |
