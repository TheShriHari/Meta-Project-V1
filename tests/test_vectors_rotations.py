"""
tests/test_vectors_rotations.py - 3D vector and rotation tensor tests for HPSim.
"""

import pytest
import numpy as np
from hpsim.core.vectors import (
    normalize_vector,
    vector_norm,
    is_orthonormal_matrix,
    matrix_determinant,
)
from hpsim.core.rotations import (
    rotation_matrix_euler_zxz,
    random_rotation_so3,
    transform_vector_crystal_to_specimen,
    transform_vector_specimen_to_crystal,
    transform_stress_specimen_to_crystal,
    transform_stress_crystal_to_specimen,
)


def test_normalize_vector():
    v = np.array([3.0, 4.0, 0.0])
    u = normalize_vector(v)
    assert np.allclose(u, [0.6, 0.8, 0.0])
    assert vector_norm(u) == pytest.approx(1.0)

    # Zero vector raises ValueError
    with pytest.raises(ValueError):
        normalize_vector(np.array([0.0, 0.0, 0.0]))


def test_rotation_matrix_euler_properties():
    # Test arbitrary Euler angles phi1, Phi, phi2
    R = rotation_matrix_euler_zxz(0.3, 0.7, 1.2)
    assert is_orthonormal_matrix(R, tol=1e-12)
    assert matrix_determinant(R) == pytest.approx(1.0, abs=1e-12)

    # Check R.T @ R == I
    I = np.eye(3)
    assert np.allclose(R.T @ R, I, atol=1e-12)
    assert np.allclose(R @ R.T, I, atol=1e-12)


def test_random_rotation_so3_determinism():
    # Deterministic seed gives identical rotation matrix
    R1 = random_rotation_so3(seed=42)
    R2 = random_rotation_so3(seed=42)
    assert np.allclose(R1, R2, atol=1e-15)

    # Different seed gives different matrix
    R3 = random_rotation_so3(seed=43)
    assert not np.allclose(R1, R3)

    # All generated rotations are orthonormal with det +1
    for s in [1, 10, 100, 999]:
        R = random_rotation_so3(seed=s)
        assert is_orthonormal_matrix(R, tol=1e-12)
        assert matrix_determinant(R) == pytest.approx(1.0, abs=1e-12)


def test_vector_frame_roundtrip():
    R = random_rotation_so3(seed=123)
    v_cryst = np.array([1.0, -2.0, 3.0])
    v_spec = transform_vector_crystal_to_specimen(v_cryst, R)
    v_back = transform_vector_specimen_to_crystal(v_spec, R)
    assert np.allclose(v_cryst, v_back, atol=1e-12)


def test_stress_frame_roundtrip():
    R = random_rotation_so3(seed=456)
    sigma_spec = np.array([
        [100.0, 20.0, 5.0],
        [20.0, 50.0, 10.0],
        [5.0, 10.0, 30.0],
    ])
    sigma_cryst = transform_stress_specimen_to_crystal(sigma_spec, R)
    sigma_back = transform_stress_crystal_to_specimen(sigma_cryst, R)
    assert np.allclose(sigma_spec, sigma_back, atol=1e-12)
