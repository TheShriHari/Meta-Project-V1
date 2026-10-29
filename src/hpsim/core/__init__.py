"""
hpsim.core - Pure mathematical and physical core kernel for dislocation kinematics and slip systems.
Architectural constraint (NFR-04): No UI, web, or visualization modules may be imported here.
"""

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
from hpsim.core.vectors import (
    normalize_vector,
    vector_norm,
    vector_dot,
    vector_cross,
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
from hpsim.core.slipsystems import (
    SlipSystem,
    get_fcc_slip_systems,
    get_bcc_slip_systems,
    calculate_burgers_magnitude,
)
from hpsim.core.stress import (
    make_stress_tensor,
    make_uniaxial_stress_tensor,
    calculate_resolved_shear_stress,
    schmid_factor_uniaxial,
)
from hpsim.core.glide import (
    calculate_glide_velocity,
    integrate_dislocation_position,
)
from hpsim.core.hallpetch import (
    SourceShutoffInputs,
    SourceShutoffResult,
    YieldOnsetInputs,
    YieldOnsetResult,
    HallPetchSweepInputs,
    HallPetchPoint,
    HallPetchSweepResult,
    solve_pileup_with_source,
    find_yield_onset,
    compute_effective_tau_star,
    compute_analytic_hall_petch_ky,
    compute_analytic_tau_star_from_ky,
    run_hall_petch_sweep,
    calibrate_tau_star_ref,
    evaluate_literature_calibration_and_validation,
)

__all__ = [
    "nm_to_m",
    "m_to_nm",
    "um_to_m",
    "m_to_um",
    "mpa_to_pa",
    "pa_to_mpa",
    "gpa_to_pa",
    "pa_to_gpa",
    "normalize_vector",
    "vector_norm",
    "vector_dot",
    "vector_cross",
    "is_orthonormal_matrix",
    "matrix_determinant",
    "rotation_matrix_euler_zxz",
    "random_rotation_so3",
    "transform_vector_crystal_to_specimen",
    "transform_vector_specimen_to_crystal",
    "transform_stress_specimen_to_crystal",
    "transform_stress_crystal_to_specimen",
    "SlipSystem",
    "get_fcc_slip_systems",
    "get_bcc_slip_systems",
    "calculate_burgers_magnitude",
    "make_stress_tensor",
    "make_uniaxial_stress_tensor",
    "calculate_resolved_shear_stress",
    "schmid_factor_uniaxial",
    "calculate_glide_velocity",
    "integrate_dislocation_position",
]
