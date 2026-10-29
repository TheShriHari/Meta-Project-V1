"""
scripts/generate_phase1_fixtures.py - Generate deterministic golden fixtures for Phase 1 math parity testing.
"""

import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.abspath("src"))

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
from hpsim.core.vectors import normalize_vector
from hpsim.core.rotations import (
    rotation_matrix_euler_zxz,
    random_rotation_so3,
    transform_vector_crystal_to_specimen,
)
from hpsim.core.slipsystems import (
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


def main():
    fixtures = {}

    # 1. Units
    fixtures["units"] = {
        "nm_to_m_test": {"input_nm": 0.405, "expected_m": nm_to_m(0.405)},
        "mpa_to_pa_test": {"input_mpa": 150.0, "expected_pa": mpa_to_pa(150.0)},
        "gpa_to_pa_test": {"input_gpa": 81.6, "expected_pa": gpa_to_pa(81.6)},
        "um_to_m_test": {"input_um": 25.4, "expected_m": um_to_m(25.4)},
    }

    # 2. Rotations
    R_euler = rotation_matrix_euler_zxz(0.35, 0.75, 1.25)
    R_so3 = random_rotation_so3(seed=42)
    v_test = np.array([1.5, -2.5, 3.5])
    v_transformed = transform_vector_crystal_to_specimen(v_test, R_euler)

    fixtures["rotations"] = {
        "euler_zxz": {
            "angles": [0.35, 0.75, 1.25],
            "R": R_euler.tolist(),
        },
        "so3_seed42": {
            "seed": 42,
            "R": R_so3.tolist(),
        },
        "transform_vector": {
            "v_input": v_test.tolist(),
            "R": R_euler.tolist(),
            "v_output": v_transformed.tolist(),
        },
    }

    # 3. Slip Systems
    fcc_sys = get_fcc_slip_systems()
    bcc_sys = get_bcc_slip_systems()

    fixtures["slipsystems"] = {
        "fcc_count": len(fcc_sys),
        "fcc_systems": [
            {
                "index": s.index,
                "plane": list(s.plane_miller),
                "direction": list(s.direction_miller),
                "n": s.n.tolist(),
                "s": s.s.tolist(),
            }
            for s in fcc_sys
        ],
        "bcc_count": len(bcc_sys),
        "bcc_systems": [
            {
                "index": s.index,
                "plane": list(s.plane_miller),
                "direction": list(s.direction_miller),
                "n": s.n.tolist(),
                "s": s.s.tolist(),
            }
            for s in bcc_sys
        ],
        "burgers_magnitudes": {
            "al_fcc": calculate_burgers_magnitude(4.0495e-10, "FCC"),
            "cu_fcc": calculate_burgers_magnitude(3.6150e-10, "FCC"),
            "fe_bcc": calculate_burgers_magnitude(2.8665e-10, "BCC"),
        },
    }

    # 4. Stress and Schmid Factor
    sigma_app = 80.0e6  # 80 MPa
    axis = [1.0, 2.0, 3.0]
    sigma_tensor = make_uniaxial_stress_tensor(sigma_app, axis)

    rss_fcc = [
        calculate_resolved_shear_stress(sigma_tensor, s.s, s.n)
        for s in fcc_sys
    ]
    schmid_fcc = [
        schmid_factor_uniaxial(s.s, s.n, axis)
        for s in fcc_sys
    ]

    fixtures["stress"] = {
        "uniaxial_axis": axis,
        "sigma_app_pa": sigma_app,
        "sigma_tensor": sigma_tensor.tolist(),
        "fcc_rss_pa": rss_fcc,
        "fcc_schmid_factors": schmid_fcc,
    }

    # 5. Glide Law
    tau_c = 12.0e6  # 12 MPa
    M_d = 1.0e4
    b = 0.286e-9

    test_stresses = [0.0, 6.0e6, 12.0e6, 18.0e6, -18.0e6, 30.0e6]
    glide_velocities = [
        calculate_glide_velocity(t, tau_c, M_d, b)
        for t in test_stresses
    ]

    fixtures["glide"] = {
        "tau_c_pa": tau_c,
        "M_d": M_d,
        "b_m": b,
        "test_stresses_pa": test_stresses,
        "expected_velocities_mps": glide_velocities,
        "integration_test": {
            "pos_0": 0.0,
            "velocity": 17.16,
            "dt": 1e-4,
            "n_steps": 50,
            "expected_pos": integrate_dislocation_position(0.0, 17.16, 1e-4, 50),
        },
    }

    os.makedirs("tests/golden", exist_ok=True)
    out_path = "tests/golden/phase1_fixtures.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=2)

    print(f"Generated {out_path} successfully.")


if __name__ == "__main__":
    main()
