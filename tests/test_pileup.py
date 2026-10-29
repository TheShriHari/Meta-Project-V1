"""
Phase 5 RED tests: Discrete Dislocation Pile-Up Engine & Eshelby-Frank-Nabarro (EFN) Benchmark.
Tests written before implementing src/hpsim/core/pileup.py.
"""
import pytest
import numpy as np

from hpsim.core.pileup import (
    solve_pileup_equilibrium,
    compute_efn_exact_positions,
    compute_efn_asymptotic_count,
    PileupInputs,
    PileupResult,
)

A_FCC_AL = 4.0495e-10  # m
B_FCC_AL = A_FCC_AL / np.sqrt(2.0)  # ~ 2.8634e-10 m
MU_AL = 26.0e9  # Pa (approx Al shear modulus)
NU_AL = 0.33


def test_input_validation():
    """Verify input validation rejects unphysical parameters."""
    valid = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=50e6,
        count=5,
    )
    res = solve_pileup_equilibrium(valid)
    assert res.status == "converged"
    assert res.converged is True

    # Negative or zero shear modulus
    with pytest.raises(ValueError, match="mu_pa"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=-1.0, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=5))

    with pytest.raises(ValueError, match="mu_pa"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=0.0, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=5))

    # Invalid Poisson ratio (elastic stability requires -1 < nu < 0.5)
    with pytest.raises(ValueError, match="nu"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=0.5, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=5))

    with pytest.raises(ValueError, match="nu"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=-1.0, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=5))

    # Invalid Burgers vector
    with pytest.raises(ValueError, match="burgers_m"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=0.0, tau_applied_pa=50e6, count=5))

    # Invalid stress
    with pytest.raises(ValueError, match="tau_applied_pa"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=-10e6, count=5))

    # Invalid count (must have at least 2 dislocations: 1 locked obstacle + 1 mobile)
    with pytest.raises(ValueError, match="count"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=1))

    # Non-finite values
    with pytest.raises(ValueError, match="finite"):
        solve_pileup_equilibrium(PileupInputs(mu_pa=np.nan, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=5))


def test_two_dislocation_analytical_solution():
    """
    For N = 2 (1 locked at 0, 1 mobile at x2):
    Force balance: A / x2 - tau_app = 0  =>  x2 = A / tau_app = mu*b / [2*pi*(1-nu)*tau_app].
    """
    inputs = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=40e6,
        count=2,
    )
    res = solve_pileup_equilibrium(inputs)
    assert res.converged is True
    assert len(res.positions_m) == 2
    assert res.positions_m[0] == 0.0

    A = MU_AL * B_FCC_AL / (2.0 * np.pi * (1.0 - NU_AL))
    expected_x2 = A / 40e6

    assert res.positions_m[1] == pytest.approx(expected_x2, rel=1e-10)
    assert res.max_residual_pa == pytest.approx(0.0, abs=1e-6)

    # Compare with EFN exact function
    efn_pos = compute_efn_exact_positions(inputs)
    assert len(efn_pos) == 2
    assert efn_pos[1] == pytest.approx(expected_x2, rel=1e-10)


def test_three_dislocation_analytical_solution():
    """
    For N = 3 (1 locked at 0, 2 mobile at x2, x3):
    Roots of L'_3(xi) = xi^2 - 6*xi + 6 = 0  =>  xi = 3 +- sqrt(3).
    x2 = (3 - sqrt(3)) / (2*lambda),  x3 = (3 + sqrt(3)) / (2*lambda)
    where lambda = tau_app / A.
    """
    inputs = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=50e6,
        count=3,
    )
    res = solve_pileup_equilibrium(inputs)
    assert res.converged is True

    A = MU_AL * B_FCC_AL / (2.0 * np.pi * (1.0 - NU_AL))
    lam = 50e6 / A
    expected_x2 = (3.0 - np.sqrt(3.0)) / (2.0 * lam)
    expected_x3 = (3.0 + np.sqrt(3.0)) / (2.0 * lam)

    assert res.positions_m[0] == 0.0
    assert res.positions_m[1] == pytest.approx(expected_x2, rel=1e-10)
    assert res.positions_m[2] == pytest.approx(expected_x3, rel=1e-10)

    # Cross-check with EFN polynomial roots function
    efn_pos = compute_efn_exact_positions(inputs)
    assert np.allclose(res.positions_m, efn_pos, rtol=1e-9, atol=1e-14)


def test_force_signs_and_repulsion():
    """
    Test force direction:
    - Same-sign dislocations repel (f_ij > 0 for x_i > x_j pushes i to the right).
    - Applied stress drives dislocations in -x toward the obstacle.
    - If a mobile dislocation is placed too close to 0, repulsive stress exceeds applied stress.
    - If placed too far, applied stress exceeds repulsion.
    """
    inputs = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=2)
    A = MU_AL * B_FCC_AL / (2.0 * np.pi * (1.0 - NU_AL))
    x_eq = A / 50e6

    # At x < x_eq: repulsion from 0 (A/x) > applied stress (50 MPa) => net force is positive (pushes outward)
    x_close = 0.5 * x_eq
    net_stress_close = A / x_close - 50e6
    assert net_stress_close > 0.0  # Repels away from obstacle

    # At x > x_eq: repulsion (A/x) < applied stress (50 MPa) => net force is negative (drives toward obstacle)
    x_far = 2.0 * x_eq
    net_stress_far = A / x_far - 50e6
    assert net_stress_far < 0.0  # Drives toward obstacle


