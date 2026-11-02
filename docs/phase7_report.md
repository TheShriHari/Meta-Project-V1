# Phase 7 Report: Micrograph Preprocessing, Stereological Intercept Analysis & Web Data Integration

## 1. Executive Summary
Phase 7 delivers the complete micrograph preprocessing, watershed grain segmentation, ASTM E112 lineal intercept measurement, seeded 3D orientation assignment, and chord-distribution rescaling pipeline in `src/hpsim/micro/`, along with license-safe JSON fixtures in `web/public/data/micrographs/*.json` and diagnostic QA overlays in `docs/screenshots/*_qa_overlay.png`.

All validation gates (`V-11`, `V-12`, `V-13`, `V-16`) and licensing/scientific policies (`M4`, `M5`, `D6`) are verified by automated tests in `tests/test_micro.py` and `web/tests/*.test.mjs`.

---

## 2. Scientific Methodology & Policies

### 2.1 Scale-Bar Calibration & Safety Enforcement (`src/hpsim/micro/io.py`, `intercept.py`, `segment.py`)
Every micrograph in `data/micrographs/metadata.csv` is calibrated directly from its physical scale bar without image resampling:
$$\Delta x_{\text{px}} = \frac{\text{scale\_bar\_um} \times 10^{-6}}{\text{pixels\_for\_scale\_bar}} \quad [\text{m/px}]$$
Embedded bottom scale-bar banners are cropped out prior to segmentation so legend text and bars do not contaminate grain boundary detection.

**Scale-Bar Safety:** The pipeline strictly refuses measurement and raises `ValueError` if `pixel_size_m` is missing, zero, or negative across `compute_lineal_intercepts`, `segment_micrograph`, `extract_grains`, and `generate_synthetic_voronoi_labels`.

### 2.2 Preprocessing & Watershed Segmentation (`preprocess.py`, `segment.py`)
1. **CLAHE + Bilateral Filtering:** Normalizes uneven illumination across optical micrographs while preserving sharp etched grain boundaries.
2. **Decision M4 — Copper Annealing Twin Exclusion:** Annealed copper (`copper_cu997_doitpoms436.jpg`) exhibits straight intragranular $\Sigma 3$ twin traces. Morphological opening and enlarged distance-transform seed spacing (`min_seed_dist_px = 29`) prevent twin lamellae from over-segmenting parent FCC grains.
3. **Decision M5 — Ferritic Steel Pearlite Masking:** In `ferritic_steel_fe202.jpg`, dark pearlite colonies are isolated via intensity-percentile thresholding (`16th` percentile) and morphological opening (`5x5` ellipse). Only bright $\alpha$-ferrite grains are labeled (`1..K`), while pearlite is masked (`label = 0`) and excluded from foreground intercept length $L_{\text{tot}}$.
4. **Complete Chord Population Export:** All chords are exported in full in `chords_m` and `chords_um` without truncation slices (`[:250]`), eliminating spatial sampling bias and ensuring client-side statistics match the full pipeline bit-for-bit.

### 2.3 Root-Cause Analysis: Raster 1D vs. Vector Contour Line Crossing Discrepancy (`V-12`)
During reference cross-checks (`V-12`), line 3 of Aluminium (row $y=160$) exhibited 3 direct crossings in 1D raster analysis versus 7 crossings in 2D vector polygon contour analysis.

**Mechanism & Root Cause:**
- **1D Raster Analysis (`_analyze_1d_line`):** Single-pixel boundary roughness spikes ($38 \to 45 \to 38$ at $x=315$ and $x=320$) are smoothed out by `_clean_1d_label_jitter` because isolated single-pixel segments ($< 2\,\text{px}$) do not represent physical grain cross-sections. After filtering, only the 3 macroscopic grain boundary transitions ($49 \to 48$, $48 \to 47$, $47 \to 38$) are counted.
- **2D Vector Contour Geometry (`_geometric_line_crossings`):** Polygon contours extracted via `cv2.findContours` strictly trace every pixel footprint without 1D jitter filtering. When a horizontal test line traverses an isolated 1-pixel boundary intrusion of grain 45 into grain 38, it enters the intrusion (crossing 1: $38 \to 45$) and exits back into grain 38 (crossing 2: $45 \to 38$). Each single-pixel boundary jitter spike is thus double-counted as 2 contour crossings.
- **Mathematical Relationship:**
  $$N_{\text{contour}} = N_{\text{1D}} + 2 \times N_{\text{jitter\_spikes}} = 3 + 2 \times 2 = 7$$
This discrepancy is surfaced transparently in `reference_line_checks` rather than obscured, and verified via synthetic counterexample tests in `tests/test_micro.py`.

### 2.4 Synthetic Voronoi Stereology Target & Liang-Barsky Oracle (`V-11`)
> **Scientific Disclaimer:** Synthetic Voronoi tessellations (`generate_synthetic_voronoi_labels` and `synthetic_voronoi_30um.json`) are **mathematical stereology verification targets (`V-11`)** used exclusively to verify the accuracy of the ASTM E112 lineal intercept estimator against known ground-truth geometry. They do **not** represent real experimental microstructures.

