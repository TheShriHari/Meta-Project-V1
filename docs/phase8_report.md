# HPSim Phase 8 Release Hardening and Scientific Integrity Report

**Date:** 2026-10-29  
**Status:** READY FOR FINAL REVIEW (Implementation complete; zero commits performed; awaiting user authorization)  
**Lead Coordinator:** Antigravity Coordinator Agent  
**Specialist Subagents:**  
- **Agent A (`baf448fc`):** Physics Conventions & High-Precision Pile-Up Oracles  
- **Agent B (`bf2bc64b`):** Phase 6 Scientific Protocol, Comparability, and Visual Standards  
- **Agent C (`2105f629`):** Micrograph Pipeline, Complete Stereological Populations, and Geometric Root-Cause  
- **Agent D (`16acdfe0`):** Static Hosting Infrastructure, Asset Resolution, and Playwright Browser QA  

---

## 1. Executive Summary & Verdict

Following the post-remediation audit and user review, the HPSim codebase underwent comprehensive scientific integrity remediation, numerical hardening, complete stereological data export, static hosting hardening, and repository hygiene remediation.

### Final Readiness Verdict: **READY FOR FINAL REVIEW**

All gates have passed with 100% verification:
- **Python Regression Suite:** **173 passed, 2 strict expected failures (`xfail`)**, 0 errors (29.72s).
- **Scientific Data Audit:** **6/6 checks pass (GREEN)** across literature CSVs, material YAML, download manifests, and DOIs.
- **Node.js Test Suite:** **87 passed, 0 failed** across physics core, parity, micrograph pipelines, and static hosting smoke tests.
- **TypeScript Typecheck:** Clean (`0` errors under `tsc --noEmit`).
- **Production Static Builds:** Both root (`./`) and repository subpath (`/hpsim/`) Vite builds succeed without errors.
- **Playwright MCP Browser Acceptance:** BAT-01 through BAT-05 pass with zero console errors, full WebGL context hydration, dynamic micrograph rendering, and responsive viewports.
- **Git Hygiene:** 3,472 tracked node modules, build outputs, and bytecode files safely untracked from the Git index (`git rm --cached`) without touching local files on disk. **Zero commits were executed.**

---

## 2. Priority Scientific Integrity Remediations

### P0-A: Pile-Up Interaction Prefactor Notation & Derivation ($A$ vs. $A'$)

#### 1. First-Principles Derivation
In an isotropic, linear elastic medium, two identical parallel edge dislocations with Burgers vector $\mathbf{b} = (b, 0, 0)$ gliding on $y=0$ parallel to the $z$-axis (line direction $\boldsymbol{\xi} = (0, 0, 1)$) exert mutual glide shear stresses and Peach-Koehler forces:
- **Glide Shear Stress Field:**
  $$\tau(x) = \frac{\mu b}{2\pi(1-\nu) x} = \frac{A}{x} \quad [\text{units: } \text{Pa}]$$
- **Peach–Koehler Glide Force per Unit Length:**
  $$f_x = \tau(x) \cdot b = \frac{\mu b^2}{2\pi(1-\nu) x} = \frac{A_{\text{force}}}{x} \quad [\text{units: } \text{N/m}]$$

#### 2. Reconciling $A$ vs. $A'$ and $G$ vs. $\mu$
- **Notation Resolution:**
  - In linear isotropic elasticity, Lamé's second parameter $\mu$ and shear modulus $G$ represent the exact same physical quantity ($\mu \equiv G$, SI units $\text{Pa}$).
  - In dislocation literature, force formulations (e.g. Cottrell 1953, and historical notes in `spec.md` §5.6) define $A_{\text{force}} = \frac{G b^2}{2\pi(1-\nu)}$ [$\text{N}$]. Dividing by $b$ [$\text{m}$] to obtain a stress balance introduced the notation $A' = \frac{A_{\text{force}}}{b} = \frac{G b}{2\pi(1-\nu)}$ [$\text{Pa}\cdot\text{m}$].
  - In direct stress formulations (Eshelby, Frank & Nabarro 1951; Hirth & Lothe 1982; `src/hpsim/core/pileup.py`; `docs/model.md` §12), the stress prefactor is denoted directly as $A$:
    $$A = \frac{\mu b}{2\pi(1-\nu)} \quad [\text{units: } \text{Pa}\cdot\text{m} = \text{N}\cdot\text{m}^{-1}]$$
  - **Verdict:** $A_{\text{EFN}} \equiv A_{\text{pileup.py}} \equiv A'_{\text{spec.md}}$. **This is purely a notation distinction, NOT a numerical bug.** The numerical values and dimensional units ($\text{Pa}\cdot\text{m}$) match identically across Python and TypeScript.
