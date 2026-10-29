"""
tests/test_hallpetch.py - Unit, validation (V-09, V-10, V-15), and parity tests for Phase 6
Emergent Hall-Petch derivation from discrete 1D dislocation pile-ups.
"""

import json
import os
import numpy as np
import pytest

from hpsim.core.hallpetch import (
    SourceShutoffInputs,
    SourceShutoffResult,
    YieldOnsetInputs,
    YieldOnsetResult,
    HallPetchSweepInputs,
    HallPetchSweepResult,
    solve_pileup_with_source,
    find_yield_onset,
    compute_analytic_hall_petch_ky,
    compute_analytic_tau_star_from_ky,
    run_hall_petch_sweep,
    calibrate_tau_star_ref,
    evaluate_literature_calibration_and_validation,
)


def test_source_shutoff_zero_below_threshold():
    """No pile-up forms when tau_eff <= tau_src."""
    inp = SourceShutoffInputs(
        mu_pa=26.0e9,
        nu=0.345,
        burgers_m=2.86343e-10,
        tau_eff_pa=0.0,
        source_distance_m=10.0e-6,
        tau_src_pa=0.0,
    )
    res = solve_pileup_with_source(inp)
    assert res.count == 0
    assert res.tip_stress_pa == 0.0
    assert len(res.positions_m) == 0


def test_source_shutoff_monotonic_and_tip_stress():
    """
    As tau_eff or L increases, equilibrium dislocation count N is non-decreasing,
    all positions lie in [0, L), and tip_stress_pa == count * tau_eff_pa (V-07).
    """
    mu_pa = 26.0e9
    nu = 0.345
    b_m = 2.86343e-10
    L_m = 10.0e-6

    counts = []
    for tau_mpa in [2.0, 5.0, 10.0, 20.0]:
        tau_pa = tau_mpa * 1e6
        res = solve_pileup_with_source(
            SourceShutoffInputs(
                mu_pa=mu_pa,
                nu=nu,
                burgers_m=b_m,
                tau_eff_pa=tau_pa,
                source_distance_m=L_m,
            )
        )
        assert res.count >= 1
        assert res.tip_stress_pa == pytest.approx(res.count * tau_pa, rel=1e-12)
        assert res.positions_m[0] == 0.0
        assert np.all(res.positions_m < L_m)
        counts.append(res.count)

    # Non-decreasing count with increasing stress
    for i in range(len(counts) - 1):
        assert counts[i + 1] >= counts[i]


def test_yield_onset_bisection_and_m_prime_scaling():
    """
    find_yield_onset finds the minimum tau_eff where tau_tip >= tau_star(m').
    Also verifies that beta > 0 increases tau_star when m' < 1.
    """
    mu_pa = 26.0e9
    nu = 0.345
    b_m = 2.86343e-10
    d_m = 25.0e-6
    tau_star_ref_pa = 65.0e6

    res_b0 = find_yield_onset(
        YieldOnsetInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            grain_size_m=d_m,
            tau_star_ref_pa=tau_star_ref_pa,
            m_prime=0.6,
            beta=0.0,
            tau_c_pa=0.8e6,
            taylor_factor=3.06,
        )
    )
    assert res_b0.converged
    assert res_b0.tip_stress_pa >= res_b0.tau_star_effective_pa * (1.0 - 1e-4)
    assert res_b0.critical_count >= 2
    assert res_b0.sigma_y_pa == pytest.approx(
        3.06 * (0.8e6 + res_b0.tau_eff_crit_pa), rel=1e-9
    )

    res_b1 = find_yield_onset(
        YieldOnsetInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            grain_size_m=d_m,
            tau_star_ref_pa=tau_star_ref_pa,
            m_prime=0.6,
            beta=1.0,
            tau_c_pa=0.8e6,
            taylor_factor=3.06,
        )
    )
    assert res_b1.tau_star_effective_pa == pytest.approx(tau_star_ref_pa * 1.4, rel=1e-12)
    assert res_b1.tau_eff_crit_pa > res_b0.tau_eff_crit_pa


