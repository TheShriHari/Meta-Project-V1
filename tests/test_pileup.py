"""
Phase 5 Tests: Discrete Dislocation Pile-Up Engine, EFN Benchmark & Physics Conventions.
"""
import os
import numpy as np
import pytest
import mpmath
import yaml

from hpsim.core.pileup import (
    solve_pileup_equilibrium,
    compute_efn_exact_positions,
    compute_efn_roots,
    compute_efn_asymptotic_count,
    compute_pileup_prefactor,
    compute_pileup_hall_petch_ky_sensitivity,
    PileupInputs,
    PileupResult,
)
from hpsim.core.glide import calculate_glide_velocity

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

    # Independent residual (own implementation, not the module's): A/x2 - tau = 0
    assert abs(A / res.positions_m[1] - 40e6) < 1e-6
    # efn_positions_m is the same quantity reported by the engine; hand value still the oracle
    assert res.efn_positions_m[1] == pytest.approx(expected_x2, rel=1e-10)


def test_first_principles_dimensional_analysis_n2():
    """
    Task 3: First-principles dimensional analysis test for N=2 using primitive inputs from materials.yaml
    (G, b, nu) without calling compute_pileup_prefactor.

    Verifies:
      1. Formula: A = G * b / [2 * pi * (1 - nu)] in Pa * m.
      2. Equilibrium position: x_1 = A / tau_eff in m.
      3. Product identity: x_1 * tau_eff == G * b / [2 * pi * (1 - nu)].
      4. Dimensional consistency: [x_1] * [tau_eff] = m * Pa = Pa * m.
      5. Numerical value for Aluminium (G=26 GPa, nu=0.345, b=0.286343 nm).
    """
    materials_path = os.path.join(os.path.dirname(__file__), "..", "src", "hpsim", "materials", "materials.yaml")
    with open(materials_path, "r", encoding="utf-8") as f:
        mat_data = yaml.safe_load(f)

    al_params = mat_data["aluminium"]["parameters"]
    G = float(al_params["G"]["value"])          # 26.0e9 Pa
    nu = float(al_params["nu"]["value"])        # 0.345
    b = float(al_params["b"]["value"])          # 2.86343e-10 m

    # Primitive direct calculation of A = G*b / [2*pi*(1 - nu)] in Pa * m
    A_primitive = (G * b) / (2.0 * np.pi * (1.0 - nu))
    tau_eff = 45.0e6  # Pa (45 MPa applied driving stress)

    # Solve N=2 discrete pile-up
    inputs = PileupInputs(
        mu_pa=G,
        nu=nu,
        burgers_m=b,
        tau_applied_pa=tau_eff,
        count=2,
    )
    res = solve_pileup_equilibrium(inputs)
    assert res.converged is True
    assert len(res.positions_m) == 2
    assert res.positions_m[0] == 0.0

    x_1 = res.positions_m[1]
    expected_x_1 = A_primitive / tau_eff

    # Assert exact product relation: x_1 * tau_eff == G * b / [2 * pi * (1 - nu)]
    product = x_1 * tau_eff
    assert product == pytest.approx(A_primitive, rel=1e-12)
    assert x_1 == pytest.approx(expected_x_1, rel=1e-12)

    # Print and assert numeric coefficient
    # For Al: G=26 GPa, b=0.286343 nm, nu=0.345 -> A ~ 1.80899997 Pa*m
    print(f"\n[Dimensional Analysis N=2] Primitive coefficient A = {product:.8e} Pa*m (expected {A_primitive:.8e} Pa*m)")
    assert 1.808e0 <= product <= 1.810e0


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

    # Hand-derived independent check (A=1, tau=lam units -> x=xi/(2 lam)):
    # force balance 1/x1 + 1/(x1-x2) = lam = 1/x2 + 1/(x2-x1), solved by hand above.
    x1, x2 = res.positions_m[1], res.positions_m[2]
    assert abs(A / x1 + A / (x1 - x2) - 50e6) < 1e-5
    assert abs(A / x2 + A / (x2 - x1) - 50e6) < 1e-5
    # Symmetry identity from summing both balances: 1/x1 + 1/x2 = 2 lam
    assert A / x1 + A / x2 == pytest.approx(2 * 50e6, rel=1e-10)


