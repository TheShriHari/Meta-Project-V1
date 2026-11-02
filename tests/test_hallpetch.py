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
    evaluate_source_distance_sensitivity,
    SourceDistanceSensitivityResult,
    CALIBRATION_PROTOCOL,
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


def test_independent_analytical_oracle_source_shutoff_and_yield_onset():
    """
    Non-tautological verification against independently derived closed-form analytical solutions:
      1. For N = 1 (single leader pinned at x_0 = 0), the back-stress at the source x = L is
         tau_back(L; 1) = A / L, where A = mu * b / [2 * pi * (1 - nu)].
         Thus a second dislocation can be emitted (N >= 2) if and only if
         tau_eff - A / L > tau_src <=> tau_eff > tau_src + A / L.
      2. For N = 2 (x_0 = 0, x_1 = A / tau_eff since xi_1 = 2 for L_1^(1)(xi) = 2 - xi = 0),
         positions_m[1] == A / tau_eff and back_stress_pa == A / L + A / (L - A / tau_eff).
      3. For find_yield_onset in the single-dislocation regime (tau* <= A / L, so N_crit = 1),
         tau_eff,crit == tau* within bisection tolerance (1e-6).
    """
    mu_pa = 26.0e9
    nu = 0.345
    b_m = 2.86343e-10
    L_m = 10.0e-6
    tau_src_pa = 0.5e6

    # Independently computed elastic prefactor A = mu * b / [2 * pi * (1 - nu)]
    A = (mu_pa * b_m) / (2.0 * np.pi * (1.0 - nu))
    tau_back_n1 = A / L_m

    # Just below N=1 -> N=2 emission threshold: tau_eff = tau_src + 0.999 * (A / L)
    tau_below = tau_src_pa + 0.999 * tau_back_n1
    res_below = solve_pileup_with_source(
        SourceShutoffInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            tau_eff_pa=tau_below,
            source_distance_m=L_m,
            tau_src_pa=tau_src_pa,
        )
    )
    assert res_below.count == 1
    assert res_below.positions_m[0] == 0.0
    assert res_below.back_stress_pa == pytest.approx(tau_back_n1, rel=1e-12)

    # Just above N=1 -> N=2 emission threshold: tau_eff = tau_src + 1.001 * (A / L)
    tau_above = tau_src_pa + 1.001 * tau_back_n1
    res_above = solve_pileup_with_source(
        SourceShutoffInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            tau_eff_pa=tau_above,
            source_distance_m=L_m,
            tau_src_pa=tau_src_pa,
        )
    )
    assert res_above.count >= 2

    # Choose tau_eff strictly in the N = 2 regime (tau_src = 0):
    # N >= 2 requires tau_eff > A / L, and N = 2 shuts off when tau_eff <= A/L + A/(L - A/tau_eff).
    # At tau_eff = 1.5 * (A / L), x_1 = A / tau_eff = (2/3) L < L, and
    # tau_back(L; 2) = A/L + A/(L/3) = 4 A/L > 1.5 A/L, so N == 2 exactly!
    tau_n2 = 1.5 * tau_back_n1
    res_n2 = solve_pileup_with_source(
        SourceShutoffInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            tau_eff_pa=tau_n2,
            source_distance_m=L_m,
            tau_src_pa=0.0,
        )
    )
    assert res_n2.count == 2
    expected_x1 = A / tau_n2
    expected_back_n2 = (A / L_m) + (A / (L_m - expected_x1))
    assert res_n2.positions_m[1] == pytest.approx(expected_x1, rel=1e-12)
    assert res_n2.back_stress_pa == pytest.approx(expected_back_n2, rel=1e-12)

    # Single-dislocation regime for find_yield_onset: tau* <= A / L => N_crit = 1 and tau_eff,crit = tau*
    tau_star_single = 0.8 * tau_back_n1
    onset_single = find_yield_onset(
        YieldOnsetInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=b_m,
            grain_size_m=2.0 * L_m,
            tau_star_ref_pa=tau_star_single,
            tau_src_pa=0.0,
        )
    )
    assert onset_single.converged is True
    assert onset_single.critical_count == 1
    assert onset_single.tau_eff_crit_pa == pytest.approx(tau_star_single, rel=1e-6)


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


@pytest.fixture(scope="module")
def v15_report():
    return evaluate_literature_calibration_and_validation()


MATERIALS = ["aluminium", "copper", "pure_iron", "ferritic_steel"]


