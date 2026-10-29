# HPSim — Phase 4 Report: Grain-Boundary Transmission (Quality Gate 4)

**Date:** 2026-10-21  
**Status: READY FOR HUMAN REVIEW — Stopped at Quality Gate 4. Phase 5 NOT started.**

---

## 1. Baseline Re-Verification (Executed Before Phase 4 Work)

Before implementing Phase 4, the existing test suites and audit scripts were independently executed to ensure zero regressions from Gate 2/3:

| Command | Status | Result Summary |
|---|---|---|
| `python -m pytest -q` | **PASS** | 115 passed in 1.98s |
| `python scripts/validate_data_acquisition.py` | **PASS** | 6/6 audit checks PASS (green) |
| `node --experimental-strip-types --test web/tests/*.test.mjs` | **PASS** | 26 passed in 3.12s |
| `cd web && npx tsc` | **PASS** | Exit code 0 (strict type check clean) |
| `cd web && npx vite build` | **PASS** | Exit code 0 (production bundle clean) |

No existing tolerances were widened or loosened.

---

## 2. Phase 4 Physics Core: Test-First Implementation

### 2.1 Test-First (RED $\to$ GREEN) Cycle
1. **Python Red Tests:** Created `tests/test_boundary.py` specifying tests for geometric compatibility bounds, residual Burgers magnitude sign-invariance, identical orientation perfect match, 90° analytical misorientation, independent rejection criteria, deterministic tie-breaking, unresolved $\tau^*_{\text{ref}}$ behavior, and empty candidate rejection. Ran `pytest tests/test_boundary.py` $\to$ `ImportError: cannot import name 'evaluate_boundary_transmission' from 'hpsim.core.boundary'`.
2. **Python Implementation:** Created `src/hpsim/core/boundary.py` with pure numerical algorithms. Cross-checked with `pytest -q` $\to$ **124 passed (GREEN)**.
3. **TypeScript Red Tests:** Created `web/tests/test_boundary.test.mjs` asserting identical behavior in Node.js $\to$ failed on import before implementation.
4. **TypeScript Implementation:** Created `web/src/core/boundary.ts` matching Python implementation bit-for-bit with zero DOM/UI/Three.js dependencies (NFR-04).
5. **Golden Parity Fixtures:** Developed `scripts/generate_phase4_fixtures.py` and exported `tests/golden/phase4_fixtures.json`. Created `web/tests/phase4_parity.test.mjs` verifying cross-runtime equivalence across identical orientations, misoriented grains, pinned states, and unresolved threshold states.

### 2.2 Core Formulation and Criteria
For incoming dislocation system $(\mathbf{s}_{\text{in}}, \mathbf{n}_{\text{in}}, \mathbf{b}_{\text{in}})$ in Grain 1 ($\mathbf{R}_{\text{in}}$) arriving at boundary with Grain 2 ($\mathbf{R}_{\text{out}}$):
1. **Specimen Frame Rotation:** Right-handed transform $\mathbf{v}_{\text{spec}} = \mathbf{R} \mathbf{v}_{\text{cryst}}$.
2. **Geometric Compatibility ($m'$):**
   $$m' = |\hat{\mathbf{s}}_{\text{in}} \cdot \hat{\mathbf{s}}_{\text{out}}| \, |\hat{\mathbf{n}}_{\text{in}} \cdot \hat{\mathbf{n}}_{\text{out}}| \in [0, 1]$$
   Criterion: $m' \ge m'_{\min}$.
3. **Residual Burgers Vector Magnitude ($|b_r|$):**
   $$|b_r| = \min\left(\|\mathbf{b}_{\text{in}} - \mathbf{b}_{\text{out}}\|, \|\mathbf{b}_{\text{in}} + \mathbf{b}_{\text{out}}\|\right)$$
   Sign-invariant under $\pm \mathbf{b}_{\text{out}}$.
4. **Outgoing Resolved Shear Stress ($\tau_{\text{out}}$):**
   $$\tau_{\text{out}} = |\mathbf{s}_{\text{out}}^T \boldsymbol{\sigma} \mathbf{n}_{\text{out}}| \ge \tau_c$$
5. **Tip Stress Criterion:**
   $$\tau_{\text{tip}} \ge \tau^*(m') = \tau^*_{\text{ref}} \left[1 + \beta(1 - m')\right]$$
