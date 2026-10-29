"""
src/hpsim/micro/chords.py - Chord length distribution extraction from segmented grain label maps.
"""

from typing import Optional
import numpy as np

from hpsim.micro.intercept import compute_lineal_intercepts


def extract_chord_distribution(
    labels: np.ndarray,
    pixel_size_m: float,
    num_lines: int = 25,
    foreground_mask: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Extract a 1D numpy array of positive chord intercept lengths (in meters) across
    num_lines horizontal and num_lines vertical test lines.
    """
    res = compute_lineal_intercepts(
        labels=labels,
        pixel_size_m=pixel_size_m,
        num_horizontal=num_lines,
        num_vertical=num_lines,
        foreground_mask=foreground_mask,
    )
    return res.chords_m[res.chords_m > 0.0]
