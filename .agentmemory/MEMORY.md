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
- **Gate 5 (Phase 5 Discrete Dislocation Pile-Up Engine):**
  - 1D single-slip edge dislocation array accumulated against an impenetrable boundary at $x=0$.
  - Characteristic interaction parameter $A = \mu b / [2\pi(1 - \nu)]$ in Pa·m.
  - Benchmarked against classical Eshelby–Frank–Nabarro (EFN 1951) associated Laguerre polynomial roots $L_{N-1}^{(1)}(\xi) = 0$ computed via Golub–Welsch (1969) tridiagonal Jacobi matrix eigensolver.
  - Exact tip stress concentration $\tau_{\text{tip}} = N \tau_{\text{app}}$ verified.
  - Asymptotic continuum count $N_{\text{asymp}} \approx \pi(1-\nu) L \tau_{\text{app}} / (\mu b)$ verified with $O(N^{-2/3})$ finite-size discrete deviation.
  - Damped Newton-Raphson relaxation with physical order-preserving line search and explicit status states (`converged`, `max_iterations_exceeded`, `numerical_failure`, `invalid_input`).
  - Cross-runtime golden parity fixtures (`tests/golden/phase5_fixtures.json`) verified to sub-picometer precision ($< 10^{-12}$ m).
  - Interactive 1D pile-up SVG schematic, scale bar, tip stress readout, and controls integrated in `web/src/ui/App.tsx`.

---

## 2. Semantic Memory (Architectural Rules & Crystallographic Constants)

### Strict Architectural Boundaries
- **Rule NFR-04 (Pure Physics Core):** `src/hpsim/core/` and `web/src/core/` must NEVER import UI, DOM, WebGL, React, or Three.js modules. They are pure mathematical calculation kernels.
- **Presentation Isolation:** Camera presets, OrbitControls, and Three.js scene updates are read-only presentation components. They must never mutate simulation state or trajectory history.
- **No Early Hall–Petch Claim:** Never claim Hall–Petch emergence, fit Hall–Petch coefficients, or calibrate $\tau^*_{\text{ref}}$ prior to Phase 6.

### Coordinate Conventions (Right-Handed)
- **Local Slip Frame:**
  - $x \parallel \mathbf{s}$ (slip direction)
  - $y \parallel \mathbf{n}$ (slip plane normal)
  - $z \parallel \boldsymbol{\xi} = \mathbf{s} \times \mathbf{n}$ (dislocation line vector)
  - Frame determinant: $\det([\mathbf{s}, \mathbf{n}, \boldsymbol{\xi}]) = +1.0$ (strictly right-handed).
- **Displacement Jump:** $\operatorname{atan2}(y, x)$ cut on negative $x$ axis (behind advancing dislocation); crossing $y < 0 \to y > 0$ yields $+b$ jump in $u_x$.
- **Pile-Up Direction:** Obstacle at $x=0$, dislocations at $0 < x_1 < \dots < x_{N-1}$, applied stress drives in $-x$ direction.

### Material Parameter Integrity (Decision M6)
- **Status:** Unresolved / Open.
- **Rule:** Never invent, guess, or hardcode empirical penetration resistance $\tau^*_{\text{ref}}$ as a sourced material parameter in `materials.yaml`.
- Missing $\tau^*_{\text{ref}}$ must produce an explicit `unresolved_threshold` configuration state. Test fixtures may use clearly badged illustrative values for algorithm verification only.

---

## 3. Procedural Memory (Verification Runbooks)

### Full Regression & Audit Commands
```bash
# 1. Python core & physics tests (136 tests)
python -m pytest -q

# 2. Scientific literature provenance & data audit harness (6/6 checks)
python scripts/validate_data_acquisition.py

# 3. Node.js unit, controller, and cross-runtime parity suite (56 tests)
node --experimental-strip-types --test web/tests/*.test.mjs

# 4. Strict TypeScript type check
cd web && npx tsc

# 5. Production web application build
cd web && npx vite build

# 6. Rebuild codebase intelligence graph
npx -y @nanonets/graft build
```