- **First-Principles Dimensional Test:** Added `test_first_principles_dimensional_analysis_n2` in `tests/test_pileup.py` computing $A$ directly from primitive crystal constants without helper functions and asserting $[x_1 \cdot \tau_{\text{eff}}] = \text{m} \cdot \text{Pa} = \text{Pa}\cdot\text{m}$ to $< 10^{-12}$.
- **Eshelby Tip Stress Multiplication Theorem:** Summing the $N-1$ mobile force-balance equations eliminates all internal pairwise repulsion terms ($\sum_{i \neq j} \frac{A}{x_i - x_j} = 0$), yielding the exact back-stress relation:
  $$\sum_{i=1}^{N-1} \frac{A}{x_i} = (N - 1)\tau_{\text{app}} \implies \tau_{\text{tip}} = \tau_{\text{app}} + \sum_{i=1}^{N-1} \frac{A}{x_i} = N \tau_{\text{app}}$$
  This confirms tip stress multiplication is an exact analytical identity, independent of dislocation positions.

---

### P0-B: Independent EFN Polynomial Root Oracles ($N=4$ and $N=5$) via `mpmath`

To verify the Golub-Welsch symmetric tridiagonal Jacobi eigensolver without circular dependencies on scipy, independent high-precision algebraic root oracles were derived from the zeros of Associated Laguerre polynomials $L_{N-1}^{(1)}(\xi) = 0$:

#### 1. Exact Algebraic Polynomials
- **For $N=4$ ($m=3$):**
  $$L_3^{(1)}(\xi) = 4 - 6\xi + 2\xi^2 - \frac{1}{6}\xi^3 = 0$$
  Multiplying by $-6$: $\xi^3 - 12\xi^2 + 36\xi - 24 = 0$.
  Independent 50-digit roots computed via `mpmath.polyroots(..., dps=50)`:
  - $\xi_1 \approx 0.93582222752408786200437645387$
  - $\xi_2 \approx 3.30540728933227841461887551899$
  - $\xi_3 \approx 7.75877048314363438951056280224$
- **For $N=5$ ($m=4$):**
  $$L_4^{(1)}(\xi) = 5 - 10\xi + 5\xi^2 - \frac{5}{6}\xi^3 + \frac{1}{24}\xi^4 = 0$$
  Multiplying by $24$: $\xi^4 - 20\xi^3 + 120\xi^2 - 240\xi + 120 = 0$.
  Independent 50-digit roots computed via `mpmath.polyroots(..., dps=50)`:
  - $\xi_1 \approx 0.743291927981431431361154588068$
  - $\xi_2 \approx 2.57163500764627883706712168979$
  - $\xi_3 \approx 5.73117875168909687514343530164$
  - $\xi_4 \approx 10.9538943126831948548297327458$

#### 2. Verification Results
- **Python:** `test_mpmath_independent_oracle_n4_and_n5` in `tests/test_pileup.py` passes with maximum relative error $< 10^{-12}$.
- **TypeScript:** Parity tests in `web/tests/test_pileup.test.mjs` pass with relative error $< 10^{-12}$.

---

### P1-A: Root-Cause Analysis of Raster vs. Vector Line Crossings

#### 1. Investigation of Aluminium Line 3 ($y=160$)
On Aluminium Line 3, the 1D raster label line yielded **3 crossings**, while the 2D polygon vector contour intersection yielded **7 crossings**.

#### 2. Mathematical Root Cause
1. **1D Raster Filtering (`_clean_1d_label_jitter`):**  
   The 1D raster line crosses 3 grain transitions ($49 \to 48$, $48 \to 47$, $47 \to 38$). At $x=315$ and $x=320$, single-pixel boundary roughness fluctuations ($38 \to 45 \to 38$) occur. Because isolated single-pixel runs are segmentation noise, `_clean_1d_label_jitter` collapses them, leaving exactly $N_{\text{1D}} = 3$.
