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
        chk = intercepts.reference_line_checks
        # 1D label-run count vs independent geometric polygon-edge reference. Per-line
        # disagreement is expected where 1-px label jitter exists (reference does not clean
        # it), so assert on the aggregate and flag gross per-line outliers.
        d = sum(c["direct_crossings"] for c in chk)
        g = sum(c["contour_crossings"] for c in chk)
        assert abs(d - g) / max(d, g, 1) <= 0.25, (rec.material_key, d, g)
        assert all(c["rel_diff"] <= 0.6 for c in chk), (rec.material_key, chk)

        qa_path = tmp_path / f"{rec.material_key}_qa.png"
        save_qa_overlay(img_rgb, seg.labels, str(qa_path), intercept_lines=intercepts.lines[:4])
        assert qa_path.exists()
        assert qa_path.stat().st_size > 1000


def test_phase7_golden_fixtures_and_web_exports():
    """
    Verify generated golden parity fixtures (tests/golden/phase7_fixtures.json),
    web micrograph JSON fixtures (web/public/data/micrographs/*.json), QA overlays,
    and Decision D6 compliance (no raw .jpg copied to web/public/).
    """
    golden_path = "tests/golden/phase7_fixtures.json"
    assert os.path.exists(golden_path)
    with open(golden_path, "r", encoding="utf-8") as f:
        golden = json.load(f)

    for case in golden["rescale_cases"]:
        res = rescale_chords(case["input_chords_m"], target_mean_m=case["target_mean_m"])
        assert res.mean_m == pytest.approx(case["expected_mean_m"], rel=1e-12)
        assert res.std_m == pytest.approx(case["expected_std_m"], rel=1e-12)
        assert res.cv == pytest.approx(case["expected_cv"], rel=1e-12)
        np.testing.assert_allclose(res.chords_m, case["expected_chords_m"], rtol=1e-12)

    hp_case = golden["chord_ensemble_hall_petch_case"]
    hp_out = evaluate_chord_ensemble_hall_petch(
        chords_m=hp_case["chords_m"],
        mu_pa=hp_case["mu_pa"],
        nu=hp_case["nu"],
        burgers_m=hp_case["burgers_m"],
        tau_c_pa=hp_case["tau_c_pa"],
        taylor_factor=hp_case["taylor_factor"],
        tau_star_ref_pa=hp_case["tau_star_ref_pa"],
        sigma_0_offset_pa=hp_case["sigma_0_offset_pa"],
    )
    assert hp_out["ensemble_mean_sigma_y_pa"] == pytest.approx(
        hp_case["expected"]["ensemble_mean_sigma_y_pa"], rel=1e-10
    )
    assert hp_out["mean_intercept_sigma_y_pa"] == pytest.approx(
        hp_case["expected"]["mean_intercept_sigma_y_pa"], rel=1e-10
    )

    # Check web JSON fixtures and QA overlay screenshots exist
    expected_stats = {
        "aluminium": {"chords": 963, "crossings": 932, "astm_um": 8.112, "chord_um": 7.847},
        "copper": {"chords": 1044, "crossings": 1011, "astm_um": 17.267, "chord_um": 16.717},
        "ferritic_steel": {"chords": 1301, "crossings": 1129, "astm_um": 13.139, "chord_um": 11.368},
        "pure_iron": {"chords": 855, "crossings": 817, "astm_um": 7.599, "chord_um": 7.261},
        "synthetic_voronoi_30um": {"chords": 231, "crossings": 215, "astm_um": 27.907, "chord_um": 25.965},
    }

    for key, exp in expected_stats.items():
        web_json = f"web/public/data/micrographs/{key}.json"
        qa_png = f"docs/screenshots/{key}_qa_overlay.png"
        assert os.path.exists(web_json), f"Missing web fixture {web_json}"
        assert os.path.exists(qa_png), f"Missing QA overlay {qa_png}"
        with open(web_json, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["key"] == key
        assert len(payload["grains"]) >= 5

        # Enforce COMPLETE chord population export (no [:250] truncation slice)
        assert len(payload["chords_m"]) == exp["chords"], (
            f"Expected {exp['chords']} complete chords for {key}, got {len(payload['chords_m'])}"
        )
        assert len(payload["chords_um"]) == exp["chords"]

        # Enforce exact image-specific pipeline counts
        stats = payload["statistics"]
        assert stats["total_chords"] == exp["chords"]
        assert stats["total_crossings"] == exp["crossings"]
        assert stats["astm_mean_intercept_um"] == exp["astm_um"]
        assert stats["chord_mean_um"] == exp["chord_um"]

        # Enforce enriched statistics presence
        assert "astm_mean_intercept_m" in stats
        assert "chord_mean_m" in stats
        assert "std_intercept_m" in stats
        assert "chord_cv" in stats
        assert "p10_m" in stats and "p50_m" in stats and "p90_m" in stats
        assert "p10_um" in stats and "p50_um" in stats and "p90_um" in stats
        assert stats["chord_cv"] > 0
        assert stats["p10_m"] <= stats["p50_m"] <= stats["p90_m"]

    assert len(extract_grains(np.ones((20, 20), dtype=np.int32), 1.0e-6)) == 1
    assert len(extract_chord_distribution(np.ones((20, 20), dtype=np.int32), 1.0e-6, num_lines=3)) == 6

    # Decision D6: ensure no raw .jpg files exist in web/public/data/micrographs/
    for fname in os.listdir("web/public/data/micrographs"):
        assert not fname.lower().endswith(".jpg"), f"License violation (D6): {fname} in web/public/"



# ---- V-12 geometric reference edge cases -------------------------------------------------
from hpsim.micro.segment import segmentation_diagnostics  # noqa: E402
from hpsim.micro.intercept import (  # noqa: E402
    _analyze_1d_line,
    _geometric_line_crossings,
    _polygon_contour_crossings_on_line,
)


def _two_by_two():
    lab = np.zeros((8, 8), dtype=np.int32)
    lab[:4, :4], lab[:4, 4:], lab[4:, :4], lab[4:, 4:] = 1, 2, 3, 4
    return lab


def test_reference_lines_coincident_with_boundary_rows():
    lab = _two_by_two()
    # Rows 3 and 4 flank the horizontal boundary; each is a clean 1|2 or 3|4 line.
    for row in (3, 4, 0, 7):
        assert _polygon_contour_crossings_on_line(lab, True, row) == 1
        assert _polygon_contour_crossings_on_line(lab, False, row) == 1


def test_reference_shared_vertex_four_corner_junction():
    lab = _two_by_two()
    assert _geometric_line_crossings(lab, True, 3)["count"] == 1
    assert _geometric_line_crossings(lab, True, 4)["count"] == 1
    assert _geometric_line_crossings(lab, True, 3)["parity_ok"]


def test_reference_masked_background_is_not_a_crossing():
    lab = np.array([[1, 1, 0, 0, 2, 2], [1, 1, 1, 2, 2, 2]] * 3, dtype=np.int32)
    assert _polygon_contour_crossings_on_line(lab, True, 0) == 0
    assert _polygon_contour_crossings_on_line(lab, True, 1) == 1


def test_reference_agrees_with_label_runs_on_rasterized_voronoi_and_is_independent():
    labels, _ = generate_synthetic_voronoi_labels(200, 200, 1e-6, 20e-6, seed=5)
    for idx in range(0, 200, 9):
        assert _polygon_contour_crossings_on_line(labels, True, idx) == _analyze_1d_line(
            labels[idx], 1e-6
        )[1]
        assert _polygon_contour_crossings_on_line(labels, False, idx) == _analyze_1d_line(
            labels[:, idx], 1e-6
        )[1]


@pytest.mark.parametrize(
    "bad",
    [np.zeros(5, dtype=np.int32), np.array([[1, -1]]), np.array([[0.5, 1.0]]), np.array([[np.nan, 1.0]]), np.array([["a"]])],
)
def test_invalid_labels_rejected(bad):
    with pytest.raises(ValueError):
        _geometric_line_crossings(bad, True, 0)
    with pytest.raises(ValueError):
        compute_lineal_intercepts(bad, 1e-6)


def test_reference_line_index_out_of_range():
    with pytest.raises(ValueError):
        _geometric_line_crossings(_two_by_two(), True, 8)


def test_v11_truth_is_geometry_not_design_target():
    labels, truth = generate_synthetic_voronoi_labels(300, 300, 1e-6, 30e-6, seed=3)
    assert truth != 30e-6  # measured from exact Voronoi edge length, not the design input
    assert 0.3 * 30e-6 < truth < 3 * 30e-6


def test_segmentation_diagnostics_flags_fragmentation():
    lab = np.arange(1, 101, dtype=np.int32).reshape(10, 10)  # 100 one-pixel grains
    d = segmentation_diagnostics(lab, 1e-6)
    assert d["small_fragment_fraction"] == 1.0 and d["manual_review_required"]
    assert d["provenance"] == "image_measured"


# ---- Root-Cause Counterexample, Scale-Bar Safety & Voronoi Oracle Tests ----
from hpsim.micro.intercept import _clean_1d_label_jitter  # noqa: E402
from hpsim.micro.segment import _voronoi_geometry_truth  # noqa: E402


def test_raster_vs_vector_jitter_counterexample():
    """
    Root-cause the raster-versus-vector line-crossing discrepancy (3 vs 7 on Aluminium Line 3):
    - Synthetic counterexample:
      A minimal 2D label array with a single macroscopic boundary between grain 1 and 2 at x=12.
      Two 1-pixel boundary jitter spikes of grain 2 protrude into grain 1 along row 2 at x=4 and x=8.
      - 1D label-run analysis: `_clean_1d_label_jitter` removes the 1-pixel spikes (1 -> 2 -> 1 becomes
        1 -> 1 -> 1). Exactly 1 true boundary crossing remains.
      - 2D vector contour analysis: Polygon boundary tracing enters the 1-pixel protrusion (crossing 1)
        and exits it (crossing 2). Each jitter spike is double-counted as 2 crossings:
        1 + (2 spikes * 2 crossings/spike) = 5 crossings!
    - Real Aluminium Line 3 check:
      On Aluminium Line 3 (y=160), two 1-pixel spikes (38 -> 45 -> 38 at x=315 and x=320) produce
      3 crossings in 1D vs 3 + (2 * 2) = 7 crossings in 2D vector geometry.
    """
    # 1. Minimal synthetic counterexample
    lab = np.ones((5, 20), dtype=np.int32)
    lab[:, 12:] = 2  # true boundary at x=12: 1 | 2
    lab[2, 4] = 2   # 1-px spike 1: 1 -> 2 -> 1
    lab[2, 8] = 2   # 1-px spike 2: 1 -> 2 -> 1

    fg_len, n_1d, cross_px, chords = _analyze_1d_line(lab[2, :], pixel_size_m=1.0e-6)
    n_vec = _polygon_contour_crossings_on_line(lab, is_horizontal=True, index_px=2)
    assert n_1d == 1, "1D analysis must clean isolated 1-px jitter spikes, leaving 1 true crossing"
    assert n_vec == 5, "2D contour must trace each 1-px spike with 2 crossings: 1 + 2*2 = 5"

    # 2. Real Aluminium Line 3 (row y=160) experimental check
    records = load_micrograph_metadata("data/micrographs/metadata.csv")
    al_meta = next(r for r in records if r.material_key == "aluminium")
    _, gray = load_micrograph_image(al_meta)
    prep = preprocess_micrograph(gray, material_key=al_meta.material_key)
    seg = segment_micrograph(prep, pixel_size_m=al_meta.pixel_size_m, material_key=al_meta.material_key)

    h, w = seg.labels.shape
    y_line3 = int(np.linspace(int(0.06 * h), int(0.94 * h), 10, dtype=int)[3])
    row_seq = seg.labels[y_line3, :]
    cleaned_row = _clean_1d_label_jitter(row_seq)
    jitter_positions = np.where(row_seq != cleaned_row)[0]

    # Exactly 2 jitter spikes exist at x=315 and x=320 where grain 45 briefly invades grain 38
    assert len(jitter_positions) == 2
    for x in jitter_positions:
        assert row_seq[x] == 45
        assert row_seq[x - 1] == 38 and row_seq[x + 1] == 38

    al_1d_cnt = _analyze_1d_line(row_seq, al_meta.pixel_size_m)[1]
    al_vec_cnt = _polygon_contour_crossings_on_line(seg.labels, is_horizontal=True, index_px=y_line3)
    assert al_1d_cnt == 3, f"Al Line 3 raster 1D count must be exactly 3, got {al_1d_cnt}"
    assert al_vec_cnt == 7, f"Al Line 3 vector contour count must be exactly 7, got {al_vec_cnt}"
    assert al_vec_cnt == al_1d_cnt + 2 * len(jitter_positions), (
        "Vector crossings must equal 1D crossings plus 2 crossings per jitter spike"
    )


def test_scale_bar_safety_missing_or_nonpositive_pixel_size():
    """
    Scale-bar safety: Pipeline refuses measurement and raises ValueError when pixel_size_m
    is missing, zero, or negative.
    """
    dummy_labels = np.ones((20, 20), dtype=np.int32)
    dummy_prep = preprocess_micrograph(np.full((20, 20), 128, dtype=np.uint8))

    for bad_scale in [0.0, -1e-6, -5.0]:
        with pytest.raises(ValueError, match="pixel_size_m must be positive"):
            compute_lineal_intercepts(dummy_labels, pixel_size_m=bad_scale)

        with pytest.raises(ValueError, match="pixel_size_m must be positive"):
            extract_grains(dummy_labels, pixel_size_m=bad_scale)

        with pytest.raises(ValueError, match="pixel_size_m must be positive"):
            segment_micrograph(dummy_prep, pixel_size_m=bad_scale)

        with pytest.raises(ValueError, match="Invalid dimensions or physical scales"):
            generate_synthetic_voronoi_labels(
                width_px=100,
                height_px=100,
                pixel_size_m=bad_scale,
                target_grain_size_m=30e-6,
            )


def test_v11_voronoi_oracle_continuous_ridge_truth_independent_of_target():
    """
    V-11 Voronoi oracle: Verify that continuous Liang-Barsky clipped ridge truth is
    strictly geometric (pi * A / (2 * L_ridges)) and independent of target_grain_size_m.
    """
    w_m = 300e-6
    h_m = 300e-6
    rng = np.random.default_rng(12345)
    pts = rng.uniform(0.0, w_m, size=(30, 2))

    # Evaluate the exact continuous Liang-Barsky clipped ridge truth directly
    truth_1 = _voronoi_geometry_truth(pts, w_m, h_m)
    truth_2 = _voronoi_geometry_truth(pts.copy(), w_m, h_m)

    assert truth_1 > 0.0
    assert truth_1 == pytest.approx(truth_2, rel=1e-15)

    # Truth is a pure function of (pts, w_m, h_m); no target_grain_size_m is passed or used
    # Underwood 1970 relation: l = pi * A / (2 * L_tot)
    far = 50.0 * max(w_m, h_m)
    cx, cy = w_m / 2.0, h_m / 2.0
    from scipy.spatial import Voronoi  # noqa: E402
    anchors = np.array([[cx - far, cy - far], [cx + far, cy - far], [cx - far, cy + far], [cx + far, cy + far]])
    vor = Voronoi(np.vstack([pts, anchors]))
    l_tot = 0.0
    for rv in vor.ridge_vertices:
        if -1 in rv:
            continue
        a, b = vor.vertices[rv[0]], vor.vertices[rv[1]]
        d = b - a
        t0, t1 = 0.0, 1.0
        for p_, q_ in ((-d[0], a[0]), (d[0], w_m - a[0]), (-d[1], a[1]), (d[1], h_m - a[1])):
            if p_ == 0.0:
                if q_ < 0.0:
                    t0, t1 = 1.0, 0.0
                    break
            elif p_ < 0.0:
                t0 = max(t0, q_ / p_)
            else:
                t1 = min(t1, q_ / p_)
        if t1 > t0:
            l_tot += (t1 - t0) * float(np.hypot(d[0], d[1]))

    expected_truth = np.pi * (w_m * h_m) / (2.0 * l_tot)
    assert truth_1 == pytest.approx(expected_truth, rel=1e-12)