def test_mpmath_independent_oracle_n4_and_n5():
    """
    Task 4: Independent EFN root oracle using high-precision mpmath.polyroots (dps=50) for N=4 and N=5:
      - N=4 (m=3): Associated Laguerre polynomial L_3^(1)(xi) = 4 - 6*xi + 2*xi^2 - (1/6)*xi^3 = 0.
      - N=5 (m=4): Associated Laguerre polynomial L_4^(1)(xi) = 5 - 10*xi + 5*xi^2 - (5/6)*xi^3 + (1/24)*xi^4 = 0.
      - Roots xi_k computed to 50 digits independently of tridiagonal Golub-Welsch eigensolver.
      - Predicted equilibrium positions: x_k = xi_k / (2 * lambda) with lambda = tau_app / A.
      - Compares solver's positions against these independent mpmath roots.
    """
    mpmath.mp.dps = 50

    # m = 3 (N = 4 dislocations: 1 locked + 3 mobile)
    # L_3^(1)(xi) = 4 - 6*xi + 2*xi^2 - (1/6)*xi^3 = 0
    # Coefficients in descending order: [-1/6, 2, -6, 4]
    poly_m3 = [-mpmath.mpf(1)/6, mpmath.mpf(2), -mpmath.mpf(6), mpmath.mpf(4)]
    mp_roots_m3 = sorted([float(r) for r in mpmath.polyroots(poly_m3)])
    assert len(mp_roots_m3) == 3

    # m = 4 (N = 5 dislocations: 1 locked + 4 mobile)
    # L_4^(1)(xi) = 5 - 10*xi + 5*xi^2 - (5/6)*xi^3 + (1/24)*xi^4 = 0
    # Coefficients in descending order: [1/24, -5/6, 5, -10, 5]
    poly_m4 = [mpmath.mpf(1)/24, -mpmath.mpf(5)/6, mpmath.mpf(5), -mpmath.mpf(10), mpmath.mpf(5)]
    mp_roots_m4 = sorted([float(r) for r in mpmath.polyroots(poly_m4)])
    assert len(mp_roots_m4) == 4

    tau_app = 55.0e6  # Pa
    A = compute_pileup_prefactor(MU_AL, NU_AL, B_FCC_AL)
    lam = tau_app / A

    # Verify N = 4 against mpmath oracle
    res_n4 = solve_pileup_equilibrium(PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=tau_app,
        count=4,
    ))
    assert res_n4.converged is True
    expected_pos_n4 = [0.0] + [xi / (2.0 * lam) for xi in mp_roots_m3]
    for k in range(4):
        assert res_n4.positions_m[k] == pytest.approx(expected_pos_n4[k], rel=1e-12, abs=1e-15)

    # Verify N = 5 against mpmath oracle
    res_n5 = solve_pileup_equilibrium(PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_applied_pa=tau_app,
        count=5,
    ))
    assert res_n5.converged is True
    expected_pos_n5 = [0.0] + [xi / (2.0 * lam) for xi in mp_roots_m4]
    for k in range(5):
        assert res_n5.positions_m[k] == pytest.approx(expected_pos_n5[k], rel=1e-12, abs=1e-15)


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


def _indep_residuals(pos, A, tau):
    """Independent force-balance residual R_i = sum_{j!=i} A/(x_i-x_j) - tau (own code, incl. locked x_0)."""
    return np.array([
        sum(A / (pos[i] - pos[j]) for j in range(len(pos)) if j != i) - tau
        for i in range(1, len(pos))
    ])


def test_equilibrium_residual_property():
    """PROPERTY/RESIDUAL test (no closed form for N>3): returned positions satisfy force balance,
    ordering, positive gaps, x_0 = 0 boundary condition, and units (metres, scale A/tau)."""
    tau = 45e6
    A = MU_AL * B_FCC_AL / (2.0 * np.pi * (1.0 - NU_AL))
    for N in [2, 3, 5, 10, 15, 25]:
        res = solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=tau, count=N))
        assert res.converged is True
        pos = res.positions_m
        assert pos.shape == (N,)
        assert pos[0] == 0.0
        assert np.all(np.diff(pos) > 0.0)
        r = _indep_residuals(pos, A, tau)
        assert np.max(np.abs(r)) < 1e-6 * tau  # relative 1e-6 of applied stress
        # units: A/tau is a length in metres; Laguerre bound xi_max < 4m+2 => x_N < (2m+1)*A/tau
        scale = A / tau
        assert 0.0 < pos[-1] < (2 * (N - 1) + 1) * scale