2. **2D Vector Ray Intersections (`_geometric_line_crossings`):**  
   Contours extracted via `cv2.findContours` trace every pixel footprint. A horizontal test line passing through an isolated 1-pixel boundary intrusion enters the spike ($38 \to 45$, crossing 1) and exits back into the host grain ($45 \to 38$, crossing 2). Each 1-pixel boundary spike adds 2 re-entrant crossings:
   $$N_{\text{vector}} = N_{\text{1D}} + 2 \times N_{\text{spikes}} = 3 + 2 \times 2 = 7$$
3. **Synthetic Counterexample:**  
   Added `test_raster_vs_vector_jitter_counterexample()` in `tests/test_micro.py` with a 5×20 synthetic label map containing two isolated 1-pixel spikes. The test proves analytically and empirically that $N_{\text{1D}} = 1$ while $N_{\text{vector}} = 5$ ($1 + 2 \times 2$).
4. **Conclusion:** This discrepancy is an expected consequence of 1D jitter filtering vs. raw 2D pixel-contour geometry, not a numerical defect.

---

### P1-B: Complete Micrograph Chord Populations & Stereological Statistics

#### 1. Elimination of Display Truncation
In `scripts/generate_phase7_fixtures.py`, lines 94 and 149 previously applied `[:250]` to chord arrays. This truncation slice was removed, exporting the full stereological chord population.

#### 2. Exact Established Pipeline Statistics

| Micrograph Key | Material / Structure | Policy | Total Chords ($N$) | Total Crossings ($P$) | ASTM E112 Intercept $\bar{\ell}_{\text{ASTM}}$ | Chord Mean $\bar{\ell}_{\text{chord}}$ | Std $\sigma_{\ell}$ | CV |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `aluminium` | Al 99.5% (FCC) | `standard_watershed` | **963** | **932** | **8.112 μm** | **7.847 μm** | 10.162 μm | 1.2951 |
| `copper` | Cu 99.7% (FCC) | `M4_copper_twin_exclusion` | **1044** | **1011** | **17.267 μm** | **16.717 μm** | 12.639 μm | 0.7561 |
| `ferritic_steel` | Fe-0.15C (BCC) | `M5_ferrite_only_mask` | **1301** | **1129** | **13.139 μm** | **11.368 μm** | 8.575 μm | 0.7542 |
| `pure_iron` | α-Fe (BCC) | `standard_watershed` | **855** | **817** | **7.599 μm** | **7.261 μm** | 6.001 μm | 0.8265 |
| `synthetic_voronoi_30um` | V-11 Target (10×10 grid) | `V11_synthetic_voronoi_target` | **231** | **215** | **27.907 μm** | **25.965 μm** | 13.677 μm | 0.5267 |

#### 3. Resolution of Display Bias
Exporting complete populations increased JSON payload size by only ~15 KB uncompressed (~4 KB gzip) and restored Aluminium's displayed mean intercept to the true $8.11\,\mu\text{m}$, permanently eliminating the legacy $15.94\,\mu\text{m}$ truncated slice artifact.

---

### P1-C: Static Asset URLs and Non-Root Base Support

1. **Pure Asset Resolver (`web/src/core/paths.ts`):**  
   Implemented `resolveAssetUrl(relPath, baseUrl, winLoc)` supporting:
   - Root base: `'/'` $\to$ `'/data/...'`
   - Subpath base: `'/hpsim/'` $\to$ `'/hpsim/data/...'`
   - Relative base: `'./'` $\to$ `'./data/...'`
   - **GitHub Pages Trailing-Slash Drop Recovery:** Automatically detects when GitHub Pages serves `https://<user>.github.io/hpsim` without a trailing slash (`pathname === '/hpsim'`), prepending `/hpsim/` to prevent asset 404s against the domain root.
2. **GitHub Pages Compatibility (`.nojekyll`):**  
   Added `web/public/.nojekyll`, copied into `web/dist/.nojekyll` during builds.
3. **Offline `file:///` Disclosure:**  
   Documented in `paths.ts` and `limitations.md` that direct `file:///` dynamic JSON fetching is blocked by modern browser CORS/origin security policies, mandating local HTTP hosting (`vite preview` or web server).

---

### P1-D: Playwright MCP Real Browser Acceptance Tests

