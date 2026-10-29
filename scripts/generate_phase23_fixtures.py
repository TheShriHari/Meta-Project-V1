"""Generate deterministic Python-reference fixtures for Phase 2/3 TS parity.
Synthetic equation-test inputs only (not material data). Run: python scripts/generate_phase23_fixtures.py
"""
import json
import numpy as np
from hpsim.core.lattice import generate_fcc_lattice
from hpsim.core.fields import edge_displacement, burgers_circuit, circle_loop
from hpsim.core.simulation import GlideParams, SimState, run_trajectory

B, NU, RC = 2.0e-10, 0.33, 2.0e-10
rng = np.random.default_rng(20261020)  # seeded sample points
pts = np.column_stack([rng.uniform(-3e-9, 3e-9, 40), rng.uniform(-3e-9, 3e-9, 40)])
pts[:, 1] += np.where(np.abs(pts[:, 1]) < 1e-12, 1e-11, 0.0)  # keep off the exact branch cut
u = [list(edge_displacement(float(x), float(y), B, NU, RC)) for x, y in pts]

lat = generate_fcc_lattice(4.0495e-10, 3, 3, 3)
loop = circle_loop(1.0e-9, 4000, centre=(2e-10, -1e-10))
P = GlideParams(b_m=B, tau_c_pa=5e6, M_d=1e4, dt_s=1e-13, domain_min_m=-1e-9, domain_max_m=1e-9, max_step_m=5e-11)
taus = [9e6] * 120 + [-12e6] * 200 + [3e6] * 5
traj = run_trajectory(SimState(0, 0.0, 0.0), taus, P)

out = {
    "field": {"b": B, "nu": NU, "rc": RC, "points": pts.tolist(), "u": u},
    "circuit": {"enclosing": list(burgers_circuit(loop, B, NU, RC)),
                "not_enclosing": list(burgers_circuit(circle_loop(5e-10, 2000, centre=(5e-9, 1e-9)), B, NU, RC)),
                "loop": {"radius": 1.0e-9, "n": 4000, "centre": [2e-10, -1e-10]}},
    "lattice": {"a": 4.0495e-10, "cells": [3, 3, 3], "first_atoms": lat[:12].tolist(), "last_atom": lat[-1].tolist(), "count": len(lat)},
    "trajectory": {"params": P.__dict__, "taus": taus,
                   "pos": [s.pos_m for s in traj], "vel": [s.velocity_mps for s in traj],
                   "status": [s.status for s in traj], "step_limited": [s.step_limited for s in traj]},
}
with open("tests/golden/phase23_fixtures.json", "w") as f:
    json.dump(out, f, indent=1)
print("wrote tests/golden/phase23_fixtures.json")
