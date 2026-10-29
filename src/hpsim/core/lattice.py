"""
hpsim.core.lattice - Finite FCC lattice from the conventional cubic cell.

Convention: positions in metres (SI), crystal frame, cell origin at (0, 0, 0).
Basis (fractional, conventional 4-atom cell): (0,0,0), (1/2,1/2,0), (1/2,0,1/2), (0,1/2,1/2).
Ordering: loop over cells i (x) -> j (y) -> k (z), then basis index; the TypeScript core uses the same order.
Only complete cells are generated (4 atoms per cell); free surfaces are not capped or relaxed.
These are IDEAL positions R_i. Displaced render positions r_i = R_i + u(R_i; r_d) live elsewhere.
"""
import numpy as np

FCC_BASIS_FRACTIONAL = np.array(
    [[0.0, 0.0, 0.0], [0.5, 0.5, 0.0], [0.5, 0.0, 0.5], [0.0, 0.5, 0.5]]
)


def generate_fcc_lattice(a_m: float, nx: int, ny: int, nz: int) -> np.ndarray:
    """Return (4*nx*ny*nz, 3) ideal atom positions in metres for lattice parameter a_m (metres)."""
    if a_m <= 0.0:
        raise ValueError(f"lattice parameter must be positive: {a_m}")
    if min(nx, ny, nz) < 1:
        raise ValueError("cell counts must be >= 1")
    out = np.empty((4 * nx * ny * nz, 3), dtype=float)
    idx = 0
    for i in range(nx):
        for j in range(ny):
            for k in range(nz):
                for b in FCC_BASIS_FRACTIONAL:
                    out[idx] = (np.array([i, j, k]) + b) * a_m
                    idx += 1
    return out