| BAT ID | Verification Requirement | Inspection & Evidence | Status |
|---|---|---|---|
| **BAT-01** | App mount, Three.js WebGL canvas init, 0 console errors | `#root` mounted; WebGL context active ($810\times 775$); 0 errors, 0 warnings. | **PASS** |
| **BAT-02** | Micrograph dynamic JSON hydration under root `/` and subpath `/hpsim/` | Hydrated `data/micrographs/aluminium.json`; rendered 140 contours, 963 chords; 0 console errors under root and `/hpsim/`. | **PASS** |
| **BAT-03** | Micrograph dropdown selection of all 5 presets & badge updates | Iterated `aluminium`, `copper` (`M4`), `pure_iron`, `ferritic_steel` (`M5`), and `synthetic_voronoi_30um` (`V-11`). All badges and scales updated dynamically. | **PASS** |
| **BAT-04** | Hall-Petch SVG chart inspection | Inspected `#card-hallpetch svg`: bootstrap CI polygon present; 16 integer-N plateau whiskers present; OLS line present. | **PASS** |
| **BAT-05** | Responsive viewport checks | Checked $1920\times 1080$, $1280\times 800$, and $768\times 1024$ (portrait column stacking). Zero horizontal overflow. | **PASS** |

---

## 3. Scientific Disclosure & Literature Comparability (P2)

### 1. Literature Comparability Matrix

| Material | Calibration Reference | Purity & Heat Treatment | Grain Size Method | Yield Definition | Held-Out Reference | Held-Out Purity | Held-Out Grain Size | Held-Out Yield | Known Physical Mismatch | Blind Unadjusted Err | Intercept-Adjusted Err |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Aluminium (FCC)** | Hansen (1977) | 99.999% Al, annealed 673–873 K | ASTM E112 mean lineal intercept $d = \bar{\ell}$ | 0.2% proof stress ($\sigma_0 = 10.0$ MPa, $k_y = 67.0$ MPa $\mu\text{m}^{1/2}$) | Hansen (1977) AA1050 | 99.5% Commercial Al | Mean lineal intercept $d = \bar{\ell}$ | 0.2% proof stress ($\sigma_0 = 16.5$ MPa, $k_y = 78.0$ MPa $\mu\text{m}^{1/2}$) | Fe/Si solute friction shift ($\Delta\sigma_0 = +6.5$ MPa, +65%). Fails 25% blind band; guarded by strict xfail. | **28.9%** (xfail) | **3.34%** |
| **Copper (FCC)** | Hansen & Ralph (1982) | 99.999% Cu, rolled 90%, recrystallised 673–973 K | Mean lineal intercept excluding $\Sigma 3$ twins | 0.2% proof stress ($\sigma_0 = 20.0$ MPa, $k_y = 125.0$ MPa $\mu\text{m}^{1/2}$) | Feltham & Meakin (1957) | 99.95% Cu | Mean lineal intercept (historical twin protocol) | 0.2% proof stress ($\sigma_0 = 23.5$ MPa, $k_y = 144.0$ MPa $\mu\text{m}^{1/2}$) | Purity difference ($\Delta\sigma_0 = +3.5$ MPa); historical twin inclusion protocol. | **12.8%** (PASS) | **4.89%** |
| **Pure Alpha-Iron (BCC)** | Takeda et al. (2008) IF-Fe | Ti-stabilised IF iron ($\le 4$ ppm C), water-quenched | Quadrature intercept $d = 1.128\sqrt{\bar{\ell}_x \bar{\ell}_y}$ | Upper yield point ($\sigma_0 = 56.0$ MPa, $k_y = 114.0$ MPa $\mu\text{m}^{1/2}$) | Takeda et al. (2008) Base Fe | Base pure iron (5 ppm free solute C) | Quadrature intercept $d = 1.128\sqrt{\bar{\ell}_x \bar{\ell}_y}$ | Upper yield point ($\sigma_0 = 72.0$ MPa, $k_y = 188.0$ MPa $\mu\text{m}^{1/2}$) | 5 ppm grain-boundary carbon segregation increases boundary locking ($k_y$ +64.9%). Pure elastic model underpredicts slope transfer by 39.4%. Guarded by strict xfail. | **27.5%** (xfail) | **12.89%** |
| **Ferritic Steel (BCC)** | Takeda et al. (2008) C60 | 56 ppm C single-phase ferrite matrix | Quadrature intercept | Upper yield stress $\sigma_{UY}$ ($\sigma_0 = 61.0$ MPa, $k_y = 516.0$ MPa $\mu\text{m}^{1/2}$) | Armstrong et al. (1962) | 0.15% C (1500 ppm C) hypoeutectoid mild steel | Mean lineal intercept $d = \bar{\ell}$ | Lower yield stress $\sigma_{LY}$ ($\sigma_0 = 68.0$ MPa, $k_y = 620.0$ MPa $\mu\text{m}^{1/2}$) | 27× carbon concentration; two-phase ferrite-pearlite aggregate (15–20% pearlite); $\sigma_{LY}$ vs $\sigma_{UY}$. | **13.2%** (PASS) | **9.16%** |

