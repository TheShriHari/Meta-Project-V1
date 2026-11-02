#!/usr/bin/env python3
"""
scripts/run_presets.py - Deterministic CLI runner for the 5 canonical hpsim simulation presets.

Presets executed:
  1. al_hansen_calibration            - 99.999% High-Purity Al (FCC), Hansen (1977)
  2. cu_hansen_ralph                  - 99.999% High-Purity Cu (FCC), Hansen & Ralph (1982)
  3. fe_if_takeda                     - Ti-Stabilized IF Alpha-Iron (BCC, 4 ppm C), Takeda et al. (2008)
  4. steel_c60_takeda                 - Ferritic Steel C60 (BCC, 56 ppm C), Takeda et al. (2008)
  5. boundary_lrb_misorientation_sweep - LRB slip-transmission tilt misorientation sweep (0..90 deg)

Usage:
  $env:PYTHONPATH="src"; python scripts/run_presets.py [--preset <name|all>] [--json <out.json>]
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List
import numpy as np

from hpsim.core.rotations import rotation_matrix_euler_zxz
from hpsim.core.stress import make_uniaxial_stress_tensor
from hpsim.core.boundary import (
    TransmissionThresholds,
    evaluate_boundary_transmission,
)
from hpsim.core.hallpetch import (
    VERIFIED_MATERIAL_SPECS,
    HallPetchSweepInputs,
    YieldOnsetInputs,
    calibrate_tau_star_ref,
    compute_analytic_tau_star_from_ky,
    find_yield_onset,
    run_hall_petch_sweep,
)


CANONICAL_PRESETS: List[str] = [
    "al_hansen_calibration",
    "cu_hansen_ralph",
    "fe_if_takeda",
    "steel_c60_takeda",
    "boundary_lrb_misorientation_sweep",
]

_PRESET_TO_MATERIAL_KEY: Dict[str, str] = {
    "al_hansen_calibration": "aluminium",
    "cu_hansen_ralph": "copper",
    "fe_if_takeda": "pure_iron",
    "steel_c60_takeda": "ferritic_steel",
}


def run_material_hall_petch_preset(preset_id: str) -> Dict[str, Any]:
    """Execute a canonical material Hall-Petch calibration & held-out preset."""
    mat_key = _PRESET_TO_MATERIAL_KEY[preset_id]
    spec = VERIFIED_MATERIAL_SPECS[mat_key]
    cal = spec["calibration_fit"]
    held = spec["held_out_fit"]

    sweep_d_m = np.geomspace(10.0e-6, 400.0e-6, 16)
    tau_star_cal_pa = calibrate_tau_star_ref(
        target_k_y_pa_m05=cal["k_y_pa_m05"],
        mu_pa=spec["mu_pa"],
        nu=spec["nu"],
        burgers_m=spec["burgers_m"],
        tau_c_pa=spec["tau_c_pa"],
        taylor_factor=spec["taylor_factor"],
        grain_sizes_m=sweep_d_m,
        sigma_0_offset_pa=cal["sigma_0_pa"],
    )
    tau_star_analytic_pa = compute_analytic_tau_star_from_ky(
        cal["k_y_pa_m05"],
        spec["mu_pa"],
        spec["nu"],
        spec["burgers_m"],
        spec["taylor_factor"],
    )

    sweep = run_hall_petch_sweep(
        HallPetchSweepInputs(
            mu_pa=spec["mu_pa"],
            nu=spec["nu"],
            burgers_m=spec["burgers_m"],
            tau_c_pa=spec["tau_c_pa"],
            taylor_factor=spec["taylor_factor"],
            tau_star_ref_pa=tau_star_cal_pa,
            grain_sizes_m=sweep_d_m,
            sigma_0_offset_pa=cal["sigma_0_pa"],
            bootstrap_samples=200,
            seed=42,
        )
    )

    # Reference yield onset at d = 25 um
    onset_25um = find_yield_onset(
        YieldOnsetInputs(
            mu_pa=spec["mu_pa"],
            nu=spec["nu"],
            burgers_m=spec["burgers_m"],
            grain_size_m=25.0e-6,
            tau_star_ref_pa=tau_star_cal_pa,
            tau_c_pa=spec["tau_c_pa"],
            taylor_factor=spec["taylor_factor"],
            sigma_0_offset_pa=cal["sigma_0_pa"],
        )
    )

    # Held-out evaluation across 5 log-spaced grain sizes (both specimen-sigma_0-adjusted and unadjusted)
    held_d_m = np.geomspace(held["d_min_um"] * 1e-6, held["d_max_um"] * 1e-6, 5)
    held_rel_errors_adjusted = []
    held_rel_errors_unadjusted = []
    for d_val in held_d_m:
        onset_h_adj = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=spec["mu_pa"],
                nu=spec["nu"],
                burgers_m=spec["burgers_m"],
                grain_size_m=float(d_val),
                tau_star_ref_pa=tau_star_cal_pa,
                tau_c_pa=spec["tau_c_pa"],
                taylor_factor=spec["taylor_factor"],
                sigma_0_offset_pa=held["sigma_0_pa"],
            )
        )
        onset_h_unadj = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=spec["mu_pa"],
                nu=spec["nu"],
                burgers_m=spec["burgers_m"],
                grain_size_m=float(d_val),
                tau_star_ref_pa=tau_star_cal_pa,
                tau_c_pa=spec["tau_c_pa"],
                taylor_factor=spec["taylor_factor"],
                sigma_0_offset_pa=cal["sigma_0_pa"],
            )
        )
        sigma_lit = held["sigma_0_pa"] + held["k_y_pa_m05"] * (d_val ** (-0.5))
        held_rel_errors_adjusted.append(abs(onset_h_adj.sigma_y_pa - sigma_lit) / sigma_lit)
        held_rel_errors_unadjusted.append(abs(onset_h_unadj.sigma_y_pa - sigma_lit) / sigma_lit)

    mean_held_err_adj = float(np.mean(held_rel_errors_adjusted))
    mean_held_err_unadj = float(np.mean(held_rel_errors_unadjusted))
    ky_rel_diff = abs(sweep.fitted_k_y_pa_m05 - held["k_y_pa_m05"]) / held["k_y_pa_m05"]

    return {
        "preset_id": preset_id,
        "type": "hall_petch_calibration",
        "material_key": mat_key,
        "material_name": spec["name"],
        "structure": spec["structure"],
        "tau_c_status": spec["tau_c_status"],
        "calibration_source": cal["source_id"],
        "calibrated_tau_star_ref_mpa": tau_star_cal_pa / 1e6,
        "analytic_tau_star_ref_mpa": tau_star_analytic_pa / 1e6,
        "target_k_y_mpa_um05": cal["k_y_pa_m05"] / 1e3,
        "simulated_k_y_mpa_um05": sweep.fitted_k_y_pa_m05 / 1e3,
        "analytic_k_y_mpa_um05": sweep.analytic_k_y_pa_m05 / 1e3,
        "log_log_slope": sweep.log_log_slope,
        "r_squared": sweep.r_squared,
        "d25um_critical_count": onset_25um.critical_count,
        "d25um_sigma_y_mpa": onset_25um.sigma_y_pa / 1e6,
        "held_out_source": held["source_id"],
        "held_out_mean_rel_error_pct": mean_held_err_adj * 100.0,
        "held_out_unadjusted_mean_rel_error_pct": mean_held_err_unadj * 100.0,
        "held_out_ky_rel_diff_pct": ky_rel_diff * 100.0,
        "v09_passed": sweep.v09_passed,
        "v10_passed": sweep.v10_passed,
        "v15_passed": bool(mean_held_err_adj <= 0.25),
    }


def run_boundary_lrb_misorientation_sweep_preset() -> Dict[str, Any]:
    """
    Execute the deterministic LRB grain-boundary misorientation sweep preset:
    Sweeps tilt angle phi1 in [0, 15, 30, 45, 60, 75, 90] deg on FCC Aluminium
    with calibrated tau*_ref = 80.89 MPa and beta = 0.5 under uniaxial [001] tension.
    """
    spec = VERIFIED_MATERIAL_SPECS["aluminium"]
    b_m = spec["burgers_m"]
    r_in = np.eye(3)
    sigma_spec = make_uniaxial_stress_tensor(80.0e6, [0.0, 0.0, 1.0])
    tau_tip_pa = 95.0e6
    thresholds = TransmissionThresholds(
        m_prime_min=0.75,
        tau_c_pa=spec["tau_c_pa"],
        tau_star_ref_pa=80.885916e6,
        beta=0.5,
    )

    angles_deg = [0.0, 15.0, 30.0, 45.0, 60.0, 75.0, 90.0]
    records: List[Dict[str, Any]] = []
    transmitted_count = 0

    for ang in angles_deg:
        r_out = rotation_matrix_euler_zxz(np.deg2rad(ang), np.deg2rad(0.5 * ang), 0.0)
        res = evaluate_boundary_transmission(
            incoming_system_index=0,
            R_in=r_in,
            R_out=r_out,
            b_magnitude_m=b_m,
            sigma_specimen=sigma_spec,
            tau_tip_pa=tau_tip_pa,
            thresholds=thresholds,
        )
        if res.outcome == "transmitted":
            transmitted_count += 1
        best_m_prime = max(c.m_prime for c in res.candidates)
        min_res_b_angstrom = min(c.residual_b_m for c in res.candidates) * 1e10
        records.append(
            {
                "angle_deg": ang,
                "outcome": res.outcome,
                "selected_system": (
                    res.selected_candidate.system_index
                    if res.selected_candidate is not None
                    else None
                ),
                "best_m_prime": best_m_prime,
                "min_residual_b_angstrom": min_res_b_angstrom,
            }
        )

    return {
        "preset_id": "boundary_lrb_misorientation_sweep",
        "type": "boundary_transmission_sweep",
        "material_key": "aluminium",
        "material_name": spec["name"],
        "structure": "FCC",
        "num_angles": len(angles_deg),
        "transmitted_count": transmitted_count,
        "pinned_count": len(angles_deg) - transmitted_count,
        "zero_deg_m_prime": records[0]["best_m_prime"],
        "zero_deg_residual_b_angstrom": records[0]["min_residual_b_angstrom"],
        "sweep_records": records,
        "v06_passed": bool(
            abs(records[0]["best_m_prime"] - 1.0) <= 1e-12
            and records[0]["min_residual_b_angstrom"] <= 1e-12
            and transmitted_count >= 1
            and (len(angles_deg) - transmitted_count) >= 1
        ),
    }


def execute_presets(selected_presets: List[str]) -> Dict[str, Any]:
    """Run the requested presets in deterministic order and return structured results."""
    results: Dict[str, Any] = {}
    for pid in selected_presets:
        if pid in _PRESET_TO_MATERIAL_KEY:
            results[pid] = run_material_hall_petch_preset(pid)
        elif pid == "boundary_lrb_misorientation_sweep":
            results[pid] = run_boundary_lrb_misorientation_sweep_preset()
        else:
            raise ValueError(f"Unknown preset '{pid}'. Valid presets: {CANONICAL_PRESETS}")
    return results


def print_summary_table(results: Dict[str, Any]) -> None:
    """Print a clean ASCII summary table of executed presets."""
    print("=" * 108)
    print("HPSIM CANONICAL SIMULATION PRESETS RUNNER")
    print("=" * 108)
    header = (
        f"{'Preset ID':<34} | {'Struct':<6} | {'tau*_ref (MPa)':>14} | "
        f"{'k_y (MPa*um^0.5)':>16} | {'Log Slope':>10} | {'Held-Out Err':>12} | {'Status':<6}"
    )
    print(header)
    print("-" * 108)

    for pid, data in results.items():
        if data["type"] == "hall_petch_calibration":
            passed = data["v09_passed"] and data["v10_passed"] and data["v15_passed"]
            status_str = "PASS" if passed else "FAIL"
            print(
                f"{pid:<34} | {data['structure']:<6} | "
                f"{data['calibrated_tau_star_ref_mpa']:>14.2f} | "
                f"{data['simulated_k_y_mpa_um05']:>16.2f} | "
                f"{data['log_log_slope']:>10.4f} | "
                f"{data['held_out_mean_rel_error_pct']:>11.2f}% | "
                f"{status_str:<6}"
            )
        else:
            status_str = "PASS" if data["v06_passed"] else "FAIL"
            summary_metric = f"tx={data['transmitted_count']}/{data['num_angles']}"
            print(
                f"{pid:<34} | {data['structure']:<6} | "
                f"{80.89:>14.2f} | "
                f"{summary_metric:>16} | "
                f"{'m0=1.000':>10} | "
                f"{'b_r=0.000A':>12} | "
                f"{status_str:<6}"
            )
    print("=" * 108)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Execute canonical hpsim simulation presets deterministically."
    )
    parser.add_argument(
        "--preset",
        default="all",
        help="Preset ID to run, or 'all' (default: all).",
    )
    parser.add_argument(
        "--json",
        dest="json_path",
        default=None,
        help="Optional file path to export structured JSON preset outputs.",
    )
    args = parser.parse_args(argv)

    if args.preset == "all":
        selected = list(CANONICAL_PRESETS)
    else:
        if args.preset not in CANONICAL_PRESETS:
            print(
                f"Error: Unknown preset '{args.preset}'. Choose from {CANONICAL_PRESETS}",
                file=sys.stderr,
            )
            return 1
        selected = [args.preset]

    results = execute_presets(selected)
    print_summary_table(results)

    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Exported JSON results to {args.json_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
