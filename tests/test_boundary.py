"""
Phase 4 RED tests: Grain-boundary transmission decision core.
Tests written before implementing src/hpsim/core/boundary.py.
"""
import pytest
import numpy as np

from hpsim.core.slipsystems import get_fcc_slip_systems, calculate_burgers_magnitude
from hpsim.core.rotations import rotation_matrix_euler_zxz
from hpsim.core.stress import make_uniaxial_stress_tensor
from hpsim.core.boundary import (
    calculate_geometric_compatibility,
    calculate_residual_burgers_magnitude,
    evaluate_candidate_slip_system,
    evaluate_boundary_transmission,
    TransmissionThresholds,
    CandidateEvaluation,
    TransmissionResult,
)

A_FCC = 4.0495e-10  # m
B_FCC = calculate_burgers_magnitude(A_FCC, "FCC")
FCC_SYSTEMS = get_fcc_slip_systems()


def test_geometric_compatibility_bounds_and_identical():
    """m' in [0, 1]. For identical vectors, m' = 1."""
    s1 = np.array([1.0, 0.0, 0.0])
    n1 = np.array([0.0, 1.0, 0.0])
    assert calculate_geometric_compatibility(s1, n1, s1, n1) == pytest.approx(1.0, abs=1e-12)

    # Orthogonal slip directions
    s2 = np.array([0.0, 0.0, 1.0])
    n2 = np.array([0.0, 1.0, 0.0])
    assert calculate_geometric_compatibility(s1, n1, s2, n2) == pytest.approx(0.0, abs=1e-12)

    # General random unit vectors
    rng = np.random.default_rng(42)
    for _ in range(50):
        v = rng.standard_normal((4, 3))
        s_in = v[0] / np.linalg.norm(v[0])
        n_in = v[1] / np.linalg.norm(v[1])
        s_out = v[2] / np.linalg.norm(v[2])
        n_out = v[3] / np.linalg.norm(v[3])
        mp = calculate_geometric_compatibility(s_in, n_in, s_out, n_out)
        assert 0.0 <= mp <= 1.0 + 1e-12


def test_residual_burgers_sign_invariance():
    """Residual Burgers magnitude is min(||b_in - b_out||, ||b_in + b_out||)."""
    b_in = np.array([B_FCC, 0.0, 0.0])
    b_out_same = np.array([B_FCC, 0.0, 0.0])
    b_out_opp = np.array([-B_FCC, 0.0, 0.0])

    assert calculate_residual_burgers_magnitude(b_in, b_out_same) == pytest.approx(0.0, abs=1e-15)
    assert calculate_residual_burgers_magnitude(b_in, b_out_opp) == pytest.approx(0.0, abs=1e-15)

    # Orthogonal burgers vectors: ||b_in - b_out|| = sqrt(2)*b, ||b_in + b_out|| = sqrt(2)*b
    b_out_ortho = np.array([0.0, B_FCC, 0.0])
    assert calculate_residual_burgers_magnitude(b_in, b_out_ortho) == pytest.approx(np.sqrt(2.0) * B_FCC, rel=1e-12)


def test_identical_orientations_produces_perfect_match():
    """Identical orientations (R_in = R_out = I): candidate 0 matches system 0 with m'=1, |b_r|=0."""
    R_in = np.eye(3)
    R_out = np.eye(3)
    sigma = make_uniaxial_stress_tensor(50e6, [0.0, 0.0, 1.0])

    # Illustrative thresholds
    thresholds = TransmissionThresholds(
        m_prime_min=0.5,
        tau_c_pa=5.0e6,
        tau_star_ref_pa=10.0e6,  # illustrative test fixture
        beta=0.0,
    )

    res = evaluate_boundary_transmission(
        incoming_system_index=0,
        R_in=R_in,
        R_out=R_out,
        b_magnitude_m=B_FCC,
        sigma_specimen=sigma,
        tau_tip_pa=20.0e6,
        thresholds=thresholds,
    )

    assert res.outcome == "transmitted"
    assert res.selected_candidate is not None
    assert res.selected_candidate.system_index == 0
    assert res.selected_candidate.m_prime == pytest.approx(1.0, abs=1e-12)
    assert res.selected_candidate.residual_b_m == pytest.approx(0.0, abs=1e-15)
    assert res.selected_candidate.passed_all is True


def test_deliberate_misorientation_analytical_compatibility():
    """Rotate grain 2 by 90 deg around z: x -> y, y -> -x, z -> z."""
    R_in = np.eye(3)
    # 90 deg rotation about z: phi1=pi/2, Phi=0, phi2=0
    R_out = rotation_matrix_euler_zxz(np.pi / 2, 0.0, 0.0)

    # System 0: (1 1 1) [0 1 -1]
    # s_in = [0, 1, -1] / sqrt(2)
    # In grain 2 rotated by 90 deg about z:
    # R_out transforms crystal vectors v_c to v_s = R_out @ v_c
    # R_out = [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
    sigma = make_uniaxial_stress_tensor(50e6, [0.0, 0.0, 1.0])
    thresholds = TransmissionThresholds(
        m_prime_min=0.2,
        tau_c_pa=1.0e6,
        tau_star_ref_pa=10.0e6,
        beta=0.0,
    )

    res = evaluate_boundary_transmission(
        incoming_system_index=0,
        R_in=R_in,
        R_out=R_out,
        b_magnitude_m=B_FCC,
        sigma_specimen=sigma,
        tau_tip_pa=25.0e6,
        thresholds=thresholds,
    )

    assert len(res.candidates) == 12
    # Verify candidate m' are all in [0, 1]
    for cand in res.candidates:
        assert 0.0 <= cand.m_prime <= 1.0 + 1e-12