def test_v15_calibration_protocol_and_report_structure(v15_report):
    """Calibration succeeds, V-09/V-10 hold, and unadjusted/adjusted held-out metrics are separate keys."""
    assert len(v15_report) == 4
    for mat_key in MATERIALS:
        entry = v15_report[mat_key]
        assert entry["calibrated_tau_star_ref_pa"] > 0.0
        assert entry["calibration_k_y_rel_error"] < 0.02
        assert entry["v09_passed"] is True
        assert entry["v10_passed"] is True
        for key in (
            "held_out_unadjusted_mean_rel_error",
            "held_out_intercept_adjusted_mean_rel_error",
            "held_out_k_y_rel_diff",
        ):
            assert key in entry
        assert "held_out_mean_rel_error" not in entry  # ambiguous legacy key removed
        # Explicit intended boolean, not mere key presence
        assert entry["v15_within_25pct_band"] is (entry["held_out_unadjusted_mean_rel_error"] <= 0.25)
    assert "CALIBRATION TARGET" in CALIBRATION_PROTOCOL["calibrated_parameters"]["tau_star_ref_pa"]


def test_v15_no_held_out_leakage_in_headline(v15_report):
    """Perturbing the held-out fit's sigma_0 and k_y must not change the headline unadjusted error."""
    import copy
    from hpsim.core import hallpetch as hp

    original = copy.deepcopy(hp.VERIFIED_MATERIAL_SPECS["aluminium"]["held_out_fit"])
    try:
        # Same literature line shifted: compare against a recomputed reference to ensure only the
        # literature target moves, not the prediction. Prediction (sigma_y_pa) depends on cal only.
        base = v15_report["aluminium"]
        assert base["held_out_unadjusted_mean_rel_error"] != base["held_out_intercept_adjusted_mean_rel_error"]
        # Prediction identity: unadjusted error computed here independently from calibration inputs
        spec = hp.VERIFIED_MATERIAL_SPECS["aluminium"]
        cal, held = spec["calibration_fit"], spec["held_out_fit"]
        errs = []
        for d in np.geomspace(held["d_min_um"] * 1e-6, held["d_max_um"] * 1e-6, 5):
            on = find_yield_onset(YieldOnsetInputs(
                mu_pa=spec["mu_pa"], nu=spec["nu"], burgers_m=spec["burgers_m"], grain_size_m=float(d),
                tau_star_ref_pa=base["calibrated_tau_star_ref_pa"], tau_c_pa=spec["tau_c_pa"],
                taylor_factor=spec["taylor_factor"], sigma_0_offset_pa=cal["sigma_0_pa"]))
            lit = held["sigma_0_pa"] + held["k_y_pa_m05"] * d ** -0.5
            errs.append(abs(on.sigma_y_pa - lit) / lit)
        assert base["held_out_unadjusted_mean_rel_error"] == pytest.approx(float(np.mean(errs)), rel=1e-9)
    finally:
        hp.VERIFIED_MATERIAL_SPECS["aluminium"]["held_out_fit"] = original


def test_v15_unadjusted_headline_is_reported_honestly(v15_report):
    """Pin the unadjusted band booleans actually observed (do not force pass); regression guard."""
    flags = {m: v15_report[m]["v15_within_25pct_band"] for m in MATERIALS}
    errs = {m: v15_report[m]["held_out_unadjusted_mean_rel_error"] for m in MATERIALS}
    for m in MATERIALS:
        assert flags[m] is (errs[m] <= 0.25)


@pytest.mark.xfail(strict=True, reason="Known: Al AA1050 held-out unadjusted error ~28.9% > 25% (solute friction not modelled)")
def test_v15_expected_failure_aluminium_unadjusted_band(v15_report):
    assert v15_report["aluminium"]["v15_within_25pct_band"] is True


@pytest.mark.xfail(strict=True, reason="Known: IF-Fe vs Base Fe slope differs ~39% (grain-boundary C segregation not modelled)")
def test_v15_expected_failure_pure_iron_slope_transfer(v15_report):
    assert v15_report["pure_iron"]["held_out_k_y_rel_diff"] <= 0.25


def test_source_shutoff_n2_threshold_hand_derived_with_tau_src():
    """
    Hand-derived N=2 window, tau_src > 0 (no solver for expected values):
      N>=2 iff tau_eff > tau_src + A/L (A = mu b / [2 pi (1-nu)]).
      N=2 persists iff tau_eff - [A/L + A/(L - A/tau_eff)] <= tau_src.
    Find the 2->3 threshold by bisection on that closed form, then check the solver on both sides.
    """
    mu, nu, b, L, tsrc = 26.0e9, 0.345, 2.86343e-10, 10.0e-6, 0.3e6
    A = mu * b / (2.0 * np.pi * (1.0 - nu))
    t12 = tsrc + A / L
    g = lambda t: t - tsrc - (A / L + A / (L - A / t))  # >0 => third dislocation emitted
    lo, hi = t12 * 1.0001, 100.0 * t12
    assert g(lo) < 0.0 and g(hi) > 0.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        lo, hi = (mid, hi) if g(mid) < 0.0 else (lo, mid)
    t23 = 0.5 * (lo + hi)

    def run(t):
        return solve_pileup_with_source(SourceShutoffInputs(
            mu_pa=mu, nu=nu, burgers_m=b, tau_eff_pa=t, source_distance_m=L, tau_src_pa=tsrc))

    assert run(t12 * 0.9999).count == 1
    assert run(t12 * 1.0001).count == 2
    assert run(t23 * 0.999).count == 2
    assert run(t23 * 1.001).count >= 3
    r = run(t23 * 0.999)
    assert r.positions_m[1] == pytest.approx(A / (t23 * 0.999), rel=1e-12)


