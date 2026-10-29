/**
 * web/tests/phase1_parity.test.mjs - Parity tests comparing TypeScript math kernel with Python golden fixtures.
 * Run natively with Node 24: node --test web/tests/phase1_parity.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  nmToM,
  mToNm,
  umToM,
  mToUm,
  mpaToPa,
  paToMpa,
  gpaToPa,
  paToGpa,
} from "../src/core/units.ts";

import {
  vectorNorm,
  normalizeVector,
  vectorDot,
  vectorCross,
  matrixDeterminant,
  isOrthonormalMatrix,
} from "../src/core/vectors.ts";

import {
  rotationMatrixEulerZXZ,
  transformVectorCrystalToSpecimen,
} from "../src/core/rotations.ts";

import {
  getFccSlipSystems,
  getBccSlipSystems,
  calculateBurgersMagnitude,
} from "../src/core/slipsystems.ts";

import {
  makeUniaxialStressTensor,
  calculateResolvedShearStress,
  schmidFactorUniaxial,
} from "../src/core/stress.ts";

import {
  calculateGlideVelocity,
  integrateDislocationPosition,
} from "../src/core/glide.ts";

const fixturesPath = path.resolve("tests/golden/phase1_fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

function assertApprox(actual, expected, tol = 1e-12, msg = "", absTol = 1e-6) {
  if (typeof msg === "number") {
    const tmp = msg;
    msg = typeof absTol === "string" ? absTol : "";
    absTol = tmp;
  }
  const diff = Math.abs(actual - expected);
  const maxMag = Math.max(Math.abs(actual), Math.abs(expected));
  const relDiff = maxMag > 0 ? diff / maxMag : diff;
  assert.ok(
    relDiff <= tol || diff <= absTol,
    `${msg}: actual=${actual}, expected=${expected}, diff=${diff}, relDiff=${relDiff}`
  );
}

test("Units parity test", () => {
  const u = fixtures.units;
  assertApprox(nmToM(u.nm_to_m_test.input_nm), u.nm_to_m_test.expected_m);
  assertApprox(mpaToPa(u.mpa_to_pa_test.input_mpa), u.mpa_to_pa_test.expected_pa);
  assertApprox(gpaToPa(u.gpa_to_pa_test.input_gpa), u.gpa_to_pa_test.expected_pa);
  assertApprox(umToM(u.um_to_m_test.input_um), u.um_to_m_test.expected_m);
});

test("Rotations parity test", () => {
  const rFix = fixtures.rotations;
  const angles = rFix.euler_zxz.angles;
  const R = rotationMatrixEulerZXZ(angles[0], angles[1], angles[2]);

  assert.ok(isOrthonormalMatrix(R, 1e-12));
  assertApprox(matrixDeterminant(R), 1.0, 1e-12);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assertApprox(R[i][j], rFix.euler_zxz.R[i][j], 1e-12, `R[${i}][${j}]`);
    }
  }

  // Vector transform
  const vTrans = transformVectorCrystalToSpecimen(
    rFix.transform_vector.v_input,
    R
  );
  for (let i = 0; i < 3; i++) {
    assertApprox(
      vTrans[i],
      rFix.transform_vector.v_output[i],
      1e-12,
      `vTrans[${i}]`
    );
  }
});

test("Slip systems parity test", () => {
  const sFix = fixtures.slipsystems;

  // FCC
  const fcc = getFccSlipSystems();
  assert.equal(fcc.length, sFix.fcc_count);
  for (let i = 0; i < fcc.length; i++) {
    const gold = sFix.fcc_systems[i];
    for (let j = 0; j < 3; j++) {
      assertApprox(fcc[i].n[j], gold.n[j], 1e-12, `fcc[${i}].n[${j}]`);
      assertApprox(fcc[i].s[j], gold.s[j], 1e-12, `fcc[${i}].s[${j}]`);
    }
  }

  // BCC
  const bcc = getBccSlipSystems();
  assert.equal(bcc.length, sFix.bcc_count);
  for (let i = 0; i < bcc.length; i++) {
    const gold = sFix.bcc_systems[i];
    for (let j = 0; j < 3; j++) {
      assertApprox(bcc[i].n[j], gold.n[j], 1e-12, `bcc[${i}].n[${j}]`);
      assertApprox(bcc[i].s[j], gold.s[j], 1e-12, `bcc[${i}].s[${j}]`);
    }
  }

  // Burgers magnitude
  assertApprox(
    calculateBurgersMagnitude(4.0495e-10, "FCC"),
    sFix.burgers_magnitudes.al_fcc,
    1e-12
  );
  assertApprox(
    calculateBurgersMagnitude(2.8665e-10, "BCC"),
    sFix.burgers_magnitudes.fe_bcc,
    1e-12
  );
});

test("Stress and Schmid factor parity test", () => {
  const stFix = fixtures.stress;
  const fcc = getFccSlipSystems();
  const sigma = makeUniaxialStressTensor(
    stFix.sigma_app_pa,
    stFix.uniaxial_axis
  );

  for (let i = 0; i < fcc.length; i++) {
    const tau = calculateResolvedShearStress(sigma, fcc[i].s, fcc[i].n);
    assertApprox(tau, stFix.fcc_rss_pa[i], 1e-12, `RSS[${i}]`);

    const m = schmidFactorUniaxial(fcc[i].s, fcc[i].n, stFix.uniaxial_axis);
    assertApprox(m, stFix.fcc_schmid_factors[i], 1e-12, `Schmid[${i}]`);
  }
});

test("Glide law parity test", () => {
  const gFix = fixtures.glide;
  const tauC = gFix.tau_c_pa;
  const Md = gFix.M_d;
  const b = gFix.b_m;

  for (let i = 0; i < gFix.test_stresses_pa.length; i++) {
    const tau = gFix.test_stresses_pa[i];
    const v = calculateGlideVelocity(tau, tauC, Md, b);
    assertApprox(v, gFix.expected_velocities_mps[i], 1e-12, `v[${i}]`);
  }

  const integ = gFix.integration_test;
  const pos = integrateDislocationPosition(
    integ.pos_0,
    integ.velocity,
    integ.dt,
    integ.n_steps
  );
  assertApprox(pos, integ.expected_pos, 1e-12, "integrated pos");
});
