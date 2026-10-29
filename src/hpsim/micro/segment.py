"""
src/hpsim/micro/segment.py - Synthetic Voronoi generator and OpenCV watershed grain segmentation
with Decision M4 (copper annealing twin exclusion) and Decision M5 (ferritic steel pearlite masking).
"""

from dataclasses import dataclass
from typing import Tuple
import cv2
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

from hpsim.micro.preprocess import PreprocessedMicrograph


@dataclass(frozen=True)
class SegmentationResult:
    """Output of grain boundary detection and watershed region labeling."""
    labels: np.ndarray
    num_grains: int
    boundary_mask: np.ndarray
    foreground_mask: np.ndarray
    policy_applied: str


def generate_synthetic_voronoi_labels(
    width_px: int,
    height_px: int,
    pixel_size_m: float,
    target_grain_size_m: float,
    seed: int = 42,
    lloyd_iterations: int = 2,
) -> Tuple[np.ndarray, float]:
    """
    Generate a 2D centroidal Voronoi grain label map (1..N) calibrated to target_grain_size_m
    as the true mean lineal intercept length (V-11).
    """
    if width_px <= 0 or height_px <= 0 or pixel_size_m <= 0.0 or target_grain_size_m <= 0.0:
        raise ValueError("Invalid dimensions or physical scales for synthetic Voronoi generator")

    w_m = width_px * pixel_size_m
    h_m = height_px * pixel_size_m
    pad = float(target_grain_size_m)

    x_min, x_max = -pad, w_m + pad
    y_min, y_max = -pad, h_m + pad
    area_tot = (x_max - x_min) * (y_max - y_min)

    # Stereological calibration factor c_lloyd = 0.835 for 2-step Lloyd-relaxed 2D Voronoi intercept
    c_lloyd = 0.835
    n_seeds = max(6, int(round((c_lloyd ** 2) * area_tot / (target_grain_size_m ** 2))))

    rng = np.random.default_rng(seed)
    pts = np.column_stack(
        [
            rng.uniform(x_min, x_max, size=n_seeds),
            rng.uniform(y_min, y_max, size=n_seeds),
        ]
    )

    # Coarse grid for fast Lloyd centroid relaxation over the padded domain
    rx = np.linspace(x_min, x_max, 240)
    ry = np.linspace(y_min, y_max, 240)
    gxx, gyy = np.meshgrid(rx, ry)
    relax_grid = np.column_stack([gxx.ravel(), gyy.ravel()])

    for _ in range(max(0, lloyd_iterations)):
        tree = cKDTree(pts)
        _, owner = tree.query(relax_grid, k=1)
        for k in range(n_seeds):
            mask = owner == k
            if np.any(mask):
                pts[k] = np.mean(relax_grid[mask], axis=0)

    # Evaluate final pixel grid labels on [0, w_m) x [0, h_m)
    px_x = (np.arange(width_px, dtype=np.float64) + 0.5) * pixel_size_m
    px_y = (np.arange(height_px, dtype=np.float64) + 0.5) * pixel_size_m
    xx, yy = np.meshgrid(px_x, px_y)
    pixel_coords = np.column_stack([xx.ravel(), yy.ravel()])

    tree_final = cKDTree(pts)
    _, raw_idx = tree_final.query(pixel_coords, k=1)
    raw_labels = (raw_idx.reshape((height_px, width_px)) + 1).astype(np.int32)

    # Compact labels to contiguous 1..K present inside the image window
    unique_ids = np.unique(raw_labels)
    compact = np.zeros_like(raw_labels, dtype=np.int32)
    for new_id, old_id in enumerate(unique_ids, start=1):
        compact[raw_labels == old_id] = new_id

    return compact, float(target_grain_size_m)


def _compute_boundary_mask_from_labels(labels: np.ndarray) -> np.ndarray:
    """Identify 4-connected intergranular boundary pixels where adjacent labels differ."""
    bmask = np.zeros(labels.shape, dtype=bool)
    bmask[:, 1:] |= labels[:, 1:] != labels[:, :-1]
    bmask[:, :-1] |= labels[:, 1:] != labels[:, :-1]
    bmask[1:, :] |= labels[1:, :] != labels[:-1, :]
    bmask[:-1, :] |= labels[1:, :] != labels[:-1, :]
    return bmask


