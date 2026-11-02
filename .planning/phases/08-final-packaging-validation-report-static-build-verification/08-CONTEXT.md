# Phase 8: Final Packaging, Validation Report & Static Build Verification - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete Phase 8 packaging, canonical preset runner, automated validation report generator covering all 17 benchmarks (`V-01` through `V-17`), comprehensive scientific limitations and user documentation (`docs/limitations.md`, `docs/user_guide.md`), static build & licensing smoke tests (`web/tests/static_smoke.test.mjs`), and unified UI preset selector + limitations/about modal (`TASK-801`–`TASK-805`).

</domain>

<decisions>
## Implementation Decisions

### Area 1: Canonical Presets Runner & Unified UI Integration (`TASK-801`)
- **5 Canonical Simulation Presets (`scripts/run_presets.py`):**
  1. `al_hansen_calibration`: 99.999% High-Purity Aluminium (FCC) calibrated against Hansen (1977) ($\sigma_0 = 10.0\,\text{MPa}$, $k_y = 67.0\,\text{MPa}\cdot\mu\text{m}^{1/2}$, $\tau^*_{\text{ref}} = 80.89\,\text{MPa}$) across a 1.6-decade grain-size sweep ($d \in [10\,\mu\text{m}, 400\,\mu\text{m}]$).
  2. `cu_hansen_ralph`: 99.999% High-Purity Copper (FCC) calibrated against Hansen & Ralph (1982) ($\sigma_0 = 20.0\,\text{MPa}$, $k_y = 125.0\,\text{MPa}\cdot\mu\text{m}^{1/2}$, $\tau^*_{\text{ref}} = 172.26\,\text{MPa}$).
  3. `fe_if_takeda`: Ti-stabilized Interstitial-Free $\alpha$-Iron (BCC, 4 ppm C) calibrated against Takeda et al. (2008) ($\sigma_0 = 56.0\,\text{MPa}$, $k_y = 114.0\,\text{MPa}\cdot\mu\text{m}^{1/2}$, $\tau^*_{\text{ref}} = 118.35\,\text{MPa}$).
  4. `steel_c60_takeda`: Low-Carbon Ferritic Steel C60 (BCC, 56 ppm C) calibrated against Takeda et al. (2008) ($\sigma_0 = 61.0\,\text{MPa}$, $k_y = 516.0\,\text{MPa}\cdot\mu\text{m}^{1/2}$, $\tau^*_{\text{ref}} = 2115.93\,\text{MPa}$), preserving explicit `needs_citation` provenance on single-crystal $\tau_c$.
  5. `boundary_lrb_misorientation_sweep`: Deterministic Lee–Robertson–Birnbaum (LRB) tilt/twist misorientation sweep ($\Delta\theta \in [0^\circ, 90^\circ]$) evaluating geometric compatibility $m'$, residual Burgers vector $|\mathbf{b}_r|$, outgoing resolved shear stress $\tau_{\text{out}}$, and pin vs. transmit decisions.
- **CLI Options:** Support `--preset <id|all>` and `--json <output_path>` for deterministic offline execution and automated regression verification.

### Area 2: Automated Validation Report Generator (`TASK-802`, `V-01`–`V-17`)
- **`scripts/generate_validation_report.py` -> `docs/validation_report.md`:** Programmatically executes and tabulates all 17 verification and validation benchmarks (`V-01` through `V-17`) from `spec.md` §9.3 / `test-plan.md` §2 with exact numerical metrics, pass tolerances, and PASS status.
- **Phase 6 Calibration & Held-Out Table (`V-09`, `V-10`, `V-15`):** Embeds the complete 4-material calibration and held-out comparison table, accompanied by detailed physical analysis of:
  - Interstitial carbon segregation at BCC iron/steel grain boundaries (`IF-Fe` 4 ppm Ti-scavenged C vs `Base Fe` 5 ppm free C vs `C60` 56 ppm C, explaining why $\tau^*_{\text{ref}}$ jumps from $118.35\,\text{MPa}$ to $2115.93\,\text{MPa}$ and why unsegregated IF-Fe underpredicts Base Fe $k_y$ by $39.4\%$).
  - Commercial purity matrix friction shifts ($\sigma_0 = 10.0\,\text{MPa}$ in 99.999% Al vs $16.5\,\text{MPa}$ in 99.5% AA1050).
  - Discrete finite-$N$ Laguerre root spacing vs continuum EFN integral approximation ($\tau^*_{\text{ref,cal}} > \tau^*_{\text{ref,analytic}}$).

### Area 3: Scientific Limitations, User Guide & Static Smoke Tests (`TASK-803`, `TASK-805`)
- **Scientific Limitations (`docs/limitations.md`):** Documents 6 core physical and methodological boundaries: (1) 1D coplanar edge pile-ups vs 3D curved dislocation networks & cross-slip; (2) Isotropic linear elasticity ($\mu, \nu$) vs cubic elastic anisotropy ($A_Z \neq 1$, especially in Cu where $A_Z \approx 3.21$); (3) Breakdown in the nanocrystalline regime ($d < 1\,\mu\text{m}$, inverse Hall–Petch / grain-boundary sliding); (4) Absence of explicit solute/carbon boundary chemistry (`V-15`); (5) 2D optical stereology (`M4` copper twin exclusion, `M5` steel pearlite masking) and seeded random $\mathrm{SO}(3)$ orientations (`V-13`) vs EBSD maps; (6) Data provenance guardrails (`RECONSTRUCTED_FROM_FIT` vs raw observations, `M3` chord rescaling sensitivity, `D6` DoITPoMS CC BY-NC-SA 4.0 licensing).
- **User & Developer Guide (`docs/user_guide.md`):** End-to-end guide covering CLI commands (`pytest`, `validate_data_acquisition.py`, `run_presets.py`, `npm run dev`, `npm run build`), walkthrough of all 5 interactive UI cards (3D Lattice & Glide Viewer, LRB Boundary Transmission Inspector, 1D EFN Dislocation Pile-Up Card, Emergent Hall–Petch Chart, and Micrograph & Chord Importer), and custom JSON/CSV chord dataset schemas.
- **Static Build & Licensing Smoke Tests (`web/tests/static_smoke.test.mjs`):** Verifies `web/public/data/materials.json` integrity across all 4 materials, enforces `D6` license compliance (asserting zero raw DoITPoMS `.jpg` images anywhere under `web/public/`), and checks `web/dist/index.html` asset portability when `web/dist/` is present.

</decisions>

<canonical_refs>
## Canonical References

- `spec.md` §8, §9.3, §10, §11, §12
- `openspec/changes/hpsim-static-hosting/tasks.md` (`TASK-801`–`TASK-805`, Quality Gate 8)
- `openspec/changes/hpsim-static-hosting/test-plan.md` (`V-01`–`V-17`)
- `docs/data_acquisition_report.md`, `docs/phase5_report.md`, `docs/phase6_report.md`
- `tests/golden/phase6_fixtures.json`
</canonical_refs>