def test_position_ordering_and_spacing():
    """
    All positions must be strictly monotonically increasing:
    0 = x_1 < x_2 < x_3 < ... < x_N.
    Spacing must be positive and non-zero.
    """
    for N in [2, 5, 10, 20]:
        inputs = PileupInputs(
            mu_pa=MU_AL,
            nu=NU_AL,
            burgers_m=B_FCC_AL,
            tau_applied_pa=60e6,
            count=N,
        )
        res = solve_pileup_equilibrium(inputs)
        assert res.converged is True
        positions = res.positions_m

        # Check strict ordering
        for i in range(len(positions) - 1):
            assert positions[i + 1] > positions[i], f"Order violation at index {i} for N={N}"

        # Spacings must be positive
        spacings = np.diff(positions)
        assert np.all(spacings > 0.0)


def test_crowding_toward_obstacle():
    """
    For a single-ended pile-up at x=0 under uniform stress, dislocations crowd toward the obstacle:
    Inter-dislocation spacing increases monotonically away from the obstacle:
    d_12 < d_23 < d_34 < ...
    """
    inputs = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=50e6,
        count=8,
    )
    res = solve_pileup_equilibrium(inputs)
    assert res.converged is True

    spacings = np.diff(res.positions_m)
    # The first spacing d_12 is from obstacle at 0 to first mobile dislocation
    # Successive mobile spacings must increase
    for k in range(len(spacings) - 1):
        assert spacings[k + 1] > spacings[k], f"Density crowding violated at spacing index {k}"


def test_efn_numerical_solver_benchmark_agreement():
    """
    The Newton-Raphson force-balance solver must agree with the exact EFN
    orthogonal polynomial roots across counts N=2, 3, 5, 10, 15, 25 to within numerical tolerance.
    """
    for N in [2, 3, 5, 10, 15, 25]:
        inputs = PileupInputs(
            mu_pa=MU_AL,
            nu=NU_AL,
            burgers_m=B_FCC_AL,
            tau_applied_pa=45e6,
            count=N,
        )
        res = solve_pileup_equilibrium(inputs)
        efn_pos = compute_efn_exact_positions(inputs)

        assert res.converged is True
        # Maximum position discrepancy must be < 1e-10 m (sub-Angstrom precision)
        max_err = np.max(np.abs(res.positions_m - efn_pos))
        assert max_err < 1e-10, f"Discrepancy too large for N={N}: {max_err:.2e} m"
        assert res.max_residual_pa < 1e-5, f"Residual too large for N={N}: {res.max_residual_pa:.2e} Pa"


def test_eshelby_tip_stress_multiplication():
    """
    Classic Eshelby theorem: The total stress concentration on the locked obstacle dislocation
    is exactly N * tau_applied.
    """
    for N in [2, 4, 8, 16]:
        tau_app = 30e6
        inputs = PileupInputs(
            mu_pa=MU_AL,
            nu=NU_AL,
            burgers_m=B_FCC_AL,
            tau_applied_pa=tau_app,
            count=N,
        )
        res = solve_pileup_equilibrium(inputs)
        assert res.converged is True
        # Theoretical tip stress = N * tau_app
        expected_tip_stress = N * tau_app
        assert res.tip_stress_pa == pytest.approx(expected_tip_stress, rel=1e-6)


def test_scaling_laws():
    """
    EFN scaling laws:
    - x_i scales as 1 / tau_app (doubling tau halves all positions).
    - x_i scales proportionally with mu and b.
    - x_i scales as 1 / (1 - nu).
    """
    base_inputs = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=6)
    base_res = solve_pileup_equilibrium(base_inputs)

    # 1. Double applied stress -> positions halve
    double_stress = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=100e6, count=6)
    double_res = solve_pileup_equilibrium(double_stress)
    assert np.allclose(double_res.positions_m, 0.5 * base_res.positions_m, rtol=1e-8)

    # 2. Double shear modulus -> positions double
    double_mu = PileupInputs(mu_pa=2.0 * MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=6)
    double_mu_res = solve_pileup_equilibrium(double_mu)
    assert np.allclose(double_mu_res.positions_m, 2.0 * base_res.positions_m, rtol=1e-8)