### 2. $L = d/2$ Source Distance Sensitivity
Continuum pile-up theory predicts $\tau_{\text{eff,crit}} \approx \sqrt{\frac{\mu b \tau^*}{\pi(1-\nu) L}}$, so $k_y \propto L^{-1/2}$:
- For $L = d$: $k_y(d) = k_y(d/2) / \sqrt{2} \approx 0.7071 \cdot k_y(d/2)$ (transgranular source)
- For $L = d/4$: $k_y(d/4) = k_y(d/2) \cdot \sqrt{2} \approx 1.4142 \cdot k_y(d/2)$ (near-boundary source)
Discrete simulation tests in Python and TypeScript verify this $\sqrt{1/L}$ scaling within $\pm 2.5\%$, while confirming that the emergent $d^{-1/2}$ power-law exponent (V-09) remains invariant across all source distance ratios.

### 3. Stereological Conventions & Disclosing No Silent 3D Multiplier
- HPSim's macroscopic Hall-Petch sweeps evaluate grain size directly using the 2D mean linear intercept $\bar{d} = \bar{\ell}$.
- **No silent stereological 3D conversion factor** (such as $1.74$ or $1.57$) is applied. This is because experimental calibration fits (Hansen, Armstrong, Feltham & Meakin) regressed yield stress directly against $\bar{\ell}^{-1/2}$. Silently applying a $1.74$ multiplier would artificially distort the fitted slope $k_y$ by $32\%$.

### 4. Preservation of Decision M6
- In `src/hpsim/materials/materials.yaml`, `tau_star_ref.value` remains `null`.
- `ferritic_steel.tau_c` remains `35.0 MPa` with `status: needs_citation`.
- The Web UI highlights ferritic steel with an explicit `"unresolved citation"` badge.

### 5. ADR-010 Architecture Reconciliation
Recorded in `docs/adr-010-architecture-reconciliation.md` that the historical Streamlit architecture mentioned in `spec.md` is formally superseded by the zero-backend static web application built with React 19, Vite, and Three.js.

---

## 4. Repository Hygiene & Git Index State

1. **Comprehensive `.gitignore`:** Configured with robust rules covering `/node_modules/`, `/web/node_modules/`, `/web/dist/`, `.vite/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, and IDE caches.
2. **Safe Index Untracking:**  
   Executed `git rm --cached` on 3,472 files across:
   - `web/node_modules/` (3,424 files)
   - `web/dist/` (4 files)
   - `*.pyc` bytecode files (44 files)
3. **Disk Integrity:** All physical files on disk in `web/node_modules/` and `web/dist/` remain completely intact (`Test-Path` verified).
4. **Approval Gate:** Staged in the Git index only. **Zero commits were executed.** History rewriting remains strictly out of scope.

---

## 5. Summary of Verification Metrics

```
================================================================================
HPSIM PHASE 8 FINAL VERIFICATION MATRIX
================================================================================
Python Regression Suite       : 173 passed, 2 xfailed (100% GREEN)
Data Acquisition Audit        : 6/6 checks passed (100% GREEN)
Node.js Parity & Web Suite    : 87 passed, 0 failed (100% GREEN)
TypeScript Compilation        : Clean (0 errors)
Vite Subpath Build (/hpsim/)  : Clean (built in 1.08s)
Playwright Browser Tests      : BAT-01 through BAT-05 passed (100% GREEN)
Simulation Presets Runner     : 5/5 presets passed (100% GREEN)
Git Index Hygiene             : 3,472 files staged for untracking (0 commits)
================================================================================
```

The codebase is hardened, reproducible, dimensionally consistent, fully verified, and ready for final review.

