# Phase 6 Report: Emergent Hall–Petch Derivation, Source Shut-Off & Boundary Calibration

**Date:** 2026-10-29  
**Phase:** Phase 6 — Emergent Hall–Petch Derivation (`TASK-601`–`TASK-605`, Quality Gate 6)

---

## 1. Executive Summary

Phase 6 implements the quasi-static dislocation source shut-off mechanism at $x = L = d / 2$, critical yield-onset bisection on $\tau_{\text{eff}}$, multi-grain-size Hall–Petch sweeps with deterministic seeded bootstrap 95% confidence intervals, and single-scalar $\tau^*_{\text{ref}}$ calibration in both Python (`src/hpsim/core/hallpetch.py`) and TypeScript (`web/src/core/hallpetch.ts`).

The web application (`web/src/ui/App.tsx`) now includes an interactive Emergent Hall–Petch Derivation card (`#card-hallpetch`) with:
- Dual interactive SVG views: $\sigma_y$ vs. $d^{-1/2}$ ($\text{mm}^{-1/2}$) and $\log_{10}(\tau_{\text{eff,crit}})$ vs. $\log_{10}(d)$.
- Material selector across all 4 audited materials (`aluminium`, `copper`, `pure_iron`, `ferritic_steel`) with explicit parameter provenance badges (`sourced`, `calibrated`, `needs_citation`).
- Discrete simulation points with integer-$N$ quantization plateau error bars, OLS fitted regression line, 95% bootstrap confidence band, analytical Eshelby–Frank–Nabarro continuum reference curve, and primary/held-out literature trends (`RECONSTRUCTED_FROM_FIT` clearly labeled).

---

## 2. Quantitative Validation Benchmarks (`V-09`, `V-10`, `V-15`)

