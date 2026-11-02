# Remediation Audit Report (Post-Audit Remediation)

**Date:** 2026-10-29  
**Branch:** `main` (commit `193721c`)  
**Timestamped Backup:** `C:\Users\toshr\Desktop\HPSim_Backup_20261029_191324`  
**Execution Context:** Scoped remediation of Phase 5, Phase 6, and Phase 7 post-audit findings.

---

## 1. Executive Summary

This remediation targeted the scientific tautologies, held-out leakage, contract mismatches, and synthetic micrograph labelling issues identified in the 2026-10-29 HPSim audit. All tests across Python and Node.js run green, including newly introduced independent oracles and strict expected-failure tests. No Git commits, history rewrites, resets, or unauthorized file deletions were performed. All pre-existing untracked work (`.planning/phases/08-...`, `scripts/run_presets.py`, etc.) and modified tracked work have been strictly preserved.

---

## 2. Remediation Status by Phase

### Phase 5 — Verification Gaps & Model Realism (`tests/test_pileup.py`, docs)
- **Status:** **FIXED**
- **Issues Remediated:**
  1. *Tautological Position Comparison*: Removed self-comparison where `solve_pileup_equilibrium` results were checked against `compute_efn_exact_positions` (the same underlying eigensolver function).
  2. *Independent Small-$N$ Oracles*:
     - $N=2$: Closed-form analytical oracle $x_2 = A/\tau$ derived from single-equation force balance; residual assertion $|\tau_{\text{eff}} - A/x_2| < 10^{-6} \tau$.
     - $N=3$: Hand-derived roots $x_{1,2} = \frac{3 \mp \sqrt{3}}{2\lambda}$, with independent residual checks on both mobile dislocation force balances and pairwise summation identity $\sum A/x_j = 2\tau_{\text{eff}}$.
  3. *Residual Property Checks ($N > 3$)*: Replaced the tautological benchmark test with an explicit `test_equilibrium_residual_property` across $N \in \{2, 3, 5, 10, 15, 25\}$, verifying ordering, positive non-zero gap spacing, origin boundary conditions, dimensional units, and force residuals.
  4. *Eshelby Tip Stress Independent Sum*: Replaced the tautological algebraic identity check ($N \cdot \tau = N \cdot \tau$) with an independent numerical summation over returned dislocation positions ($\tau_{\text{tip}} = \tau + \sum_{j=1}^{N-1} \frac{A}{x_j}$), verifying agreement with both $N\tau$ and `res.tip_stress_pa` to relative tolerance $10^{-9}$.
  5. *Semantics and Solver Documentation*:
     - Corrected `docs/model.md` and `docs/phase5_report.md` to document Python's actual tridiagonal eigensolver (`scipy.linalg.eigh_tridiagonal`), superseding the erroneous `numpy.linalg.eigvalsh(T)` dense solver description.
     - Documented that neither Python nor TypeScript returns `status="invalid_input"`; both implementations raise exceptions (`ValueError` / `Error`), aligning documentation with code and tests.

---

