"""
src/hpsim/micro/qa.py - Diagnostic QA overlay rendering for segmented micrographs and intercept lines.
"""

import os
from typing import Dict, List, Optional
import cv2
import numpy as np

from hpsim.micro.segment import _compute_boundary_mask_from_labels


def save_qa_overlay(
    rgb_img: np.ndarray,
    labels: np.ndarray,
    out_path: str,
    intercept_lines: Optional[List[Dict[str, object]]] = None,
) -> None:
    """
    Render a diagnostic QA overlay showing detected grain boundaries (red), masked non-ferrite
    regions (violet tint), and lineal intercept test lines + crossing ticks (cyan/yellow).
    """
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    canvas = rgb_img.copy()
    if canvas.ndim == 2:
        canvas = cv2.cvtColor(canvas, cv2.COLOR_GRAY2RGB)

    # Tint masked pearlite / background regions (labels == 0)
    bg_mask = labels == 0
    if np.any(bg_mask):
        canvas[bg_mask] = (
            0.55 * canvas[bg_mask] + 0.45 * np.array([120, 40, 140], dtype=np.float64)
        ).astype(np.uint8)

    # Draw grain boundaries in bright red
    bmask = _compute_boundary_mask_from_labels(labels)
    canvas[bmask] = [255, 45, 45]

    # Overlay sample intercept lines and crossing markers
    if intercept_lines:
        for ln in intercept_lines:
            x1, y1 = int(ln["x1"]), int(ln["y1"])
            x2, y2 = int(ln["x2"]), int(ln["y2"])
            cv2.line(canvas, (x1, y1), (x2, y2), (0, 230, 255), 1, cv2.LINE_AA)
            for pt in ln.get("crossings_px", []):
                cx, cy = int(pt[0]), int(pt[1])
                cv2.circle(canvas, (cx, cy), 2, (255, 235, 0), -1)

    bgr_out = cv2.cvtColor(canvas, cv2.COLOR_RGB2BGR)
    cv2.imwrite(out_path, bgr_out)
