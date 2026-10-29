# HPSim Phase 5 Report: Discrete Dislocation Pile-Up Engine & Eshelby–Frank–Nabarro Benchmark

**Milestone:** Phase 5 (Discrete Dislocation Pile-Up Engine)  
**Quality Gate Status:** Stopped at Quality Gate 5 (Awaiting Explicit Human Review)  
**Date:** 2026-10-21  
**Repository:** HPSim (Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator)  

---

## 1. Executive Summary & Authorization Compliance

Phase 5 was executed under strict adherence to user-defined scope and guardrails:
1. **Scope:** Implemented and validated a deterministic, single-slip, one-dimensional discrete edge-dislocation pile-up engine in the Python scientific reference core and matching TypeScript browser core, benchmarked against the classical Eshelby–Frank–Nabarro (EFN 1951) solution.
2. **Absolute Guardrails Respected:**
   - **No Hall–Petch Claims:** Did **not** implement Hall–Petch regression, claim the Hall–Petch relation has emerged, fit/calibrate material parameters, or use demo Hall–Petch data (deferred to Phase 6).
   - **No Parameter Guessing:** Material parameter $\tau^*_{\text{ref}}$ remains completely unresolved and uncalibrated under **Decision M6**; no illustrative values were written to `src/hpsim/materials/materials.yaml`. All demo parameters in UI controls are explicitly labeled `illustrative`.
   - **Core Isolation Maintained:** `src/hpsim/core/pileup.py` and `web/src/core/pileup.ts` contain zero UI, DOM, Canvas, Three.js, or network dependencies (`isolation.test.mjs` passes).
   - **No Molecular Dynamics Claim:** The model is explicitly documented and labeled in UI and documentation as a simplified continuum-elasticity discrete-dislocation model, not molecular dynamics.
   - **No Autonomous Loops / Pushes:** No unattended Ralph Loop, paid media, git commit, git push, or external deployment was executed. Work stops at Quality Gate 5.

---

## 2. Test, Audit & Build Output Verification

### 2.1 Step 0 Baseline vs. Step 6 Final Test Ladder Comparison

| Verification Suite | Step 0 Baseline | Step 6 Final Result | Status |
|---|---|---|---|
| **Python Pytest Suite** (`python -m pytest -q`) | 124 passed in 2.22s | **136 passed** in 1.38s (+12 Phase 5 tests) | **PASS (GREEN)** |
| **Scientific Data Audit** (`python scripts/validate_data_acquisition.py`) | 6/6 checks passed | **6/6 checks passed** (100% SHA-256 match) | **PASS (GREEN)** |
| **Node.js TypeScript Core Tests** (`node --experimental-strip-types --test web/tests/*.test.mjs`) | 40 passed in 3.86s | **56 passed** in 4.60s (+16 Phase 5 tests) | **PASS (GREEN)** |
| **TypeScript Typecheck** (`cd web && npx tsc`) | 0 errors | **0 errors** (clean compilation) | **PASS (GREEN)** |
| **Vite Production Build** (`cd web && npx vite build`) | Built in 963ms | **Built in 787ms** (`dist/` clean) | **PASS (GREEN)** |
| **Browser Console Audit** (Playwright MCP) | 0 errors, 0 warnings | **0 errors, 0 warnings** | **PASS (GREEN)** |

All prior Phase 1–4 tests continue to pass without modification or weakened tolerances.

---

## 3. Physical Model & Eshelby–Frank–Nabarro (EFN) Benchmark

### 3.1 Governing Physical Equations
The model considers $N$ straight, infinite edge dislocations of identical sign gliding along a common 1D slip plane in a linear, isotropic elastic medium:
- Dislocation $1$ is locked at an impenetrable planar boundary/obstacle at $x = 0$.
- $N - 1$ mobile dislocations accumulate at equilibrium positions $0 < x_1 < x_2 < \dots < x_{N-1}$.
- Uniform applied shear stress $\tau_{\text{app}} > 0$ drives all dislocations in the $-x$ direction toward the obstacle.

The isotropic elastic interaction coefficient is:
$$A = \frac{\mu b}{2\pi(1 - \nu)} \quad [\text{Pa}\cdot\text{m}]$$

The equilibrium condition for mobile dislocations $i \in \{1, \dots, N-1\}$ is:
$$R_i(x_1, \dots, x_{N-1}) = \frac{A}{x_i} + \sum_{j \neq i, j=1}^{N-1} \frac{A}{x_i - x_j} - \tau_{\text{app}} = 0$$