6. **Deterministic Tie-Breaking:**
   - Priority 1: Highest $m'$ (rounded to 10 decimal digits).
   - Priority 2: Lowest $|b_r|/b$ (rounded to 10 decimal digits).
   - Priority 3: Highest $\tau_{\text{out}}$ (rounded to 6 decimal digits / 1 Pa).
   - Priority 4: Lowest slip-system index (ascending 0..11).

---

## 3. Honest Handling of Uncalibrated Material Parameters (Decision M6)

As established in Gate 0 and Decision M6, the grain boundary penetration resistance reference $\tau^*_{\text{ref}}$ is uncalibrated in the literature for this model.

- **Explicit Unresolved State:** When `tau_star_ref_pa` is `None` / `null`, `evaluate_boundary_transmission` does **not** assume an arbitrary default or guess a pass/fail. Instead:
  - `passed_tau_tip` is set to `null` for all candidate slip systems.
  - Overall `outcome` is strictly `"unresolved_threshold"`.
  - The human-readable log explicitly records: `tau_star_ref is unresolved (M6 calibration pending); threshold check blocked`.
- **Test-Only & UI Demonstrations:** Threshold values ($\tau^*_{\text{ref}} = 50\text{ MPa}$, $\tau_{\text{tip}} = 80\text{ MPa}$, $\beta = 1.0$) are used solely in test fixtures and as an optional user-toggled UI demonstration control. They are strictly badged as `ILLUSTRATIVE VALUES — NOT SOURCED` and are **never** committed to `materials.yaml` as sourced constants.

### Parameter Classification Table
| Parameter | Classification | Status / Value | Provenance |
|---|---|---|---|
| $a_{\text{fcc}}$ | Sourced Parameter | $4.0495 \times 10^{-10}\text{ m}$ | `src/hpsim/materials/materials.yaml` (Al) |
| $b_{\text{fcc}}$ | Sourced / Geometric | $a/\sqrt{2} \approx 2.8634 \times 10^{-10}\text{ m}$ | Direct crystallographic derivation |
| $\tau_c$ | Test Illustrative | $5.0\text{ MPa}$ | Demo visibility only |
| $m'_{\min}$ | Test Illustrative | $0.70$ | Compatibility threshold |
| $\tau^*_{\text{ref}}$ | **Unresolved (Decision M6)** | `null` (Pending Phase 6) | Literature audit; no early calibration |
| $\beta$ | Test Illustrative | $1.0$ | Misorientation sensitivity demo |
| $\tau_{\text{tip}}$ | Test Illustrative | $80.0\text{ MPa}$ | Dislocation arrival tip stress demo |

---

## 4. Controlled Boundary Geometry & 3D Explainability

### 4.1 Boundary Geometry
- Controlled two-grain columnar model: Grain 1 (incoming dislocation) and Grain 2 (adjacent candidate grain) meet at a controlled boundary plane.
- The boundary interface is perpendicular to the in-plane slip direction projection and contains the columnar growth axis ($Z$).
- Synthetic crystallographic misorientations ($\theta \in [0^\circ, 90^\circ]$ around $Z$) are used. No claim is made that optical micrographs provide 3D crystal orientations.

### 4.2 Interactive 3D Presentation & Event Log
- **Controlled Boundary Plane:** Rendered as an amber semi-transparent plane with wireframe borders.
- **Grain 2 Wireframe:** Adjacent grain bounding box rendered in cyan across the boundary interface.
- **Outcome Marker:** Positioned at dislocation boundary arrival point:
  - Green sphere: `transmitted`
  - Red sphere: `pinned`
  - Amber sphere: `unresolved_threshold`
