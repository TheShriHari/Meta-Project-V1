# HPSim — Reproducibility & Environment Guide

This document provides exact, deterministic environment setup instructions, random seeds, test commands, fixture-generation scripts, and data licensing terms to ensure 100% independent reproducibility of all scientific and software results in **HPSim**.

---

## 1. Environment & Software Prerequisites

HPSim is evaluated on Windows PowerShell and POSIX shells (Linux/macOS).

### 1.1 Python Environment
- **Python Version:** 3.11.x or higher
- **Core Dependencies:**
  - `numpy >= 1.26.0`
  - `scipy >= 1.12.0`
  - `pytest >= 8.0.0`
  - `pyyaml >= 6.0.0`
  - `opencv-python >= 4.9.0`
  - `mpmath >= 1.3.0` (used for high-precision 50-digit verification oracles)

Installation:
```powershell
pip install numpy scipy pytest pyyaml opencv-python mpmath
```

### 1.2 Node.js & Web Environment
- **Node.js Version:** v22.0.0+ (supports native TS execution via `--experimental-strip-types`)
- **Package Manager:** `npm` v10+
- **Frontend Stack:** React 19, TypeScript 5.8+, Vite 6/8, Three.js 0.186+

Installation:
```powershell
cd web
npm install
cd ..
```

---

## 2. Deterministic Seeds & Algorithmic Oracles

To guarantee that calculations are fully deterministic and bit-for-bit reproducible:

1. **Bootstrap Confidence Intervals (`V-09`, `V-10`):**
   - Seed: `42` (`numpy.random.default_rng(42)`) in Python; seed-based pseudo-random generator in TypeScript.
   - Resampling Count: $B = 1,000$ resamples.
2. **Seeded Uniform Crystallographic Orientations (`V-13`):**
   - Algorithm: Shoemake (1992) uniform quaternion sampling on $\mathrm{SO}(3)$.
   - Seed: Fixed seed array per material in `src/hpsim/micro/orientations.py`.
3. **Synthetic Voronoi Verification Target (`V-11`):**
   - Grid: $10 \times 10$ seed points with deterministic jitter perturbations $\Delta \in [-0.2, 0.2]$.
   - Grain Size Truth: Analytical continuous Liang–Barsky clipping of Voronoi ridges yields $\bar{\ell} = \frac{\pi A}{2 L_{\text{tot}}} = 27.907\ \mu\text{m}$ (Underwood 1970).
4. **Independent mpmath EFN Polynomial Oracles ($N=4, 5$):**
   - High-precision 50-digit polynomial roots of Associated Laguerre polynomials $L_{N-1}^{(1)}(\xi) = 0$ evaluated directly in `tests/test_pileup.py` without scipy dependencies.

---

## 3. End-to-End Command Reproduction Matrix

Execute each command from the repository root:

| Verification Suite | Exact Command | Expected Exit Code | Expected Result |
| :--- | :--- | :---: | :--- |
| **Python Regression** | `$env:PYTHONPATH="src"; $env:PYTHONDONTWRITEBYTECODE="1"; python -m pytest -p no:cacheprovider -q` | `0` | **173 passed, 2 strict xfailed** (~37s) |
| **Data Integrity Audit** | `python scripts/validate_data_acquisition.py` | `0` | **6/6 checks pass (GREEN)** |
| **Node.js Test Suite** | `node --experimental-strip-types --test web/tests/*.test.mjs` | `0` | **87 passed, 0 failed** (~2.5s) |
| **TypeScript Check** | `Push-Location web; npx tsc --noEmit --incremental false; Pop-Location` | `0` | **0 errors (clean compilation)** |
| **Static Build Test** | `Push-Location web; npx vite build --base=/hpsim/ --outDir "$env:TEMP\hpsim_dist" --emptyOutDir; Pop-Location` | `0` | **Bundle built successfully** (~1.2s) |
| **Simulation Presets** | `$env:PYTHONPATH="src"; python scripts/run_presets.py` | `0` | **5/5 presets passed (GREEN)** |
| **Validation Report** | `$env:PYTHONPATH="src"; python scripts/generate_validation_report.py` | `0` | **Generates `docs/validation_report.md`** |

> [!IMPORTANT]
> Always set `PYTHONPATH="src"` before invoking Python scripts to ensure imports resolve to the local package rather than an external installed wheel.

---

## 4. Fixture Generation Scripts

All static web fixtures are deterministically generated from source materials and micrographs:

1. **Phase 6 Hall-Petch Golden Fixtures:**
   ```powershell
   $env:PYTHONPATH="src"
   python scripts/generate_phase6_fixtures.py
   ```
   Generates `tests/golden/phase6_fixtures.json` and updates `web/public/data/materials.json`.

2. **Phase 7 Micrograph Vector Fixtures:**
   ```powershell
   $env:PYTHONPATH="src"
   python scripts/generate_phase7_fixtures.py
   ```
   Segments raw local optical micrographs, extracts boundary polygons, computes ASTM E112 intercept test lines, and exports complete chord populations to `web/public/data/micrographs/*.json` and `tests/golden/phase7_fixtures.json`.

---

## 5. Data Licensing & Redistribution Boundaries

- **DoITPoMS Micrographs (Cambridge University):**
  - Source: University of Cambridge Department of Materials Science & Metallurgy.
  - License: **CC BY-NC-SA 4.0** (Attribution-NonCommercial-ShareAlike).
  - Restriction: Raw `.jpg` micrographs (`data/micrographs/*.jpg`) are educational materials and must **not** be redistributed in commercial distributions or public production assets.
  - Compliance: `hpsim` complies by exporting only derivative geometric boundary polygons, test line coordinates, and numerical chord distributions to `web/public/data/micrographs/`. Zero raw JPEG files exist in the web assets.
- **Experimental Literature Datasets:**
  - Sources: Hansen (1977), Hansen & Ralph (1982), Feltham & Meakin (1957), Takeda et al. (2008), Armstrong et al. (1962).
  - License: Fair-use scholarly quotation with full DOIs cited in `data/literature/SOURCES.md`.

