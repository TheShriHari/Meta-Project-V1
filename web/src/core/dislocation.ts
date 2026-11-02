/**
 * web/src/core/dislocation.ts - Place a straight edge dislocation on a slip system inside a finite block
 * and compute displaced render coordinates r_i = R_i + u(R_i; r_d). Pure math; no rendering imports.
 *
 * Local frame: x -> slip direction s, y -> slip-plane normal n, line xi = s x n (along z, right-handed).
 * The slip plane is placed midway between two atomic {111} planes (offset d111/2) so no atom lies on the
 * branch cut. Core position along the line is the scalar `pos` (metres) measured from p0.
 */
import type { Vec3 } from "./vectors.ts";
import { edgeDisplacement } from "./fields.ts";

export interface DislocationGeometry {
  s: Vec3;
  n: Vec3;
  /** Point on the slip plane nearest the block centre; origin of `pos` (metres). */
  p0: Vec3;
  /** Interplanar-offset coordinate of the slip plane: n . p0 (metres). */
  yPlane: number;
  /** Extent of the slip line inside the block, as pos limits (metres), already inset by one lattice parameter. */
  tMin: number;
  tMax: number;
}

export interface FieldParams {
  b_m: number;
  nu: number;
  rc_m: number;
}

export function makeDislocationGeometry(s: Vec3, n: Vec3, a_m: number, boxSize_m: Vec3): DislocationGeometry {
  const d = a_m / Math.sqrt(3); // FCC {111} interplanar spacing
  const c: Vec3 = [boxSize_m[0] / 2, boxSize_m[1] / 2, boxSize_m[2] / 2];
  const cn = c[0] * n[0] + c[1] * n[1] + c[2] * n[2];
  const yPlane = (Math.floor(cn / d) + 0.5) * d;
  const off = cn - yPlane;
  const p0: Vec3 = [c[0] - off * n[0], c[1] - off * n[1], c[2] - off * n[2]];
  let lo = -Infinity, hi = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(s[i]) < 1e-12) continue;
    const t1 = (0 - p0[i]) / s[i], t2 = (boxSize_m[i] - p0[i]) / s[i];
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  }
  return { s, n, p0, yPlane, tMin: lo + a_m, tMax: hi - a_m };
}

/** Computes displaced positions (metres) into `out`; `ideal` is never modified. Defaults to a new array if `out` is omitted. */
export function displacedPositions(
  ideal: Float64Array, g: DislocationGeometry, pos_m: number, f: FieldParams,
  out: Float64Array = new Float64Array(ideal.length)
): Float64Array {
  const { s, n, p0 } = g;
  for (let i = 0; i < ideal.length; i += 3) {
    const dx = ideal[i] - p0[0], dy = ideal[i + 1] - p0[1], dz = ideal[i + 2] - p0[2];
    const x = dx * s[0] + dy * s[1] + dz * s[2] - pos_m;
    const y = dx * n[0] + dy * n[1] + dz * n[2];
    const [ux, uy] = edgeDisplacement(x, y, f.b_m, f.nu, f.rc_m);
    out[i] = ideal[i] + ux * s[0] + uy * n[0];
    out[i + 1] = ideal[i + 1] + ux * s[1] + uy * n[1];
    out[i + 2] = ideal[i + 2] + ux * s[2] + uy * n[2];
  }
  return out;
}
