"""Phase 2: isotropic edge-dislocation displacement field + Burgers circuit (spec V-03)."""
import numpy as np
import pytest
from hpsim.core.fields import (
    edge_displacement,
    burgers_circuit,
    circle_loop,
)

# Synthetic, dimensionless test values (equation tests only; not material data).
B, NU, RC = 1.0, 0.3, 1.0
TOL = 1e-3  # spec V-03: 1e-3 * b


def test_far_field_decay_of_strain_is_one_over_r():
    # |du| across a small step falls ~ 1/r away from the core (excluding the cut).
    def grad_mag(r):
        h = 1e-4 * r
        p, q = (0.0, r), (h, r)
        ux1, uy1 = edge_displacement(*p, B, NU, RC)
        ux2, uy2 = edge_displacement(*q, B, NU, RC)
        return np.hypot(ux2 - ux1, uy2 - uy1) / h
    assert grad_mag(100.0) / grad_mag(1000.0) == pytest.approx(10.0, rel=0.02)


def test_branch_cut_jump_equals_b_behind_core_only():
    eps = 1e-9
    x = -5.0  # behind the core (negative x)
    ux_up, _ = edge_displacement(x, +eps, B, NU, RC)
    ux_dn, _ = edge_displacement(x, -eps, B, NU, RC)
    assert ux_up - ux_dn == pytest.approx(+B, abs=1e-6)  # theta = +pi above the cut, -pi below -> jump +b
    xa = +5.0  # ahead of the core: field is continuous across y=0
    a_up, _ = edge_displacement(xa, +eps, B, NU, RC)
    a_dn, _ = edge_displacement(xa, -eps, B, NU, RC)
    assert a_up - a_dn == pytest.approx(0.0, abs=1e-6)


def test_regularization_removes_core_singularity():
    ux, uy = edge_displacement(0.0, 1e-12, B, NU, RC)
    assert np.isfinite(ux) and np.isfinite(uy)
    # without regularisation (rc=0) the log term would diverge; with rc it stays bounded
    assert abs(uy) < 10 * B


def test_vectorised_matches_scalar():
    x = np.array([-3.0, 2.0, 7.5]); y = np.array([1.0, -2.0, 0.5])
    ux, uy = edge_displacement(x, y, B, NU, RC)
    for i in range(3):
        sx, sy = edge_displacement(float(x[i]), float(y[i]), B, NU, RC)
        assert ux[i] == pytest.approx(sx, abs=1e-14) and uy[i] == pytest.approx(sy, abs=1e-14)


@pytest.mark.parametrize("radius", [3.0, 10.0, 50.0])
@pytest.mark.parametrize("centre", [(0.0, 0.0), (0.4, -0.3)])
def test_burgers_circuit_enclosing_core_gives_b(radius, centre):
    loop = circle_loop(radius, 4000, centre=centre)
    cx, cy = burgers_circuit(loop, B, NU, RC)
    assert abs(cx - B) < TOL * B and abs(cy) < TOL * B


def test_burgers_circuit_square_loop_enclosing_core():
    pts = []
    n = 500
    for t in np.linspace(0, 1, n, endpoint=False): pts.append((-5 + 10 * t, -5))
    for t in np.linspace(0, 1, n, endpoint=False): pts.append((5, -5 + 10 * t))
    for t in np.linspace(0, 1, n, endpoint=False): pts.append((5 - 10 * t, 5))
    for t in np.linspace(0, 1, n, endpoint=False): pts.append((-5, 5 - 10 * t))
    cx, cy = burgers_circuit(np.array(pts), B, NU, RC)
    assert abs(cx - B) < TOL * B and abs(cy) < TOL * B


def test_burgers_circuit_not_enclosing_core_is_zero():
    loop = circle_loop(2.0, 2000, centre=(10.0, 3.0))
    cx, cy = burgers_circuit(loop, B, NU, RC)
    assert abs(cx) < TOL * B and abs(cy) < TOL * B


def test_burgers_circuit_clockwise_gives_minus_b():
    loop = circle_loop(5.0, 4000)[::-1]
    cx, _ = burgers_circuit(loop, B, NU, RC)
    assert abs(cx + B) < TOL * B


def test_burgers_circuit_rejects_loop_too_coarse_to_unwrap():
    coarse = circle_loop(5.0, 2)  # each segment spans pi about the core: unwrapping ambiguous
    with pytest.raises(ValueError):
        burgers_circuit(coarse, B, NU, RC)
