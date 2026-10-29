"""
tests/test_micro.py - Unit and validation tests (V-11, V-12, V-13, V-16) for Phase 7
Micrograph Preprocessing & Geometric Analysis package (src/hpsim/micro/).
"""

import json
import os
import numpy as np
import pytest

from hpsim.micro import (
    load_micrograph_metadata,
    load_micrograph_image,
    preprocess_micrograph,
    generate_synthetic_voronoi_labels,
    segment_micrograph,
    compute_lineal_intercepts,
    extract_grains,
    extract_chord_distribution,
    assign_seeded_orientations,
    rescale_chords,
    evaluate_chord_ensemble_hall_petch,
    save_qa_overlay,
)


def test_v11_synthetic_voronoi_intercept_accuracy():
    """
    V-11: Synthetic Voronoi microstructure of known mean grain size d_true recovers
    mean lineal intercept l_bar within 10% across >= 3 sizes and >= 3 seeds.
    """
    sizes_um = [15.0, 30.0, 60.0]
    seeds = [11, 29, 47]
    pixel_size_um = 0.5  # 0.5 um/px on a 600x600 grid -> 300x300 um field

    for target_d_um in sizes_um:
        for seed in seeds:
            labels, true_mean_intercept_m = generate_synthetic_voronoi_labels(
                width_px=600,
                height_px=600,
                pixel_size_m=pixel_size_um * 1e-6,
                target_grain_size_m=target_d_um * 1e-6,
                seed=seed,
                lloyd_iterations=2,
            )
            intercept_res = compute_lineal_intercepts(
                labels=labels,
                pixel_size_m=pixel_size_um * 1e-6,
                num_horizontal=25,
                num_vertical=25,
            )
            rel_err = (
                abs(intercept_res.mean_intercept_m - true_mean_intercept_m)
                / true_mean_intercept_m
            )
            assert rel_err <= 0.10, (
                f"V-11 failed for d={target_d_um} um, seed={seed}: "
                f"measured={intercept_res.mean_intercept_m*1e6:.2f} um vs "
                f"true={true_mean_intercept_m*1e6:.2f} um (rel_err={rel_err:.4f})"
            )


def test_v13_seeded_orientations_determinism():
    """
    V-13: Identical random seed produces bit-for-bit identical grain orientations R_i in SO(3)
    and slip trace angles; different seeds produce distinct orientations.
    """
    grain_ids = [1, 2, 3, 4, 5]
    orient_a1 = assign_seeded_orientations(grain_ids, seed=101, structure="FCC")
    orient_a2 = assign_seeded_orientations(grain_ids, seed=101, structure="FCC")
    orient_b = assign_seeded_orientations(grain_ids, seed=202, structure="FCC")

    assert len(orient_a1) == 5
    for g1, g2, gb in zip(orient_a1, orient_a2, orient_b):
        assert g1.grain_id == g2.grain_id
        np.testing.assert_array_equal(g1.rotation_matrix, g2.rotation_matrix)
        assert g1.slip_trace_angle_rad == g2.slip_trace_angle_rad
        # Verify R in SO(3): R.T @ R = I and det(R) = +1
        np.testing.assert_allclose(
            g1.rotation_matrix.T @ g1.rotation_matrix, np.eye(3), atol=1e-12
        )
        assert np.linalg.det(g1.rotation_matrix) == pytest.approx(1.0, rel=1e-12)
        # Different seeds must differ
        assert not np.allclose(g1.rotation_matrix, gb.rotation_matrix)


def test_v16_chord_rescaling_mean_and_cv_invariance():
    """
    V-16: Rescaled chord distribution matches target mean within 1e-9 relative
    while preserving coefficient of variation (std/mean) within 1e-12.
    """
    rng = np.random.default_rng(42)
    raw_chords_m = rng.lognormal(mean=-10.5, sigma=0.45, size=120)
    raw_cv = float(np.std(raw_chords_m) / np.mean(raw_chords_m))

    for target_um in [12.5, 45.0, 120.0]:
        target_m = target_um * 1e-6
        res = rescale_chords(raw_chords_m, target_mean_m=target_m)
        rel_mean_err = abs(res.mean_m - target_m) / target_m
        assert rel_mean_err <= 1e-9
        assert abs(res.cv - raw_cv) <= 1e-12


def test_v12_real_micrograph_segmentation_and_intercept_crosscheck(tmp_path):
    """
    V-12: Load real micrographs from data/micrographs/metadata.csv, segment with M4/M5
    policies, generate QA overlay, and verify reference test-line intercept cross-check.
    """
    records = load_micrograph_metadata("data/micrographs/metadata.csv")
    assert len(records) == 4

    for rec in records:
        img_rgb, gray = load_micrograph_image(rec)
        prep = preprocess_micrograph(gray, material_key=rec.material_key)
        seg = segment_micrograph(
            prep,
            pixel_size_m=rec.pixel_size_m,
            material_key=rec.material_key,
        )
        assert seg.num_grains >= 5
        intercepts = compute_lineal_intercepts(
            seg.labels,
            pixel_size_m=rec.pixel_size_m,
            num_horizontal=10,
            num_vertical=10,
            foreground_mask=seg.foreground_mask,
        )
        assert intercepts.mean_intercept_m > 1.0e-6
        assert len(intercepts.reference_line_checks) >= 3
        for chk in intercepts.reference_line_checks:
            # Direct pixel transition count vs polygon boundary intersection cross-check within 15%
            assert chk["rel_diff"] <= 0.15

        qa_path = tmp_path / f"{rec.material_key}_qa.png"
        save_qa_overlay(img_rgb, seg.labels, str(qa_path), intercept_lines=intercepts.lines[:4])
        assert qa_path.exists()
        assert qa_path.stat().st_size > 1000
