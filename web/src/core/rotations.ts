/**
 * web/src/core/rotations.ts - 3D crystal-to-specimen rotation transforms.
 * Pure TypeScript implementation matching Python hpsim.core.rotations.
 */

import type { Mat3, Vec3 } from "./vectors.ts";
import {
  matrixMultiply,
  matrixMultiplyVec,
  matrixTranspose,
} from "./vectors.ts";

export function rotationMatrixEulerZXZ(
  phi1: number,
  Phi: number,
  phi2: number
): Mat3 {
  const c1 = Math.cos(phi1);
  const s1 = Math.sin(phi1);
  const cP = Math.cos(Phi);
  const sP = Math.sin(Phi);
  const c2 = Math.cos(phi2);
  const s2 = Math.sin(phi2);

  const Rz1: Mat3 = [
    [c1, -s1, 0],
    [s1, c1, 0],
    [0, 0, 1],
  ];

  const Rx: Mat3 = [
    [1, 0, 0],
    [0, cP, -sP],
    [0, sP, cP],
  ];

  const Rz2: Mat3 = [
    [c2, -s2, 0],
    [s2, c2, 0],
    [0, 0, 1],
  ];

  return matrixMultiply(matrixMultiply(Rz1, Rx), Rz2);
}

export function transformVectorCrystalToSpecimen(
  vCryst: Vec3,
  R: Mat3
): Vec3 {
  return matrixMultiplyVec(R, vCryst);
}

export function transformVectorSpecimenToCrystal(
  vSpec: Vec3,
  R: Mat3
): Vec3 {
  return matrixMultiplyVec(matrixTranspose(R), vSpec);
}

export function transformStressSpecimenToCrystal(
  sigmaSpec: Mat3,
  R: Mat3
): Mat3 {
  const Rt = matrixTranspose(R);
  return matrixMultiply(matrixMultiply(Rt, sigmaSpec), R);
}

export function transformStressCrystalToSpecimen(
  sigmaCryst: Mat3,
  R: Mat3
): Mat3 {
  const Rt = matrixTranspose(R);
  return matrixMultiply(matrixMultiply(R, sigmaCryst), Rt);
}
