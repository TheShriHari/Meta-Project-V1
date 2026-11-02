# HPSim AgentMemory Repository Knowledge Bank

**Project:** Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)  
**Engine:** AgentMemory Persistent Tier  
**Last Updated:** Phase 4 Quality Gate 4 Completion (2026-10-21)

---

## 1. Episodic Memory (Milestone Chronology & Decisions)

### Milestone History
- **Gate 0 (Scientific Data Acquisition & Provenance Audit):**
  - Audited 40 observations across Al, Cu, and α-Fe / ferritic steels.
  - Sourced literature fits recorded in `hall_petch_verified_fits.csv`.
  - Reconstructed points segregated under `hall_petch_datasets.csv` as `demonstration_only`.
  - DoITPoMS CC BY-NC-SA 4.0 micrographs retained as local research assets only (never published in public web distribution).
- **Gate 1 (Phase 1 Mathematics Kernel):**
  - Vectors, Euler ZXZ rotations, 12 FCC slip systems $\{111\}\langle 110\rangle$, Schmid factor, and resolved shear stress.
  - Pure Python reference (`src/hpsim/core/`) and TypeScript (`web/src/core/`) verified at relative tolerance $\le 10^{-12}$.
- **Gate 2/3 (Combined Phase 2 + 3):**
  - FCC atomic lattice generator (conventional 4-atom cell, nearest-neighbour $a/\sqrt{2}$, coordination 12).
  - Regularized isotropic edge-dislocation continuum displacement field ($r^2 + r_c^2$, normalized by $r_c^2$, branch cut behind core on slip plane midway between atomic planes).
  - Volterra Burgers circuit closure verified to within $10^{-14}\cdot b$ ($+b$ counter-clockwise around line vector $\boldsymbol{\xi}$).
  - Single-dislocation overdamped glide law ($v = M_d b \operatorname{sgn}(\tau) \max(|\tau| - \tau_c, 0)$).
  - React + Vite + Three.js presentation runtime with camera view presets (front, top, side, isometric).
- **Gate 4 (Phase 4 Grain-Boundary Transmission):**
  - Livingston–Gorczyca geometric compatibility $m' = |\hat{\mathbf{s}}_{\text{in}} \cdot \hat{\mathbf{s}}_{\text{out}}| |\hat{\mathbf{n}}_{\text{in}} \cdot \hat{\mathbf{n}}_{\text{out}}| \in [0, 1]$.
  - Residual Burgers vector magnitude $|b_r| = \min(\|\mathbf{b}_{\text{in}} - \mathbf{b}_{\text{out}}\|, \|\mathbf{b}_{\text{in}} + \mathbf{b}_{\text{out}}\|)$.
  - Outgoing driving stress from full Cauchy stress tensor $\tau_{\text{out}} = |\mathbf{s}_{\text{out}}^T \boldsymbol{\sigma} \mathbf{n}_{\text{out}}| \ge \tau_c$.
  - Tip stress condition $\tau_{\text{tip}} \ge \tau^*(m') = \tau^*_{\text{ref}} (1 + \beta(1 - m'))$.
  - Explicit `"unresolved_threshold"` outcome when $\tau^*_{\text{ref}}$ is null / uncalibrated.
  - Deterministic tie-breaking hierarchy: highest $m' \to$ lowest $|b_r|/b \to$ highest $\tau_{\text{out}} \to$ lowest slip system index.
  - Controlled two-grain columnar model with adjacent grain wireframe, boundary plane, outcome marker, and candidate outgoing slip arrows.
- **Gate 6 (Phase 6 Emergent Hall–Petch & Comparability Protocol):**
  - Headline blind prediction metric is `held_out_unadjusted_mean_rel_error` (intercept-adjusted is secondary NOT BLIND).
  - $\tau^*_{\text{ref}}$ is a CALIBRATION TARGET to match published $k_y$; only the $d^{-1/2}$ power-law exponent is emergent (`V-09`).
  - Literature comparability table established for Al, Cu, IF-Fe, and Ferritic Steel across purity, heat treatment, grain size method, yield definition, and source DOIs.
  - Hall–Petch sweep uses 2D mean linear intercept $\bar{d}$ directly; no 3D conversion factor (e.g. 1.74/1.57) is silently applied.
  - Dislocation source distance sensitivity $L \in \{d/4, d/2, d\}$ demonstrates analytical $k_y \propto 1/\sqrt{L}$ scaling ($\sqrt{2/d}$ vs $\sqrt{1/d}$) with invariant $d^{-1/2}$ log-log slope.
  - Decision M6 preserved (`materials.yaml` preserves `tau_star_ref: null` and `ferritic_steel.tau_c: needs_citation`; UI badges ferritic steel with 'unresolved citation').
  - Both strict xfail tests maintained in `test_hallpetch.py`.

- **Final Stabilization (College Demo and Resume Readiness, 2026-10-29):**
  - Evaluated Ralph Loop: `sbx` missing, automated commit restriction applied; coordinated sequentially via specialist subagents on isolated branch `hpsim/final-stabilization-20261029`.
  - 173 Python tests (2 strict xfails), 6/6 data audit, 87 Node tests, clean TypeScript, root and subpath Vite builds passing.
  - Implemented preallocated typed array buffer reuse in `displacedPositions` (3.70x speedup; zero GC overhead) and recursive WebGL disposal.
  - Created Student Guided Tour, high-contrast non-color outcome distinctions, offline `file:///` warning, root `README.md`, `docs/user_guide.md` demo walkthrough, `docs/reproducibility.md`, `docs/resume_project_brief.md`, and `docs/final_stabilization_report.md`.
  - Preserved 3,472 staged untracking changes in index; zero commits or pushes executed. Final verdict: READY FOR COLLEGE DEMO.

