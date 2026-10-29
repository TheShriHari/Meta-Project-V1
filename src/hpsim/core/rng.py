"""
hpsim.core.rng - Deterministic random number generator management.

Enforces reproducibility (NFR-01):
Identical seed must produce byte-identical random sequences across execution runs.
"""

from typing import Optional
import numpy as np


def get_rng(seed: Optional[int] = None) -> np.random.Generator:
    """
    Construct a deterministic NumPy random generator instance.
    
    Args:
        seed: Integer seed or None.
        
    Returns:
        numpy.random.Generator instance.
    """
    return np.random.default_rng(seed)
