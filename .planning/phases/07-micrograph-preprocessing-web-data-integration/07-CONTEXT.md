# Phase 7: Micrograph Preprocessing & Web Data Integration - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the offline Python micrograph preprocessing & geometric analysis package (`src/hpsim/micro/`: `io.py`, `preprocess.py`, `segment.py`, `qa.py`, `intercept.py`, `grains.py`, `chords.py`, `orientations.py`, `rescale.py`), validate `V-11` (synthetic Voronoi lineal intercept accuracy within 10%), `V-12` (real micrograph segmentation, QA overlays in `docs/screenshots/`, and reference-line intercept cross-check), `V-13` (seeded orientation determinism), and `V-16` (chord rescaling mean within $10^{-9}$ and unchanged CV), export license-safe preprocessed micrograph JSON fixtures to `web/public/data/micrographs/`, and add the interactive Micrograph Overlay (`MicrographView`) + client-side JSON/CSV chord distribution drag-and-drop importer (`DataImport`) to the browser application.
</domain>

<decisions>
## Implementation Decisions

### Area 1: Segmentation, Intercepts & Synthetic Validation (`V-11`, `V-12`)
- **Synthetic Voronoi Generator (`V-11`):** Implement a rasterized 2D Poisson–Voronoi (with Lloyd relaxation option) label-map generator in `src/hpsim/micro/segment.py` with known target mean equivalent grain diameter $d_{\text{true}} = \sqrt{A / N_{\text{grains}}}$. Verify via ASTM E112 horizontal + vertical test lines (`src/hpsim/micro/intercept.py`) that the recovered mean lineal intercept $\bar{\ell}$ agrees within $10\%$ across $\ge 3$ target grain sizes ($15\,\mu\text{m}, 30\,\mu\text{m}, 60\,\mu\text{m}$) and $\ge 3$ random seeds.
- **Real Micrograph Pipeline & Policies (`V-12`):** Load and scale-calibrate the 4 micrographs in `data/micrographs/metadata.csv` (`io.py`), apply CLAHE + bilateral/Gaussian denoise (`preprocess.py`), Canny/Sobel ridge detection + seeded watershed segmentation (`segment.py`) honoring Decision `M4` (excluding straight intracellular twin traces in copper via morphological bridge/aspect filtering) and Decision `M5` (masking dark pearlite colonies in ferritic steel via intensity threshold so only ferrite grains are measured), save red-boundary QA overlays to `docs/screenshots/<name>_qa_overlay.png` (`qa.py`), and cross-check automated vs reference boundary crossings on $\ge 3$ horizontal/vertical test lines.

### Area 2: Chord Distributions, Rescaling & Seeded Orientations (`V-13`, `V-16`)
- **Grain Polygons & Chords (`grains.py`, `chords.py`):** Extract per-grain centroids, areas, equivalent circular diameters, boundary contour polygons, and directional/isotropic chord-length distributions $\{c_k\}$.
- **Deterministic Seeded Orientations (`orientations.py`, `V-13`):** Assign each segmented grain $g_i$ an orthonormal crystal orientation $R_i \in \mathrm{SO}(3)$ via `hpsim.core.rotations.random_rotation_so3` seeded deterministically from `(master_seed, grain_id)` plus Bunge Euler angles $(\varphi_1, \Phi, \varphi_2)$ and a dominant slip-trace angle $\theta_i$ in the 2D specimen plane.
- **Parametric Chord Rescaling (`rescale.py`, `V-16`):** Implement `rescale_chords(chords_m, target_mean_m)` scaling $c_k' = c_k \cdot (d_{\text{target}} / \bar{c})$ so $\text{mean}(c') = d_{\text{target}}$ within $10^{-9}$ relative tolerance while preserving coefficient of variation $\text{CV} = \sigma_c / \bar{c}$ within $10^{-12}$, and compute ensemble Hall–Petch yield predictions across $\{c_k'\}$.

### Area 3: License-Safe Web Fixtures, `MicrographView` & Drag-and-Drop Importer (`TASK-703`–`TASK-705`)
- **Strict Redistribution Guardrail (`D6`):** Never copy raw CC BY-NC-SA 4.0 DoITPoMS `.jpg` files (`aluminium_al995_doitpoms609.jpg`, `copper_cu997_doitpoms436.jpg`, `ferritic_steel_fe202.jpg`) into `web/public/`. Export only extracted vector grain polygons, ASTM E112 intercept lines, chord arrays, scale calibration, and seeded slip-trace angles to `web/public/data/micrographs/*.json` (plus synthetic Voronoi fixtures).
- **Web Micrograph & Chord Core (`web/src/core/micrograph.ts`):** Pure TypeScript module for chord statistics ($\bar{\ell}$, $\text{CV}$, histogram bins), `rescaleChords` (`V-16` parity), and ensemble chord-weighted Hall–Petch yield stress computation.
- **Interactive UI (`#card-micrograph` in `web/src/ui/App.tsx`):** SVG `MicrographView` rendering segmented grain boundary polygons, ASTM E112 intercept test lines with boundary tick markers, seeded per-grain slip traces, chord histogram, parametric $d_{\text{target}}$ rescaling slider, and client-side drag-and-drop / file-picker JSON & CSV chord distribution importer (`DataImport`).
</decisions>

<specifics>
## Specific Ideas

- Use OpenCV (`cv2`) and `scipy.ndimage` in `src/hpsim/micro/` for fast, deterministic CLAHE, bilateral filtering, distance-transform watershed, and contour polygon simplification (`cv2.approxPolyDP`).
- Provide a script `scripts/generate_phase7_fixtures.py` that processes all 4 micrographs in `data/micrographs/` + synthetic Voronoi benchmarks, writes `docs/screenshots/*_qa_overlay.png`, exports `web/public/data/micrographs/*.json`, and writes `tests/golden/phase7_fixtures.json` for Python/TypeScript parity tests.
</specifics>

<canonical_refs>
## Canonical References

- `spec.md` §5.8, §6.2, §8.1 (`FR-09`, `FR-10`, `FR-11`, `FR-19`), §10.2 (`V-11`, `V-12`, `V-13`, `V-16`)
- `openspec/changes/hpsim-static-hosting/tasks.md` (`TASK-701`–`TASK-705`, Quality Gate 7)
- `openspec/changes/hpsim-static-hosting/assumptions.md` (`D1`/`M3`, `D2`/`M4`, `D3`/`M5`, `D6`)
- `data/micrographs/metadata.csv`
</canonical_refs>
