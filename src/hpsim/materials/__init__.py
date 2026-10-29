"""
hpsim.materials - Materials property database and provenance management.
"""

from hpsim.materials.loader import (
    Material,
    MaterialParameter,
    UnresolvedParameterError,
    load_materials_database,
    get_material,
)

__all__ = [
    "Material",
    "MaterialParameter",
    "UnresolvedParameterError",
    "load_materials_database",
    "get_material",
]
