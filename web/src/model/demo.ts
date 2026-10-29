/**
 * web/src/model/demo.ts - Builds the demo structure + controller from the tested core.
 *
 * PARAMETER PROVENANCE (all values below are ILLUSTRATIVE, shown as such in the UI):
 *  - a_m   = 4.0495e-10 m : Al-like lattice parameter as recorded in materials.yaml, but material
 *            parameters (decision M6) are NOT approved, so it is used only as an illustrative number.
 *  - nu    = 0.33          : illustrative Poisson ratio.
 *  - tau_c = 5 MPa, M_d = 1e4 1/(Pa s) : illustrative; chosen so motion is visible, NOT material data.
 *  - rc    = b             : core radius per spec 5.4 (rc ~ b), configurable.
 *  - dt    = 2e-13 s       : fixed physics step. Nothing here is a verified material prediction.
 * Equations (RSS, glide, field) all come from the core modules.
 */
import { generateFccLattice } from "../core/lattice.ts";
import { calculateBurgersMagnitude, getFccSlipSystems, type SlipSystem } from "../core/slipsystems.ts";
import { rotationMatrixEulerZXZ, transformVectorCrystalToSpecimen } from "../core/rotations.ts";
import { schmidFactorUniaxial, makeUniaxialStressTensor } from "../core/stress.ts";
import { makeDislocationGeometry } from "../core/dislocation.ts";
import { SimulationController } from "../core/controller.ts";
import { evaluateBoundaryTransmission, type TransmissionResult } from "../core/boundary.ts";
import type { Vec3, Mat3 } from "../core/vectors.ts";

export const ILLUSTRATIVE = {
  a_m: 4.0495e-10,
  nu: 0.33,
  tau_c_pa: 5e6,
  M_d: 1e4,
  dt_s: 2e-13,
  // Phase 4 illustrative test values (uncalibrated M6 parameter):
  tau_star_ref_pa: 50e6,
  tau_tip_pa: 80e6,
  beta: 1.0,
  m_prime_min: 0.70,
} as const;

export const LOADING_AXES: Record<string, Vec3> = {
  "[001]": [0, 0, 1],
  "[011]": [0, 1, 1],
  "[111]": [1, 1, 1],
  "[123]": [1, 2, 3],
};

export interface DemoOptions {
  cells: number;
  systemIndex: number;
  axisKey: string;
  appliedStress_pa: number;
  grain2TiltDeg?: number;
  mPrimeMin?: number;
  useIllustrativeTauStar?: boolean;
  illustrativeTauStarRef_pa?: number;
  illustrativeTauTip_pa?: number;
  beta?: number;
}

export function bestSystemIndex(axis: Vec3): number {
  let best = 0, bm = -Infinity;
  getFccSlipSystems().forEach((sys, i) => {
    const m = schmidFactorUniaxial(sys.s, sys.n, axis);
    if (m > bm + 1e-12) { bm = m; best = i; }
  });
  return best;
}

export function buildDemo(o: DemoOptions) {
  const a = ILLUSTRATIVE.a_m;
  const b = calculateBurgersMagnitude(a, "FCC");
  const sys: SlipSystem = getFccSlipSystems()[o.systemIndex];
  const axis = LOADING_AXES[o.axisKey];

  // Grain 1: identity orientation R1 in specimen frame
  const R1: Mat3 = rotationMatrixEulerZXZ(0, 0, 0);
  const s = transformVectorCrystalToSpecimen(sys.s, R1);
  const n = transformVectorCrystalToSpecimen(sys.n, R1);

  // Grain 2: adjacent grain with controlled columnar tilt misorientation
  const tiltDeg = o.grain2TiltDeg ?? 15;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const R2: Mat3 = rotationMatrixEulerZXZ(tiltRad, 0, 0);

  const L = o.cells * a;
  const box: Vec3 = [L, L, L];
  const ideal = generateFccLattice(a, o.cells, o.cells, o.cells);
  const geom = makeDislocationGeometry(s, n, a, box);
  const field = { b_m: b, nu: ILLUSTRATIVE.nu, rc_m: b };
  const controller = new SimulationController({
    params: {
      b_m: b, tau_c_pa: ILLUSTRATIVE.tau_c_pa, M_d: ILLUSTRATIVE.M_d, dt_s: ILLUSTRATIVE.dt_s,
      domain_min_m: geom.tMin, domain_max_m: geom.tMax, max_step_m: 0.25 * b,
    },
    s, n, loadingAxis: axis, appliedStress_pa: o.appliedStress_pa,
  });

  // Phase 4: Evaluate boundary transmission
  const sigmaSpecimen = makeUniaxialStressTensor(o.appliedStress_pa, axis);
  const mPrimeMin = o.mPrimeMin ?? ILLUSTRATIVE.m_prime_min;
  const useIllustrative = o.useIllustrativeTauStar ?? false;
  const tauStarRef = useIllustrative ? (o.illustrativeTauStarRef_pa ?? ILLUSTRATIVE.tau_star_ref_pa) : null;
  const tauTip = o.illustrativeTauTip_pa ?? ILLUSTRATIVE.tau_tip_pa;
  const beta = o.beta ?? ILLUSTRATIVE.beta;

  const transmission: TransmissionResult = evaluateBoundaryTransmission(
    o.systemIndex,
    R1,
    R2,
    b,
    sigmaSpecimen,
    tauTip,
    {
      mPrimeMin,
      tauCPa: ILLUSTRATIVE.tau_c_pa,
      tauStarRefPa: tauStarRef,
      beta,
    }
  );

  return {
    a_m: a,
    b_m: b,
    box_m: box,
    ideal,
    geom,
    field,
    controller,
    system: sys,
    schmid: schmidFactorUniaxial(sys.s, sys.n, axis),
    // Phase 4 additions:
    R1,
    R2,
    grain2TiltDeg: tiltDeg,
    transmission,
    thresholdsUsed: {
      mPrimeMin,
      tauCPa: ILLUSTRATIVE.tau_c_pa,
      tauStarRefPa: tauStarRef,
      tauTipPa: tauTip,
      beta,
    },
  };
}

export type Demo = ReturnType<typeof buildDemo>;

