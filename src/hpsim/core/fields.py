"""
hpsim.core.fields - Isotropic-elastic straight edge-dislocation displacement field (plane strain).

Local frame (per spec 5.4): x along the Burgers vector / glide direction, y along the slip-plane
normal, z along the dislocation line; (x, y) are measured from the core. Metres, SI.

    u_x = (b/2pi) [ theta + x*y / (2(1-nu) (r2 + rc^2)) ]
    u_y = -(b/2pi) [ (1-2nu)/(4(1-nu)) * ln((r2 + rc^2)/rc^2) + (x^2-y^2) / (4(1-nu) (r2 + rc^2)) ]
    theta = atan2(y, x),  r2 = x^2 + y^2

Core regularization: r2 -> r2 + rc^2 in the logarithmic and rational terms (rc ~ b, configurable).
theta is NOT regularized (it is bounded; it carries the Burgers jump). The log argument is divided
by rc^2 so it is dimensionless; this only adds a uniform rigid translation to u_y and does not
change strains or the Burgers circuit.

Branch cut: atan2 puts the discontinuity on the NEGATIVE local x axis (y = 0, x < 0), i.e. along the
slip plane BEHIND a core that glides in +x; crossing it from y<0 to y>0 produces a jump of +b in u_x,
the slipped region. The cut stays fixed in the local frame when the core reverses (it follows the core).
Atoms must not be placed exactly on the cut (the lattice generator keeps the slip plane midway
between atomic planes).

Burgers circuit sign: for a counter-clockwise loop in (x, y) enclosing the core, closure of du is +b
(displacement-jump / Volterra convention). Continuum visualization only - not an atomistic core.
"""
import numpy as np


def _parts(x, y, nu, rc):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    r2 = x * x + y * y + rc * rc
    theta = np.arctan2(y, x)
    sx = x * y / (2.0 * (1.0 - nu) * r2)
    sy = -((1.0 - 2.0 * nu) / (4.0 * (1.0 - nu)) * np.log(r2 / (rc * rc))
           + (x * x - y * y) / (4.0 * (1.0 - nu) * r2))
    return theta, sx, sy


def edge_displacement(x, y, b, nu, rc):
    """Return (u_x, u_y) in metres for local coordinates (x, y) in metres. Accepts scalars or arrays."""
    if rc <= 0.0:
        raise ValueError("core radius rc must be positive")
    if not (-1.0 < nu < 0.5):
        raise ValueError(f"Poisson ratio out of range: {nu}")
    theta, sx, sy = _parts(x, y, nu, rc)
    k = b / (2.0 * np.pi)
    ux, uy = k * (theta + sx), k * sy
    if np.ndim(ux) == 0:
        return float(ux), float(uy)
    return ux, uy


def circle_loop(radius, n, centre=(0.0, 0.0)):
    """Counter-clockwise closed loop sampled at n points (last point not repeated)."""
    t = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False)
    return np.column_stack([centre[0] + radius * np.cos(t), centre[1] + radius * np.sin(t)])


def burgers_circuit(loop, b, nu, rc, max_wrapped_dtheta=0.75 * np.pi):
    """Closure sum (du_x, du_y) around a closed sampled loop (theta-unwrapped method, spec V-03).

    Each segment's du uses the angle increment wrapped to (-pi, pi]; single-valued parts telescope.
    Raises ValueError if any segment subtends > max_wrapped_dtheta at the core (unwrapping ambiguous).
    """
    pts = np.asarray(loop, dtype=float)
    nxt = np.roll(pts, -1, axis=0)
    th0, sx0, sy0 = _parts(pts[:, 0], pts[:, 1], nu, rc)
    th1, sx1, sy1 = _parts(nxt[:, 0], nxt[:, 1], nu, rc)
    dth = (th1 - th0 + np.pi) % (2.0 * np.pi) - np.pi
    if np.any(np.abs(dth) > max_wrapped_dtheta):
        raise ValueError("loop too coarse (a segment subtends too large an angle at the core) to unwrap theta")
    k = b / (2.0 * np.pi)
    return float(k * np.sum(dth + (sx1 - sx0))), float(k * np.sum(sy1 - sy0))
