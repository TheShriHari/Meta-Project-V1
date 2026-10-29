"""
hpsim.core.vectors - 3D vector and matrix geometric primitives.
"""

from typing import Union
import numpy as np


def vector_norm(v: Union[np.ndarray, list[float]]) -> float:
    """Calculate Euclidean L2 norm of a vector."""
    arr = np.asarray(v, dtype=np.float64)
    return float(np.linalg.norm(arr))


def normalize_vector(v: Union[np.ndarray, list[float]], tol: float = 1e-15) -> np.ndarray:
    """
    Normalize a vector to unit length.
    
    Raises:
        ValueError: if vector magnitude is smaller than tol.
    """
    arr = np.asarray(v, dtype=np.float64)
    norm = np.linalg.norm(arr)
    if norm < tol:
        raise ValueError(f"Cannot normalize vector with near-zero norm: {norm}")
    return arr / norm


def vector_dot(u: Union[np.ndarray, list[float]], v: Union[np.ndarray, list[float]]) -> float:
    """Compute dot product of two vectors."""
    u_arr = np.asarray(u, dtype=np.float64)
    v_arr = np.asarray(v, dtype=np.float64)
    return float(np.dot(u_arr, v_arr))


def vector_cross(u: Union[np.ndarray, list[float]], v: Union[np.ndarray, list[float]]) -> np.ndarray:
    """Compute cross product of two 3D vectors."""
    u_arr = np.asarray(u, dtype=np.float64)
    v_arr = np.asarray(v, dtype=np.float64)
    return np.cross(u_arr, v_arr)


def is_orthonormal_matrix(m: Union[np.ndarray, list[list[float]]], tol: float = 1e-12) -> bool:
    """
    Validate that a 3x3 matrix R is orthonormal:
    R^T @ R = I within tolerance tol.
    """
    arr = np.asarray(m, dtype=np.float64)
    if arr.shape != (3, 3):
        return False
    diff = arr.T @ arr - np.eye(3)
    return bool(np.max(np.abs(diff)) < tol)


def matrix_determinant(m: Union[np.ndarray, list[list[float]]]) -> float:
    """Calculate determinant of a 3x3 matrix."""
    arr = np.asarray(m, dtype=np.float64)
    return float(np.linalg.det(arr))
