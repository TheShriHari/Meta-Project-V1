"""
hpsim.materials.loader - Strict material parameter loading with provenance and status tracking.

Enforces zero silent parameter hallucination:
- Every parameter retains its status: sourced, calculated, calibrated, illustrative, needs_citation.
- Any attempt to retrieve a parameter with status 'needs_citation' or unresolved 'null' value
  for physical calculation raises an explicit UnresolvedParameterError.
"""

from dataclasses import dataclass
from typing import Optional, Dict
import os
import yaml


class UnresolvedParameterError(Exception):
    """Raised when attempting to retrieve an unverified, missing, or needs_citation parameter."""
    pass


@dataclass(frozen=True)
class MaterialParameter:
    """Represents a single material property entry with provenance metadata."""
    name: str
    value: Optional[float]
    unit: str
    source: str
    doi_or_url: str
    test_conditions: str
    status: str

    def is_resolved(self) -> bool:
        """Return True if parameter is numeric and verified (sourced, calculated, calibrated)."""
        return (
            self.value is not None
            and self.status in ["sourced", "calculated", "calibrated", "illustrative"]
            and self.status != "needs_citation"
        )


@dataclass(frozen=True)
class Material:
    """Represents an audited material entry in the HPSim database."""
    key: str
    name: str
    structure: str
    composition: str
    heat_treatment: str
    parameters: Dict[str, MaterialParameter]

    def get_verified_value(self, param_name: str) -> float:
        """
        Retrieve a verified numeric value for calculation.
        
        Raises:
            KeyError: if param_name does not exist.
            UnresolvedParameterError: if parameter status is needs_citation or value is null.
        """
        if param_name not in self.parameters:
            raise KeyError(f"Parameter '{param_name}' not defined for material '{self.name}'.")

        param = self.parameters[param_name]
        if param.status == "needs_citation":
            raise UnresolvedParameterError(
                f"Parameter '{param_name}' for '{self.name}' has status 'needs_citation' "
                f"and cannot be used as a verified scientific input. Citation required."
            )
        if param.value is None:
            raise UnresolvedParameterError(
                f"Parameter '{param_name}' for '{self.name}' has unresolved value (null). "
                f"Status: {param.status}."
            )

        return float(param.value)


def load_materials_database(path: str = "src/hpsim/materials/materials.yaml") -> Dict[str, Material]:
    """
    Load the materials property database from YAML into typed Material objects.
    
    Args:
        path: Path to materials.yaml file.
        
    Returns:
        Dict mapping material keys ('aluminium', 'copper', etc.) to Material objects.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Materials database YAML file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        raw_data = yaml.safe_load(f)

    database: Dict[str, Material] = {}
    for mat_key, mat_data in raw_data.items():
        param_dict: Dict[str, MaterialParameter] = {}
        for p_key, p_data in mat_data.get("parameters", {}).items():
            val = p_data.get("value")
            param_dict[p_key] = MaterialParameter(
                name=p_key,
                value=float(val) if val is not None else None,
                unit=str(p_data.get("unit", "")),
                source=str(p_data.get("source", "")),
                doi_or_url=str(p_data.get("doi_or_url", "")),
                test_conditions=str(p_data.get("test_conditions", "")),
                status=str(p_data.get("status", "needs_citation")),
            )

        database[mat_key] = Material(
            key=mat_key,
            name=str(mat_data.get("name", mat_key)),
            structure=str(mat_data.get("structure", "")),
            composition=str(mat_data.get("composition", "")),
            heat_treatment=str(mat_data.get("heat_treatment", "")),
            parameters=param_dict,
        )

    return database


def get_material(key: str, path: str = "src/hpsim/materials/materials.yaml") -> Material:
    """Retrieve a single Material by key from the database."""
    db = load_materials_database(path)
    if key not in db:
        raise KeyError(f"Material '{key}' not found in database at '{path}'. Available: {list(db.keys())}")
    return db[key]