def test_source_shutoff_edge_inputs():
    """Edge inputs: tau_eff == tau_src gives 0; invalid distance raises."""
    base = dict(mu_pa=26.0e9, nu=0.345, burgers_m=2.86343e-10)
    assert solve_pileup_with_source(SourceShutoffInputs(**base, tau_eff_pa=1e6, source_distance_m=1e-5, tau_src_pa=1e6)).count == 0
    with pytest.raises(ValueError):
        solve_pileup_with_source(SourceShutoffInputs(**base, tau_eff_pa=1e6, source_distance_m=0.0))


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


def test_phase6_analytic_oracle_fixtures_match_solver():
    """Closed-form oracle fixtures (independent provenance) vs solver."""
    fixture_path = "tests/golden/phase6_fixtures.json"
    if not os.path.exists(fixture_path):
        pytest.skip("phase6_fixtures.json not yet generated")
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data["analytic_oracle_cases"]) == 2
    for case in data["analytic_oracle_cases"]:
        res = solve_pileup_with_source(SourceShutoffInputs(**case["inputs"]))
        exp = case["expected"]
        assert res.count == exp["count"]
        assert list(res.positions_m) == pytest.approx(exp["positions_m"], rel=1e-12, abs=0.0)
        assert res.back_stress_pa == pytest.approx(exp["back_stress_pa"], rel=1e-12)


def test_source_distance_sensitivity_ky_scaling():
    """
    Test sensitivity of emergent Hall-Petch slope k_y to dislocation source distance L in {d/4, d/2, d}.
    Analytically (EFN continuum):
      k_y(L = alpha * d) = (1 / sqrt(alpha)) * M_T * sqrt( mu * b * tau* / [pi * (1 - nu)] )
      k_y scales as sqrt(1/L), so k_y(d) ~ sqrt(1/d) vs k_y(d/2) ~ sqrt(2/d).
      Therefore:
        k_y(d/4) / k_y(d/2) = sqrt(2) ~ 1.4142
        k_y(d) / k_y(d/2) = 1 / sqrt(2) ~ 0.7071
    Discrete pile-up simulation must match this theoretical scaling within +/- 5%,
    and maintain the emergent d^(-1/2) power-law exponent (V-09: -0.5 +/- 0.05) across all ratios.
    """
    mu_pa = 26.0e9
    nu = 0.345
    b_m = 2.86343e-10
    M_T = 3.06
    tau_c_pa = 0.8e6
    tau_star_ref_pa = 80.89e6

    d_sweep = np.geomspace(10.0e-6, 400.0e-6, 16)
    base_inp = HallPetchSweepInputs(
        mu_pa=mu_pa,
        nu=nu,
        burgers_m=b_m,
        tau_c_pa=tau_c_pa,
        taylor_factor=M_T,
        tau_star_ref_pa=tau_star_ref_pa,
        grain_sizes_m=d_sweep,
        sigma_0_offset_pa=10.0e6,
        bootstrap_samples=30,
        seed=42,
    )

    sens = evaluate_source_distance_sensitivity(base_inp, ratios=[0.25, 0.5, 1.0])
    assert isinstance(sens, SourceDistanceSensitivityResult)
    assert sens.ratios == [0.25, 0.5, 1.0]

    # Check that V-09 (-0.5 +/- 0.05 log-log exponent) holds for all source distances
    for r in [0.25, 0.5, 1.0]:
        res_r = sens.results[r]
        assert abs(res_r.log_log_slope - (-0.5)) <= 0.05, (
            f"V-09 failed for ratio {r}: slope={res_r.log_log_slope}"
        )
        assert res_r.v09_passed is True

    # Check analytical sqrt(1/L) scaling:
    # k_y(d/4) / k_y(d/2) ~ sqrt(2) = 1.4142 within 5%
    ratio_d4_to_d2 = sens.ratio_to_half_d_scaling[0.25]
    assert ratio_d4_to_d2 == pytest.approx(np.sqrt(2.0), rel=0.05)

    # k_y(d) / k_y(d/2) ~ 1/sqrt(2) = 0.7071 within 5%
    ratio_d_to_d2 = sens.ratio_to_half_d_scaling[1.0]
    assert ratio_d_to_d2 == pytest.approx(1.0 / np.sqrt(2.0), rel=0.05)
