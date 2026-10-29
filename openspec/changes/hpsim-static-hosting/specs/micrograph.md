# Specification Delta: `micrograph`

**Change ID:** `hpsim-static-hosting`  
**Capability:** `micrograph`

---

## MODIFIED Requirements

### Separation of Image Processing and Web Display
- **WAS:** Streamlit app directly invokes scikit-image/OpenCV pipelines on uploaded micrographs at runtime.
- **NOW:** Heavy image processing (segmentation, CLAHE, ridge detection, watershed, ASTM E112 intercept analysis) remains strictly an offline Python toolchain (`src/hpsim/micro/`).
- Python toolchain exports structured JSON representations of segmented grain boundaries, scale calibrations, and chord distributions to `web/public/data/micrographs/`.
- Web application renders lightweight SVG grain boundaries and chord overlays directly on bundled or user-provided sample images.

---

## ADDED Requirements

### Static Sample Micrograph Fixtures
- Preprocessed, openly licensed micrograph datasets (e.g. Takada 2008 ferritic steel) bundled as static JSON fixtures for immediate offline demonstration without requiring user file selection.

### Micrograph Data Licensing Enforcement
- Large raw unprocessed micrographs (e.g. local 9.5 MB copper scan) must remain in local development storage and must not be committed to `web/public/data/` without size optimization and license verification.
