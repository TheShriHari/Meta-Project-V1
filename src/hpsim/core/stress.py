"""
hpsim.core.stress - Cauchy stress tensor and resolved shear stress (RSS) calculations.

Governing equations:
- Tensor expression for resolved shear stress on slip system with unit direction s and unit normal n:
    tau_RSS = s.T @ sigma @ n = sum_{i,j} s_i * sigma_{ij} * n_j
- For uniaxial loading along unit vector t with tensile magnitude sigma_app:
    sigma = sigma_app * (t (x) t)
    tau_RSS = sigma_app * cos(phi) * cos(lambda)
  where:
    cos(phi) = n . t  (angle between slip plane normal and loading axis)
    cos(lambda) = s . t (angle between slip direction and loading axis)
    m = cos(phi) * cos(lambda) (Schmid factor)
"""

from typing import Union
import numpy as np
from hpsim.core.vectors import normalize_vector


def make_stress_tensor(
    sigma_xx: float,
    sigma_yy: float,
    sigma_zz: float,
    tau_xy: float,
    tau_yz: float,
    tau_zx: float,
) -> np.ndarray:
    """
    Construct a 3x3 symmetric Cauchy stress tensor in Pascals.
    
    Args:
        sigma_xx, sigma_yy, sigma_zz: Normal stress components (Pa).
        tau_xy, tau_yz, tau_zx: Shear stress components (Pa).
        
    Returns:
        3x3 symmetric numpy array of shape (3, 3) in Pa.
    """
    return np.array([
        [sigma_xx, tau_xy,   tau_zx],
        [tau_xy,   sigma_yy, tau_yz],
        [tau_zx,   tau_yz,   sigma_zz]
    ], dtype=np.float64)


def make_uniaxial_stress_tensor(
    sigma_app: float,
    loading_axis: Union[np.ndarray, list[float]],
) -> np.ndarray:
    """
    Construct a 3x3 Cauchy stress tensor representing uniaxial stress along loading_axis.
    
    sigma = sigma_app * (t (x) t)
    
    Args:
        sigma_app: Uniaxial stress magnitude (Pa, positive for tension, negative for compression).
        loading_axis: 3D vector specifying the orientation of the tensile/compressive axis.
        
    Returns:
        3x3 symmetric stress tensor in Pa.
    """
    t = normalize_vector(loading_axis)
    return float(sigma_app) * np.outer(t, t)


def calculate_resolved_shear_stress(
    sigma: np.ndarray,
    s: Union[np.ndarray, list[float]],
    n: Union[np.ndarray, list[float]],
) -> float:
    """
    Calculate the resolved shear stress (RSS) on a slip system via tensor projection:
    
    tau_RSS = s.T @ sigma @ n
    
    Args:
        sigma: 3x3 Cauchy stress tensor (Pa).
        s: Unit slip direction vector (dimensionless).
        n: Unit slip plane normal vector (dimensionless).
        
    Returns:
        tau_RSS: Resolved shear stress in Pa (signed).
    """
    s_arr = np.asarray(s, dtype=np.float64)
    n_arr = np.asarray(n, dtype=np.float64)
    return float(s_arr @ sigma @ n_arr)


def schmid_factor_uniaxial(
    s: Union[np.ndarray, list[float]],
    n: Union[np.ndarray, list[float]],
    loading_axis: Union[np.ndarray, list[float]],
) -> float:
    """
    Calculate the geometric Schmid factor m for a uniaxial loading axis:
    
    m = cos(phi) * cos(lambda) = (n . t) * (s . t)
    
    Oracle function for verifying tensor RSS calculations.
    
    Args:
        s: Unit slip direction vector.
        n: Unit slip plane normal vector.
        loading_axis: 3D loading axis vector.
        
    Returns:
        m: Dimensionless Schmid factor (in range [-0.5, 0.5]).
    """
    t = normalize_vector(loading_axis)
    s_unit = normalize_vector(s)
    n_unit = normalize_vector(n)

    cos_phi = float(np.dot(n_unit, t))
    cos_lambda = float(np.dot(s_unit, t))
    return cos_phi * cos_lambda
