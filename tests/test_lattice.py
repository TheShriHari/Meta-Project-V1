"""Phase 2: FCC conventional-cell lattice tests."""
import numpy as np
from hpsim.core.lattice import FCC_BASIS_FRACTIONAL, generate_fcc_lattice

# Synthetic lattice parameter for geometry-only tests (not a material claim).
A = 1.0


def test_fcc_basis_is_the_conventional_four_atom_basis():
    expected = {(0, 0, 0), (0.5, 0.5, 0), (0.5, 0, 0.5), (0, 0.5, 0.5)}
    assert {tuple(p) for p in FCC_BASIS_FRACTIONAL} == expected


def test_atom_count_and_extent():
    pos = generate_fcc_lattice(A, 3, 4, 5)
    assert pos.shape == (4 * 3 * 4 * 5, 3)
    assert np.all(pos.min(axis=0) >= 0.0)
    assert np.all(pos.max(axis=0) < np.array([3, 4, 5]) * A)


def test_all_coordinates_finite_and_unique():
    pos = generate_fcc_lattice(A, 4, 4, 4)
    assert np.all(np.isfinite(pos))
    assert len({tuple(np.round(p, 9)) for p in pos}) == len(pos)


def test_repeatability():
    assert np.array_equal(generate_fcc_lattice(A, 3, 3, 3), generate_fcc_lattice(A, 3, 3, 3))


def test_nearest_neighbour_distance_and_coordination():
    pos = generate_fcc_lattice(A, 4, 4, 4)
    centre = np.array([2.0, 2.0, 2.0]) * A
    i = int(np.argmin(np.linalg.norm(pos - centre, axis=1)))
    d = np.linalg.norm(pos - pos[i], axis=1)
    d = d[d > 1e-12]
    assert abs(d.min() - A / np.sqrt(2)) < 1e-12
    assert np.sum(np.abs(d - A / np.sqrt(2)) < 1e-9) == 12


def test_lattice_parameter_scales_linearly():
    p1 = generate_fcc_lattice(1.0, 2, 2, 2)
    p2 = generate_fcc_lattice(3.5, 2, 2, 2)
    assert np.allclose(p2, 3.5 * p1, rtol=0, atol=1e-12)