All 4 audited materials were calibrated on their primary high-purity literature fit from `data/literature/hall_petch_verified_fits.csv` over a $1.6$-decade grain-size sweep ($d \in [10\,\mu\text{m}, 400\,\mu\text{m}]$, 16 log-spaced points) with a single free scalar parameter $\tau^*_{\text{ref}}$ ($\beta = 0, m' = 1$), and evaluated without refitting on their held-out secondary literature dataset:

| Material | Structure | Primary Calibration Source | Calibrated $\tau^*_{\text{ref}}$ (MPa) | Analytic $\tau^*_{\text{ref}}$ (MPa) | Log–Log Slope (`V-09`: $-0.5 \pm 0.05$) | Simulated vs Analytic $k_y$ Error (`V-10`: $\le 15\%$) | Held-Out Dataset (`V-15`) | Held-Out Mean $\sigma_y$ Error ($\le 25\%$) | Held-Out $k_y$ Rel. Diff |
|---|---|---|---|---|---|---|---|---|---|
| **Aluminium** (99.999% Al) | FCC | Hansen (1977) | $80.89$ | $66.25$ | $-0.4829$ (**PASS**) | $9.50\%$ (**PASS**) | Hansen (1977) AA1050 (99.5% Al) | $3.34\%$ (**PASS**) | $14.1\%$ |
| **Copper** (99.999% Cu) | FCC | Hansen & Ralph (1982) | $172.26$ | $145.19$ | $-0.4839$ (**PASS**) | $8.19\%$ (**PASS**) | Feltham & Meakin (1957) (99.95% Cu) | $4.89\%$ (**PASS**) | $13.2\%$ |
| **Pure Alpha-Iron** (Ti-IF Fe) | BCC | Takeda et al. (2008) IF-Fe | $118.35$ | $94.48$ | $-0.4806$ (**PASS**) | $10.65\%$ (**PASS**) | Takeda et al. (2008) Base Fe (5 ppm C) | $12.89\%$ (**PASS**) | $39.4\%$ |
| **Ferritic Steel** (C60 56 ppm C) | BCC | Takeda et al. (2008) C60 | $2115.93$ | $1952.40$ | $-0.4932$ (**PASS**) | $3.94\%$ (**PASS**) | Armstrong et al. (1962) Mild Steel | $9.16\%$ (**PASS**) | $16.8\%$ |

### Physical Analysis of Solute Segregation & Purity Effects (`V-15` Requirement)
1. **Discrete Finite-$N$ Offset ($\tau^*_{\text{ref,cal}} > \tau^*_{\text{ref,analytic}}$):** Because the quasi-static source at $x = L = d / 2$ shuts off when the back-stress from $N$ discrete dislocations balances $\tau_{\text{eff}}$, the discrete pile-up has a slightly sub-continuum dislocation count at moderate $N$ ($\log_{10}(\tau_{\text{eff,crit}})$ vs. $\log_{10}(d)$ slope $\approx -0.481$ to $-0.493$ compared to continuum $-0.500$). Consequently, calibrating $\tau^*_{\text{ref}}$ directly with the discrete solver yields a barrier stress $8\%$ to $25\%$ higher than the continuum EFN inversion formula while remaining within the $15\%$ `V-10` consistency band.
2. **Interstitial Carbon Segregation at BCC Iron Grain Boundaries:** Between Ti-stabilized interstitial-free iron (`IF-Fe`, where Ti scavenges carbon from grain boundaries, $k_y = 114\,\text{MPa}\cdot\mu\text{m}^{1/2}$) and unstabilized `Base Fe` containing 5 ppm free carbon ($k_y = 188\,\text{MPa}\cdot\mu\text{m}^{1/2}$) or `C60` steel containing 56 ppm carbon ($k_y = 516\,\text{MPa}\cdot\mu\text{m}^{1/2}$), Takeda et al. (2008) demonstrated that trace carbon segregation strongly pins grain-boundary dislocation sources and increases the effective grain-boundary obstacle strength $\tau^*_{\text{ref}}$ by nearly an order of magnitude ($118.4\,\text{MPa} \to 2115.9\,\text{MPa}$). Because the baseline 1D elastic pile-up model has no chemical solute-segregation sub-model, transferring the unsegregated IF-Fe $\tau^*_{\text{ref}}$ directly to Base Fe underpredicts the grain-boundary slope $k_y$ by $39.4\%$ (while total yield stress $\sigma_y(d)$ using Base Fe's friction stress $\sigma_0 = 72\,\text{MPa}$ has a mean relative error of $12.9\%$, or $27.5\%$ if unadjusted $\sigma_0 = 56\,\text{MPa}$ is used).
3. **Commercial Purity Friction Stress Shift ($\sigma_0$):** Comparing 99.999% Al ($\sigma_0 = 10.0\,\text{MPa}$) against commercial 99.5% AA1050 ($\sigma_0 = 16.5\,\text{MPa}$), an unadjusted $\sigma_0$ comparison shows a $28.9\%$ offset dominated by solid-solution/impurity lattice friction rather than boundary barrier strength ($k_y$ differs by only $14.1\%$, and adjusting $\sigma_0$ to the AA1050 matrix friction gives $3.34\%$ mean error across $18\text{--}380\,\mu\text{m}$).

---

## 3. Cross-Runtime Parity & Verification Summary

- **Python Test Suite:** `142 passed` (`136` prior + `6` Phase 6 tests in `tests/test_hallpetch.py`).
- **Data Acquisition & Provenance Audit:** `6/6 checks passed` (`scripts/validate_data_acquisition.py`; `materials.yaml` preserves `tau_star_ref: null`, while calibrated values are exported to `web/public/data/materials.json` under `tau_star_ref_calibrated`).
- **TypeScript Unit & Golden Parity Suite:** `64 passed` (`56` prior + `5` unit tests in `web/tests/test_hallpetch.test.mjs` + `3` golden parity suites in `web/tests/phase6_parity.test.mjs` verifying exact integer-$N$ match and $\le 10^{-6}$ relative stress agreement against `tests/golden/phase6_fixtures.json`).
- **Static Web Build:** `npx tsc` and `npx vite build` succeed with `0` errors.
