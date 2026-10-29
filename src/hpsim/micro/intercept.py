"""
src/hpsim/micro/intercept.py - ASTM E112 lineal intercept grain-size measurement
and reference test-line boundary intersection cross-check (V-11, V-12).
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np


@dataclass(frozen=True)
class InterceptResult:
    """Result of horizontal + vertical grid lineal intercept analysis."""
    mean_intercept_m: float
    std_intercept_m: float
    total_length_m: float
    total_crossings: int
    chords_m: np.ndarray
    lines: List[Dict[str, object]]
    reference_line_checks: List[Dict[str, float]]


def _analyze_1d_line(
    seq: np.ndarray, pixel_size_m: float
) -> tuple[float, int, List[int], List[float]]:
    """
    Analyze a 1D array of integer grain labels (>0 = foreground grain, 0 = background/masked).
    Returns (fg_length_m, num_crossings, crossing_indices_px, chords_m).
    """
    n = len(seq)
    if n == 0:
        return 0.0, 0, [], []

    fg_pixels = int(np.sum(seq > 0))
    fg_length_m = fg_pixels * pixel_size_m

    crossings_px: List[int] = []
    chords_m: List[float] = []

    run_label = int(seq[0])
    run_len = 1

    for i in range(1, n):
        lbl = int(seq[i])
        if lbl == run_label:
            run_len += 1
        else:
            if run_label > 0 and run_len >= 2:
                chords_m.append(run_len * pixel_size_m)
            if run_label > 0 and lbl > 0:
                crossings_px.append(i)
            run_label = lbl
            run_len = 1

    if run_label > 0 and run_len >= 2:
        chords_m.append(run_len * pixel_size_m)

    return fg_length_m, len(crossings_px), crossings_px, chords_m


def _polygon_contour_crossings_on_line(
    labels: np.ndarray, is_horizontal: bool, index_px: int
) -> int:
    """
    Independent run-length boundary intersection counter for V-12 cross-check:
    identifies distinct intergranular boundary crossings between contiguous runs of >= 2 px.
    """
    seq = labels[index_px, :] if is_horizontal else labels[:, index_px]
    if len(seq) < 3:
        return 0
    cleaned = seq.copy()
    for i in range(1, len(cleaned) - 1):
        if cleaned[i] != cleaned[i - 1] and cleaned[i - 1] == cleaned[i + 1]:
            cleaned[i] = cleaned[i - 1]
    cnt = 0
    for i in range(1, len(cleaned)):
        if cleaned[i] != cleaned[i - 1] and cleaned[i] > 0 and cleaned[i - 1] > 0:
            cnt += 1
    return cnt


def compute_lineal_intercepts(
    labels: np.ndarray,
    pixel_size_m: float,
    num_horizontal: int = 25,
    num_vertical: int = 25,
    foreground_mask: Optional[np.ndarray] = None,
) -> InterceptResult:
    """
    Compute ASTM E112 lineal intercept statistics across a grid of horizontal and vertical
    test lines, extract individual chord lengths, and run reference test-line cross-checks.
    """
    if labels.ndim != 2:
        raise ValueError("labels must be a 2D array")
    if pixel_size_m <= 0.0:
        raise ValueError(f"pixel_size_m must be positive, got {pixel_size_m}")

    work_labels = labels.astype(np.int32).copy()
    if foreground_mask is not None:
        work_labels[~foreground_mask] = 0

    h, w = work_labels.shape
    y_indices = np.linspace(int(0.06 * h), int(0.94 * h), max(1, num_horizontal), dtype=int)
    x_indices = np.linspace(int(0.06 * w), int(0.94 * w), max(1, num_vertical), dtype=int)

    total_length_m = 0.0
    total_crossings = 0
    all_chords: List[float] = []
    lines_out: List[Dict[str, object]] = []

    for y in y_indices:
        seq = work_labels[y, :]
        fg_len, n_cross, cross_px, chords = _analyze_1d_line(seq, pixel_size_m)
        total_length_m += fg_len
        total_crossings += n_cross
        all_chords.extend(chords)
        lines_out.append(
            {
                "orientation": "horizontal",
                "x1": 0,
                "y1": int(y),
                "x2": int(w - 1),
                "y2": int(y),
                "foreground_length_m": float(fg_len),
                "num_crossings": int(n_cross),
                "crossings_px": [[int(cx), int(y)] for cx in cross_px],
            }
        )

    for x in x_indices:
        seq = work_labels[:, x]
        fg_len, n_cross, cross_px, chords = _analyze_1d_line(seq, pixel_size_m)
        total_length_m += fg_len
        total_crossings += n_cross
        all_chords.extend(chords)
        lines_out.append(
            {
                "orientation": "vertical",
                "x1": int(x),
                "y1": 0,
                "x2": int(x),
                "y2": int(h - 1),
                "foreground_length_m": float(fg_len),
                "num_crossings": int(n_cross),
                "crossings_px": [[int(x), int(cy)] for cy in cross_px],
            }
        )

    chords_arr = np.array(all_chords, dtype=np.float64)
    if total_crossings > 0:
        mean_intercept_m = float(total_length_m / total_crossings)
    elif chords_arr.size > 0:
        mean_intercept_m = float(np.mean(chords_arr))
    else:
        mean_intercept_m = float(min(h, w) * pixel_size_m)

    std_intercept_m = float(np.std(chords_arr)) if chords_arr.size > 1 else 0.0

    # Reference line cross-checks (V-12): compare raw transition count vs smoothed contour crossings
    ref_checks: List[Dict[str, float]] = []
    sample_lines = lines_out[: min(4, len(lines_out))]
    for idx, ln in enumerate(sample_lines):
        is_horiz = ln["orientation"] == "horizontal"
        line_coord = int(ln["y1"]) if is_horiz else int(ln["x1"])
        direct_cnt = int(ln["num_crossings"])
        contour_cnt = _polygon_contour_crossings_on_line(work_labels, is_horiz, line_coord)
        denom = max(direct_cnt, contour_cnt, 1)
        rel_diff = abs(direct_cnt - contour_cnt) / float(denom)
        ref_checks.append(
            {
                "line_index": float(idx),
                "direct_crossings": float(direct_cnt),
                "contour_crossings": float(contour_cnt),
                "rel_diff": float(rel_diff),
            }
        )

    return InterceptResult(
        mean_intercept_m=mean_intercept_m,
        std_intercept_m=std_intercept_m,
        total_length_m=float(total_length_m),
        total_crossings=int(total_crossings),
        chords_m=chords_arr,
        lines=lines_out,
        reference_line_checks=ref_checks,
    )
