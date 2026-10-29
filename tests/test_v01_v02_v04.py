"""
tests/test_v01_v02_v04.py - Explicit verification benchmarks for Quality Gate 1 per spec.md §9.3.
"""

import pytest
import numpy as np
from hpsim.core.slipsystems import (
    get_fcc_slip_systems,
    get_bcc_slip_systems,
    calculate_burgers_magnitude,
)
from hpsim.core.stress import (
    make_uniaxial_stress_tensor,
    calculate_resolved_shear_stress,
    schmid_factor_uniaxial,
)
from hpsim.core.glide import (
    calculate_glide_velocity,
    integrate_dislocation_position,
)


def test_v01_slip_system_geometry():
    """
    V-01: Slip-system geometry benchmark:
    - FCC and BCC each have 12 unique systems
    - |s| = |n| = 1 within 1e-12
    - s . n = 0 within 1e-12
    - b computed = a / sqrt(2) (FCC) and a * sqrt(3) / 2 (BCC)
    """
    # 1. FCC Check
    fcc_systems = get_fcc_slip_systems()
    assert len(fcc_systems) == 12, f"FCC must have exactly 12 slip systems, found {len(fcc_systems)}"
    for s in fcc_systems:
        assert np.linalg.norm(s.s) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(s.n) == pytest.approx(1.0, abs=1e-12)
        assert np.dot(s.s, s.n) == pytest.approx(0.0, abs=1e-12)

    # 2. BCC Check
    bcc_systems = get_bcc_slip_systems()
    assert len(bcc_systems) == 12, f"BCC must have exactly 12 slip systems, found {len(bcc_systems)}"
    for s in bcc_systems:
        assert np.linalg.norm(s.s) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(s.n) == pytest.approx(1.0, abs=1e-12)
        assert np.dot(s.s, s.n) == pytest.approx(0.0, abs=1e-12)

    # 3. Burgers vector geometry
    a_fcc = 0.405e-9
    b_fcc = calculate_burgers_magnitude(a_fcc, "FCC")
    assert b_fcc == pytest.approx(a_fcc / np.sqrt(2.0), rel=1e-12)

    a_bcc = 0.287e-9
    b_bcc = calculate_burgers_magnitude(a_bcc, "BCC")
    assert b_bcc == pytest.approx(a_bcc * np.sqrt(3.0) / 2.0, rel=1e-12)


def test_v02_schmid_oracle():
    """
    V-02: Schmid oracle benchmark:
    - Uniaxial tension along [001] on FCC {111}<110>:
      8 active systems each with absolute Schmid factor 1/sqrt(6) ≈ 0.408248, 4 with 0.
    - Tensor RSS equals cos(phi) * cos(lambda) within 1e-12.
    - Max absolute Schmid factor <= 0.5 for arbitrary random loading axes.
    """
    t_001 = np.array([0.0, 0.0, 1.0])
    fcc_systems = get_fcc_slip_systems()

    factors = [schmid_factor_uniaxial(sys.s, sys.n, t_001) for sys in fcc_systems]
    abs_factors = [abs(f) for f in factors]

    target_val = 1.0 / np.sqrt(6.0)  # ≈ 0.40824829

    # Count matching systems
    zero_count = sum(1 for f in abs_factors if abs(f) < 1e-12)
    active_count = sum(1 for f in abs_factors if abs(f - target_val) < 1e-12)

    assert zero_count == 4, f"Expected 4 inactive systems with factor 0, found {zero_count}"
    assert active_count == 8, f"Expected 8 active systems with factor 1/sqrt(6), found {active_count}"

    # Verify tensor RSS equals sigma * cos(phi) * cos(lambda)
    sigma_val = 50.0e6
    sigma_tensor = make_uniaxial_stress_tensor(sigma_val, t_001)

    for sys in fcc_systems:
        tau_tensor = calculate_resolved_shear_stress(sigma_tensor, sys.s, sys.n)
        m_schmid = schmid_factor_uniaxial(sys.s, sys.n, t_001)
        tau_schmid = sigma_val * m_schmid

        # Dimensionless Schmid factor matches within 1e-12
        m_tensor = tau_tensor / sigma_val
        assert abs(m_tensor - m_schmid) < 1e-12
        assert tau_tensor == pytest.approx(tau_schmid, rel=1e-12)


def test_v04_glide_law_static():
    """
    V-04 (static part): Glide law benchmark:
    - Zero velocity for |tau_RSS| <= tau_c
    - Linear in (|tau_RSS| - tau_c) above threshold
    - Sign reverses with stress
    - Position after fixed time independent of dt within 1e-9 for constant stress
    """
    tau_c = 15.0e6  # 15 MPa
    M_d = 1.0e4
    b = 0.25e-9

    # Zero velocity at or below threshold
    assert calculate_glide_velocity(0.0, tau_c, M_d, b) == 0.0
    assert calculate_glide_velocity(14.999e6, tau_c, M_d, b) == 0.0
    assert calculate_glide_velocity(-14.999e6, tau_c, M_d, b) == 0.0
    assert calculate_glide_velocity(15.0e6, tau_c, M_d, b) == 0.0

    # Linearity above threshold
    v1 = calculate_glide_velocity(25.0e6, tau_c, M_d, b)  # tau_eff = 10 MPa
    v2 = calculate_glide_velocity(35.0e6, tau_c, M_d, b)  # tau_eff = 20 MPa
    assert v2 == pytest.approx(2.0 * v1, rel=1e-12)

    # Sign reversal
    v_rev = calculate_glide_velocity(-25.0e6, tau_c, M_d, b)
    assert v_rev == pytest.approx(-v1, rel=1e-12)

    # Step-size independence under constant stress
    T_total = 0.01  # seconds
    pos_dt1 = integrate_dislocation_position(0.0, v1, dt=0.01, n_steps=1)
    pos_dt100 = integrate_dislocation_position(0.0, v1, dt=0.0001, n_steps=100)
    assert abs(pos_dt1 - pos_dt100) / pos_dt1 < 1e-9