### 3.2 Exact Analytical Benchmark
**Primary Reference:**
> J. D. Eshelby, F. C. Frank, and F. R. N. Nabarro, "The equilibrium of linear arrays of dislocations," *Philosophical Magazine*, 42 (1951), pp. 351–364. DOI: [10.1080/14786445108561060](https://doi.org/10.1080/14786445108561060).

EFN demonstrated that by nondimensionalizing with $\xi = 2\lambda x$ where $\lambda = \tau_{\text{app}} / A$, the equilibrium positions are the exact zeros of the associated Laguerre polynomial:
$$L_{N-1}^{(1)}(\xi) = 0 \implies x_k = \frac{\xi_k}{2\lambda} = \frac{\xi_k \mu b}{4\pi(1 - \nu)\tau_{\text{app}}} \quad (k = 1, \dots, N-1)$$

#### Closed-Form Exact Solutions Tested:
- **$N = 2$:** $x_1 = \frac{A}{\tau_{\text{app}}} = \frac{\mu b}{2\pi(1-\nu)\tau_{\text{app}}}$.
- **$N = 3$:** $\xi^2 - 6\xi + 6 = 0 \implies x_1 = \frac{3 - \sqrt{3}}{2\lambda}, \quad x_2 = \frac{3 + \sqrt{3}}{2\lambda}$.

#### Classical Eshelby Tip Stress Theorem:
The concentrated shear stress acting on the locked lead dislocation at the obstacle ($x = 0$) is:
$$\tau_{\text{tip}} = \tau_{\text{app}} + \sum_{k=1}^{N-1} \frac{A}{x_k} = N \tau_{\text{app}}$$
Both Python and TypeScript verify $\tau_{\text{tip}} = N \tau_{\text{app}}$ to machine precision across all tested counts.

### 3.3 Numerical Implementation: Golub–Welsch Algorithm
To compute exact roots unconditionally across arbitrary $N$ without numerical root search, HPSim implements the Golub–Welsch (1969) algorithm:
- The zeros of $L_m^{(1)}(\xi)$ are the eigenvalues of the symmetric tridiagonal Jacobi matrix $T \in \mathbb{R}^{m \times m}$ ($m = N - 1$):
  $$T_{j, j} = 2j + 2 \quad (j=0..m-1), \quad T_{j+1, j} = T_{j, j+1} = \sqrt{(j+1)(j+2)} \quad (j=0..m-2)$$
- In Python: `numpy.linalg.eigvalsh(T)`.
- In TypeScript: Pure TypeScript tridiagonal QL algorithm with implicit Wilkinson shift (`tridiagonalEigenvalues`).
- Max discrepancy between Python and TypeScript roots: $< 9.95 \times 10^{-14}$.

### 3.4 Asymptotic Continuum Scaling vs. Finite-$N$ Discrete Effects
The continuum approximation often quoted in literature is:
$$N_{\text{asymp}} \approx \frac{\pi (1 - \nu) L \tau_{\text{app}}}{\mu b}$$
By Szegő's theorem (1939) on the largest zero of Laguerre polynomials, the ratio $\xi_{\max} / (4m) = 1 - O(m^{-2/3})$. Consequently, the continuum count formula deviates systematically at finite $N$:
- $N = 3$: ratio $N_{\text{asymp}} / N \approx 0.394$ (finite-size discrete boundary).
- $N = 10$: ratio $\approx 0.703$.
- $N = 30$: ratio $\approx 0.852$.
- $N = 100$: ratio $\approx 0.923$.
- $N \to \infty$: ratio $\to 1.0$.

Both test suites rigorously test and document this monotonic asymptotic convergence, preventing conflation of continuum approximations with finite-$N$ discrete reality.

---

## 4. Cross-Runtime Parity & Golden Fixtures

Golden fixtures were generated in `tests/golden/phase5_fixtures.json` via `scripts/generate_phase5_fixtures.py` and verified by both `tests/test_pileup.py` and `web/tests/phase5_parity.test.mjs`:

| Case | Configuration | Max Position Error $|x_{\text{TS}} - x_{\text{Py}}|$ | Max Residual $\max |R_i|$ | Tip Stress $\tau_{\text{tip}}$ | Parity Status |
|---|---|---|---|---|---|
| **Case 1** | $N=3$, Al, $\tau_{\text{app}}=50\text{ MPa}$ | $< 10^{-14}\text{ m}$ ($0.0001$ Å) | $1.49 \times 10^{-8}\text{ Pa}$ | $150.0\text{ MPa}$ ($\times 3$) | **PASS** |
| **Case 2** | $N=8$, Al, $\tau_{\text{app}}=45\text{ MPa}$ | $< 10^{-13}\text{ m}$ ($0.001$ Å) | $2.16 \times 10^{-7}\text{ Pa}$ | $360.0\text{ MPa}$ ($\times 8$) | **PASS** |
| **Case 3** | $N=15$, Cu, $\tau_{\text{app}}=60\text{ MPa}$ | $< 10^{-12}\text{ m}$ ($0.01$ Å) | $9.83 \times 10^{-7}\text{ Pa}$ | $900.0\text{ MPa}$ ($\times 15$) | **PASS** |
| **Case 4** | $N=25$, Al, $\tau_{\text{app}}=120\text{ MPa}$ | $< 10^{-12}\text{ m}$ ($0.01$ Å) | $3.80 \times 10^{-6}\text{ Pa}$ | $3000.0\text{ MPa}$ ($\times 25$) | **PASS** |
| **Case 5** | $N=4$, Al, perturbed $+5\%$ | $< 10^{-12}\text{ m}$ | $2.38 \times 10^6\text{ Pa}$ | $200.0\text{ MPa}$ | **PASS** (`max_iterations_exceeded`) |

---

## 5. Visual UI Integration & Browser Smoke Testing

A dedicated **Discrete Dislocation Pile-Up** card was integrated into `web/src/ui/App.tsx`:
- **1D Pile-Up SVG Schematic:** Shows the impenetrable boundary at $x = 0$ (hatched red obstacle), slip plane axis, and dislocations rendered with inverted-T ($\bot$) glyphs. The lead dislocation is locked at $x = 0$ in red, and mobile dislocations in cyan crowd toward the obstacle.
- **Physical Scale Bar:** Explicit spatial length bar $0 \to L\text{ nm}$.
- **Readout Metrics:** Tip stress concentration $\tau_{\text{tip}} = N \tau_{\text{app}}$, pile-up length $L$, asymptotic continuum count $N_{\text{asymp}}$, max residual $|R_{\max}|$, and solver iterations.
- **Controls:** Sliders for count $N \in [2, 25]$ and applied stress $\tau_{\text{app}} \in [10, 150]\text{ MPa}$, material preset buttons (Al vs Cu, tagged `illustrative`), and a relaxation test toggle.
- **Honest Status Reporting:** When the perturbed initial guess with limited iteration budget is enabled, the UI immediately switches to `⚠ ITERATION BUDGET EXCEEDED` without displaying stale previous positions or false convergence.
- **Camera Isolation:** Visual operations do not mutate physics state.

### Captured Browser Verification Artifacts
- **Converged Equilibrium UI:** `phase5_pileup_converged_ui.png`
- **Perturbed Non-Convergence UI:** `phase5_pileup_perturbed_budget_ui.png`

---

## 6. Files Created and Modified

### Files Created:
1. `src/hpsim/core/pileup.py` — Python discrete pile-up engine & EFN benchmark.
2. `tests/test_pileup.py` — Python unit and parity tests (12 tests).
3. `web/src/core/pileup.ts` — Pure TypeScript client-side pile-up solver & tridiagonal eigensolver.
4. `web/tests/test_pileup.test.mjs` — TypeScript unit and benchmark tests (11 tests).
5. `scripts/generate_phase5_fixtures.py` — Golden fixture generation script.
6. `tests/golden/phase5_fixtures.json` — Provenance-tracked golden fixtures.
7. `web/tests/phase5_parity.test.mjs` — Cross-runtime golden parity tests (5 cases).
8. `docs/phase5_report.md` — This milestone report.

### Files Modified:
1. `web/src/core/index.ts` — Added `export * from "./pileup.ts"`.
2. `web/src/ui/styles.css` — Added Phase 5 styles and pile-up layout classes.
3. `web/src/ui/App.tsx` — Integrated Phase 5 pile-up card, SVG visualization, readouts, and controls.
4. `docs/model.md` — Appended Section 12 with comprehensive mathematical and numerical documentation.
5. `openspec/changes/hpsim-static-hosting/tasks.md` — Marked Phase 5 tasks complete, set Gate 5 status.
6. `openspec/changes/hpsim-static-hosting/assumptions.md` — Appended Section 6 Phase 5 Authorization Record.

---

## 7. What Remains Unresolved & Excluded

1. **Hall–Petch Regression & Grain Size Sweeps (Phase 6):** No multi-grain Hall–Petch sweeps or yield-onset bisection searches were executed. The Hall–Petch relation $k_y d^{-1/2}$ has not been claimed to emerge.
2. **Material Parameter $\tau^*_{\text{ref}}$ (Decision M6):** Remains unresolved and uncalibrated. No values have been written to `src/hpsim/materials/materials.yaml`.
3. **Micrograph Segmentation & CV Pipeline (Phase 7):** DoITPoMS micrographs remain local research data and are not bundled in the static web application.
4. **Physical Exclusions:** No 3D line bow-out, cross-slip, climb, Frank-Read generation kinetics, anisotropic elasticity, or atomistic potentials were implemented.

---

## 8. Quality Gate 5 Declaration

Phase 5 implementation, verification, and documentation are complete. The project is stopped at **Quality Gate 5** awaiting explicit user review and authorization before proceeding to Phase 6.
