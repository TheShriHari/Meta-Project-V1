"""
tests/test_slipsystems.py - Crystallographic slip systems and Burgers vector tests.
"""

import pytest
import numpy as np
from hpsim.core.slipsystems import (
    get_fcc_slip_systems,
    get_bcc_slip_systems,
    calculate_burgers_magnitude,
)


def test_fcc_slip_systems_geometry():
    systems = get_fcc_slip_systems()
    # FCC {111}<110> has exactly 12 slip systems
    assert len(systems) == 12

    for s in systems:
        # Unit vector magnitudes
        assert np.linalg.norm(s.n) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(s.s) == pytest.approx(1.0, abs=1e-12)
        # Normal and slip direction must be orthogonal: s . n = 0
        assert np.dot(s.s, s.n) == pytest.approx(0.0, abs=1e-12)
        assert s.plane_family == "{111}"
        assert s.direction_family == "<110>"

    # Check for duplicate systems (both directions and normals must be unique up to sign convention)
    # Check that no two systems share the exact same (s, n) pair
    pairs = [(tuple(np.round(sys.s, 6)), tuple(np.round(sys.n, 6))) for sys in systems]
    assert len(set(pairs)) == 12


def test_bcc_slip_systems_geometry():
    systems = get_bcc_slip_systems()
    # BCC {110}<111> has exactly 12 slip systems
    assert len(systems) == 12

    for s in systems:
        # Unit vector magnitudes
        assert np.linalg.norm(s.n) == pytest.approx(1.0, abs=1e-12)
        assert np.linalg.norm(s.s) == pytest.approx(1.0, abs=1e-12)
        # Normal and slip direction must be orthogonal: s . n = 0
        assert np.dot(s.s, s.n) == pytest.approx(0.0, abs=1e-12)
        assert s.plane_family == "{110}"
        assert s.direction_family == "<111>"

    pairs = [(tuple(np.round(sys.s, 6)), tuple(np.round(sys.n, 6))) for sys in systems]
    assert len(set(pairs)) == 12


def test_burgers_vector_magnitude():
    # FCC: b = a / sqrt(2)
    a_al = 4.0495e-10
    b_al = calculate_burgers_magnitude(a_al, "FCC")
    assert b_al == pytest.approx(a_al / np.sqrt(2.0), rel=1e-12)

    # BCC: b = a * sqrt(3) / 2
    a_fe = 2.8665e-10
    b_fe = calculate_burgers_magnitude(a_fe, "BCC")
    assert b_fe == pytest.approx(a_fe * np.sqrt(3.0) / 2.0, rel=1e-12)

    # Invalid structure raises ValueError
    with pytest.raises(ValueError):
        calculate_burgers_magnitude(a_al, "HCP")

    # Non-positive lattice parameter raises ValueError
    with pytest.raises(ValueError):
        calculate_burgers_magnitude(-1.0, "FCC")
