"""
scripts/generate_phase7_fixtures.py - Generate Phase 7 micrograph segmentation fixtures,
diagnostic QA overlays, web-ready license-safe JSON datasets, and golden parity vectors.

Note:
- Raw CC BY-NC-SA 4.0 micrograph `.jpg` images from DoITPoMS are NEVER copied into `web/public/`
  (Decision D6 / assumptions.md). Only license-safe derived vector polygons, chord histograms,
  and statistical summaries are exported to `web/public/data/micrographs/*.json`.
- Synthetic Voronoi tessellations (`synthetic_voronoi_30um`) are mathematical stereology
  verification targets (V-11) and do NOT represent real experimental microstructures.
"""

import json
import os
import sys
from typing import Dict, List

import numpy as np

# Ensure src is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from hpsim.micro import (
    assign_seeded_orientations,
    compute_lineal_intercepts,
    evaluate_chord_ensemble_hall_petch,
    extract_grains,
    generate_synthetic_voronoi_labels,
    load_micrograph_image,
    load_micrograph_metadata,
    preprocess_micrograph,
    rescale_chords,
    save_qa_overlay,
    segment_micrograph,
)


def _build_fixture_payload(
    key: str,
    material_name: str,
    structure: str,
    phase_of_interest: str,
    heat_treatment: str,
    etchant: str,
    magnification: str,
    scale_bar_um: float,
    pixels_for_scale_bar: float,
    pixel_size_m: float,
    license_note: str,
    redistributable_raw: bool,
    policy_applied: str,
    pearlite_fraction: float,
    width_px: int,
    height_px: int,
    labels: np.ndarray,
    fg_mask: np.ndarray,
    seed: int = 42,
    num_horizontal: int = 20,
    num_vertical: int = 20,
) -> tuple[Dict[str, object], object]:
    """Extract grains, orientations, and lineal intercepts and assemble a web-ready JSON payload."""
    intercepts = compute_lineal_intercepts(
        labels=labels,
        pixel_size_m=pixel_size_m,
        num_horizontal=num_horizontal,
        num_vertical=num_vertical,
        foreground_mask=fg_mask,
    )
    grains = extract_grains(labels=labels, pixel_size_m=pixel_size_m, approx_epsilon_px=2.0)

    # Cap exported polygons at 140 largest grains for fast web canvas rendering
    max_grains_export = 140
    exported_grains = grains[:max_grains_export]
    orientations = assign_seeded_orientations(
        [g.grain_id for g in exported_grains], seed=seed, structure=structure
    )
    orient_map = {o.grain_id: o for o in orientations}

    grain_list = []
    for g in exported_grains:
        o = orient_map[g.grain_id]
        grain_list.append(
            {
                "grain_id": g.grain_id,
                "area_px": g.area_px,
                "area_um2": round(g.area_m2 * 1e12, 3),
                "equiv_diameter_um": round(g.equiv_diameter_m * 1e6, 3),
                "centroid_px": [round(g.centroid_px[0], 2), round(g.centroid_px[1], 2)],
                "centroid_um": [round(g.centroid_m[0] * 1e6, 3), round(g.centroid_m[1] * 1e6, 3)],
                "polygon_px": [[round(x, 1), round(y, 1)] for (x, y) in g.polygon_px],
                "slip_trace_angle_rad": round(o.slip_trace_angle_rad, 6),
                "rotation_matrix": [[round(float(v), 6) for v in row] for row in o.rotation_matrix],
            }
        )

    # Export COMPLETE chord population (no biased [:250] truncation slice)
    chords_arr = np.array(intercepts.chords_m, dtype=np.float64)
    total_chords = int(len(chords_arr))
    chord_mean_m = float(np.mean(chords_arr)) if total_chords > 0 else 0.0
    chord_mean_um = float(chord_mean_m * 1e6)

    p10_m = float(np.percentile(chords_arr, 10)) if total_chords > 0 else 0.0
    p50_m = float(np.percentile(chords_arr, 50)) if total_chords > 0 else 0.0
    p90_m = float(np.percentile(chords_arr, 90)) if total_chords > 0 else 0.0
    p10_um = round(float(p10_m * 1e6), 3)
    p50_um = round(float(p50_m * 1e6), 3)
    p90_um = round(float(p90_m * 1e6), 3)

    astm_mean_m = float(intercepts.mean_intercept_m)
    astm_mean_um = float(astm_mean_m * 1e6)
    std_d_m = float(intercepts.std_intercept_m)
    std_d_um = float(std_d_m * 1e6)
    cv_d = float(std_d_m / chord_mean_m) if chord_mean_m > 0 else 0.0

    chords_um = [round(float(c * 1e6), 4) for c in intercepts.chords_m]
    sample_lines = []
    for ln in intercepts.lines[::4]:
        sample_lines.append(
            {
                "orientation": ln["orientation"],
                "x1": ln["x1"],
                "y1": ln["y1"],
                "x2": ln["x2"],
                "y2": ln["y2"],
                "num_crossings": ln["num_crossings"],
                "crossings_px": ln["crossings_px"][:40],
            }
        )

    payload: Dict[str, object] = {
        "key": key,
        "material_name": material_name,
        "structure": structure,
        "phase_of_interest": phase_of_interest,
        "heat_treatment": heat_treatment,
        "etchant": etchant,
        "magnification": magnification,
        "calibration": {
            "scale_bar_um": scale_bar_um,
            "pixels_for_scale_bar": pixels_for_scale_bar,
            "pixel_size_m": pixel_size_m,
            "pixel_size_um": round(pixel_size_m * 1e6, 6),
        },
        "license_note": license_note,
        "redistributable_raw_image": redistributable_raw,
        "segmentation_policy": policy_applied,
        "segmentation_uncertainty_note": (
            "Synthetic mathematical stereology target (V-11); not an experimental micrograph."
            if key.startswith("synthetic_")
            else "Automated 2D optical watershed segmentation carries ~10-20% boundary delineation uncertainty due to chemical etching contrast and polishing artifacts."
        ),
        "pearlite_masked_fraction": round(pearlite_fraction, 4),
        "image_dimensions_px": {"width": int(width_px), "height": int(height_px)},
        "statistics": {
            "num_grains_total": len(grains),
            "num_grains_exported": len(grain_list),
            "astm_mean_intercept_m": astm_mean_m,
            "astm_mean_intercept_um": round(astm_mean_um, 3),
            "chord_mean_m": chord_mean_m,
            "chord_mean_um": round(chord_mean_um, 3),
            "mean_intercept_m": astm_mean_m,
            "mean_intercept_um": round(astm_mean_um, 3),
            "std_intercept_m": std_d_m,
            "std_intercept_um": round(std_d_um, 3),
            "chord_cv": round(cv_d, 4),
            "p10_m": p10_m,
            "p50_m": p50_m,
            "p90_m": p90_m,
            "p10_um": p10_um,
            "p50_um": p50_um,
            "p90_um": p90_um,
            "total_line_length_um": round(intercepts.total_length_m * 1e6, 2),
            "total_crossings": int(intercepts.total_crossings),
            "total_chords": total_chords,
            "reference_line_checks": intercepts.reference_line_checks,
        },
        "chords_m": [float(f"{c:.6e}") for c in intercepts.chords_m],
        "chords_um": chords_um,
        "sample_intercept_lines": sample_lines,
        "grains": grain_list,
    }
    return payload, intercepts


