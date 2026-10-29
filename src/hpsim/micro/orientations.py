"""
src/hpsim/micro/orientations.py - Seeded per-grain 3D crystal orientation assignment on SO(3) (V-13).
"""

from dataclasses import dataclass
from typing import List, Sequence
import numpy as np

from hpsim.core.rotations import random_rotation_so3


@dataclass(frozen=True)
class GrainOrientation:
    """Deterministic seeded 3D crystal orientation R_i in SO(3) and 2D slip trace angle."""
    grain_id: int
    seed: int
    structure: str
    rotation_matrix: np.ndarray
    slip_trace_angle_rad: float


def assign_seeded_orientations(
    grain_ids: Sequence[int],
    seed: int = 42,
    structure: str = "FCC",
) -> List[GrainOrientation]:
    """
    Assign a deterministic, uniformly distributed 3D rotation matrix R_i in SO(3)
    to each grain ID using a reproducible hash of (seed, grain_id) (V-13).
    """
    out: List[GrainOrientation] = []
    base_seed = int(seed) & 0xFFFFFFFF

    for gid in grain_ids:
        gid_int = int(gid)
        grain_seed = (base_seed * 1000003 + gid_int * 9176 + 0x9E3779B9) & 0xFFFFFFFF
        R = random_rotation_so3(seed=grain_seed)
        # Project primary crystal slip direction onto the 2D specimen (x, y) observation plane
        slip_angle = float(np.arctan2(R[1, 0], R[0, 0]))
        out.append(
            GrainOrientation(
                grain_id=gid_int,
                seed=grain_seed,
                structure=structure,
                rotation_matrix=R,
                slip_trace_angle_rad=slip_angle,
            )
        )

    return out
