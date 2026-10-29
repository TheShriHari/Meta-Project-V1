/** Phase 2/3 TypeScript core tests (node:test). Synthetic fixtures only; not material data. */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFccLattice, FCC_BASIS_FRACTIONAL } from "../src/core/lattice.ts";
import { edgeDisplacement, burgersCircuit, circleLoop } from "../src/core/fields.ts";
import { makeDislocationGeometry, displacedPositions } from "../src/core/dislocation.ts";
import { getFccSlipSystems } from "../src/core/slipsystems.ts";

const near = (a, b, tol, m = "") => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

test("FCC basis, counts, finiteness, repeatability", () => {
  assert.equal(FCC_BASIS_FRACTIONAL.length, 4);
  const p = generateFccLattice(1, 3, 4, 5);
  assert.equal(p.length, 3 * 4 * 3 * 4 * 5);
  assert.ok(p.every(Number.isFinite));
  assert.deepEqual(Array.from(p), Array.from(generateFccLattice(1, 3, 4, 5)));
  for (let i = 0; i < p.length; i += 3) {
    assert.ok(p[i] >= 0 && p[i] < 3 && p[i + 1] < 4 && p[i + 2] < 5);
  }
});

test("FCC nearest-neighbour distance a/sqrt2 with coordination 12", () => {
  const a = 2.5;
  const p = generateFccLattice(a, 4, 4, 4);
  let best = 0, bd = 1e9;
  for (let i = 0; i < p.length / 3; i++) {
    const d = Math.hypot(p[3 * i] - 2 * a, p[3 * i + 1] - 2 * a, p[3 * i + 2] - 2 * a);
    if (d < bd) { bd = d; best = i; }
  }
  let n = 0, dmin = 1e9;
  for (let j = 0; j < p.length / 3; j++) {
    if (j === best) continue;
    const d = Math.hypot(p[3 * j] - p[3 * best], p[3 * j + 1] - p[3 * best + 1], p[3 * j + 2] - p[3 * best + 2]);
    dmin = Math.min(dmin, d);
    if (Math.abs(d - a / Math.SQRT2) < 1e-9) n++;
  }
  near(dmin, a / Math.SQRT2, 1e-12);
  assert.equal(n, 12);
});

test("edge field: finite at the core (regularised), branch-cut jump +b behind, none ahead", () => {
  const [ux, uy] = edgeDisplacement(0, 1e-12, 1, 0.3, 1);
  assert.ok(Number.isFinite(ux) && Number.isFinite(uy));
  const e = 1e-9;
  near(edgeDisplacement(-5, e, 1, 0.3, 1)[0] - edgeDisplacement(-5, -e, 1, 0.3, 1)[0], 1, 1e-6);
  near(edgeDisplacement(5, e, 1, 0.3, 1)[0] - edgeDisplacement(5, -e, 1, 0.3, 1)[0], 0, 1e-6);
});

test("Burgers circuit: enclosing = b, not enclosing = 0, clockwise = -b (tol 1e-3 b)", () => {
  for (const r of [3, 10, 50]) {
    const [cx, cy] = burgersCircuit(circleLoop(r, 4000, [0.4, -0.3]), 1, 0.3, 1);
    near(cx, 1, 1e-3, "enclosing"); near(cy, 0, 1e-3);
  }
  const [zx, zy] = burgersCircuit(circleLoop(2, 2000, [10, 3]), 1, 0.3, 1);
  near(zx, 0, 1e-3); near(zy, 0, 1e-3);
  near(burgersCircuit(circleLoop(5, 4000).reverse(), 1, 0.3, 1)[0], -1, 1e-3);
  assert.throws(() => burgersCircuit(circleLoop(5, 2), 1, 0.3, 1));
});

test("displaced render coordinates are separate from ideal coordinates", () => {
  const a = 4.0495e-10;
  const ideal = generateFccLattice(a, 4, 4, 4);
  const copy = Float64Array.from(ideal);
  const sys = getFccSlipSystems()[0];
  const g = makeDislocationGeometry(sys.s, sys.n, a, [4 * a, 4 * a, 4 * a]);
  const out = displacedPositions(ideal, g, 0, { b_m: a / Math.SQRT2, nu: 0.33, rc_m: a / Math.SQRT2 });
  assert.deepEqual(Array.from(ideal), Array.from(copy), "ideal must not be mutated");
  assert.equal(out.length, ideal.length);
  assert.ok(out.every(Number.isFinite));
  let maxu = 0;
  for (let i = 0; i < out.length; i++) maxu = Math.max(maxu, Math.abs(out[i] - ideal[i]));
  assert.ok(maxu > 0 && maxu < 2 * a);
  assert.ok(g.tMin < 0 && g.tMax > 0 && g.tMin < g.tMax);
});

test("no lattice atom sits on the branch cut (slip plane between atomic planes)", () => {
  const a = 1;
  const ideal = generateFccLattice(a, 5, 5, 5);
  for (const sys of getFccSlipSystems()) {
    const g = makeDislocationGeometry(sys.s, sys.n, a, [5, 5, 5]);
    for (let i = 0; i < ideal.length; i += 3) {
      const y = (ideal[i] - g.p0[0]) * sys.n[0] + (ideal[i + 1] - g.p0[1]) * sys.n[1] + (ideal[i + 2] - g.p0[2]) * sys.n[2];
      assert.ok(Math.abs(y) > 0.1 * a / Math.sqrt(3), `atom on cut for system ${sys.index}`);
    }
  }
});
