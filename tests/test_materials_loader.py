"""
tests/test_materials_loader.py - Material parameter loader and provenance status tests.
"""

import pytest
from hpsim.materials.loader import (
    load_materials_database,
    get_material,
    UnresolvedParameterError,
)


def test_materials_loader_preserves_provenance():
    db = load_materials_database()
    assert "aluminium" in db
    assert "copper" in db
    assert "pure_iron" in db
    assert "ferritic_steel" in db

    al = db["aluminium"]
    assert al.structure == "FCC"
    assert al.parameters["a"].status == "sourced"
    assert al.parameters["b"].status == "calculated"
    assert al.parameters["tau_star_ref"].status == "calibrated"
    assert al.parameters["tau_star_ref"].value is None


def test_loader_rejects_unresolved_parameters():
    # Attempting to retrieve a parameter marked as needs_citation or null for physical calculation
    # must raise UnresolvedParameterError rather than returning a silent default
    steel = get_material("ferritic_steel")

    # tau_c is currently marked as needs_citation
    assert steel.parameters["tau_c"].status == "needs_citation"
    with pytest.raises(UnresolvedParameterError):
        steel.get_verified_value("tau_c")

    # tau_star_ref is calibrated / null
    assert steel.parameters["tau_star_ref"].value is None
    with pytest.raises(UnresolvedParameterError):
        steel.get_verified_value("tau_star_ref")

    # Sourced parameters succeed
    a_val = steel.get_verified_value("a")
    assert a_val == pytest.approx(2.8670e-10)


def test_copper_purity_provenance():
    cu = get_material("copper")
    assert "99.999" in cu.name or "99.999" in cu.composition
    assert cu.parameters["k_y"].value == pytest.approx(125000.0)