---

## 2. Semantic Memory (Architectural Rules & Crystallographic Constants)

### Strict Architectural Boundaries
- **Rule NFR-04 (Pure Physics Core):** `src/hpsim/core/` and `web/src/core/` must NEVER import UI, DOM, WebGL, React, or Three.js modules. They are pure mathematical calculation kernels.
- **Presentation Isolation:** Camera presets, OrbitControls, and Three.js scene updates are read-only presentation components. They must never mutate simulation state or trajectory history.

### Coordinate Conventions (Right-Handed)
- **Local Slip Frame:**
  - $x \parallel \mathbf{s}$ (slip direction)
  - $y \parallel \mathbf{n}$ (slip plane normal)
  - $z \parallel \boldsymbol{\xi} = \mathbf{s} \times \mathbf{n}$ (dislocation line vector)
  - Frame determinant: $\det([\mathbf{s}, \mathbf{n}, \boldsymbol{\xi}]) = +1.0$ (strictly right-handed).
- **Displacement Jump:** $\operatorname{atan2}(y, x)$ cut on negative $x$ axis (behind advancing dislocation); crossing $y < 0 \to y > 0$ yields $+b$ jump in $u_x$.

### Material Parameter Integrity (Decision M6)
- **Status:** Unresolved / Open.
- **Rule:** Never invent, guess, or hardcode empirical penetration resistance $\tau^*_{\text{ref}}$ as a sourced material parameter in `materials.yaml`.
- Missing $\tau^*_{\text{ref}}$ must produce an explicit `unresolved_threshold` configuration state. Test fixtures may use clearly badged illustrative values for algorithm verification only.

---

## 3. Procedural Memory (Verification Runbooks)

### Full Regression & Audit Commands
```bash
# 1. Python core & physics tests (124 tests)
python -m pytest -q

# 2. Scientific literature provenance & data audit harness (6/6 checks)
python scripts/validate_data_acquisition.py

# 3. Node.js unit, controller, and cross-runtime parity suite (40 tests)
node --experimental-strip-types --test web/tests/*.test.mjs

# 4. Strict TypeScript type check
cd web && npx tsc

# 5. Production web application build
cd web && npx vite build

# 6. Rebuild codebase intelligence graph
npx -y @nanonets/graft build
```

---

## 5. Session Memory Summary (2026-10-29 — Phases 6–8 & Evidence-Based Audit)

- **Phase 6 (Emergent Hall–Petch Derivation):** Implemented quasi-static source shut-off at $x = L = d / 2$, yield-onset bisection on $\tau_{\text{eff}}$, multi-grain-size Hall–Petch sweeps with seeded bootstrap 95% CI, and single-parameter $\tau^*_{\text{ref}}$ calibration across all 4 materials in `src/hpsim/core/hallpetch.py` and `web/src/core/hallpetch.ts`. Hardened with closed-form $N=1 \to 2$ analytical oracle tests and dual $\sigma_0$-adjusted / unadjusted `V-15` reporting.
- **Phase 7 (Micrograph Preprocessing & Web Data Integration):** Implemented `src/hpsim/micro/` (`io.py`, `preprocess.py`, `segment.py`, `intercept.py`, `grains.py`, `chords.py`, `orientations.py`, `rescale.py`, `qa.py`) and `web/src/core/micrograph.ts`, validated `V-11`, `V-12` (polygon contour vs direct pixel transition cross-check), `V-13`, and `V-16`, generated red-boundary QA overlays (`docs/screenshots/*_qa_overlay.png`), and exported license-safe derived JSON fixtures (`web/public/data/micrographs/*.json`, `D6` compliant).
- **Agent C Micrograph Hardening & Complete Statistics Export:** Removed biased `[:250]` slice in `scripts/generate_phase7_fixtures.py`, exporting complete chord populations and enforcing exact image-specific pipeline counts (Al: 963 chords/932 crossings; Cu: 1044/1011; Steel: 1301/1129; Fe: 855/817; Voronoi: 231/215). Enriched `statistics` with ASTM and chord sample means, CV, and percentiles. Resolved the Aluminium 15.94 μm bug in `App.tsx` (#card-micrograph) by displaying both ASTM E112 grid intercept (8.11 μm) and chord sample distribution metrics (7.85 μm, n=963). Root-caused raster-vs-vector line-crossing discrepancy (3 vs 7 on Al line 3) as single-pixel boundary roughness ($38 \to 45 \to 38$) filtered by `_clean_1d_label_jitter` in 1D vs double-counted as 2 crossings each in vector contour space ($N_{\text{vec}} = N_{\text{1D}} + 2 N_{\text{jitter}}$); proven via synthetic counterexample in `tests/test_micro.py`. Enforced scale-bar safety (`pixel_size_m > 0`) and verified V-11 Voronoi Liang-Barsky continuous ridge truth independence from nominal target size.
- **Phase 8 (Final Packaging, Validation Report & Smoke Verification):** Created `scripts/run_presets.py`, `scripts/generate_validation_report.py`, `docs/validation_report.md` (`V-01`–`V-17`), `docs/limitations.md`, `docs/user_guide.md`, and `web/tests/static_smoke.test.mjs`, and integrated one-click Experiment Presets and the About/Scientific Limitations modal in `web/src/ui/App.tsx`.
- **Verification Status:** `148 passed` in `pytest`, `6/6` in `validate_data_acquisition.py`, `76 passed` in `node --test web/tests/*.test.mjs`, and `0` errors in `tsc` & `vite build`.

