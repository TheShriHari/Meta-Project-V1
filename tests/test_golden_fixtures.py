"""
tests/test_golden_fixtures.py - Validate Python kernel against phase1_fixtures.json.
"""

import json
import pytest
import numpy as np

from hpsim.core.slipsystems import (
    get_fcc_slip_systems,
    get_bcc_slip_systems,
    calculate_burgers_magnitude,
)
from hpsim.core.stress import (
    calculate_resolved_shear_stress,
    schmid_factor_uniaxial,
)
from hpsim.core.glide import (
    calculate_glide_velocity,
    integrate_dislocation_position,
)


def test_python_matches_golden_fixtures():
    with open("tests/golden/phase1_fixtures.json", "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    # 1. Slip systems
    fcc_sys = get_fcc_slip_systems()
    assert len(fcc_sys) == fixtures["slipsystems"]["fcc_count"]
    for i, s in enumerate(fcc_sys):
        golden_s = fixtures["slipsystems"]["fcc_systems"][i]
        assert np.allclose(s.n, golden_s["n"], atol=1e-12)
        assert np.allclose(s.s, golden_s["s"], atol=1e-12)

    bcc_sys = get_bcc_slip_systems()
    assert len(bcc_sys) == fixtures["slipsystems"]["bcc_count"]
    for i, s in enumerate(bcc_sys):
        golden_s = fixtures["slipsystems"]["bcc_systems"][i]
        assert np.allclose(s.n, golden_s["n"], atol=1e-12)
        assert np.allclose(s.s, golden_s["s"], atol=1e-12)

    # 2. Stress & RSS
    stress_fix = fixtures["stress"]
    sigma_tensor = np.array(stress_fix["sigma_tensor"])
    axis = np.array(stress_fix["uniaxial_axis"])

    for i, s in enumerate(fcc_sys):
        tau = calculate_resolved_shear_stress(sigma_tensor, s.s, s.n)
        assert tau == pytest.approx(stress_fix["fcc_rss_pa"][i], rel=1e-12)

        m = schmid_factor_uniaxial(s.s, s.n, axis)
        assert m == pytest.approx(stress_fix["fcc_schmid_factors"][i], abs=1e-12)

    # 3. Glide
    glide_fix = fixtures["glide"]
    tau_c = glide_fix["tau_c_pa"]
    M_d = glide_fix["M_d"]
    b = glide_fix["b_m"]

    for i, tau_val in enumerate(glide_fix["test_stresses_pa"]):
        v = calculate_glide_velocity(tau_val, tau_c, M_d, b)
        assert v == pytest.approx(glide_fix["expected_velocities_mps"][i], rel=1e-12)

    integ = glide_fix["integration_test"]
    pos = integrate_dislocation_position(
        integ["pos_0"], integ["velocity"], integ["dt"], integ["n_steps"]
    )
    assert pos == pytest.approx(integ["expected_pos"], rel=1e-12)