### Phase 6 — Scientific Protocol & Parity (`src/hpsim/core/hallpetch.py`, `tests/test_hallpetch.py`, `web/src/core/hallpetch.ts`, `web/tests/phase6_parity.test.mjs`, `web/src/ui/App.tsx`, docs)
- **Status:** **FIXED**
- **Issues Remediated:**
  1. *Held-Out Leakage Elimination*:
     - Audited and updated `evaluate_literature_calibration_and_validation`. Removed the leaky `held_out_mean_rel_error` (which used the held-out material's own $\sigma_0$).
     - Defined `held_out_unadjusted_mean_rel_error` as the primary **headline blind prediction metric** (evaluated with calibrated $\tau^*_{\text{ref}}$ and the primary calibration dataset's $\sigma_0$, without access to the held-out dataset's $\sigma_0$).
     - Preserved `held_out_intercept_adjusted_mean_rel_error` strictly as a secondary comparison labeled **NOT blind** (slope-only / adjusted intercept).
  2. *Calibration Protocol Disclosure*:
     - Introduced explicit `CALIBRATION_PROTOCOL` documentation in `hallpetch.py` and fixture headers: $\tau^*_{\text{ref}}$ is a single fitted scalar targeting published $k_y$; therefore, $k_y$ is a calibration target and **not** an emergent prediction. Emergence applies strictly to the $d^{-1/2}$ power-law exponent ($V-09$).
     - Explicitly preserved decision that reconstructed rows from `hall_petch_datasets.csv` remain `demonstration_only`.
     - Preserved `tau_star_ref: null` in `materials.yaml` and `tau_c: needs_citation` for ferritic steel.
  3. *Assertion Hardening & Honest Failure Documentation*:
     - Replaced weak assertions in `test_v15_calibration_and_held_out_literature_comparison` with explicit strict booleans.
     - Added two strict `@pytest.mark.xfail(strict=True)` tests documenting known scientific limitations: Aluminum unadjusted error exceeding the 25% band (~28.9%) and pure-iron slope transfer discrepancy (~39%), demonstrating honest reporting rather than curve-fitting.
  4. *Analytical Small-$N$ Emission Oracles*:
     - Added closed-form hand-derived oracles for $N=1 \to N=2$ source shut-off thresholds and $N=2$ back-stress equations with $\tau_{\text{src}} > 0$.
  5. *Canonical Contract Alignment & Parity*:
     - Reconciled grain size sweep contract to canonical 10–400 µm across 16 points (Python, TypeScript, `materials.json`, and UI).
     - Proved equivalence between Python's asymptotic warm-start solver and sequential emission search via 150 randomized and boundary cases in `phase6_parity.test.mjs`.
  6. *Documentation & UI Integrity*:
     - Corrected `docs/phase6_report.md` to state that quantization error bars and 95% bootstrap CI bands are not rendered in the SVG, preventing decorative or unsupported statistical claims.
     - Updated UI labels in `web/src/ui/App.tsx` to clearly differentiate blind unadjusted predictions from intercept-adjusted demonstrations.

---

### Phase 7 — Micrograph Provenance & Geometric Verification (`src/hpsim/micro/`, `tests/test_micro.py`, `web/src/core/micrograph.ts`, `web/tests/test_micrograph.test.mjs`)
- **Status:** **FIXED**
- **Issues Remediated:**
  1. *De-identification of Synthetic Browser Presets*:
     - Renamed and labeled all built-in synthetic browser presets in `web/src/core/micrograph.ts` as:
       `"SYNTHETIC DEMONSTRATION — NOT MEASURED FROM SOURCE MICROGRAPH"`.
     - Clarified that chords are rescaled Voronoi geometry for UI sensitivity illustration only, with no twin/pearlite image segmentation applied.
     - Marked synthetic presets with `isRealSegmentedFixture: false`.
  2. *Independent Geometric Reference for $V-12$*:
     - Replaced the circular `_build_simplified_polygon_label_map` (which re-rasterized polygons and fed them back into the 1D run analyzer) with `_geometric_line_crossings`.
     - Uses upsampled per-grain polygon contours from OpenCV (`RETR_CCOMP`), computing ray intersections using an upsampled band and deterministic half-open crossing conventions.
     - Tested edge cases: coincident boundary lines, 4-corner vertices, masked backgrounds, invalid non-integer/out-of-bound labels.
  3. *Oracle Separation*:
     - Decoupled `generate_synthetic_voronoi_labels` from `target_grain_size_m`. The verification oracle is now the geometric truth from clipped Voronoi ridge lengths ($\bar{l} = \frac{\pi A}{2 L}$), satisfying $V-11$ independently.
  4. *Over-Fragmentation Diagnostics*:
     - Added `segmentation_diagnostics()` computing grain counts, area distributions, small-fragment fractions (<100 px and <10% median area), and median ECD.
     - Diagnostic audit revealed pure iron has a small-fragment fraction of 0.0 (no fine-scale shatter), but an intercept-to-ECD ratio of ~0.5. Parameters were intentionally left untouched to prevent unprincipled target-fitting.
     - Flagged data discrepancy between legacy web chord counts/means and the local segmentation pipeline for future dataset regeneration.

---

## 3. Comprehensive Verification Results

All tests and validation harnesses were executed from the repository root:

| Command | Exit Code | Result Summary |
| :--- | :---: | :--- |
| `$env:PYTHONPATH="src"; python -m pytest -q` | `0` | **165 passed, 2 xfailed** (strict) in 21.93s |
| `python scripts/validate_data_acquisition.py` | `0` | **PASS**: All 6 data integrity & DOI audit checks green |
| `node --experimental-strip-types --test web/tests/*.test.mjs` | `0` | **80 passed, 0 failed** in 1.22s |
| `Push-Location web; npx tsc; Pop-Location` | `0` | **TypeScript compilation passed** with 0 errors |
| `npx vite build --outDir "$env:TEMP\hpsim_remediation_dist" --emptyOutDir` | `0` | **Production bundle built successfully** in 551ms |

*Note on xfailed tests:*
- `tests/test_hallpetch.py::test_v15_unadjusted_aluminium_known_failure`: Documents that Aluminum unadjusted held-out error (28.9%) exceeds the 25% target without intercept adjustment.
- `tests/test_hallpetch.py::test_v15_pure_iron_slope_transfer_known_failure`: Documents that pure-iron literature calibration slope does not transfer within 25% to the held-out Takaki dataset (~39% difference).

---

## 4. Modified Files List

The following files were modified as part of the bounded remediation:
- **Core Python:**
  - `src/hpsim/core/hallpetch.py`
  - `src/hpsim/micro/grains.py`
  - `src/hpsim/micro/intercept.py`
  - `src/hpsim/micro/segment.py`
- **Python Tests & Fixture Generators:**
  - `tests/test_pileup.py`
  - `tests/test_hallpetch.py`
  - `tests/test_micro.py`
  - `scripts/generate_phase6_fixtures.py`
  - `tests/golden/phase6_fixtures.json`
- **TypeScript Core, UI & Tests:**
  - `web/src/core/hallpetch.ts`
  - `web/src/core/micrograph.ts`
  - `web/src/ui/App.tsx`
  - `web/tests/phase6_parity.test.mjs`
  - `web/tests/test_micrograph.test.mjs`
- **Data & Documentation:**
  - `web/public/data/materials.json`
  - `docs/model.md`
  - `docs/phase5_report.md`
  - `docs/phase6_report.md`
  - `docs/remediation_audit_report.md` (this report)

All pre-existing tracked and untracked changes remain preserved in the working tree.

---

## 5. Residual Risks & Recommended Next Decisions

1. **Micrograph Fixture Chord Reconciliation**:
   - The JSON fixtures in `web/public/data/micrographs/*.json` contain truncated chord lists (~250 chords), whereas full pipeline outputs produce 900–1600 chords. A coordinated fixture regeneration script should update these fixtures without embedding raw copyrighted images.
2. **Ferritic Steel $V-12$ Jitter Sensitivity**:
   - The OpenCV geometric contour crossing check is sensitive to single-pixel boundary rasterization differences on complex multi-phase boundaries. A tolerance of $\le 25\%$ aggregate difference is currently applied.
3. **Pending Decision M6**:
   - Decision M6 regarding calibration integration into `materials.yaml` remains open. `tau_star_ref` values remain demonstration and test outputs; no production YAML parameter promotion has occurred.

**Conclusion**: The codebase now provides mathematically sound, non-tautological test oracles, transparent scientific reporting, and rigorous runtime parity. Work is paused for user review prior to Phase 8.

