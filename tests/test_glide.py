"""
tests/test_glide.py - Single-dislocation overdamped glide kinetics tests for HPSim.
"""

import pytest
from hpsim.core.glide import (
    calculate_glide_velocity,
    integrate_dislocation_position,
)


def test_glide_velocity_threshold():
    # Parameters: mobility M_d = 1e4 1/(Pa*s), b = 0.286 nm, tau_c = 10.0 MPa
    M_d = 1.0e4
    b = 0.286e-9
    tau_c = 10.0e6  # Pa

    # Below threshold -> velocity exactly 0
    assert calculate_glide_velocity(tau_rss=5.0e6, tau_c=tau_c, M_d=M_d, b=b) == 0.0
    assert calculate_glide_velocity(tau_rss=-5.0e6, tau_c=tau_c, M_d=M_d, b=b) == 0.0

    # Exactly at threshold -> velocity exactly 0
    assert calculate_glide_velocity(tau_rss=10.0e6, tau_c=tau_c, M_d=M_d, b=b) == 0.0
    assert calculate_glide_velocity(tau_rss=-10.0e6, tau_c=tau_c, M_d=M_d, b=b) == 0.0

    # Above threshold -> linear growth in effective stress
    # tau_eff = 15 MPa - 10 MPa = 5 MPa
    # v = 1e4 * 0.286e-9 * 1 * 5e6 = 14.3 m/s
    v_pos = calculate_glide_velocity(tau_rss=15.0e6, tau_c=tau_c, M_d=M_d, b=b)
    expected_v = M_d * b * (15.0e6 - tau_c)
    assert v_pos == pytest.approx(expected_v)

    # Sign reversal
    v_neg = calculate_glide_velocity(tau_rss=-15.0e6, tau_c=tau_c, M_d=M_d, b=b)
    assert v_neg == pytest.approx(-expected_v)


def test_discretization_independence_for_constant_stress():
    # Under constant driving stress, displacement over total time interval T
    # must be identical regardless of whether it is taken in 1 step, 10 steps, or 1000 steps.
    v = 12.5  # m/s
    total_time = 1.0e-3  # 1 ms

    expected_disp = v * total_time

    # 1 large step
    x1 = integrate_dislocation_position(pos_0=0.0, velocity=v, dt=total_time, n_steps=1)
    assert x1 == pytest.approx(expected_disp, rel=1e-12)

    # 100 small steps
    x100 = integrate_dislocation_position(pos_0=0.0, velocity=v, dt=total_time / 100.0, n_steps=100)
    assert x100 == pytest.approx(expected_disp, rel=1e-12)

    # Discretization independence check within 1e-9 relative
    assert abs(x1 - x100) / expected_disp < 1e-9
