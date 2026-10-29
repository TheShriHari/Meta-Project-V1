"""
hpsim.core.dislocation - Dislocation local coordinate frames, geometry, and displaced positions.

Coordinate convention (Right-handed local frame):
  x: slip direction s (Burgers vector direction)
  y: slip plane normal n
  z: dislocation line direction xi = s x n

With this definition:
  det([s, n, xi]) = det([s, n, s x n]) = +1 (strictly right-handed and orthonormal).
  Burgers vector b = |b| * s.
  A counter-clockwise circuit in (x, y) around +z (xi) yields closure +b * s.
  Peach-Koehler force F = (sigma @ b) x xi satisfies F . s = |b| * tau_RSS.
"""
from dataclasses import dataclass
from typing import Tuple, Union
import numpy as np

from hpsim.core.fields import edge_displacement


def local_frame(s: Union[np.ndarray, list], n: Union[np.ndarray, list]) -> np.ndarray:
    """
    Construct the 3x3 orthonormal crystal-to-local rotation matrix R_local.
    
    Rows of R_local are the unit base vectors of the local frame expressed in crystal coordinates:
      row 0: x = s (slip direction)
      row 1: y = n (slip plane normal)
      row 2: z = xi = s x n (dislocation line direction)
      
    Transformations:
      v_local = R_local @ v_crystal
      v_crystal = R_local.T @ v_local
    """
    s_arr = np.asarray(s, dtype=float)
    n_arr = np.asarray(n, dtype=float)
    s_unit = s_arr / np.linalg.norm(s_arr)
    n_unit = n_arr / np.linalg.norm(n_arr)
    
    # xi = s x n ensures right-handed system: det([s, n, s x n]) = +1
    xi = np.cross(s_unit, n_unit)
    xi_unit = xi / np.linalg.norm(xi)
    
    R = np.vstack([s_unit, n_unit, xi_unit])
    return R


def to_local(v_crystal: Union[np.ndarray, list], R_local: np.ndarray) -> np.ndarray:
    """Transform vector from crystal coordinates to local dislocation coordinates."""
    return R_local @ np.asarray(v_crystal, dtype=float)


def from_local(v_local: Union[np.ndarray, list], R_local: np.ndarray) -> np.ndarray:
    """Transform vector from local dislocation coordinates to crystal coordinates."""
    return R_local.T @ np.asarray(v_local, dtype=float)


@dataclass(frozen=True)
class DislocationGeometry:
    s: np.ndarray
    n: np.ndarray
    xi: np.ndarray
    p0: np.ndarray
    y_plane: float
    t_min: float
    t_max: float


def make_geometry(
    s: Union[np.ndarray, list],
    n: Union[np.ndarray, list],
    a_m: float,
    box_size_m: Tuple[float, float, float]
) -> DislocationGeometry:
    """
    Compute dislocation geometry and limits within a simulation box.
    Places the slip plane midway between atomic planes (offset d111/2)
    to ensure no atoms lie exactly on the branch cut.
    """
    s_arr = np.asarray(s, dtype=float) / np.linalg.norm(s)
    n_arr = np.asarray(n, dtype=float) / np.linalg.norm(n)
    xi_arr = np.cross(s_arr, n_arr)
    xi_arr = xi_arr / np.linalg.norm(xi_arr)
    
    d = a_m / np.sqrt(3.0)  # FCC {111} interplanar spacing
    box = np.asarray(box_size_m, dtype=float)
    c = box / 2.0
    cn = np.dot(c, n_arr)
    y_plane = (np.floor(cn / d) + 0.5) * d
    off = cn - y_plane
    p0 = c - off * n_arr
    
    t_min = -np.inf
    t_max = np.inf
    for i in range(3):
        if abs(s_arr[i]) > 1e-12:
            t1 = (0.0 - p0[i]) / s_arr[i]
            t2 = (box[i] - p0[i]) / s_arr[i]
            t_min = max(t_min, min(t1, t2))
            t_max = min(t_max, max(t1, t2))
            
    return DislocationGeometry(
        s=s_arr,
        n=n_arr,
        xi=xi_arr,
        p0=p0,
        y_plane=float(y_plane),
        t_min=float(t_min + a_m),
        t_max=float(t_max - a_m)
    )


def displaced_positions(
    ideal_positions: np.ndarray,
    geometry: DislocationGeometry,
    pos_m: float,
    b_m: float,
    nu: float,
    rc_m: float
) -> np.ndarray:
    """
    Calculate displaced positions r_i = R_i + u(R_i; r_d).
    ideal_positions: (N, 3) in crystal frame (metres).
    Returns (N, 3) displaced positions in crystal frame (metres).
    """
    ideal = np.asarray(ideal_positions, dtype=float)
    diff = ideal - geometry.p0
    
    x = np.dot(diff, geometry.s) - pos_m
    y = np.dot(diff, geometry.n)
    
    ux, uy = edge_displacement(x, y, b_m, nu, rc_m)
    
    # Displacement u in crystal coordinates: u = ux * s + uy * n
    # (since line is along xi, edge dislocation has zero uz)
    disp = np.outer(ux, geometry.s) + np.outer(uy, geometry.n)
    return ideal + disp
