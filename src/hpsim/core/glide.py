"""
hpsim.core.glide - Overdamped single-dislocation glide kinematics.

Governing equation:
    v = M_d * b * sign(tau_RSS) * max(|tau_RSS| - tau_c, 0)

Units and conventions:
- Mobility M_d: 1 / (Pa * s)
- Burgers vector magnitude b: metres (m)
- Driving stress tau_RSS: Pascals (Pa)
- Critical friction stress tau_c: Pascals (Pa) (must be non-negative)
- Glide velocity v: metres / second (m/s)
- Sign: Positive velocity moves the dislocation in the +s slip direction;
        negative velocity moves it in the -s direction.
"""

from typing import Union
import numpy as np


def calculate_glide_velocity(
    tau_rss: float,
    tau_c: float,
    M_d: float,
    b: float,
) -> float:
    """
    Calculate the instantaneous overdamped glide velocity of a dislocation.
    
    v = M_d * b * sign(tau_RSS) * max(|tau_RSS| - tau_c, 0)
    
    Args:
        tau_rss: Resolved shear stress on the slip plane (Pa).
        tau_c: Critical resolved shear stress / friction stress (Pa, >= 0).
        M_d: Dislocation mobility coefficient (1 / (Pa * s), > 0).
        b: Burgers vector magnitude (metres, > 0).
        
    Returns:
        Glide velocity in m/s (signed).
        
    Raises:
        ValueError: if tau_c < 0, M_d <= 0, or b <= 0.
    """
    if tau_c < 0.0:
        raise ValueError(f"Critical shear stress tau_c cannot be negative: {tau_c}")
    if M_d <= 0.0:
        raise ValueError(f"Mobility coefficient M_d must be positive: {M_d}")
    if b <= 0.0:
        raise ValueError(f"Burgers vector magnitude b must be positive: {b}")

    abs_tau = abs(float(tau_rss))
    overstress = max(abs_tau - float(tau_c), 0.0)

    if overstress == 0.0:
        return 0.0

    sign = 1.0 if tau_rss > 0.0 else -1.0
    return float(M_d * b * sign * overstress)


def integrate_dislocation_position(
    pos_0: float,
    velocity: float,
    dt: float,
    n_steps: int = 1,
) -> float:
    """
    Integrate dislocation scalar coordinate along the slip line for n_steps of duration dt.
    
    pos(t + n * dt) = pos_0 + sum(v * dt)
    
    Args:
        pos_0: Initial coordinate along the slip line (metres).
        velocity: Glide velocity (m/s).
        dt: Time increment per step (seconds, > 0).
        n_steps: Number of integration steps (integer, >= 1).
        
    Returns:
        Final coordinate in metres.
    """
    if dt <= 0.0:
        raise ValueError(f"Time step dt must be positive: {dt}")
    if n_steps < 1:
        raise ValueError(f"n_steps must be at least 1: {n_steps}")

    return float(pos_0 + velocity * dt * n_steps)
