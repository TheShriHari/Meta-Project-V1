"""
hpsim.core.slipsystems - Crystallographic slip systems and Burgers vector geometry.

Implemented slip systems:
- FCC {111}<110>: 12 unique slip systems (4 planes x 3 directions).
- BCC {110}<111>: 12 unique slip systems (6 planes x 2 directions).

Each slip system defines:
- Unit plane normal vector n (|n| = 1)
- Unit slip direction vector s (|s| = 1)
- Strict orthogonality: s . n = 0
"""

from dataclasses import dataclass
from typing import Tuple, List
import numpy as np


@dataclass(frozen=True)
class SlipSystem:
    """Represents a single crystallographic slip system."""
    index: int
    plane_miller: Tuple[int, int, int]
    direction_miller: Tuple[int, int, int]
    n: np.ndarray  # Unit plane normal in crystal frame (shape: (3,))
    s: np.ndarray  # Unit slip direction in crystal frame (shape: (3,))
    plane_family: str
    direction_family: str

    def __repr__(self) -> str:
        return (
            f"SlipSystem(index={self.index}, plane={self.plane_miller}, "
            f"direction={self.direction_miller}, family={self.plane_family}{self.direction_family})"
        )


def get_fcc_slip_systems() -> List[SlipSystem]:
    """
    Generate the 12 unique {111}<110> slip systems for FCC crystals.
    
    Returns:
        List of 12 SlipSystem instances with unit normalized s and n vectors.
    """
    # 4 distinct planes of {111}
    # Each plane has 3 distinct directions from <110> lying in that plane (s . n = 0)
    definitions = [
        # Plane (1, 1, 1)
        ((1, 1, 1), [(0, 1, -1), (-1, 0, 1), (1, -1, 0)]),
        # Plane (-1, 1, 1)
        ((-1, 1, 1), [(0, 1, -1), (1, 0, 1), (1, 1, 0)]),
        # Plane (1, -1, 1)
        ((1, -1, 1), [(0, 1, 1), (1, 0, -1), (1, 1, 0)]),
        # Plane (1, 1, -1)
        ((1, 1, -1), [(0, 1, 1), (1, 0, 1), (1, -1, 0)]),
    ]

    systems: List[SlipSystem] = []
    idx = 0
    for plane, directions in definitions:
        n_raw = np.array(plane, dtype=np.float64)
        n_unit = n_raw / np.linalg.norm(n_raw)

        for d in directions:
            s_raw = np.array(d, dtype=np.float64)
            s_unit = s_raw / np.linalg.norm(s_raw)

            # Ensure exact orthogonality
            assert abs(np.dot(s_unit, n_unit)) < 1e-12

            systems.append(
                SlipSystem(
                    index=idx,
                    plane_miller=plane,
                    direction_miller=d,
                    n=n_unit,
                    s=s_unit,
                    plane_family="{111}",
                    direction_family="<110>",
                )
            )
            idx += 1

    assert len(systems) == 12
    return systems


def get_bcc_slip_systems() -> List[SlipSystem]:
    """
    Generate the 12 unique {110}<111> slip systems for BCC crystals.
    
    Returns:
        List of 12 SlipSystem instances with unit normalized s and n vectors.
    """
    # 6 distinct planes of {110}
    # Each plane has 2 distinct directions from <111> lying in that plane (s . n = 0)
    definitions = [
        # Plane (1, 1, 0)
        ((1, 1, 0), [(1, -1, 1), (1, -1, -1)]),
        # Plane (1, 0, 1)
        ((1, 0, 1), [(1, 1, -1), (1, -1, -1)]),
        # Plane (0, 1, 1)
        ((0, 1, 1), [(1, 1, -1), (-1, 1, -1)]),
        # Plane (1, -1, 0)
        ((1, -1, 0), [(1, 1, 1), (1, 1, -1)]),
        # Plane (1, 0, -1)
        ((1, 0, -1), [(1, 1, 1), (1, -1, 1)]),
        # Plane (0, 1, -1)
        ((0, 1, -1), [(1, 1, 1), (-1, 1, 1)]),
    ]

    systems: List[SlipSystem] = []
    idx = 0
    for plane, directions in definitions:
        n_raw = np.array(plane, dtype=np.float64)
        n_unit = n_raw / np.linalg.norm(n_raw)

        for d in directions:
            s_raw = np.array(d, dtype=np.float64)
            s_unit = s_raw / np.linalg.norm(s_raw)

            # Ensure exact orthogonality
            assert abs(np.dot(s_unit, n_unit)) < 1e-12

            systems.append(
                SlipSystem(
                    index=idx,
                    plane_miller=plane,
                    direction_miller=d,
                    n=n_unit,
                    s=s_unit,
                    plane_family="{110}",
                    direction_family="<111>",
                )
            )
            idx += 1

    assert len(systems) == 12
    return systems


def calculate_burgers_magnitude(lattice_parameter_a: float, structure: str) -> float:
    """
    Calculate the physical magnitude of the Burgers vector b (in metres)
    from lattice constant a and crystal structure.
    
    Formulae:
        FCC: b = a / sqrt(2)     (along <110>)
        BCC: b = a * sqrt(3) / 2  (along <111>)
        
    Args:
        lattice_parameter_a: Lattice constant a in metres (must be positive).
        structure: "FCC" or "BCC".
        
    Returns:
        Burgers vector magnitude b in metres.
        
    Raises:
        ValueError: if a <= 0 or structure is unsupported.
    """
    if lattice_parameter_a <= 0.0:
        raise ValueError(f"Lattice parameter a must be positive, got: {lattice_parameter_a}")

    struct_upper = structure.strip().upper()
    if struct_upper == "FCC":
        return float(lattice_parameter_a / np.sqrt(2.0))
    elif struct_upper == "BCC":
        return float(lattice_parameter_a * np.sqrt(3.0) / 2.0)
    else:
        raise ValueError(f"Unsupported crystal structure '{structure}'. Expected 'FCC' or 'BCC'.")
