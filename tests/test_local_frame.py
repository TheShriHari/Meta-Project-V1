"""Phase 2/3 review: local-frame handedness and sign-convention consistency (written BEFORE the fix).

Intended convention (Hirth & Lothe style, right-handed local frame):
  x = s (slip direction = Burgers direction), y = n (slip-plane normal), z = xi = s x n (line direction),
  so (x, y, z) is right-handed.  Burgers vector b = +|b| s.  Burgers circuit: b = closed integral of du
  around a loop that is RIGHT-HANDED about xi (counter-clockwise in (x, y) seen from +z).
  Peach-Koehler force on the line F = (sigma . b) x xi  must give  F . s = |b| tau_RSS  (tau>0 -> +s).
Synthetic stresses/lattice values only.
"""
import numpy as np
import pytest
from hpsim.core.slipsystems import get_fcc_slip_systems
from hpsim.core.stress import make_uniaxial_stress_tensor, calculate_resolved_shear_stress
from hpsim.core.fields import burgers_circuit, edge_displacement
from hpsim.core.dislocation import (
    local_frame, to_local, from_local, make_geometry, displaced_positions,
)

SYSTEMS = get_fcc_slip_systems()
B, NU, RC = 1.0, 0.3, 1.0


@pytest.mark.parametrize("sy", SYSTEMS, ids=lambda s: f"sys{s.index}")
def test_local_frame_orthonormal_right_handed(sy):
    R = local_frame(sy.s, sy.n)                      # rows: x=s, y=n, z=xi (expressed in crystal frame)
    assert np.allclose(R @ R.T, np.eye(3), atol=1e-12)
    assert np.linalg.det(R) == pytest.approx(1.0, abs=1e-12)
    xi = R[2]
    assert np.allclose(xi, np.cross(sy.s, sy.n), atol=1e-12)
    assert abs(xi @ sy.s) < 1e-12 and abs(xi @ sy.n) < 1e-12   # line perpendicular to b and n


def test_old_documented_frame_was_left_handed():
    """Regression guard: (s, n, n x s) has det -1 for every system, so it must never be the local frame."""
    for sy in SYSTEMS:
        assert np.linalg.det(np.array([sy.s, sy.n, np.cross(sy.n, sy.s)])) == pytest.approx(-1.0, abs=1e-12)


@pytest.mark.parametrize("sy", SYSTEMS, ids=lambda s: f"sys{s.index}")
def test_transform_roundtrip_and_axes(sy):
    R = local_frame(sy.s, sy.n)
    v = np.array([0.3, -1.2, 0.7])
    assert np.allclose(from_local(to_local(v, R), R), v, atol=1e-14)
    assert np.allclose(to_local(sy.s, R), [1, 0, 0], atol=1e-12)
    assert np.allclose(to_local(sy.n, R), [0, 1, 0], atol=1e-12)


@pytest.mark.parametrize("sign", [+1.0, -1.0])
@pytest.mark.parametrize("sy", SYSTEMS, ids=lambda s: f"sys{s.index}")
def test_peach_koehler_matches_rss_sign_and_glide_direction(sy, sign):
    """Independent physics oracle: F = (sigma b) x xi, F.s == |b| tau_RSS, F along the glide plane."""
    sigma = make_uniaxial_stress_tensor(sign * 40e6, [0.2, 0.3, 1.0])
    b = 2.86e-10
    tau = calculate_resolved_shear_stress(sigma, sy.s, sy.n)
    xi = np.cross(sy.s, sy.n)
    F = np.cross(sigma @ (b * np.asarray(sy.s)), xi)
    assert F @ np.asarray(sy.s) == pytest.approx(b * tau, rel=1e-12, abs=1e-30)
    # glide force has no component out of the slip plane along the line; climb force is separate (along n)
    assert abs(F @ xi) < 1e-12 * max(abs(b * tau), 1e-30) + 1e-30


