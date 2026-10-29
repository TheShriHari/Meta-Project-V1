"""
src/hpsim/micro/grains.py - Grain polygon extraction, area, equivalent circular diameter, and centroids.
"""

from dataclasses import dataclass
from typing import List, Tuple
import cv2
import numpy as np


@dataclass(frozen=True)
class GrainRecord:
    """Geometric properties and simplified polygon boundary of a segmented grain."""
    grain_id: int
    area_px: int
    area_m2: float
    equiv_diameter_m: float
    centroid_px: Tuple[float, float]
    centroid_m: Tuple[float, float]
    polygon_px: List[Tuple[float, float]]
    polygon_m: List[Tuple[float, float]]


def extract_grains(
    labels: np.ndarray,
    pixel_size_m: float,
    approx_epsilon_px: float = 1.8,
) -> List[GrainRecord]:
    """
    Extract per-grain area, equivalent circular diameter d_eq = sqrt(4*A/pi), centroid,
    and simplified contour polygon vertices in both pixel and meter coordinates.
    """
    if labels.ndim != 2:
        raise ValueError("labels must be a 2D array")
    if pixel_size_m <= 0.0:
        raise ValueError(f"pixel_size_m must be positive, got {pixel_size_m}")

    records: List[GrainRecord] = []
    unique_ids = [int(g) for g in np.unique(labels) if g > 0]

    for gid in unique_ids:
        mask = (labels == gid).astype(np.uint8)
        area_px = int(np.sum(mask))
        if area_px < 4:
            continue

        area_m2 = float(area_px * (pixel_size_m ** 2))
        equiv_d_m = float(np.sqrt((4.0 * area_m2) / np.pi))

        ys, xs = np.nonzero(mask)
        cx_px = float(np.mean(xs))
        cy_px = float(np.mean(ys))

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        largest_cnt = max(contours, key=cv2.contourArea)
        approx = cv2.approxPolyDP(largest_cnt, epsilon=approx_epsilon_px, closed=True)
        pts_px: List[Tuple[float, float]] = [
            (float(pt[0][0]), float(pt[0][1])) for pt in approx
        ]
        if len(pts_px) < 3:
            pts_px = [(float(pt[0][0]), float(pt[0][1])) for pt in largest_cnt]

        pts_m: List[Tuple[float, float]] = [
            (x * pixel_size_m, y * pixel_size_m) for (x, y) in pts_px
        ]

        records.append(
            GrainRecord(
                grain_id=gid,
                area_px=area_px,
                area_m2=area_m2,
                equiv_diameter_m=equiv_d_m,
                centroid_px=(cx_px, cy_px),
                centroid_m=(cx_px * pixel_size_m, cy_px * pixel_size_m),
                polygon_px=pts_px,
                polygon_m=pts_m,
            )
        )

    # Sort largest grains first for deterministic display truncation
    records.sort(key=lambda r: (-r.area_px, r.grain_id))
    return records
