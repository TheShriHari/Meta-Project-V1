/**
 * web/tests/test_local_frame_parity.test.mjs
 * Parity and verification tests for coordinate frames, Peach-Koehler force,
 * line orientation, Burgers circuit sign, and stress-reversal consistency.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getFccSlipSystems } from "../src/core/slipsystems.ts";
import { vectorCross, vectorDot, vectorNorm } from "../src/core/vectors.ts";
import { makeUniaxialStressTensor, calculateResolvedShearStress } from "../src/core/stress.ts";
import { burgersCircuit, circleLoop } from "../src/core/fields.ts";
import { makeDislocationGeometry, displacedPositions } from "../src/core/dislocation.ts";

const systems = getFccSlipSystems();
const near = (a, b, tol, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (diff=${Math.abs(a - b)})`);

test("local frame is orthonormal and right-handed (det = +1)", () => {
  for (const sys of systems) {
    const s = sys.s;
    const n = sys.n;
    const xi = vectorCross(s, n);

    // Orthonormality
    near(vectorNorm(s), 1.0, 1e-12, "norm(s)");
    near(vectorNorm(n), 1.0, 1e-12, "norm(n)");
    near(vectorNorm(xi), 1.0, 1e-12, "norm(xi)");
    near(vectorDot(s, n), 0.0, 1e-12, "s.n");
    near(vectorDot(s, xi), 0.0, 1e-12, "s.xi");
    near(vectorDot(n, xi), 0.0, 1e-12, "n.xi");

    // Determinant of [s, n, xi]
    // det = s0*(n1*xi2 - n2*xi1) - s1*(n0*xi2 - n2*xi0) + s2*(n0*xi1 - n1*xi0)
    const det =
      s[0] * (n[1] * xi[2] - n[2] * xi[1]) -
      s[1] * (n[0] * xi[2] - n[2] * xi[0]) +
      s[2] * (n[0] * xi[1] - n[1] * xi[0]);
    near(det, 1.0, 1e-12, `det for system ${sys.index}`);
  }
});

test("Peach-Koehler glide force sign matches resolved shear stress", () => {
  const loading = [0.2, 0.3, 1.0];
  const bMag = 2.86e-10;

  for (const sign of [+1, -1]) {
    const sigma = makeUniaxialStressTensor(sign * 40e6, loading);
    for (const sys of systems) {
      const tau = calculateResolvedShearStress(sigma, sys.s, sys.n);
      const xi = vectorCross(sys.s, sys.n);

      // b_vec = bMag * s
      const bVec = [bMag * sys.s[0], bMag * sys.s[1], bMag * sys.s[2]];

      // sigma @ bVec
      const sigB = [
        sigma[0][0] * bVec[0] + sigma[0][1] * bVec[1] + sigma[0][2] * bVec[2],
        sigma[1][0] * bVec[0] + sigma[1][1] * bVec[1] + sigma[1][2] * bVec[2],
        sigma[2][0] * bVec[0] + sigma[2][1] * bVec[1] + sigma[2][2] * bVec[2],
      ];

      // F = (sigma @ b) x xi
      const F = vectorCross(sigB, xi);

      // Force component along slip direction s
      const F_glide = vectorDot(F, sys.s);
      near(F_glide, bMag * tau, 1e-14, `Glide force for system ${sys.index}`);

      // Force component out of slip plane along line direction xi must be 0
      near(vectorDot(F, xi), 0.0, 1e-14, `Line-parallel force for system ${sys.index}`);
    }
  }
});

test("Burgers circuit closure sign is +b for right-handed orientation around xi", () => {
  const b = 1.0;
  const nu = 0.3;
  const rc = 1.0;

  // Counter-clockwise circuit in (x, y) = positive orientation around +z (xi)
  const ccwLoop = circleLoop(5.0, 4000);
  const [cx, cy] = burgersCircuit(ccwLoop, b, nu, rc);
  near(cx, b, 1e-3, "CCW loop closes to +b");
  near(cy, 0.0, 1e-3, "uy closes to 0");

  // Clockwise loop closes to -b
  const cwLoop = circleLoop(5.0, 4000).reverse();
  const [cx_cw, cy_cw] = burgersCircuit(cwLoop, b, nu, rc);
  near(cx_cw, -b, 1e-3, "CW loop closes to -b");
});
