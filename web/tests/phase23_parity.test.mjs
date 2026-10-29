/** Python-reference vs TypeScript parity for Phase 2/3 (golden fixtures from scripts/generate_phase23_fixtures.py). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFccLattice } from "../src/core/lattice.ts";
import { edgeDisplacement, burgersCircuit, circleLoop } from "../src/core/fields.ts";
import { runTrajectory } from "../src/core/simulation.ts";

const fx = JSON.parse(fs.readFileSync("tests/golden/phase23_fixtures.json", "utf-8"));
// Same IEEE-754 double formulas; Math.atan2/log may differ from libm by ~1 ulp -> rel 1e-12 justified.
const close = (a, b, rel = 1e-12, abs = 0) => assert.ok(Math.abs(a - b) <= Math.max(rel * Math.abs(b), abs), `${a} vs ${b}`);

test("parity: lattice", () => {
  const l = fx.lattice, p = generateFccLattice(l.a, ...l.cells);
  assert.equal(p.length / 3, l.count);
  l.first_atoms.flat().forEach((v, i) => close(p[i], v, 1e-15, 1e-30));
  l.last_atom.forEach((v, i) => close(p[p.length - 3 + i], v, 1e-15));
});

test("parity: edge displacement field", () => {
  const f = fx.field;
  f.points.forEach(([x, y], i) => {
    const [ux, uy] = edgeDisplacement(x, y, f.b, f.nu, f.rc);
    close(ux, f.u[i][0], 1e-12, 1e-24); close(uy, f.u[i][1], 1e-12, 1e-24);
  });
});

test("parity: Burgers circuit", () => {
  const f = fx.field, c = fx.circuit.loop;
  const enc = burgersCircuit(circleLoop(c.radius, c.n, c.centre), f.b, f.nu, f.rc);
  close(enc[0], fx.circuit.enclosing[0], 1e-9); close(enc[0], f.b, 1e-3);
  const non = burgersCircuit(circleLoop(5e-10, 2000, [5e-9, 1e-9]), f.b, f.nu, f.rc);
  assert.ok(Math.abs(non[0]) < 1e-3 * f.b && Math.abs(fx.circuit.not_enclosing[0]) < 1e-3 * f.b);
});

test("parity: glide trajectory (forward, reversal, threshold, boundary)", () => {
  const t = fx.trajectory;
  const init = { step: 0, t_s: 0, pos_m: 0, velocity_mps: 0, tau_rss_pa: 0, status: "initial", step_limited: false, applied_stress_pa: 0 };
  const traj = runTrajectory(init, t.taus, t.params);
  assert.equal(traj.length, t.pos.length);
  traj.forEach((s, i) => {
    close(s.pos_m, t.pos[i], 1e-12, 1e-24); close(s.velocity_mps, t.vel[i], 1e-12, 1e-24);
    assert.equal(s.status, t.status[i]); assert.equal(s.step_limited, t.step_limited[i]);
  });
});
