"""
hpsim.core.units - Strict SI unit conversion functions.

Internal standard: All physical quantities inside the simulation engine are stored in pure SI units:
- Length: metres (m)
- Stress / Elastic Moduli / CRSS: pascals (Pa)
- Mobility: 1 / (Pa * s)
- Velocity: m / s
- Angles: radians (rad)
"""

# Length conversions
def nm_to_m(val_nm: float) -> float:
    """Convert nanometres to metres."""
    return float(val_nm) * 1e-9


def m_to_nm(val_m: float) -> float:
    """Convert metres to nanometres."""
    return float(val_m) * 1e9


def um_to_m(val_um: float) -> float:
    """Convert micrometres to metres."""
    return float(val_um) * 1e-6


def m_to_um(val_m: float) -> float:
    """Convert metres to micrometres."""
    return float(val_m) * 1e6


# Stress conversions
def mpa_to_pa(val_mpa: float) -> float:
    """Convert megapascals (MPa = N/mm^2) to pascals (Pa = N/m^2)."""
    return float(val_mpa) * 1e6


def pa_to_mpa(val_pa: float) -> float:
    """Convert pascals (Pa) to megapascals (MPa)."""
    return float(val_pa) * 1e-6


def gpa_to_pa(val_gpa: float) -> float:
    """Convert gigapascals (GPa) to pascals (Pa)."""
    return float(val_gpa) * 1e9


def pa_to_gpa(val_pa: float) -> float:
    """Convert pascals (Pa) to gigapascals (GPa)."""
    return float(val_pa) * 1e-9
