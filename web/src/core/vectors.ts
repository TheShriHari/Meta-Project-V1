/**
 * web/src/core/vectors.ts - 3D vector and matrix math primitives.
 * Pure TypeScript implementation with zero runtime dependencies.
 */

export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export function vectorNorm(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function normalizeVector(v: Vec3, tol = 1e-15): Vec3 {
  const norm = vectorNorm(v);
  if (norm < tol) {
    throw new Error(`Cannot normalize near-zero vector: norm=${norm}`);
  }
  return [v[0] / norm, v[1] / norm, v[2] / norm];
}

export function vectorDot(u: Vec3, v: Vec3): number {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

export function vectorCross(u: Vec3, v: Vec3): Vec3 {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

export function matrixMultiplyVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function matrixTranspose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function matrixMultiply(a: Mat3, b: Mat3): Mat3 {
  const res: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      res[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return res;
}

export function matrixDeterminant(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

export function isOrthonormalMatrix(m: Mat3, tol = 1e-12): boolean {
  const mTm = matrixMultiply(matrixTranspose(m), m);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const target = i === j ? 1 : 0;
      if (Math.abs(mTm[i][j] - target) > tol) {
        return false;
      }
    }
  }
  return true;
}
