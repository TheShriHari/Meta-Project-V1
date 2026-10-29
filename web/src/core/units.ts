/**
 * web/src/core/units.ts - SI unit conversion functions.
 * Pure TypeScript implementation with zero runtime dependencies.
 */

export function nmToM(valNm: number): number {
  return valNm * 1e-9;
}

export function mToNm(valM: number): number {
  return valM * 1e9;
}

export function umToM(valUm: number): number {
  return valUm * 1e-6;
}

export function mToUm(valM: number): number {
  return valM * 1e6;
}

export function mpaToPa(valMpa: number): number {
  return valMpa * 1e6;
}

export function paToMpa(valPa: number): number {
  return valPa * 1e-6;
}

export function gpaToPa(valGpa: number): number {
  return valGpa * 1e9;
}

export function paToGpa(valPa: number): number {
  return valPa * 1e-9;
}
