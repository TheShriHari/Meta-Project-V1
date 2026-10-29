"""
tests/test_units.py - Unit conversion and dimension verification tests for HPSim.
"""

import pytest
from hpsim.core.units import (
    nm_to_m,
    m_to_nm,
    um_to_m,
    m_to_um,
    mpa_to_pa,
    pa_to_mpa,
    gpa_to_pa,
    pa_to_gpa,
)


def test_length_conversions():
    # 1 nm = 1e-9 m
    assert nm_to_m(1.0) == pytest.approx(1e-9)
    assert m_to_nm(1e-9) == pytest.approx(1.0)

    # 1 um = 1e-6 m
    assert um_to_m(1.0) == pytest.approx(1e-6)
    assert m_to_um(1e-6) == pytest.approx(1.0)

    # Round trip
    val_m = 0.405e-9
    assert nm_to_m(m_to_nm(val_m)) == pytest.approx(val_m)


def test_stress_conversions():
    # 1 MPa = 1e6 Pa
    assert mpa_to_pa(1.0) == pytest.approx(1e6)
    assert pa_to_mpa(1e6) == pytest.approx(1.0)

    # 1 GPa = 1e9 Pa
    assert gpa_to_pa(1.0) == pytest.approx(1e9)
    assert pa_to_gpa(1e9) == pytest.approx(1.0)

    # Round trip
    val_pa = 27.5e6
    assert mpa_to_pa(pa_to_mpa(val_pa)) == pytest.approx(val_pa)
