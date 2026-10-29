# Phase 6: Emergent Hall–Petch Derivation - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive emergent Hall–Petch $d^{-1/2}$ strengthening from 1D discrete edge-dislocation pile-up mechanics with quasi-static source shut-off and yield-onset bisection, validate `V-09` (log–log slope $-0.5 \pm 0.05$) and `V-10` ($k_y$ consistency within 15%), calibrate $\tau^*_{\text{ref}}$ per material against verified literature fits (`V-15`), and integrate an interactive Hall–Petch SVG chart card in the browser UI.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Pile-Up Source Shut-Off, Yield-Onset Bisection & Emergent Scaling (V-09, V-10)
- **Source Shut-Off at $x = L = d/2$:** Starting at $N = 1$, add dislocations while the net driving stress at the source $\tau_{\text{eff}} - \tau_{\text{back}}(L; N) > \tau_{\text{src}}$ (with $\tau_{\text{back}}(L; N) = \sum_{j=0}^{N-1} A / (L - x_j)$ and $x_{N-1} < L$, default $\tau_{\text{src}} = 0$). Tip stress is $\tau_{\text{tip}} = N(L, \tau_{\text{eff}}) \cdot \tau_{\text{eff}}$.
- **Yield-Onset Bisection:** Since $\tau_{\text{tip}}(L, \tau_{\text{eff}})$ is monotonically non-decreasing in $\tau_{\text{eff}}$, find the smallest $\tau_{\text{eff}} > 0$ such that $\tau_{\text{tip}}(L, \tau_{\text{eff}}) \ge \tau^*(m')$ via bisection (combined with exact EFN root step check), reporting both $\tau_{\text{eff,crit}}$, critical count $N_{\text{crit}}$, and the integer-$N$ discretization step plateau width.
- **Emergent Scaling & Regression (`V-09`, `V-10`):** Sweep grain size $d$ over $\ge 1.5$ decades (e.g. $5\,\mu\text{m}$ to $250\,\mu\text{m}$), verify log–log slope of $\tau_{\text{eff,crit}}$ vs $d$ is within $-0.5 \pm 0.05$ (`V-09`), and perform OLS linear regression of $\sigma_y = \sigma_0 + k_y d^{-1/2}$ with deterministic seeded bootstrap 95% CI, verifying simulated $k_y$ is within 15% of $k_{y,\text{analytic}} = M_T\sqrt{2\mu b \tau^*/(\pi(1-\nu))}$ (`V-10`).

### Area 2: Calibration of $\tau^*_{\text{ref}}$ & Literature Validation (M6, V-15)
- **Calibration vs Held-Out Split:** For each of the 4 materials in `hall_petch_verified_fits.csv`, calibrate the single scalar $\tau^*_{\text{ref}}$ ($\beta = 0$) on the primary high-purity fit (Hansen 1977 99.999% Al, Hansen & Ralph 1982 99.999% Cu, Takeda 2008 Ti-IF Iron, Takeda 2008 C60 Steel) and evaluate `V-15` on the secondary independent fit (Hansen 1977 AA1050 Al, Feltham & Meakin 1957 Cu, Takeda 2008 Base Fe, Armstrong 1962 Mild Steel).
- **V-15 Tolerance Band:** Use the default $\pm 25\%$ relative error band across the held-out grain-size range, reporting exact errors honestly (and noting solute/precipitate boundary segregation differences in Fe-C).
- **Database & Audit Update:** Update `tau_star_ref.value` in `src/hpsim/materials/materials.yaml` (and export `web/public/data/materials.json`) with the calibrated values (`status: "calibrated"`), and update `scripts/validate_data_acquisition.py` so Test 1 verifies positive finite calibrated `tau_star_ref` values consistent with the Phase 6 calibration.

### Area 3: Interactive Browser Hall–Petch Chart & Cross-Runtime Parity
- **Interactive SVG Hall–Petch Card in `App.tsx`:** Add a dedicated Phase 6 card with material selector (Al, Cu, Pure $\alpha$-Fe, Ferritic Steel), view mode toggle ($\sigma_y$ vs $d^{-1/2}$ Hall–Petch plot vs $\log_{10}\tau_{\text{eff,crit}}$ vs $\log_{10} d$ scaling plot), $\tau^*_{\text{ref}}$ override slider, discrete simulation markers, OLS fit line, analytical EFN continuum line, and cited literature fit curves.
- **Provenance Badges:** Explicitly badge every curve and parameter as `sourced`, `calibrated`, or `illustrative`, and keep `RECONSTRUCTED_FROM_FIT` points labeled as regression-line demonstrations only.
- **Cross-Language Golden Parity:** Generate `tests/golden/phase6_fixtures.json` via `scripts/generate_phase6_fixtures.py` and verify parity in `tests/test_hallpetch.py` and `web/tests/phase6_parity.test.mjs`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hpsim/core/pileup.py` & `web/src/core/pileup.ts`: `compute_pileup_prefactor`, `compute_efn_roots`, `solve_pileup_equilibrium`.
- `src/hpsim/core/rng.py`: Deterministic seeded random number generator for bootstrap confidence intervals.
- `src/hpsim/materials/loader.py`: Material YAML loader and validator.

### Established Patterns
- Pure functional core with frozen/typed dataclasses in Python and strict interfaces in TypeScript (`NFR-04` isolation).
- Golden JSON parity fixtures verified in both `pytest` and `node --experimental-strip-types --test`.

### Integration Points
- `src/hpsim/core/__init__.py` and `web/src/core/index.ts` for exporting `hallpetch` symbols.
- `web/src/ui/App.tsx` and `web/src/ui/styles.css` for the interactive Phase 6 card.

</code_context>

<specifics>
## Specific Ideas

- Include both the continuum EFN formula $\tau^*_{\text{analytic}} = \frac{\pi(1-\nu)}{2\mu b}\left(\frac{k_y}{M_T}\right)^2$ and discrete pile-up calibration so the finite-$N$ discrete vs continuum comparison (`V-10`) is transparent.

</specifics>

<deferred>
## Deferred Ideas

- Real micrograph chord distribution sweeps and CV segmentation belong to Phase 7.

</deferred>
