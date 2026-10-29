/**
 * web/src/core/stress.ts - Stress tensor and resolved shear stress in pure TypeScript.
 * Matches Python hpsim.core.stress.
 */

import type { Mat3, Vec3 } from "./vectors.ts";
import { normalizeVector, vectorDot } from "./vectors.ts";

export function makeStressTensor(
  sigmaXx: number,
  sigmaYy: number,
  sigmaZz: number,
  tauXy: number,
  tauYz: number,
  tauZx: number
): Mat3 {
  return [
    [sigmaXx, tauXy, tauZx],
    [tauXy, sigmaYy, tauYz],
    [tauZx, tauYz, sigmaZz],
  ];
}

export function makeUniaxialStressTensor(
  sigmaApp: number,
  loadingAxis: Vec3
): Mat3 {
  const t = normalizeVector(loadingAxis);
  return [
    [sigmaApp * t[0] * t[0], sigmaApp * t[0] * t[1], sigmaApp * t[0] * t[2]],
    [sigmaApp * t[1] * t[0], sigmaApp * t[1] * t[1], sigmaApp * t[1] * t[2]],
    [sigmaApp * t[2] * t[0], sigmaApp * t[2] * t[1], sigmaApp * t[2] * t[2]],
  ];
}

export function calculateResolvedShearStress(
  sigma: Mat3,
  s: Vec3,
  n: Vec3
): number {
  // tau_RSS = s.T @ sigma @ n
  const sigmaN: Vec3 = [
    sigma[0][0] * n[0] + sigma[0][1] * n[1] + sigma[0][2] * n[2],
    sigma[1][0] * n[0] + sigma[1][1] * n[1] + sigma[1][2] * n[2],
    sigma[2][0] * n[0] + sigma[2][1] * n[1] + sigma[2][2] * n[2],
  ];
  return vectorDot(s, sigmaN);
}

export function schmidFactorUniaxial(
  s: Vec3,
  n: Vec3,
  loadingAxis: Vec3
): number {
  const t = normalizeVector(loadingAxis);
  const sUnit = normalizeVector(s);
  const nUnit = normalizeVector(n);
  const cosPhi = vectorDot(nUnit, t);
  const cosLambda = vectorDot(sUnit, t);
  return cosPhi * cosLambda;
}