def test_v09_emergent_exponent_and_v10_ky_consistency():
    """
    V-09: Log-log slope of tau_eff,crit vs d over >= 1.5 decades equals -0.5 +/- 0.05.
    V-10: Simulated fitted k_y is within 15% of analytical continuum k_y formula.
    """
    mu_pa = 26.0e9
    nu = 0.345
    b_m = 2.86343e-10
    M_T = 3.06
    tau_c_pa = 0.8e6
    tau_star_ref_pa = 66.25e6

    # 1.7 decades: 5 um to 250 um
    grain_sizes_m = np.geomspace(5.0e-6, 250.0e-6, 20)
    sweep = run_hall_petch_sweep(
        HallPetchSweepInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            tau_c_pa=tau_c_pa,
            taylor_factor=M_T,
            tau_star_ref_pa=tau_star_ref_pa,
            grain_sizes_m=grain_sizes_m,
            bootstrap_samples=200,
            seed=42,
        )
    )

    # V-09: Emergent exponent -0.5 +/- 0.05
    assert abs(sweep.log_log_slope - (-0.5)) <= 0.05, (
        f"V-09 failed: log-log slope {sweep.log_log_slope:.4f} outside -0.5 +/- 0.05"
    )
    assert sweep.v09_passed is True

    # V-10: k_y consistency within 15% of analytic formula
    k_y_analytic = compute_analytic_hall_petch_ky(mu_pa, nu, b_m, tau_star_ref_pa, M_T)
    rel_err = abs(sweep.fitted_k_y_pa_m05 - k_y_analytic) / k_y_analytic
    assert rel_err <= 0.15, (
        f"V-10 failed: fitted k_y={sweep.fitted_k_y_pa_m05:.1f} vs analytic={k_y_analytic:.1f} (rel_err={rel_err:.4f})"
    )
    assert sweep.v10_passed is True
    assert sweep.k_y_ci95_low_pa_m05 <= sweep.fitted_k_y_pa_m05 <= sweep.k_y_ci95_high_pa_m05


def test_v15_calibration_and_held_out_literature_comparison():
    """
    V-15: Calibrate tau_star_ref on primary verified literature fit per material
    and evaluate held-out secondary literature fit.
    """
    report = evaluate_literature_calibration_and_validation()
    assert len(report) == 4
    for mat_key in ["aluminium", "copper", "pure_iron", "ferritic_steel"]:
        assert mat_key in report
        entry = report[mat_key]
        assert entry["calibrated_tau_star_ref_pa"] > 0.0
        assert entry["calibration_k_y_rel_error"] < 0.02
        assert entry["v09_passed"] is True
        assert entry["v10_passed"] is True
        assert "held_out_mean_rel_error" in entry
        assert "v15_within_25pct_band" in entry


def test_phase6_golden_fixtures_parity():
    """Verify Python core matches generated Phase 6 golden fixtures if present."""
    fixture_path = "tests/golden/phase6_fixtures.json"
    if not os.path.exists(fixture_path):
        pytest.skip("phase6_fixtures.json not yet generated")

    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for case in data["yield_onset_cases"]:
        inp = case["inputs"]
        exp = case["expected"]
        res = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=inp["mu_pa"],
                nu=inp["nu"],
                burgers_m=inp["burgers_m"],
                grain_size_m=inp["grain_size_m"],
                tau_star_ref_pa=inp["tau_star_ref_pa"],
                m_prime=inp["m_prime"],
                beta=inp["beta"],
                tau_c_pa=inp["tau_c_pa"],
                taylor_factor=inp["taylor_factor"],
                sigma_0_offset_pa=inp.get("sigma_0_offset_pa"),
            )
        )
        assert res.critical_count == exp["critical_count"]
        assert res.tau_eff_crit_pa == pytest.approx(exp["tau_eff_crit_pa"], rel=1e-6)
        assert res.sigma_y_pa == pytest.approx(exp["sigma_y_pa"], rel=1e-6)
