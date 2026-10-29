"""Phase 3: fixed-step single-dislocation glide controller reference (no pinning, no grain boundaries).

All numeric parameters are synthetic equation-test fixtures, not material properties.
"""
import pytest
from hpsim.core.simulation import GlideParams, SimState, advance_step, run_trajectory

P = GlideParams(b_m=2.0e-10, tau_c_pa=5.0e6, M_d=1.0e4, dt_s=1.0e-13,
                domain_min_m=-1.0e-9, domain_max_m=1.0e-9, max_step_m=5.0e-11)
S0 = SimState(step=0, t_s=0.0, pos_m=0.0)


def test_below_and_at_threshold_zero_velocity():
    for tau in (0.0, 4.9e6, 5.0e6, -5.0e6):
        s = advance_step(S0, tau, P)
        assert s.velocity_mps == 0.0 and s.pos_m == 0.0 and s.status == "below_threshold"


def test_linear_in_excess_stress():
    v1 = advance_step(S0, 6.0e6, P).velocity_mps
    v2 = advance_step(S0, 8.0e6, P).velocity_mps
    v3 = advance_step(S0, 11.0e6, P).velocity_mps
    assert v2 / v1 == pytest.approx(3.0, rel=1e-12)
    assert v3 / v1 == pytest.approx(6.0, rel=1e-12)
    assert v1 == pytest.approx(P.M_d * P.b_m * 1.0e6, rel=1e-12)


def test_stress_reversal_reverses_velocity():
    f = advance_step(S0, 9.0e6, P); r = advance_step(S0, -9.0e6, P)
    assert f.velocity_mps > 0 and r.velocity_mps == pytest.approx(-f.velocity_mps, rel=1e-14)
    assert r.pos_m < 0


def test_deterministic_trajectory():
    taus = [9.0e6] * 50 + [-9.0e6] * 30
    assert run_trajectory(S0, taus, P) == run_trajectory(S0, taus, P)


def test_time_advances_by_fixed_dt():
    traj = run_trajectory(S0, [9.0e6] * 10, P)
    assert traj[-1].step == 10 and traj[-1].t_s == pytest.approx(10 * P.dt_s, rel=1e-14)


def test_large_step_cannot_skip_boundary():
    big = GlideParams(**{**P.__dict__, "dt_s": 1.0})  # absurd step: proposed displacement >> domain
    s = advance_step(S0, 9.0e6, big)
    assert s.pos_m == big.domain_max_m and s.status == "at_domain_limit" and s.step_limited
    s2 = advance_step(S0, -9.0e6, big)
    assert s2.pos_m == big.domain_min_m


def test_stops_at_limit_without_wrap_then_can_reverse():
    traj = run_trajectory(S0, [9.0e6] * 2000, P)
    assert traj[-1].pos_m == P.domain_max_m and max(s.pos_m for s in traj) <= P.domain_max_m
    back = advance_step(traj[-1], -9.0e6, P)
    assert back.pos_m < P.domain_max_m


def test_constant_stress_displacement_independent_of_dt():
    T = 1.0e-11
    ends = []
    for n in (10, 100, 1000):
        p = GlideParams(**{**P.__dict__, "dt_s": T / n, "max_step_m": 1.0})
        ends.append(run_trajectory(S0, [6.0e6] * n, p)[-1].pos_m)
    assert ends[0] == pytest.approx(ends[2], rel=1e-9) and ends[1] == pytest.approx(ends[2], rel=1e-9)
