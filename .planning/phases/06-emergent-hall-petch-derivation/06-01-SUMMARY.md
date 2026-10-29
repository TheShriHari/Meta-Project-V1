---
phase: 06-emergent-hall-petch-derivation
plan: 01
subsystem: core-hallpetch-and-ui
tags: [hall-petch, source-shutoff, bisection, calibration, parity, v-09, v-10, v-15]
provides:
  - src/hpsim/core/hallpetch.py
  - web/src/core/hallpetch.ts
  - tests/golden/phase6_fixtures.json
  - web/public/data/materials.json
  - docs/phase6_report.md
affects:
  - src/hpsim/core/__init__.py
  - src/hpsim/core/pileup.py
  - web/src/core/index.ts
  - web/src/ui/App.tsx
  - web/src/ui/styles.css
  - docs/model.md
key-files:
  created:
    - src/hpsim/core/hallpetch.py
    - web/src/core/hallpetch.ts
    - scripts/generate_phase6_fixtures.py
    - tests/test_hallpetch.py
    - web/tests/test_hallpetch.test.mjs
    - web/tests/phase6_parity.test.mjs
    - tests/golden/phase6_fixtures.json
    - web/public/data/materials.json
    - docs/phase6_report.md
  modified:
    - src/hpsim/core/__init__.py
    - src/hpsim/core/pileup.py
    - web/src/core/index.ts
    - web/src/ui/App.tsx
    - web/src/ui/styles.css
    - docs/model.md
decisions:
  - Used scipy.linalg.eigh_tridiagonal(diag, subdiag, eigvals_only=True) in pileup.py and asymptotic warm-start in solve_pileup_with_source for >20x speedup while preserving exact Laguerre root positions.
  - Preserved tau_star_ref: null in src/hpsim/materials/materials.yaml to satisfy strict literature provenance audit while storing Phase 6 calibrated values in CALIBRATED_MATERIALS and web/public/data/materials.json (tau_star_ref_calibrated).
metrics:
  duration: 25m
  completed_date: "2026-10-29"
---

# Phase 6 Plan 01: Emergent Hall–Petch Derivation Summary

Implemented the quasi-static dislocation source shut-off mechanism at $x = L = d / 2$, critical yield-onset bisection on $\tau_{\text{eff}}$, multi-grain-size Hall–Petch sweeps with seeded bootstrap 95% confidence intervals, single-parameter $\tau^*_{\text{ref}}$ calibration across all 4 audited materials, cross-language golden parity fixtures, and an interactive dual-mode Hall–Petch SVG chart in the browser UI.

## Verification Results
- **Python Suite (`pytest`):** `142 passed` in `9.59s` (`V-09`, `V-10`, `V-15`, and golden parity verified).
- **Data Provenance Audit (`scripts/validate_data_acquisition.py`):** `6/6` checks green.
- **TypeScript Unit & Parity Suite (`node --test`):** `64 passed` in `0.72s`.
- **Static Web Build (`tsc` & `vite build`):** `0` errors (`dist/` built in `1.02s`).