def test_independent_rejection_criteria():
    """Each criterion independently causes rejection when violated."""
    R_in = np.eye(3)
    R_out = np.eye(3)
    sigma = make_uniaxial_stress_tensor(50e6, [0.0, 0.0, 1.0])

    # 1. Reject on m_prime_min: require m' >= 1.1 (impossible)
    t_mprime = TransmissionThresholds(m_prime_min=1.1, tau_c_pa=1.0e6, tau_star_ref_pa=10.0e6, beta=0.0)
    res1 = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 20.0e6, t_mprime)
    assert res1.outcome == "pinned"
    assert res1.selected_candidate is None
    for c in res1.candidates:
        assert c.passed_m_prime is False

    # 2. Reject on tau_out < tau_c: set tau_c very high (1000 MPa)
    t_tauc = TransmissionThresholds(m_prime_min=0.5, tau_c_pa=1000.0e6, tau_star_ref_pa=10.0e6, beta=0.0)
    res2 = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 20.0e6, t_tauc)
    assert res2.outcome == "pinned"
    assert all(c.passed_tau_out is False for c in res2.candidates)

    # 3. Reject on tau_tip < tau_star: tau_tip = 5 MPa, tau_star_ref = 50 MPa
    t_taustar = TransmissionThresholds(m_prime_min=0.5, tau_c_pa=1.0e6, tau_star_ref_pa=50.0e6, beta=0.0)
    res3 = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 5.0e6, t_taustar)
    assert res3.outcome == "pinned"
    assert all(c.passed_tau_tip is False for c in res3.candidates)


def test_unresolved_tau_star_produces_unresolved_threshold_state():
    """When tau_star_ref is None (M6 unresolved), outcome is 'unresolved_threshold', not 'pinned'."""
    R_in = np.eye(3)
    R_out = np.eye(3)
    sigma = make_uniaxial_stress_tensor(50e6, [0.0, 0.0, 1.0])

    t_unresolved = TransmissionThresholds(
        m_prime_min=0.5,
        tau_c_pa=1.0e6,
        tau_star_ref_pa=None,  # Unresolved M6 parameter
        beta=0.0,
    )

    res = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 20.0e6, t_unresolved)
    assert res.outcome == "unresolved_threshold"
    assert "tau_star_ref is unresolved" in res.summary_log
    assert res.selected_candidate is None
    # Individual candidates indicate tau_tip check was unresolved
    for c in res.candidates:
        assert c.passed_tau_tip is None


def test_deterministic_ranking_and_tie_breaking():
    """
    Selection order per spec 5.5:
    1. Highest m'
    2. Smallest |b_r|
    3. Highest tau_out
    4. Lowest slip-system index
    """
    R_in = np.eye(3)
    R_out = np.eye(3)
    sigma = make_uniaxial_stress_tensor(50e6, [0.0, 0.0, 1.0])

    thresholds = TransmissionThresholds(
        m_prime_min=0.1,
        tau_c_pa=1.0e6,
        tau_star_ref_pa=5.0e6,
        beta=0.0,
    )

    res = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 25.0e6, thresholds)
    assert res.outcome == "transmitted"
    # System 0 has m' = 1.0, |b_r| = 0.0, which beats all others
    assert res.selected_candidate.system_index == 0


def test_no_acceptable_candidates_returns_pinned_with_logs():
    """When no candidate passes, outcome is 'pinned' and reason log explains why."""
    R_in = np.eye(3)
    R_out = np.eye(3)
    # Zero applied stress -> tau_out = 0 on all systems, fails tau_out >= tau_c
    sigma = np.zeros((3, 3))
    thresholds = TransmissionThresholds(m_prime_min=0.5, tau_c_pa=5.0e6, tau_star_ref_pa=10.0e6, beta=0.0)

    res = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 15.0e6, thresholds)
    assert res.outcome == "pinned"
    assert res.selected_candidate is None
    assert "No candidate slip system satisfied all transmission criteria" in res.summary_log


def test_outgoing_rss_from_full_tensor():
    """Outgoing RSS is computed from full stress tensor and transforms with grain orientation."""
    R_in = np.eye(3)
    R_out = rotation_matrix_euler_zxz(np.pi / 2, 0.0, 0.0)
    sigma = make_uniaxial_stress_tensor(40e6, [0.0, 0.0, 1.0])

    thresholds = TransmissionThresholds(
        m_prime_min=0.0,
        tau_c_pa=1.0e6,
        tau_star_ref_pa=10.0e6,
        beta=0.0,
    )

    res = evaluate_boundary_transmission(0, R_in, R_out, B_FCC, sigma, 20.0e6, thresholds)
    assert len(res.candidates) == 12
    for c in res.candidates:
        assert c.tau_out_pa >= 0.0
        # For uniaxial stress along z of 40 MPa, Schmid factor <= 0.5 -> max RSS <= 20 MPa
        assert c.tau_out_pa <= 20.0e6 + 1e-6

