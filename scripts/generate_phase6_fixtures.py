#!/usr/bin/env python3
"""
scripts/generate_phase6_fixtures.py - Generate Phase 6 cross-runtime golden parity fixtures
(`tests/golden/phase6_fixtures.json`) and export `web/public/data/materials.json`.
"""

import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from hpsim.core.hallpetch import (
    SourceShutoffInputs,
    YieldOnsetInputs,
    HallPetchSweepInputs,
    solve_pileup_with_source,
    find_yield_onset,
    run_hall_petch_sweep,
    evaluate_literature_calibration_and_validation,
    VERIFIED_MATERIAL_SPECS,
    CALIBRATION_PROTOCOL,
)
from hpsim.materials.loader import load_materials_database


def main():
    os.makedirs("tests/golden", exist_ok=True)
    os.makedirs("web/public/data", exist_ok=True)

    cal_val_report = evaluate_literature_calibration_and_validation()

    # 0. Hand-derived analytical oracles (closed form; solver NOT used for expected values).
    #    A = mu b / (2 pi (1-nu)); N=1: back stress at source = A/L, emission of 2nd dislocation iff
    #    tau_eff > tau_src + A/L. N=2: x1 = A/tau_eff, back = A/L + A/(L - A/tau_eff).
    import math

    analytic_oracle_cases = []
    for oid, mu, nu_, b, L_, tsrc, factor in [
        ("oracle_n1_al", 26.0e9, 0.345, 2.86343e-10, 10.0e-6, 0.5e6, 0.999),
        ("oracle_n2_al", 26.0e9, 0.345, 2.86343e-10, 10.0e-6, 0.0, 1.5),
    ]:
        A = mu * b / (2.0 * math.pi * (1.0 - nu_))
        if oid.startswith("oracle_n1"):
            tau_eff = tsrc + factor * A / L_
            exp = {"count": 1, "positions_m": [0.0], "back_stress_pa": A / L_}
        else:
            tau_eff = factor * A / L_
            x1 = A / tau_eff
            exp = {
                "count": 2,
                "positions_m": [0.0, x1],
                "back_stress_pa": A / L_ + A / (L_ - x1),
            }
        analytic_oracle_cases.append(
            {
                "id": oid,
                "provenance": "closed-form hand derivation computed in generator; independent of solve_pileup_with_source",
                "inputs": {"mu_pa": mu, "nu": nu_, "burgers_m": b, "tau_eff_pa": tau_eff,
                           "source_distance_m": L_, "tau_src_pa": tsrc},
                "expected": exp,
            }
        )

    # 1. Source shut-off test cases
    source_shutoff_cases = []
    shutoff_configs = [
        {
            "id": "al_low_stress",
            "mu_pa": 26.0e9,
            "nu": 0.345,
            "burgers_m": 2.86343e-10,
            "tau_eff_pa": 5.0e6,
            "source_distance_m": 10.0e-6,
            "tau_src_pa": 0.0,
        },
        {
            "id": "cu_mid_stress",
            "mu_pa": 46.4e9,
            "nu": 0.343,
            "burgers_m": 2.55620e-10,
            "tau_eff_pa": 12.0e6,
            "source_distance_m": 15.0e-6,
            "tau_src_pa": 0.5e6,
        },
    ]

    for cfg in shutoff_configs:
        res = solve_pileup_with_source(
            SourceShutoffInputs(
                mu_pa=cfg["mu_pa"],
                nu=cfg["nu"],
                burgers_m=cfg["burgers_m"],
                tau_eff_pa=cfg["tau_eff_pa"],
                source_distance_m=cfg["source_distance_m"],
                tau_src_pa=cfg["tau_src_pa"],
            )
        )
        source_shutoff_cases.append(
            {
                "id": cfg["id"],
                "inputs": cfg,
                "expected": {
                    "count": res.count,
                    "tip_stress_pa": res.tip_stress_pa,
                    "back_stress_pa": res.back_stress_pa,
                    "net_source_stress_pa": res.net_source_stress_pa,
                    "positions_m": [float(x) for x in res.positions_m],
                    "pileup_length_m": res.pileup_length_m,
                    "asymptotic_count": res.asymptotic_count,
                },
            }
        )

    # 2. Yield-onset bisection cases (5 configurations using exact calibrated tau_star_ref_pa)
    yield_onset_cases = []
    onset_configs = [
        {
            "id": "al_d25um_beta0",
            "mu_pa": 26.0e9,
            "nu": 0.345,
            "burgers_m": 2.86343e-10,
            "grain_size_m": 25.0e-6,
            "tau_star_ref_pa": cal_val_report["aluminium"]["calibrated_tau_star_ref_pa"],
            "m_prime": 1.0,
            "beta": 0.0,
            "tau_c_pa": 0.8e6,
            "taylor_factor": 3.06,
            "sigma_0_offset_pa": 10.0e6,
        },
        {
            "id": "al_d25um_beta1_m06",
            "mu_pa": 26.0e9,
            "nu": 0.345,
            "burgers_m": 2.86343e-10,
            "grain_size_m": 25.0e-6,
            "tau_star_ref_pa": cal_val_report["aluminium"]["calibrated_tau_star_ref_pa"],
            "m_prime": 0.6,
            "beta": 1.0,
            "tau_c_pa": 0.8e6,
            "taylor_factor": 3.06,
            "sigma_0_offset_pa": 10.0e6,
        },
        {
            "id": "cu_d50um_beta0",
            "mu_pa": 46.4e9,
            "nu": 0.343,
            "burgers_m": 2.55620e-10,
            "grain_size_m": 50.0e-6,
            "tau_star_ref_pa": cal_val_report["copper"]["calibrated_tau_star_ref_pa"],
            "m_prime": 1.0,
            "beta": 0.0,
            "tau_c_pa": 0.65e6,
            "taylor_factor": 3.06,
            "sigma_0_offset_pa": 20.0e6,
        },
        {
            "id": "fe_if_d20um_beta0",
            "mu_pa": 81.6e9,
            "nu": 0.291,
            "burgers_m": 2.48246e-10,
            "grain_size_m": 20.0e-6,
            "tau_star_ref_pa": cal_val_report["pure_iron"]["calibrated_tau_star_ref_pa"],
            "m_prime": 1.0,
            "beta": 0.0,
            "tau_c_pa": 27.5e6,
            "taylor_factor": 2.75,
            "sigma_0_offset_pa": 56.0e6,
        },
        {
            "id": "steel_c60_d15um_beta0",
            "mu_pa": 81.0e9,
            "nu": 0.290,
            "burgers_m": 2.48289e-10,
            "grain_size_m": 15.0e-6,
            "tau_star_ref_pa": cal_val_report["ferritic_steel"]["calibrated_tau_star_ref_pa"],
            "m_prime": 1.0,
            "beta": 0.0,
            "tau_c_pa": 35.0e6,
            "taylor_factor": 2.75,
            "sigma_0_offset_pa": 61.0e6,
        },
    ]

    for cfg in onset_configs:
        res = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=cfg["mu_pa"],
                nu=cfg["nu"],
                burgers_m=cfg["burgers_m"],
                grain_size_m=cfg["grain_size_m"],
                tau_star_ref_pa=cfg["tau_star_ref_pa"],
                m_prime=cfg["m_prime"],
                beta=cfg["beta"],
                tau_c_pa=cfg["tau_c_pa"],
                taylor_factor=cfg["taylor_factor"],
                sigma_0_offset_pa=cfg["sigma_0_offset_pa"],
            )
        )
        yield_onset_cases.append(
            {
                "id": cfg["id"],
                "inputs": cfg,
                "expected": {
                    "converged": res.converged,
                    "tau_star_effective_pa": res.tau_star_effective_pa,
                    "tau_eff_crit_pa": res.tau_eff_crit_pa,
                    "tau_eff_analytic_pa": res.tau_eff_analytic_pa,
                    "critical_count": res.critical_count,
                    "tip_stress_pa": res.tip_stress_pa,
                    "sigma_y_pa": res.sigma_y_pa,
                    "sigma_y_analytic_pa": res.sigma_y_analytic_pa,
                    "plateau_width_pa": res.plateau_width_pa,
                },
            }
        )

    # 3. Full Hall-Petch sweep parity case (Aluminium 16 points from 10 um to 400 um)
    sweep_d_m = [float(x) for x in np.geomspace(10.0e-6, 400.0e-6, 16)]
    sweep_inp = {
        "mu_pa": 26.0e9,
        "nu": 0.345,
        "burgers_m": 2.86343e-10,
        "tau_c_pa": 0.8e6,
        "taylor_factor": 3.06,
        "tau_star_ref_pa": cal_val_report["aluminium"]["calibrated_tau_star_ref_pa"],
        "grain_sizes_m": sweep_d_m,
        "sigma_0_offset_pa": 10.0e6,
        "bootstrap_samples": 200,
        "seed": 42,
    }
    sweep_res = run_hall_petch_sweep(
        HallPetchSweepInputs(
            mu_pa=sweep_inp["mu_pa"],
            nu=sweep_inp["nu"],
            burgers_m=sweep_inp["burgers_m"],
            tau_c_pa=sweep_inp["tau_c_pa"],
            taylor_factor=sweep_inp["taylor_factor"],
            tau_star_ref_pa=sweep_inp["tau_star_ref_pa"],
            grain_sizes_m=sweep_inp["grain_sizes_m"],
            sigma_0_offset_pa=sweep_inp["sigma_0_offset_pa"],
            bootstrap_samples=sweep_inp["bootstrap_samples"],
            seed=sweep_inp["seed"],
        )
    )

    fixture_payload = {
        "phase": 6,
        "description": "Emergent Hall-Petch derivation, source shut-off, yield-onset bisection, and V-09/V-10/V-15 benchmarks",
        "provenance": {
            "analytic_oracle_cases": "closed form, independent of solver",
            "source_shutoff_cases / yield_onset_cases / sweep_case": "REGRESSION fixtures generated by the Python solver (parity only, not independent evidence of correctness)",
            "yield_onset_cases.tau_star_ref_pa": "calibrated to a literature Hall-Petch slope (calibration target, not emergent)",
            "calibration_validation_summary": "headline held-out metric = unadjusted; adjusted is NOT blind",
        },
        "calibration_protocol": CALIBRATION_PROTOCOL,
        "analytic_oracle_cases": analytic_oracle_cases,
        "source_shutoff_cases": source_shutoff_cases,
        "yield_onset_cases": yield_onset_cases,
        "sweep_case": {
            "inputs": sweep_inp,
            "expected": {
                "fitted_sigma_0_pa": sweep_res.fitted_sigma_0_pa,
                "fitted_k_y_pa_m05": sweep_res.fitted_k_y_pa_m05,
                "analytic_sigma_0_pa": sweep_res.analytic_sigma_0_pa,
                "analytic_k_y_pa_m05": sweep_res.analytic_k_y_pa_m05,
                "k_y_ci95_low_pa_m05": sweep_res.k_y_ci95_low_pa_m05,
                "k_y_ci95_high_pa_m05": sweep_res.k_y_ci95_high_pa_m05,
                "r_squared": sweep_res.r_squared,
                "log_log_slope": sweep_res.log_log_slope,
                "log_log_intercept": sweep_res.log_log_intercept,
                "k_y_rel_error_vs_analytic": sweep_res.k_y_rel_error_vs_analytic,
                "v09_passed": sweep_res.v09_passed,
                "v10_passed": sweep_res.v10_passed,
            },
        },
        "calibration_validation_summary": cal_val_report,
    }

    with open("tests/golden/phase6_fixtures.json", "w", encoding="utf-8") as f:
        json.dump(fixture_payload, f, indent=2)

    # Export web/public/data/materials.json combining materials.yaml provenance + Phase 6 calibrated tau_star_ref
    db = load_materials_database()
    materials_json = {}
    for mat_key, mat_obj in db.items():
        params_out = {}
        for p_key, p_obj in mat_obj.parameters.items():
            params_out[p_key] = {
                "value": p_obj.value,
                "unit": p_obj.unit,
                "source": p_obj.source,
                "doi_or_url": p_obj.doi_or_url,
                "test_conditions": p_obj.test_conditions,
                "status": p_obj.status,
            }
        if mat_key in cal_val_report:
            cv = cal_val_report[mat_key]
            params_out["tau_star_ref_calibrated"] = {
                "value": cv["calibrated_tau_star_ref_pa"],
                "unit": "Pa",
                "source": f"Phase 6 discrete pile-up calibration against {cv['calibration_source']}",
                "doi_or_url": VERIFIED_MATERIAL_SPECS[mat_key]["calibration_fit"]["doi"],
                "test_conditions": "1.6-decade grain size sweep (10-400 um), beta=0, m'=1",
                "status": "calibrated",
            }
        materials_json[mat_key] = {
            "key": mat_obj.key,
            "name": mat_obj.name,
            "structure": mat_obj.structure,
            "composition": mat_obj.composition,
            "heat_treatment": mat_obj.heat_treatment,
            "parameters": params_out,
        }

    with open("web/public/data/materials.json", "w", encoding="utf-8") as f:
        json.dump(materials_json, f, indent=2)

    print("Generated tests/golden/phase6_fixtures.json and web/public/data/materials.json")
    for k, v in cal_val_report.items():
        print(
            f"  {k:15s}: tau*_ref={v['calibrated_tau_star_ref_pa']/1e6:7.2f} MPa | "
            f"k_y_sim={v['simulated_k_y_pa_m05']/1e3:6.1f} vs target={v['calibration_target_k_y_pa_m05']/1e3:6.1f} MPa*um^0.5 | "
            f"slope={v['log_log_slope']:.4f} | V15 held-out UNADJUSTED mean err={v['held_out_unadjusted_mean_rel_error']*100:.1f}% (intercept-adjusted, not blind: {v['held_out_intercept_adjusted_mean_rel_error']*100:.1f}%)"
        )


if __name__ == "__main__":
    main()