def main() -> None:
    os.makedirs("web/public/data/micrographs", exist_ok=True)
    os.makedirs("docs/screenshots", exist_ok=True)
    os.makedirs("tests/golden", exist_ok=True)

    metadata_list = load_micrograph_metadata("data/micrographs/metadata.csv")
    index_entries: List[Dict[str, object]] = []
    all_payloads: Dict[str, Dict[str, object]] = {}

    for meta in metadata_list:
        rgb, gray = load_micrograph_image(meta)
        prep = preprocess_micrograph(gray, material_key=meta.material_key)
        seg = segment_micrograph(prep, pixel_size_m=meta.pixel_size_m, material_key=meta.material_key)

        h, w = seg.labels.shape
        payload, intercepts = _build_fixture_payload(
            key=meta.material_key,
            material_name=meta.material_name,
            structure=meta.structure,
            phase_of_interest=meta.phase_of_interest,
            heat_treatment=meta.heat_treatment,
            etchant=meta.etchant,
            magnification=meta.magnification,
            scale_bar_um=meta.scale_bar_um,
            pixels_for_scale_bar=meta.pixels_for_scale_bar,
            pixel_size_m=meta.pixel_size_m,
            license_note=meta.license_note,
            redistributable_raw=meta.redistributable_raw,
            policy_applied=seg.policy_applied,
            pearlite_fraction=prep.pearlite_fraction,
            width_px=w,
            height_px=h,
            labels=seg.labels,
            fg_mask=seg.foreground_mask,
            seed=42,
        )

        # Save QA overlay to docs/screenshots/<material_key>_qa_overlay.png
        qa_path = f"docs/screenshots/{meta.material_key}_qa_overlay.png"
        save_qa_overlay(
            rgb_img=rgb,
            labels=seg.labels,
            out_path=qa_path,
            intercept_lines=intercepts.lines[::5],
        )

        json_path = f"web/public/data/micrographs/{meta.material_key}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        all_payloads[meta.material_key] = payload
        index_entries.append(
            {
                "key": meta.material_key,
                "material_name": meta.material_name,
                "structure": meta.structure,
                "mean_intercept_um": payload["statistics"]["mean_intercept_um"],
                "astm_mean_intercept_um": payload["statistics"]["astm_mean_intercept_um"],
                "chord_mean_um": payload["statistics"]["chord_mean_um"],
                "std_intercept_um": payload["statistics"]["std_intercept_um"],
                "total_crossings": payload["statistics"]["total_crossings"],
                "total_chords": payload["statistics"]["total_chords"],
                "num_grains": payload["statistics"]["num_grains_total"],
                "segmentation_policy": seg.policy_applied,
                "fixture_file": f"/data/micrographs/{meta.material_key}.json",
            }
        )
        print(
            f"[Phase 7] Processed {meta.material_key}: "
            f"grains={payload['statistics']['num_grains_total']}, "
            f"chords={payload['statistics']['total_chords']}, "
            f"crossings={payload['statistics']['total_crossings']}, "
            f"l_bar_astm={payload['statistics']['astm_mean_intercept_um']:.3f} um, "
            f"l_bar_chord={payload['statistics']['chord_mean_um']:.3f} um, "
            f"policy={seg.policy_applied}"
        )

    # 5. Generate synthetic Voronoi 30 um verification target fixture
    # (V-11 10x10 grid on 500x700 window with seed 8 yields exactly 231 chords, 215 crossings, ASTM 27.907 um)
    vor_w, vor_h = 500, 700
    vor_px_m = 0.5e-6
    vor_target_m = 30.0e-6
    vor_labels, _ = generate_synthetic_voronoi_labels(
        width_px=vor_w,
        height_px=vor_h,
        pixel_size_m=vor_px_m,
        target_grain_size_m=vor_target_m,
        seed=8,
        lloyd_iterations=2,
    )
    vor_fg = np.ones_like(vor_labels, dtype=bool)
    vor_key = "synthetic_voronoi_30um"
    vor_payload, vor_intercepts = _build_fixture_payload(
        key=vor_key,
        material_name="Synthetic Voronoi Tessellation (30 um Stereology Verification Target)",
        structure="FCC",
        phase_of_interest="synthetic_voronoi_verification_only",
        heat_treatment="Mathematical 2-step Lloyd-relaxed Voronoi tessellation (NOT an experimental micrograph)",
        etchant="N/A (synthetic verification target V-11)",
        magnification="N/A",
        scale_bar_um=50.0,
        pixels_for_scale_bar=100.0,
        pixel_size_m=vor_px_m,
        license_note="CC0 1.0 Public Domain (Synthetically generated verification target)",
        redistributable_raw=True,
        policy_applied="V11_synthetic_voronoi_target",
        pearlite_fraction=0.0,
        width_px=vor_w,
        height_px=vor_h,
        labels=vor_labels,
        fg_mask=vor_fg,
        seed=42,
        num_horizontal=10,
        num_vertical=10,
    )

    # Render synthetic Voronoi QA overlay on a synthetic grayscale shaded canvas
    vor_canvas = np.full((vor_h, vor_w, 3), 215, dtype=np.uint8)
    for gid in range(1, int(np.max(vor_labels)) + 1):
        shade = 175 + ((gid * 37) % 65)
        vor_canvas[vor_labels == gid] = [shade, shade, min(255, shade + 8)]
    save_qa_overlay(
        rgb_img=vor_canvas,
        labels=vor_labels,
        out_path=f"docs/screenshots/{vor_key}_qa_overlay.png",
        intercept_lines=vor_intercepts.lines[::2],
    )

    with open(f"web/public/data/micrographs/{vor_key}.json", "w", encoding="utf-8") as f:
        json.dump(vor_payload, f, indent=2)

    all_payloads[vor_key] = vor_payload
    index_entries.append(
        {
            "key": vor_key,
            "material_name": vor_payload["material_name"],
            "structure": "FCC",
            "mean_intercept_um": vor_payload["statistics"]["mean_intercept_um"],
            "astm_mean_intercept_um": vor_payload["statistics"]["astm_mean_intercept_um"],
            "chord_mean_um": vor_payload["statistics"]["chord_mean_um"],
            "std_intercept_um": vor_payload["statistics"]["std_intercept_um"],
            "total_crossings": vor_payload["statistics"]["total_crossings"],
            "total_chords": vor_payload["statistics"]["total_chords"],
            "num_grains": vor_payload["statistics"]["num_grains_total"],
            "segmentation_policy": "V11_synthetic_voronoi_target",
            "fixture_file": f"/data/micrographs/{vor_key}.json",
        }
    )
    print(
        f"[Phase 7] Processed {vor_key}: "
        f"grains={vor_payload['statistics']['num_grains_total']}, "
        f"chords={vor_payload['statistics']['total_chords']}, "
        f"crossings={vor_payload['statistics']['total_crossings']}, "
        f"l_bar_astm={vor_payload['statistics']['astm_mean_intercept_um']:.3f} um, "
        f"l_bar_chord={vor_payload['statistics']['chord_mean_um']:.3f} um"
    )

    with open("web/public/data/micrographs/index.json", "w", encoding="utf-8") as f:
        json.dump({"micrographs": index_entries}, f, indent=2)

    # Generate golden parity vector file tests/golden/phase7_fixtures.json
    sample_chords_m = [12.0e-6, 18.0e-6, 25.0e-6, 31.0e-6, 44.0e-6, 52.0e-6]
    rescaled_25 = rescale_chords(sample_chords_m, target_mean_m=25.0e-6)
    rescaled_60 = rescale_chords(sample_chords_m, target_mean_m=60.0e-6)

    # Copper-like parameters for chord ensemble Hall-Petch parity check
    hp_ensemble = evaluate_chord_ensemble_hall_petch(
        chords_m=rescaled_25.chords_m,
        mu_pa=48.0e9,
        nu=0.34,
        burgers_m=0.256e-9,
        tau_c_pa=8.17e6,
        taylor_factor=3.06,
        tau_star_ref_pa=195.0e6,
        sigma_0_offset_pa=25.0e6,
    )

    golden_data = {
        "description": "Phase 7 golden parity vectors for chord rescaling (V-16), seeded orientations (V-13), and chord-ensemble Hall-Petch evaluation.",
        "rescale_cases": [
            {
                "input_chords_m": sample_chords_m,
                "target_mean_m": 25.0e-6,
                "expected_chords_m": [float(v) for v in rescaled_25.chords_m],
                "expected_mean_m": rescaled_25.mean_m,
                "expected_std_m": rescaled_25.std_m,
                "expected_cv": rescaled_25.cv,
                "expected_scale_factor": rescaled_25.scale_factor,
            },
            {
                "input_chords_m": sample_chords_m,
                "target_mean_m": 60.0e-6,
                "expected_chords_m": [float(v) for v in rescaled_60.chords_m],
                "expected_mean_m": rescaled_60.mean_m,
                "expected_std_m": rescaled_60.std_m,
                "expected_cv": rescaled_60.cv,
                "expected_scale_factor": rescaled_60.scale_factor,
            },
        ],
        "chord_ensemble_hall_petch_case": {
            "chords_m": [float(v) for v in rescaled_25.chords_m],
            "mu_pa": 48.0e9,
            "nu": 0.34,
            "burgers_m": 0.256e-9,
            "tau_c_pa": 8.17e6,
            "taylor_factor": 3.06,
            "tau_star_ref_pa": 195.0e6,
            "sigma_0_offset_pa": 25.0e6,
            "expected": hp_ensemble,
        },
        "micrograph_summary": index_entries,
    }

    with open("tests/golden/phase7_fixtures.json", "w", encoding="utf-8") as f:
        json.dump(golden_data, f, indent=2)
    print("[Phase 7] Wrote tests/golden/phase7_fixtures.json and web/public/data/micrographs/*.json")


if __name__ == "__main__":
    main()
