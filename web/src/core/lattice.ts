/**
 * web/src/core/lattice.ts - Finite FCC lattice from the conventional cubic cell.
 * Mirrors hpsim.core.lattice: SI metres, crystal frame, same atom ordering (cell i,j,k then basis).
 * Returns IDEAL positions R_i as a flat Float64Array [x0,y0,z0,x1,...].
 */

export const FCC_BASIS_FRACTIONAL: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [0.5, 0.5, 0],
  [0.5, 0, 0.5],
  [0, 0.5, 0.5],
];

export function generateFccLattice(a_m: number, nx: number, ny: number, nz: number): Float64Array {
  if (!(a_m > 0)) throw new Error(`lattice parameter must be positive: ${a_m}`);
  if (Math.min(nx, ny, nz) < 1) throw new Error("cell counts must be >= 1");
  const out = new Float64Array(3 * 4 * nx * ny * nz);
  let o = 0;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++)
        for (const b of FCC_BASIS_FRACTIONAL) {
          out[o++] = (i + b[0]) * a_m;
          out[o++] = (j + b[1]) * a_m;
          out[o++] = (k + b[2]) * a_m;
        }
  return out;
}