- **Candidate Outgoing Slip Vectors:** 3D directional arrows emanating into Grain 2 from the arrival point:
  - Bright emerald green: Selected winning candidate.
  - Light sky blue: Qualifying candidate slip systems.
  - Slate gray: Rejected slip systems.
- **Explainable Event Log & Candidate Table:**
  - Full candidate table in `App.tsx` displaying all 12 candidate slip systems in Grain 2 with $(hkl)[uvw]$, $m'$, $|b_r|/b$, $\tau_{\text{out}}$, $\tau^*(m')$, and individual pass/fail reasons.
  - Selected system row is highlighted in vibrant green.
- **Rendering & Physics State Isolation:** Camera presets, OrbitControls, and Three.js scene updates are purely read-only presentation components. Tests confirm zero state mutation on simulation controllers or history.

![Phase 4 UI Screenshot](docs/screenshots/phase4_boundary.png)

---

## 5. Quality Gate 4 Verification Results

All tests rerun cleanly and reported with actual commands and outputs:

### 1. Python Test Suite
```
python -m pytest -q
........................................................................ [ 58%]
....................................................                     [100%]
124 passed in 2.14s
```

### 2. Scientific Data Provenance & Integrity Audit
```
python scripts/validate_data_acquisition.py
================================================================================
HPSIM SCIENTIFIC DATA AUDIT HARNESS
================================================================================
[TEST 1] Validating src/hpsim/materials/materials.yaml...
  -> PASS: materials.yaml is syntactically valid with verified Burgers vectors.
[TEST 2] Validating verified literature fits in data/literature/hall_petch_verified_fits.csv...
  -> PASS: hall_petch_verified_fits.csv contains 8 verified literature fits with valid DOIs and unit conversions.
[TEST 3] Auditing data points in data/literature/hall_petch_datasets.csv and companion data/literature/hall_petch_datasets_candidate.csv...
  -> PASS: All 40 dataset rows strictly conform to provenance and uncertainty audit rules.
[TEST 4] Validating data/micrographs/metadata.csv...
  -> PASS: metadata.csv matches schema and all 4 micrographs exist.
[TEST 5] Validating data/literature/download_manifest.csv...
  -> PASS: download_manifest.csv verified against physical files with 100% SHA-256 match.
[TEST 6] Validating DOI provenance and Copper purity across SOURCES.md and materials.yaml...
  -> PASS: All bibliographic DOIs and purity specifications verified against publisher records.
================================================================================
ALL AUTOMATED INTEGRITY AND AUDIT CHECKS PASSED (GREEN)
================================================================================
```