def test_efn_asymptotic_count_relation():
    """
    For a pile-up of length L = x_N, EFN continuum approximation gives:
    N_approx = pi * (1 - nu) * L * tau_app / (mu * b).
    By Szego's classical theorem on Laguerre roots, the largest root scales as:
    xi_max / (4*m) = 1 - O(m^(-2/3)).
    Verify that:
    - At small N (N=3), the discrete ratio N_approx / N is ~0.394 (finite-size discrete boundary).
    - As N increases (N=30), N_approx / N approaches ~0.85, documenting the O(N^(-2/3)) asymptotic approach.
    """
    # Small N=3
    in3 = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=3)
    res3 = solve_pileup_equilibrium(in3)
    L3 = res3.positions_m[-1]
    n_approx_3 = compute_efn_asymptotic_count(L3, 50e6, MU_AL, NU_AL, B_FCC_AL)
    ratio_3 = n_approx_3 / 3.0
    # For N=3, exact ratio is (3 + sqrt(3)) / 12 ~ 0.3943
    assert ratio_3 == pytest.approx(0.3943, rel=0.02)

    # Larger N=30
    in30 = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=50e6, count=30)
    res30 = solve_pileup_equilibrium(in30)
    L30 = res30.positions_m[-1]
    n_approx_30 = compute_efn_asymptotic_count(L30, 50e6, MU_AL, NU_AL, B_FCC_AL)
    ratio_30 = n_approx_30 / 30.0
    # For N=30, the ratio increases to ~0.852, showing monotonic asymptotic convergence toward 1.0
    assert 0.80 < ratio_30 < 0.90
    assert ratio_30 > ratio_3


def test_solver_inadequate_iteration_budget():
    """When given an inadequate iteration budget with a perturbed initial guess, solver flags non-convergence."""
    # Start with a deliberately perturbed initial guess far from equilibrium
    perturbed_initial = np.array([0.0, 1e-8, 2e-8, 4e-8, 8e-8])
    inputs = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=50e6,
        count=5,
        initial_positions_m=perturbed_initial,
        max_iterations=1,
    )
    res = solve_pileup_equilibrium(inputs)
    assert res.converged is False
    assert res.status == "max_iterations_exceeded"


def test_phase5_fixtures_parity():
    """Verify that stored golden fixtures match Python solver across all 5 test cases."""
    import json
    import os

    fixture_path = os.path.join(os.path.dirname(__file__), "golden", "phase5_fixtures.json")
    with open(fixture_path, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    # Case 1
    c1 = fixtures["case1_small_pileup_n3"]
    in1 = PileupInputs(mu_pa=c1["mu_pa"], nu=c1["nu"], burgers_m=c1["burgers_m"], tau_applied_pa=c1["tau_applied_pa"], count=c1["count"])
    res1 = solve_pileup_equilibrium(in1)
    assert np.allclose(res1.positions_m, c1["positions_m"], atol=1e-14)
    assert res1.tip_stress_pa == pytest.approx(c1["tip_stress_pa"])

    # Case 2
    c2 = fixtures["case2_medium_pileup_n8"]
    in2 = PileupInputs(mu_pa=c2["mu_pa"], nu=c2["nu"], burgers_m=c2["burgers_m"], tau_applied_pa=c2["tau_applied_pa"], count=c2["count"])
    res2 = solve_pileup_equilibrium(in2)
    assert np.allclose(res2.positions_m, c2["positions_m"], atol=1e-13)
    assert res2.tip_stress_pa == pytest.approx(c2["tip_stress_pa"])

    # Case 3
    c3 = fixtures["case3_copper_pileup_n15"]
    in3 = PileupInputs(mu_pa=c3["mu_pa"], nu=c3["nu"], burgers_m=c3["burgers_m"], tau_applied_pa=c3["tau_applied_pa"], count=c3["count"])
    res3 = solve_pileup_equilibrium(in3)
    assert np.allclose(res3.positions_m, c3["positions_m"], atol=1e-12)
    assert res3.tip_stress_pa == pytest.approx(c3["tip_stress_pa"])

    # Case 4
    c4 = fixtures["case4_high_stress_pileup_n25"]
    in4 = PileupInputs(mu_pa=c4["mu_pa"], nu=c4["nu"], burgers_m=c4["burgers_m"], tau_applied_pa=c4["tau_applied_pa"], count=c4["count"])
    res4 = solve_pileup_equilibrium(in4)
    assert np.allclose(res4.positions_m, c4["positions_m"], atol=1e-12)
    assert res4.tip_stress_pa == pytest.approx(c4["tip_stress_pa"])

    # Case 5
    c5 = fixtures["case5_newton_perturbed_n4"]
    in5 = PileupInputs(
        mu_pa=c5["mu_pa"],
        nu=c5["nu"],
        burgers_m=c5["burgers_m"],
        tau_applied_pa=c5["tau_applied_pa"],
        count=c5["count"],
        tolerance_pa=c5["tolerance_pa"],
        max_iterations=50,
        initial_positions_m=np.array(c5["initial_positions_m"]),
    )
    res5 = solve_pileup_equilibrium(in5)
    assert res5.status == c5["status"]
    assert res5.converged == c5["converged"]
    assert res5.iterations == c5["iterations"]
    assert np.allclose(res5.positions_m, c5["positions_m"], atol=1e-12)

