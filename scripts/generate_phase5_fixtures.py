"""
scripts/generate_phase5_fixtures.py - Generate verified golden fixtures for Phase 5 pile-up parity tests.

Provenance:
  - Theoretical framework: J. D. Eshelby, F. C. Frank, F. R. N. Nabarro (1951), Phil. Mag. 42, 351-364.
  - Interaction parameter: A = mu * b / [2*pi*(1 - nu)].
  - Exact roots: Zeros of associated Laguerre polynomial L_{N-1}^{(1)}(2*lambda*x) = 0 via Golub-Welsch (1969).
  - Units: SI (mu in Pa, nu dimensionless, b in m, tau in Pa, positions in m, residuals in Pa).
"""
import json
import os
import sys

# Ensure src is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

import numpy as np
from hpsim.core.pileup import (
    compute_efn_exact_positions,
    compute_pileup_prefactor,
    compute_pileup_residuals,
    solve_pileup_equilibrium,
    PileupInputs,
)

MU_AL = 26.0e9
NU_AL = 0.33
B_AL = 4.0495e-10 / np.sqrt(2.0)  # ~ 2.863378e-10 m

MU_CU = 48.0e9
NU_CU = 0.34
B_CU = 3.615e-10 / np.sqrt(2.0)  # ~ 2.556191e-10 m


def generate_fixtures():
    fixtures = {
        "metadata": {
            "source": "Eshelby, Frank & Nabarro (1951) Phil. Mag. 42:351-364",
            "method": "Golub-Welsch (1969) tridiagonal Jacobi matrix eigensolver for L_{N-1}^{(1)} zeros",
            "units": "SI (Pa, m, dimensionless)",
        }
    }

    # Case 1: Analytical N=3 in Al
    in1 = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_AL, tau_applied_pa=50e6, count=3)
    res1 = solve_pileup_equilibrium(in1)
    A1 = compute_pileup_prefactor(MU_AL, NU_AL, B_AL)
    lam1 = 50e6 / A1
    fixtures["case1_small_pileup_n3"] = {
        "material": "Aluminium",
        "mu_pa": MU_AL,
        "nu": NU_AL,
        "burgers_m": B_AL,
        "tau_applied_pa": 50e6,
        "count": 3,
        "A_pa_m": A1,
        "lambda_inv_m": lam1,
        "analytical_xi": [float(3.0 - np.sqrt(3.0)), float(3.0 + np.sqrt(3.0))],
        "positions_m": res1.positions_m.tolist(),
        "residuals_pa": res1.residuals_pa.tolist(),
        "max_residual_pa": res1.max_residual_pa,
        "tip_stress_pa": res1.tip_stress_pa,
        "pileup_length_m": res1.pileup_length_m,
    }

    # Case 2: Medium pile-up N=8 in Al
    in2 = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_AL, tau_applied_pa=45e6, count=8)
    res2 = solve_pileup_equilibrium(in2)
    fixtures["case2_medium_pileup_n8"] = {
        "material": "Aluminium",
        "mu_pa": MU_AL,
        "nu": NU_AL,
        "burgers_m": B_AL,
        "tau_applied_pa": 45e6,
        "count": 8,
        "positions_m": res2.positions_m.tolist(),
        "residuals_pa": res2.residuals_pa.tolist(),
        "max_residual_pa": res2.max_residual_pa,
        "tip_stress_pa": res2.tip_stress_pa,
        "pileup_length_m": res2.pileup_length_m,
    }

    # Case 3: Copper pile-up N=15
    in3 = PileupInputs(mu_pa=MU_CU, nu=NU_CU, burgers_m=B_CU, tau_applied_pa=60e6, count=15)
    res3 = solve_pileup_equilibrium(in3)
    fixtures["case3_copper_pileup_n15"] = {
        "material": "Copper",
        "mu_pa": MU_CU,
        "nu": NU_CU,
        "burgers_m": B_CU,
        "tau_applied_pa": 60e6,
        "count": 15,
        "positions_m": res3.positions_m.tolist(),
        "residuals_pa": res3.residuals_pa.tolist(),
        "max_residual_pa": res3.max_residual_pa,
        "tip_stress_pa": res3.tip_stress_pa,
        "pileup_length_m": res3.pileup_length_m,
    }

    # Case 4: High stress pile-up N=25 in Al
    in4 = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_AL, tau_applied_pa=120e6, count=25)
    res4 = solve_pileup_equilibrium(in4)
    fixtures["case4_high_stress_pileup_n25"] = {
        "material": "Aluminium",
        "mu_pa": MU_AL,
        "nu": NU_AL,
        "burgers_m": B_AL,
        "tau_applied_pa": 120e6,
        "count": 25,
        "positions_m": res4.positions_m.tolist(),
        "residuals_pa": res4.residuals_pa.tolist(),
        "max_residual_pa": res4.max_residual_pa,
        "tip_stress_pa": res4.tip_stress_pa,
        "pileup_length_m": res4.pileup_length_m,
    }

    # Case 5: Damped Newton solve from perturbed initial guess N=4
    # Compute true positions
    in5_exact = PileupInputs(mu_pa=MU_AL, nu=NU_AL, burgers_m=B_AL, tau_applied_pa=50e6, count=4)
    exact_pos = compute_efn_exact_positions(in5_exact)
    # Perturb mobile dislocations by +5%
    perturbed = np.copy(exact_pos)
    perturbed[1:] *= 1.05
    in5 = PileupInputs(
        mu_pa=MU_AL,
        nu=NU_AL,
        burgers_m=B_AL,
        tau_applied_pa=50e6,
        count=4,
        tolerance_pa=1e-4,
        max_iterations=50,
        initial_positions_m=perturbed,
    )
    res5 = solve_pileup_equilibrium(in5)
    fixtures["case5_newton_perturbed_n4"] = {
        "material": "Aluminium",
        "mu_pa": MU_AL,
        "nu": NU_AL,
        "burgers_m": B_AL,
        "tau_applied_pa": 50e6,
        "count": 4,
        "initial_positions_m": perturbed.tolist(),
        "tolerance_pa": 1e-4,
        "status": res5.status,
        "converged": res5.converged,
        "iterations": res5.iterations,
        "positions_m": res5.positions_m.tolist(),
        "residuals_pa": res5.residuals_pa.tolist(),
        "max_residual_pa": res5.max_residual_pa,
        "tip_stress_pa": res5.tip_stress_pa,
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "tests", "golden", "phase5_fixtures.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=2)
    print(f"Phase 5 golden fixtures successfully written to {out_path}")


if __name__ == "__main__":
    generate_fixtures()