### 3. Node.js Unit & Cross-Runtime Parity Suite
```
node --experimental-strip-types --test web/tests/*.test.mjs
✔ web/src/core has no UI/rendering/DOM dependencies (15.0182ms)
✔ Units parity test (5.562ms)
✔ Rotations parity test (1.8231ms)
✔ Slip systems parity test (1.9353ms)
✔ Stress and Schmid factor parity test (1.2075ms)
✔ Glide law parity test (1.3429ms)
✔ FCC basis, counts, finiteness, repeatability (6.9605ms)
✔ FCC nearest-neighbour distance a/sqrt2 with coordination 12 (1.2374ms)
✔ edge field: finite at the core (regularised), branch-cut jump +b behind, none ahead (0.5569ms)
✔ Burgers circuit: enclosing = b, not enclosing = 0, clockwise = -b (tol 1e-3 b) (18.2459ms)
✔ displaced render coordinates are separate from ideal coordinates (3.6003ms)
✔ no lattice atom sits on the branch cut (slip plane between atomic planes) (4.3448ms)
✔ parity: lattice (2.1026ms)
✔ parity: edge displacement field (2.7683ms)
✔ parity: Burgers circuit (10.349ms)
✔ parity: glide trajectory (forward, reversal, threshold, boundary) (2.2545ms)
✔ zero velocity at/below threshold; linear above; reversal (4.5194ms)
✔ deterministic + large steps cannot skip the boundary (7.6277ms)
✔ controller: readout matches core RSS and glide velocity exactly (0.9861ms)
✔ controller: step / reset / seek / replay / truncate (1.0368ms)
✔ controller: stress reversal reverses glide direction (0.6478ms)
✔ playback speed changes steps-per-frame only, never the trajectory (11.0473ms)
✔ camera presets and render updates never mutate frozen physics state (4.6399ms)
✔ parity case 1: identical orientations transmitted (6.8789ms)
✔ parity case 2: misoriented grain transmission (0.9404ms)
✔ parity case 3: pinned outcome (0.6771ms)
✔ parity case 4: unresolved threshold outcome (0.5699ms)
✔ geometric compatibility bounds and identical systems (5.0283ms)
✔ residual Burgers magnitude minimization (0.581ms)
✔ identical orientations produces perfect match on candidate 0 (1.9795ms)
✔ deliberate misorientation 90 deg z produces valid candidate list (0.775ms)
✔ independent rejection criteria in TypeScript (0.8303ms)
✔ unresolved tau*_ref produces explicit unresolved_threshold outcome (0.4362ms)
✔ deterministic tie-breaking order in TypeScript: m', then |b_r|, then tau_out, then index (0.591ms)
✔ outgoing RSS is computed from full tensor and transforms consistently (0.6542ms)
✔ no acceptable candidate yields pinned with numerical reasons (0.5061ms)
✔ transmission evaluation does not mutate input state (0.7156ms)
✔ local frame is orthonormal and right-handed (det = +1) (2.4685ms)
✔ Peach-Koehler glide force sign matches resolved shear stress (2.2258ms)
✔ Burgers circuit closure sign is +b for right-handed orientation around xi (15.2203ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
```

### 4. TypeScript Strict Compiler Check
```
cd web && npx tsc
(Clean exit code 0; zero errors)
```

### 5. Production Bundle Build
```
cd web && npx vite build
vite v8.3.4 building client environment for production...
transforming...
✓ 35 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.65 kB │ gzip:   0.39 kB
dist/assets/index-CWRvuGXj.css    4.00 kB │ gzip:   1.49 kB
dist/assets/index-BAcImcpR.js   811.55 kB │ gzip: 217.97 kB
✓ built in 947ms
```

### 6. Browser Smoke Test (Playwright Subagent)
- Navigated to `http://localhost:5173/`.
- Verified default state renders `UNRESOLVED THRESHOLD` alert due to uncalibrated Decision M6 $\tau^*_{\text{ref}}$.
- Toggled illustrative $\tau^*_{\text{ref}}$ checkbox $\to$ outcome reactive update to `TRANSMITTED` for identical grain alignment.
- Verified candidate table, preset misorientation buttons (0°, 15°, 45°, 90°), and 3D overlay arrows.
- Zero uncaught exceptions or console errors.

---

## 6. Physical Limitations & Phase Scope Boundary

1. **No Pile-Up Solver (Phase 5 Scope):** Multi-dislocation interactions and backstress pile-up arrays are not implemented in Phase 4. Dislocation tip stress $\tau_{\text{tip}}$ is currently an explicit controlled test input.
2. **No Hall–Petch Sweeps (Phase 6 Scope):** Polycrystalline grain-size sweeps, yield-onset search, and Hall–Petch coefficient fitting are strictly deferred to Phase 6.
3. **No Micrograph Segmentation UI (Phase 7 Scope):** Micrograph CV segmentation remains offline research scope.
4. **Columnar Model Only:** Grain boundaries are treated as planar interfaces with a common [001] columnar axis. Complex 3D curved grain boundary facets are omitted.

---

## 7. Quality Gate 4 Conclusion

Phase 4 Grain-Boundary Transmission is complete, fully tested, documented, and visually explainable. Execution is stopped at Quality Gate 4. No work on Phase 5 will begin without explicit user authorization.
