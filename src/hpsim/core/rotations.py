"""
hpsim.core.rotations - Crystal-to-specimen 3D rotation transforms on SO(3).

Conventions:
- R is the 3x3 rotation matrix mapping crystal coordinates to specimen coordinates:
    v_spec = R @ v_cryst
- For stress tensors:
    sigma_spec = R @ sigma_cryst @ R.T
    sigma_cryst = R.T @ sigma_spec @ R
- Every valid rotation satisfies:
    R.T @ R = I (orthonormal)
    det(R) = +1 (proper rotation, no reflections)
"""

from typing import Optional, Union
import numpy as np


def rotation_matrix_euler_zxz(phi1: float, Phi: float, phi2: float) -> np.ndarray:
    """
    Construct a crystal-to-specimen rotation matrix from Bunge Euler angles (Z1-X-Z2).
    
    R = R_z(phi1) @ R_x(Phi) @ R_z(phi2)
    
    Args:
        phi1: First rotation about Z axis (radians).
        Phi: Second rotation about rotated X axis (radians).
        phi2: Third rotation about rotated Z axis (radians).
        
    Returns:
        3x3 orthonormal rotation matrix R with det(R) = +1.
    """
    c1, s1 = np.cos(phi1), np.sin(phi1)
    cP, sP = np.cos(Phi), np.sin(Phi)
    c2, s2 = np.cos(phi2), np.sin(phi2)

    R_z1 = np.array([
        [c1, -s1, 0.0],
        [s1,  c1, 0.0],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)

    R_x = np.array([
        [1.0, 0.0, 0.0],
        [0.0, cP, -sP],
        [0.0, sP,  cP]
    ], dtype=np.float64)

    R_z2 = np.array([
        [c2, -s2, 0.0],
        [s2,  c2, 0.0],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)

    return R_z1 @ R_x @ R_z2


def random_rotation_so3(seed: Optional[int] = None) -> np.ndarray:
    """
    Generate a uniformly distributed random rotation matrix on SO(3)
    using the subgroup algorithm (Shoemake 1992).
    
    Args:
        seed: Deterministic integer seed for reproducibility.
        
    Returns:
        3x3 orthonormal rotation matrix R with det(R) = +1.
    """
    rng = np.random.default_rng(seed)
    u1, u2, u3 = rng.uniform(0.0, 1.0, size=3)

    # Unit quaternion from uniform random variables
    q0 = np.sqrt(1.0 - u1) * np.sin(2.0 * np.pi * u2)
    q1 = np.sqrt(1.0 - u1) * np.cos(2.0 * np.pi * u2)
    q2 = np.sqrt(u1) * np.sin(2.0 * np.pi * u3)
    q3 = np.sqrt(u1) * np.cos(2.0 * np.pi * u3)

    # Convert unit quaternion [q0, q1, q2, q3] to 3x3 rotation matrix
    # where q0 is scalar (w), [q1, q2, q3] is vector part (x, y, z)
    # Using Shoemake's convention:
    w, x, y, z = q1, q2, q3, q0

    R = np.array([
        [1.0 - 2.0*(y*y + z*z),       2.0*(x*y - z*w),       2.0*(x*z + y*w)],
        [      2.0*(x*y + z*w), 1.0 - 2.0*(x*x + z*z),       2.0*(y*z - x*w)],
        [      2.0*(x*z - y*w),       2.0*(y*z + x*w), 1.0 - 2.0*(x*x + y*y)]
    ], dtype=np.float64)

    return R


def transform_vector_crystal_to_specimen(
    v_cryst: Union[np.ndarray, list[float]], R: np.ndarray
) -> np.ndarray:
    """Transform a 3D vector from crystal frame to specimen frame: v_spec = R @ v_cryst."""
    v = np.asarray(v_cryst, dtype=np.float64)
    return R @ v


def transform_vector_specimen_to_crystal(
    v_spec: Union[np.ndarray, list[float]], R: np.ndarray
) -> np.ndarray:
    """Transform a 3D vector from specimen frame to crystal frame: v_cryst = R.T @ v_spec."""
    v = np.asarray(v_spec, dtype=np.float64)
    return R.T @ v


def transform_stress_specimen_to_crystal(
    sigma_spec: np.ndarray, R: np.ndarray
) -> np.ndarray:
    """Transform Cauchy stress tensor from specimen frame to crystal frame: sigma_cryst = R.T @ sigma_spec @ R."""
    return R.T @ sigma_spec @ R


def transform_stress_crystal_to_specimen(
    sigma_cryst: np.ndarray, R: np.ndarray
) -> np.ndarray:
    """Transform Cauchy stress tensor from crystal frame to specimen frame: sigma_spec = R @ sigma_cryst @ R.T."""
    return R @ sigma_cryst @ R.T