By stereology (Underwood 1970 / ASTM E112), a 2D planar tessellation with boundary length per unit area $L_A$ has exact mean lineal intercept:
$$\bar{\ell}_{\text{true}} = \frac{\pi}{2 L_A} = \frac{\pi A_{\text{window}}}{2 \sum L_{\text{ridge}}}$$

**Voronoi Oracle Independence:** Continuous ground-truth intercept length is computed by clipping exact geometric Voronoi ridges against the window boundaries $[0, w] \times [0, h]$ using the Liang-Barsky line clipping algorithm. The oracle evaluates $\bar{\ell}_{\text{true}}$ strictly from continuous geometric ridge lengths and window area; it is completely independent of the generator's nominal `target_grain_size_m` setting.

### 2.5 License Compliance (`Decision D6`)
Per `assumptions.md` Decision D6, DoITPoMS micrographs carry `CC BY-NC-SA 4.0` licenses. Raw `.jpg` files remain strictly in `data/micrographs/` for local analysis and are **never** copied into `web/public/` or `web/dist/`. Only derived vector grain polygons, complete chord distributions, and summary statistics are exported to `web/public/data/micrographs/*.json`.

---

## 3. Segmented Micrograph Summary Table & Verified Counts

| Key | Material / Structure | Segmentation Policy | Total Chords | Total Crossings | ASTM Intercept $\bar{\ell}_{\text{ASTM}}$ | Chord Mean $\bar{\ell}_{\text{chord}}$ | Std $\sigma_{\ell}$ | Chord CV | Pearlite Masked |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `aluminium` | Al 99.5% (FCC) | `standard_watershed` | **963** | **932** | **8.112 μm** | **7.847 μm** | 10.162 μm | 1.2951 | 0.0% |
| `copper` | Cu 99.7% (FCC) | `M4_copper_twin_exclusion` | **1044** | **1011** | **17.267 μm** | **16.717 μm** | 12.639 μm | 0.7561 | 0.0% |
| `ferritic_steel` | Fe-0.15C (BCC) | `M5_ferrite_only_mask` | **1301** | **1129** | **13.139 μm** | **11.368 μm** | 8.575 μm | 0.7542 | 13.78% |
| `pure_iron` | α-Fe (BCC) | `standard_watershed` | **855** | **817** | **7.599 μm** | **7.261 μm** | 6.001 μm | 0.8265 | 0.0% |
| `synthetic_voronoi_30um` | Synthetic V-11 Target | `V11_synthetic_voronoi_target` | **231** | **215** | **27.907 μm** | **25.965 μm** | 13.677 μm | 0.5267 | 0.0% |

Enriched statistics for all micrographs include:
- Exact ASTM E112 grid intercept: $\bar{\ell}_{\text{ASTM}} = L_T / P$ (`astm_mean_intercept_m`, `astm_mean_intercept_um`)
- Complete chord sample distribution statistics: $\bar{\ell}_{\text{chord}}$, $\sigma_{\ell}$, $\mathrm{CV} = \sigma / \mu$ (`chord_mean_m`, `std_intercept_m`, `chord_cv`)
- Distribution percentiles: $p_{10}$, $p_{50}$ (median), $p_{90}$ (`p10_m`, `p50_m`, `p90_m`)
- Total counts: $P = \text{total\_crossings}$, $N = \text{total\_chords}$

---

## 4. Verification Summary (`V-11`, `V-12`, `V-13`, `V-16`)
- **`V-11` (Voronoi Lineal Intercept Accuracy & Oracle Independence):** Passed across $15, 30, 60\,\mu\text{m}$ and seeds $11, 29, 47$ (`rel_err <= 0.10`). Continuous Liang-Barsky clipped ridge truth verified independent of target grain size parameter.
- **`V-12` (Real Micrograph Reference Line Cross-Check & Root Cause):** Passed across all micrographs; raster 1D vs. vector contour crossing differences proven to originate from single-pixel boundary re-entrances double-counted in vector space ($N_{\text{vec}} = N_{\text{1D}} + 2 N_{\text{jitter}}$).
- **`V-13` (Seeded 3D Orientation Reproducibility):** Passed; `assign_seeded_orientations` produces bit-for-bit identical $\mathbf{R}_i \in \mathrm{SO}(3)$ ($\mathbf{R}_i^T \mathbf{R}_i = \mathbf{I}$, $\det \mathbf{R}_i = +1$) for identical seeds and distinct rotations for different seeds.
- **`V-16` (Chord Rescaling Mean & CV Invariance):** Passed; `rescale_chords` matches target mean within $\le 10^{-9}$ relative error and preserves $\mathrm{CV} = \sigma / \mu$ within $\le 10^{-12}$.
- **Scale-Bar Safety:** Passed; pipeline enforces `pixel_size_m > 0` and rejects missing/nonpositive scales with `ValueError`.
- **Decision D6 Compliance:** Confirmed 0 `.jpg` files exist in `web/public/` or `web/dist/`.
