"""Generate deterministic Python-reference fixtures for Phase 4 boundary transmission parity.
Run: python scripts/generate_phase4_fixtures.py
"""
import json
import numpy as np
from hpsim.core.slipsystems import calculate_burgers_magnitude
from hpsim.core.rotations import rotation_matrix_euler_zxz
from hpsim.core.stress import make_uniaxial_stress_tensor
from hpsim.core.boundary import (
    TransmissionThresholds,
    evaluate_boundary_transmission,
)

A_FCC = 4.0495e-10
B_FCC = calculate_burgers_magnitude(A_FCC, "FCC")

# Case 1: Identical orientations (transmitted)
R_in1 = np.eye(3).tolist()
R_out1 = np.eye(3).tolist()
sigma1 = make_uniaxial_stress_tensor(45e6, [0.0, 0.0, 1.0]).tolist()
thresh1 = TransmissionThresholds(m_prime_min=0.5, tau_c_pa=5e6, tau_star_ref_pa=15e6, beta=0.2)
res1 = evaluate_boundary_transmission(0, np.array(R_in1), np.array(R_out1), B_FCC, np.array(sigma1), 25e6, thresh1)

# Case 2: Controlled misorientation (grain 2 rotated 45 deg around [001])
R_in2 = rotation_matrix_euler_zxz(0.1, 0.2, 0.3).tolist()
R_out2 = rotation_matrix_euler_zxz(0.8, 0.4, 0.5).tolist()
sigma2 = make_uniaxial_stress_tensor(60e6, [1.0, 1.0, 2.0]).tolist()
thresh2 = TransmissionThresholds(m_prime_min=0.4, tau_c_pa=4e6, tau_star_ref_pa=20e6, beta=0.1)
res2 = evaluate_boundary_transmission(3, np.array(R_in2), np.array(R_out2), B_FCC, np.array(sigma2), 30e6, thresh2)

# Case 3: Pinned due to low tip stress
thresh3 = TransmissionThresholds(m_prime_min=0.4, tau_c_pa=4e6, tau_star_ref_pa=50e6, beta=0.0)
res3 = evaluate_boundary_transmission(3, np.array(R_in2), np.array(R_out2), B_FCC, np.array(sigma2), 10e6, thresh3)

# Case 4: Unresolved threshold (tau_star_ref is None)
thresh4 = TransmissionThresholds(m_prime_min=0.4, tau_c_pa=4e6, tau_star_ref_pa=None, beta=0.0)
res4 = evaluate_boundary_transmission(3, np.array(R_in2), np.array(R_out2), B_FCC, np.array(sigma2), 30e6, thresh4)

def serialize_result(res):
    sel = None
    if res.selected_candidate:
        c = res.selected_candidate
        sel = {
            "system_index": c.system_index,
            "plane_miller": list(c.plane_miller),
            "direction_miller": list(c.direction_miller),
            "s_specimen": c.s_specimen.tolist(),
            "n_specimen": c.n_specimen.tolist(),
            "m_prime": c.m_prime,
            "residual_b_m": c.residual_b_m,
            "tau_out_pa": c.tau_out_pa,
            "tau_star_pa": c.tau_star_pa,
            "passed_all": c.passed_all,
        }
    candidates = []
    for c in res.candidates:
        candidates.append({
            "system_index": c.system_index,
            "m_prime": c.m_prime,
            "residual_b_m": c.residual_b_m,
            "tau_out_pa": c.tau_out_pa,
            "tau_star_pa": c.tau_star_pa,
            "passed_m_prime": c.passed_m_prime,
            "passed_tau_out": c.passed_tau_out,
            "passed_tau_tip": c.passed_tau_tip,
            "passed_all": c.passed_all,
            "reasons": c.rejection_reasons,
        })
    return {
        "outcome": res.outcome,
        "incoming_system_index": res.incoming_system_index,
        "selected_candidate": sel,
        "candidates": candidates,
        "summary_log": res.summary_log,
    }

fixtures = {
    "case1_identical": {
        "R_in": R_in1,
        "R_out": R_out1,
        "sigma": sigma1,
        "tau_tip": 25e6,
        "thresholds": {"m_prime_min": 0.5, "tau_c_pa": 5e6, "tau_star_ref_pa": 15e6, "beta": 0.2},
        "result": serialize_result(res1),
    },
    "case2_misoriented": {
        "R_in": R_in2,
        "R_out": R_out2,
        "sigma": sigma2,
        "tau_tip": 30e6,
        "thresholds": {"m_prime_min": 0.4, "tau_c_pa": 4e6, "tau_star_ref_pa": 20e6, "beta": 0.1},
        "result": serialize_result(res2),
    },
    "case3_pinned": {
        "R_in": R_in2,
        "R_out": R_out2,
        "sigma": sigma2,
        "tau_tip": 10e6,
        "thresholds": {"m_prime_min": 0.4, "tau_c_pa": 4e6, "tau_star_ref_pa": 50e6, "beta": 0.0},
        "result": serialize_result(res3),
    },
    "case4_unresolved": {
        "R_in": R_in2,
        "R_out": R_out2,
        "sigma": sigma2,
        "tau_tip": 30e6,
        "thresholds": {"m_prime_min": 0.4, "tau_c_pa": 4e6, "tau_star_ref_pa": None, "beta": 0.0},
        "result": serialize_result(res4),
    },
}

with open("tests/golden/phase4_fixtures.json", "w") as f:
    json.dump(fixtures, f, indent=2)

print("Successfully wrote tests/golden/phase4_fixtures.json")