@pytest.mark.parametrize("idx", [0, 4, 7, 11])
def test_burgers_closure_sign_right_handed_about_xi(idx):
    """A loop built right-handed about xi from cross products closes on +b*s (declared convention)."""
    sy = SYSTEMS[idx]
    R = local_frame(sy.s, sy.n); xi = R[2]
    e1 = np.cross(xi, [0.37, 0.11, 0.93]); e1 /= np.linalg.norm(e1)   # arbitrary direction perpendicular to xi
    e2 = np.cross(xi, e1)                                               # (e1, e2, xi) right-handed
    phi = np.linspace(0, 2 * np.pi, 4000, endpoint=False)
    rho = 5.0
    pts3 = np.outer(np.cos(phi), e1) * rho + np.outer(np.sin(phi), e2) * rho
    loc = np.array([to_local(p, R) for p in pts3])                      # local (x, y, z); z must be 0
    assert np.allclose(loc[:, 2], 0, atol=1e-12)
    cx, cy = burgers_circuit(loc[:, :2], B, NU, RC)
    assert cx == pytest.approx(B, abs=1e-3 * B) and abs(cy) < 1e-3 * B
    assert np.allclose(from_local([cx, cy, 0.0], R), B * np.asarray(sy.s), atol=1e-3 * B)
    # opposite sense (left-handed about xi) closes on -b
    cx2, _ = burgers_circuit(loc[::-1, :2], B, NU, RC)
    assert cx2 == pytest.approx(-B, abs=1e-3 * B)


@pytest.mark.parametrize("idx", [0, 5, 9])
@pytest.mark.parametrize("pos", [-0.3, 0.0, 0.4])
def test_branch_cut_jump_vector_is_plus_b_s_behind_core(idx, pos):
    """3D check: crossing the slip plane (n-side minus opposite side) behind the core gives +b s."""
    sy = SYSTEMS[idx]; a = 1.0
    g = make_geometry(sy.s, sy.n, a, (4 * a, 4 * a, 4 * a))
    b = a / np.sqrt(2)
    behind = g.p0 + (pos - 1.5) * np.asarray(sy.s)
    eps = 1e-9
    up = displaced_positions((behind + eps * np.asarray(sy.n))[None, :], g, pos, b, NU, b)[0] - (behind + eps * np.asarray(sy.n))
    dn = displaced_positions((behind - eps * np.asarray(sy.n))[None, :], g, pos, b, NU, b)[0] - (behind - eps * np.asarray(sy.n))
    assert np.allclose(up - dn, b * np.asarray(sy.s), atol=1e-6 * b)
    ahead = g.p0 + (pos + 1.5) * np.asarray(sy.s)
    upa = displaced_positions((ahead + eps * np.asarray(sy.n))[None, :], g, pos, b, NU, b)[0] - (ahead + eps * np.asarray(sy.n))
    dna = displaced_positions((ahead - eps * np.asarray(sy.n))[None, :], g, pos, b, NU, b)[0] - (ahead - eps * np.asarray(sy.n))
    assert np.allclose(upa - dna, 0, atol=1e-6 * b)


def test_log_regularization_differs_from_spec_only_by_a_constant():
    """Spec: ln(r^2 + rc^2).  Ours: ln((r^2 + rc^2)/rc^2).  u_y must differ by one spatially constant."""
    rng = np.random.default_rng(7)
    for rc, b, nu in [(2.0e-10, 2.0e-10, 0.33), (1.0, 1.0, 0.3), (3.0e-10, 2.86e-10, 0.345)]:
        x = rng.uniform(-50 * rc, 50 * rc, 400); y = rng.uniform(-50 * rc, 50 * rc, 400)
        _, uy = edge_displacement(x, y, b, nu, rc)
        r2 = x * x + y * y + rc * rc
        uy_spec = -(b / (2 * np.pi)) * ((1 - 2 * nu) / (4 * (1 - nu)) * np.log(r2) + (x * x - y * y) / (4 * (1 - nu) * r2))
        diff = uy - uy_spec
        expected = (b / (2 * np.pi)) * (1 - 2 * nu) / (4 * (1 - nu)) * np.log(rc * rc)
        assert diff.max() - diff.min() < 1e-12 * b                    # spatially constant
        assert np.allclose(diff, expected, rtol=0, atol=1e-12 * b)    # equals the analytic constant
