"""
tests/test_stress.py - Stress tensor and Schmid factor oracle tests for HPSim.
"""

import pytest
import numpy as np
from hpsim.core.stress import (
    make_stress_tensor,
    make_uniaxial_stress_tensor,
    calculate_resolved_shear_stress,
    schmid_factor_uniaxial,
)
from hpsim.core.slipsystems import get_fcc_slip_systems
from hpsim.core.rotations import random_rotation_so3


def test_stress_tensor_construction():
    sigma = make_stress_tensor(10.0, 20.0, 30.0, 5.0, 6.0, 7.0)
    # Check symmetry
    assert np.allclose(sigma, sigma.T)
    assert sigma[0, 0] == 10.0
    assert sigma[1, 1] == 20.0
    assert sigma[2, 2] == 30.0
    assert sigma[0, 1] == 5.0
    assert sigma[1, 2] == 6.0
    assert sigma[2, 0] == 7.0


def test_resolved_shear_stress_tensor_vs_schmid_oracle():
    # Uniaxial tension sigma_app = 100 MPa along axis t = [0, 0, 1]
    sigma_app = 100.0e6  # Pa
    t_axis = np.array([0.0, 0.0, 1.0])
    sigma_tensor = make_uniaxial_stress_tensor(sigma_app, t_axis)

    systems = get_fcc_slip_systems()
    for sys in systems:
        tau_tensor = calculate_resolved_shear_stress(sigma_tensor, sys.s, sys.n)
        m = schmid_factor_uniaxial(sys.s, sys.n, t_axis)
        tau_schmid = sigma_app * m

        # Must match exactly within floating point precision
        assert tau_tensor == pytest.approx(tau_schmid, abs=1e-6)


def test_frame_invariance_of_rss():
    # Physical resolved shear stress on a slip system is invariant under rigid coordinate rotation
    R = random_rotation_so3(seed=789)
    sigma_app = 75.0e6
    t_axis = np.array([1.0, 1.0, 2.0])
    sigma_cryst = make_uniaxial_stress_tensor(sigma_app, t_axis)

    # Transform stress to specimen frame: sigma_spec = R @ sigma_cryst @ R.T
    sigma_spec = R @ sigma_cryst @ R.T

    systems = get_fcc_slip_systems()
    for sys in systems:
        # RSS evaluated in crystal frame
        tau_cryst = calculate_resolved_shear_stress(sigma_cryst, sys.s, sys.n)

        # Vectors transformed to specimen frame
        s_spec = R @ sys.s
        n_spec = R @ sys.n
        tau_spec = calculate_resolved_shear_stress(sigma_spec, s_spec, n_spec)

        assert tau_cryst == pytest.approx(tau_spec, abs=1e-6)


def test_max_schmid_factor_bound():
    # The maximum absolute Schmid factor for any uniaxial loading cannot exceed 0.5
    rng = np.random.default_rng(999)
    systems = get_fcc_slip_systems()

    for _ in range(500):
        # Random loading axis
        t = rng.normal(size=3)
        t = t / np.linalg.norm(t)

        for sys in systems:
            m = schmid_factor_uniaxial(sys.s, sys.n, t)
            assert abs(m) <= 0.5 + 1e-12, f"Schmid factor {m} exceeded theoretical limit 0.5"