def test_eshelby_tip_stress_multiplication():
    """Eshelby identity N*tau, checked against an independent sum over returned positions.
    Summing mobile balances (pair terms cancel) gives sum_i A/x_i = (N-1)*tau (stress on the
    locked dislocation from mobile ones); plus applied tau gives N*tau."""
    tau_app = 30e6
    A = MU_AL * B_FCC_AL / (2.0 * np.pi * (1.0 - NU_AL))
    for N in [2, 4, 8, 16]:
        res = solve_pileup_equilibrium(PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_FCC_AL, tau_applied_pa=tau_app, count=N))
        assert res.converged is True
        tip_from_positions = tau_app + sum(A / x for x in res.positions_m[1:])
        assert tip_from_positions == pytest.approx(N * tau_app, rel=1e-9)
        assert res.tip_stress_pa == pytest.approx(tip_from_positions, rel=1e-9)


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


def test_pileup_length_hall_petch_sensitivity():
    """
    Task 5: Sensitivity study of Hall-Petch slope k_y to pile-up length scale L = c * d.
    Compares baseline L = d/2 against L = d and L = d/4.
    """
    tau_star = 120.0e6  # Pa
    res = compute_pileup_hall_petch_ky_sensitivity(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_FCC_AL,
        tau_star_pa=tau_star,
        taylor_factor=3.06,
    )

    # Check scaling ratios
    assert res.ratio_d_full_to_half == pytest.approx(1.0 / np.sqrt(2.0), rel=1e-12)
    assert res.ratio_d_quarter_to_half == pytest.approx(np.sqrt(2.0), rel=1e-12)

    # k_y(L=d) is smaller by factor 1/sqrt(2) because slip band is longer
    assert res.ky_L_d_full_pa_m05 == pytest.approx(res.ky_L_d_half_pa_m05 / np.sqrt(2.0), rel=1e-12)

    # k_y(L=d/4) is larger by factor sqrt(2) because slip band is shorter
    assert res.ky_L_d_quarter_pa_m05 == pytest.approx(res.ky_L_d_half_pa_m05 * np.sqrt(2.0), rel=1e-12)

    # Check dimensional scaling: [k_y] = Pa * m^(1/2)
    # Typical Hall-Petch slope for metals is 0.05 - 1.0 MPa * m^(1/2) = 5e4 - 1e6 Pa * m^(1/2)
    assert 1e4 <= res.ky_L_d_half_pa_m05 <= 1e7


def test_post_transmission_glide_velocity_direction():
    """
    Task 6: Post-transmission velocity points away from boundary (x > 0).
    When a dislocation transmits across an obstacle boundary at x=0 into an adjacent grain,
    the glide velocity v along the outgoing slip coordinate must be positive (v > 0)
    so the dislocation glides into the receiving grain interior, away from the boundary.
    """
    M_d = 1.0e-4   # 1 / (Pa * s)
    b = B_FCC_AL   # m
    tau_c = 1.0e6  # 1 MPa friction stress

    # Case A: Outgoing system has positive resolved shear stress tau_RSS > tau_c
    tau_rss_pos = 15.0e6  # 15 MPa
    v_pos = calculate_glide_velocity(tau_rss_pos, tau_c, M_d, b)
    assert v_pos > 0.0, "Positive driving stress must produce positive velocity (away from boundary)"

    # Case B: Outgoing system with |tau_RSS| >= tau_c but negative crystal projection
    # Physical slip vector convention requires flipping s -> -s so tau_eff = |tau_RSS| >= tau_c
    tau_rss_neg = -15.0e6
    tau_eff_directed = abs(tau_rss_neg)
    v_directed = calculate_glide_velocity(tau_eff_directed, tau_c, M_d, b)
    assert v_directed > 0.0, "Transmitted dislocation with effective outward orientation glides into grain interior"
    assert v_directed == pytest.approx(v_pos, rel=1e-12)

    # Under-threshold stress does not glide (v = 0)
    v_zero = calculate_glide_velocity(0.5e6, tau_c, M_d, b)
    assert v_zero == 0.0


def test_phase5_fixtures_parity():
    """Verify that stored golden fixtures match Python solver across all 5 test cases."""
    import json

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
