"""
src/hpsim/micro/preprocess.py - Contrast normalization (CLAHE), denoising, and phase masking (M5).
"""

from dataclasses import dataclass
import cv2
import numpy as np


@dataclass(frozen=True)
class PreprocessedMicrograph:
    """Output of contrast normalization, edge-preserving smoothing, and M5 phase masking."""
    gray_raw: np.ndarray
    enhanced_gray: np.ndarray
    smoothed_gray: np.ndarray
    gradient_mag: np.ndarray
    foreground_mask: np.ndarray
    pearlite_fraction: float


def preprocess_micrograph(
    gray: np.ndarray,
    material_key: str = "generic",
    clahe_clip_limit: float = 2.2,
    clahe_grid_size: int = 8,
) -> PreprocessedMicrograph:
    """
    Apply CLAHE contrast normalization, bilateral edge-preserving filter, Sobel gradient
    extraction, and Decision M5 ferrite-only masking (for ferritic_steel).

    Segmentation Uncertainty & Limitations:
      - Optical metallographs exhibit uneven chemical etching, polishing scratches, and
        intragranular relief that introduce +/-10-20% uncertainty in automated watershed
        grain boundary delineation compared to manual EBSD or expert tracing.
      - Decision M5 (`ferritic_steel`): Dark pearlite colonies are isolated via intensity
        percentile thresholding and morphological opening so only the bright primary ferrite
        matrix is analyzed for grain size.
    """
    if gray.ndim != 2:
        raise ValueError("preprocess_micrograph expects a 2D grayscale image")

    clahe = cv2.createCLAHE(
        clipLimit=clahe_clip_limit,
        tileGridSize=(clahe_grid_size, clahe_grid_size),
    )
    enhanced = clahe.apply(gray)

    # Bilateral filter preserves sharp grain boundaries while smoothing intragranular etch noise
    smoothed = cv2.bilateralFilter(enhanced, d=7, sigmaColor=35, sigmaSpace=7)

    # Sobel gradient magnitude for boundary ridge enhancement
    gx = cv2.Sobel(smoothed, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(smoothed, cv2.CV_64F, 0, 1, ksize=3)
    grad = np.hypot(gx, gy)
    if np.max(grad) > 0:
        grad_u8 = np.clip((grad / np.max(grad)) * 255.0, 0, 255).astype(np.uint8)
    else:
        grad_u8 = np.zeros_like(gray, dtype=np.uint8)

    # Decision M5 (spec.md §12, assumptions.md D3): In ferritic steel, mask dark pearlite colonies
    # so only the bright ferrite phase is analyzed for grain size.
    if material_key == "ferritic_steel":
        # Dark regions well below median intensity correspond to pearlite colonies
        thresh_val = float(np.percentile(gray, 16.0))
        raw_pearlite = gray < thresh_val
        # Keep only contiguous colonies (> 25 px) as pearlite mask, not thin grain boundaries
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        pearlite_open = cv2.morphologyEx(
            raw_pearlite.astype(np.uint8), cv2.MORPH_OPEN, kernel
        ).astype(bool)
        fg_mask = ~pearlite_open
        pearlite_frac = float(np.mean(pearlite_open))
    else:
        fg_mask = np.ones_like(gray, dtype=bool)
        pearlite_frac = 0.0

    return PreprocessedMicrograph(
        gray_raw=gray,
        enhanced_gray=enhanced,
        smoothed_gray=smoothed,
        gradient_mag=grad_u8,
        foreground_mask=fg_mask,
        pearlite_fraction=pearlite_frac,
    )
