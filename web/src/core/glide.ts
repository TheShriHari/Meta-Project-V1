/**
 * web/src/core/glide.ts - Overdamped dislocation glide kinetics in pure TypeScript.
 * Matches Python hpsim.core.glide.
 */

export function calculateGlideVelocity(
  tauRss: number,
  tauC: number,
  Md: number,
  b: number
): number {
  if (tauC < 0) {
    throw new Error(`Critical stress tauC cannot be negative: ${tauC}`);
  }
  if (Md <= 0) {
    throw new Error(`Mobility Md must be positive: ${Md}`);
  }
  if (b <= 0) {
    throw new Error(`Burgers vector magnitude b must be positive: ${b}`);
  }

  const absTau = Math.abs(tauRss);
  const overstress = Math.max(absTau - tauC, 0);

  if (overstress === 0) {
    return 0;
  }

  const sign = tauRss > 0 ? 1 : -1;
  return Md * b * sign * overstress;
}

export function integrateDislocationPosition(
  pos0: number,
  velocity: number,
  dt: number,
  nSteps = 1
): number {
  if (dt <= 0) {
    throw new Error(`Time step dt must be positive: ${dt}`);
  }
  if (nSteps < 1) {
    throw new Error(`nSteps must be at least 1: ${nSteps}`);
  }
  return pos0 + velocity * dt * nSteps;
}