def segment_micrograph(
    prep: PreprocessedMicrograph,
    pixel_size_m: float,
    material_key: str = "generic",
) -> SegmentationResult:
    """
    Segment a preprocessed micrograph into contiguous labeled grains using adaptive
    thresholding, morphological filtering, distance-transform seed extraction, and watershed.

    Policies:
      - M4 (copper): Suppress straight intragranular annealing twin traces so host grains
        are not over-segmented by twin lamellae.
      - M5 (ferritic_steel): Mask out dark pearlite colonies via prep.foreground_mask so
        only ferrite grains are labeled (1..K) and pearlite is background (0).
    """
    if pixel_size_m <= 0.0:
        raise ValueError(f"pixel_size_m must be positive, got {pixel_size_m}")

    smooth = prep.smoothed_gray
    h, w = smooth.shape

    # Adaptive thresholding + gradient threshold to capture dark etched boundaries
    block_size = 35 if material_key != "copper" else 45
    adapt_edges = cv2.adaptiveThreshold(
        smooth,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block_size,
        6 if material_key != "copper" else 9,
    )
    grad_thresh_val = float(np.percentile(prep.gradient_mag, 78.0 if material_key != "copper" else 84.0))
    grad_edges = (prep.gradient_mag >= grad_thresh_val).astype(np.uint8) * 255

    raw_boundary = cv2.bitwise_or(adapt_edges, grad_edges)

    if material_key == "copper":
        # Decision M4: Remove thin isolated twin traces via morphological opening and larger seed footprint
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        boundary_bin = cv2.morphologyEx(raw_boundary, cv2.MORPH_OPEN, k_open)
        min_seed_dist_px = 29
        policy = "M4_copper_twin_exclusion"
    elif material_key == "ferritic_steel":
        k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        boundary_bin = cv2.morphologyEx(raw_boundary, cv2.MORPH_CLOSE, k_close)
        # Treat pearlite mask boundaries as barriers during distance transform
        boundary_bin[~prep.foreground_mask] = 255
        min_seed_dist_px = 19
        policy = "M5_ferrite_only_mask"
    elif material_key == "aluminium":
        # Polarized light anodized Al has distinct grain contrast patches; gradient + intensity clustering
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        boundary_bin = cv2.morphologyEx(grad_edges, cv2.MORPH_CLOSE, k_open)
        min_seed_dist_px = 27
        policy = "standard_watershed"
    else:
        k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        boundary_bin = cv2.morphologyEx(raw_boundary, cv2.MORPH_OPEN, k_close)
        min_seed_dist_px = 21
        policy = "standard_watershed"

    interior_mask = (boundary_bin == 0) & prep.foreground_mask
    dist = cv2.distanceTransform(interior_mask.astype(np.uint8), cv2.DIST_L2, 5)
    dist_smooth = ndimage.gaussian_filter(dist, sigma=2.0)

    local_max = (
        (dist_smooth == ndimage.maximum_filter(dist_smooth, size=min_seed_dist_px))
        & (dist_smooth >= 2.5)
        & prep.foreground_mask
    )
    markers, num_seeds = ndimage.label(local_max)

    # Fallback if image contrast is very uniform: place a regular seed grid over foreground
    if num_seeds < 8:
        grid_step = max(24, min(h, w) // 8)
        seed_mask = np.zeros_like(local_max, dtype=bool)
        seed_mask[grid_step // 2 :: grid_step, grid_step // 2 :: grid_step] = True
        seed_mask &= prep.foreground_mask
        markers, num_seeds = ndimage.label(seed_mask)

    # Run OpenCV watershed on 3-channel gradient topography
    grad_3c = cv2.cvtColor(prep.gradient_mag, cv2.COLOR_GRAY2BGR)
    ws_markers = markers.astype(np.int32).copy()
    cv2.watershed(grad_3c, ws_markers)

    # Fill watershed boundary pixels (-1) with nearest neighbor positive label
    pos_mask = ws_markers > 0
    if np.any(pos_mask) and np.any(~pos_mask):
        _, nearest_idx = ndimage.distance_transform_edt(~pos_mask, return_indices=True)
        filled_labels = ws_markers[tuple(nearest_idx)]
    else:
        filled_labels = np.maximum(ws_markers, 1)

    # Enforce Decision M5: zero out non-foreground (pearlite) pixels
    if not np.all(prep.foreground_mask):
        filled_labels = filled_labels.copy()
        filled_labels[~prep.foreground_mask] = 0

    # Compact positive grain IDs to 1..K and merge tiny fragments (< 25 px)
    unique_pos = [gid for gid in np.unique(filled_labels) if gid > 0]
    compact = np.zeros_like(filled_labels, dtype=np.int32)
    next_id = 1
    for gid in unique_pos:
        mask = filled_labels == gid
        if int(np.sum(mask)) >= 25:
            compact[mask] = next_id
            next_id += 1

    # Reassign any tiny dropped foreground fragments to nearest valid grain
    valid_fg = compact > 0
    missing_fg = prep.foreground_mask & (~valid_fg)
    if np.any(valid_fg) and np.any(missing_fg):
        _, idx = ndimage.distance_transform_edt(~valid_fg, return_indices=True)
        compact[missing_fg] = compact[tuple(idx)][missing_fg]

    num_grains = int(np.max(compact)) if compact.size > 0 else 0
    bmask = _compute_boundary_mask_from_labels(compact)

    return SegmentationResult(
        labels=compact,
        num_grains=num_grains,
        boundary_mask=bmask,
        foreground_mask=prep.foreground_mask.copy(),
        policy_applied=policy,
    )
