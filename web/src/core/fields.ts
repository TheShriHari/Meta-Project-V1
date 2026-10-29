/**
 * web/src/core/fields.ts - Isotropic-elastic edge-dislocation displacement field (plane strain).
 * Mirrors hpsim.core.fields exactly; see that module's docstring for the full convention:
 *  - local frame: x along b / glide, y along slip-plane normal, metres, measured from the core
 *  - regularisation r^2 -> r^2 + rc^2 in log and rational terms; theta = atan2(y, x) unregularised
 *  - branch cut on the negative local x axis (behind a core gliding in +x); jump +b crossing y<0 -> y>0
 *  - CCW loop enclosing the core closes on +b. Continuum visualisation, not an atomistic core.
 */

export function edgeDisplacement(
  x: number, y: number, b: number, nu: number, rc: number
): [number, number] {
  if (!(rc > 0)) throw new Error("core radius rc must be positive");
  if (!(nu > -1 && nu < 0.5)) throw new Error(`Poisson ratio out of range: ${nu}`);
  const r2 = x * x + y * y + rc * rc;
  const theta = Math.atan2(y, x);
  const k = b / (2 * Math.PI);
  const ux = k * (theta + (x * y) / (2 * (1 - nu) * r2));
  const uy = -k * (((1 - 2 * nu) / (4 * (1 - nu))) * Math.log(r2 / (rc * rc)) + (x * x - y * y) / (4 * (1 - nu) * r2));
  return [ux, uy];
}

export function circleLoop(radius: number, n: number, centre: [number, number] = [0, 0]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    out.push([centre[0] + radius * Math.cos(t), centre[1] + radius * Math.sin(t)]);
  }
  return out;
}

function parts(x: number, y: number, nu: number, rc: number): [number, number, number] {
  const r2 = x * x + y * y + rc * rc;
  return [
    Math.atan2(y, x),
    (x * y) / (2 * (1 - nu) * r2),
    -(((1 - 2 * nu) / (4 * (1 - nu))) * Math.log(r2 / (rc * rc)) + (x * x - y * y) / (4 * (1 - nu) * r2)),
  ];
}

/** Closure sum (du_x, du_y) around a closed sampled loop, theta-unwrapped method (spec V-03). */
export function burgersCircuit(
  loop: ReadonlyArray<readonly [number, number]>, b: number, nu: number, rc: number,
  maxWrappedDtheta = 0.75 * Math.PI
): [number, number] {
  let sumTheta = 0, sumSx = 0, sumSy = 0;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p = loop[i], q = loop[(i + 1) % n];
    const a = parts(p[0], p[1], nu, rc), c = parts(q[0], q[1], nu, rc);
    let d = c[0] - a[0];
    d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(d) > maxWrappedDtheta) {
      throw new Error("loop too coarse (a segment subtends too large an angle at the core) to unwrap theta");
    }
    sumTheta += d; sumSx += c[1] - a[1]; sumSy += c[2] - a[2];
  }
  const k = b / (2 * Math.PI);
  return [k * (sumTheta + sumSx), k * sumSy];
}
