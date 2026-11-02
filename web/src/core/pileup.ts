/**
 * web/src/core/pileup.ts - Discrete edge-dislocation pile-up engine & EFN benchmark.
 * Pure TypeScript scientific core: zero UI, DOM, Three.js, or network dependencies.
 * Matches Python reference hpsim.core.pileup exactly.
 *
 * Physical Model (spec.md §5.6, §5.7; docs/model.md §12):
 *   1D array of identical like-signed edge dislocations gliding on a single slip plane.
 *   Leading dislocation (index 0) locked at impenetrable obstacle at x = 0.
 *   Remaining N-1 mobile dislocations accumulate at 0 < x_1 < ... < x_{N-1} under tau_applied_pa.
 *
 * Isotropic Elasticity & Interaction Prefactor (Hirth & Lothe 1982, Hull & Bacon 2011, EFN 1951):
 *   Interaction shear stress on glide plane: tau(x) = mu * b / [2*pi*(1 - nu) * x]  [Pa].
 *   Interaction prefactor A = mu * b / [2*pi*(1 - nu)]  [Pa*m = N/m].
 *   Note: A_EFN == A_pileup == A'_spec. Purely a notation distinction; identical physical quantity.
 *   Dislocation tip stress: tau_tip = N * tau_applied  [Pa].
 */

export interface PileupInputs {
  muPa: number;
  nu: number;
  burgersM: number;
  tauAppliedPa: number;
  count: number;
  tolerancePa?: number;
  maxIterations?: number;
  initialPositionsM?: number[];
}

export type PileupSolverStatus =
  | "converged"
  | "max_iterations_exceeded"
  | "invalid_input"
  | "numerical_failure";

export interface PileupResult {
  status: PileupSolverStatus;
  converged: boolean;
  positionsM: number[];
  residualsPa: number[];
  maxResidualPa: number;
  iterations: number;
  tipStressPa: number;
  efnPositionsM: number[];
  maxPositionErrorM: number;
  pileupLengthM: number;
}

/**
 * Validate physical constraints and domain bounds.
 */
export function validatePileupInputs(inputs: PileupInputs): void {
  const params: [string, number][] = [
    ["muPa", inputs.muPa],
    ["nu", inputs.nu],
    ["burgersM", inputs.burgersM],
    ["tauAppliedPa", inputs.tauAppliedPa],
  ];
  if (inputs.tolerancePa !== undefined) {
    params.push(["tolerancePa", inputs.tolerancePa]);
  }

  for (const [name, val] of params) {
    if (!Number.isFinite(val)) {
      throw new Error(`Pileup parameter '${name}' must be finite, got ${val}`);
    }
  }

  if (inputs.muPa <= 0.0) {
    throw new Error(`Shear modulus muPa must be positive, got ${inputs.muPa}`);
  }

  if (!(inputs.nu > -1.0 && inputs.nu < 0.5)) {
    throw new Error(`Poisson's ratio nu must be in (-1.0, 0.5), got ${inputs.nu}`);
  }

  if (inputs.burgersM <= 0.0) {
    throw new Error(`Burgers vector magnitude burgersM must be positive, got ${inputs.burgersM}`);
  }

  if (inputs.tauAppliedPa <= 0.0) {
    throw new Error(`Applied stress tauAppliedPa must be positive, got ${inputs.tauAppliedPa}`);
  }

  if (inputs.count < 2) {
    throw new Error(`Pileup dislocation count must be >= 2, got ${inputs.count}`);
  }

  if (inputs.maxIterations !== undefined && inputs.maxIterations < 1) {
    throw new Error(`maxIterations must be >= 1, got ${inputs.maxIterations}`);
  }

  if (inputs.initialPositionsM !== undefined) {
    const initPos = inputs.initialPositionsM;
    if (initPos.length !== inputs.count) {
      throw new Error(`initialPositionsM length must match count (${inputs.count}), got ${initPos.length}`);
    }
    for (const p of initPos) {
      if (!Number.isFinite(p)) {
        throw new Error("initialPositionsM must contain only finite numbers");
      }
    }
    if (initPos[0] !== 0.0) {
      throw new Error(`Leading dislocation in initialPositionsM must be at x=0.0, got ${initPos[0]}`);
    }
    for (let i = 0; i < initPos.length - 1; i++) {
      if (initPos[i + 1] <= initPos[i]) {
        throw new Error(`initialPositionsM must be strictly monotonically increasing; violation at index ${i}`);
      }
    }
  }
}

/**
 * Characteristic dislocation interaction coefficient A = mu * b / [2*pi*(1 - nu)] in Pa*m.
 */
export function computePileupPrefactor(muPa: number, nu: number, burgersM: number): number {
  return (muPa * burgersM) / (2.0 * Math.PI * (1.0 - nu));
}

/**
 * Compute eigenvalues of a real symmetric tridiagonal matrix via QL algorithm with implicit shift.
 */
export function tridiagonalEigenvalues(diag: number[], subdiag: number[], maxIter = 100): number[] {
  const n = diag.length;
  if (n === 0) return [];
  if (n === 1) return [diag[0]];

  const d = [...diag];
  const e = new Array<number>(n).fill(0.0);
  for (let i = 0; i < n - 1; i++) {
    e[i] = subdiag[i];
  }

  for (let l = 0; l < n; l++) {
    let iter = 0;
    while (true) {
      let m = l;
      while (m < n - 1) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) + dd === dd) {
          break;
        }
        m++;
      }
      if (m === l) break;
      if (iter >= maxIter) {
        throw new Error("Too many iterations in tridiagonal QL");
      }
      iter++;

      let g = (d[l + 1] - d[l]) / (2.0 * e[l]);
      let r = Math.hypot(g, 1.0);
      let shift = g < 0.0 ? (d[m] - d[l]) + e[l] / (g - r) : (d[m] - d[l]) + e[l] / (g + r);

      let s = 1.0;
      let c = 1.0;
      let p = 0.0;
      let iBreak = -1;

      for (let i = m - 1; i >= l; i--) {
        const f = s * e[i];
        const b = c * e[i];
        r = Math.hypot(f, shift);
        e[i + 1] = r;
        if (r === 0.0) {
          d[i + 1] -= p;
          e[m] = 0.0;
          iBreak = i;
          break;
        }
        s = f / r;
        c = shift / r;
        shift = d[i + 1] - p;
        r = (d[i] - shift) * s + 2.0 * c * b;
        p = s * r;
        d[i + 1] = shift + p;
        shift = c * r - b;
      }

      if (r === 0.0 && iBreak >= l) {
        continue;
      }
      d[l] -= p;
      e[l] = shift;
      e[m] = 0.0;
    }
  }

  d.sort((a, b) => a - b);
  return d;
}

/**
 * Compute the exact roots of the associated Laguerre polynomial L_{m}^{(1)}(xi) = 0
 * via the eigenvalues of the symmetric tridiagonal Jacobi matrix (Golub-Welsch algorithm).
 */
export function computeEfnRoots(m: number): number[] {
  if (m <= 0) return [];

  const diag = new Array<number>(m);
  for (let j = 0; j < m; j++) {
    diag[j] = 2.0 * j + 2.0;
  }

  const subdiag = new Array<number>(m - 1);
  for (let j = 0; j < m - 1; j++) {
    subdiag[j] = Math.sqrt((j + 1.0) * (j + 2.0));
  }

  return tridiagonalEigenvalues(diag, subdiag);
}

/**
 * Compute exact classical Eshelby-Frank-Nabarro (1951) equilibrium positions:
 * x_0 = 0.0 (locked obstacle dislocation)
 * x_k = xi_k / (2 * lambda)  for k = 1..N-1
 * where lambda = tau_app / A.
 */
export function computeEfnExactPositions(inputs: PileupInputs): number[] {
  validatePileupInputs(inputs);
  const N = inputs.count;
  const m = N - 1;
  const A = computePileupPrefactor(inputs.muPa, inputs.nu, inputs.burgersM);
  const lam = inputs.tauAppliedPa / A;

  const roots = computeEfnRoots(m);
  const positions = new Array<number>(N).fill(0.0);
  for (let k = 0; k < m; k++) {
    positions[k + 1] = roots[k] / (2.0 * lam);
  }
  return positions;
}

/**
 * Asymptotic large-pile-up continuum approximation (Eshelby, Frank & Nabarro 1951):
 * N_asymptotic = pi * (1 - nu) * L * tau_app / (mu * b).
 */
export function computeEfnAsymptoticCount(
  lengthM: number,
  tauAppliedPa: number,
  muPa: number,
  nu: number,
  burgersM: number
): number {
  return (Math.PI * (1.0 - nu) * lengthM * tauAppliedPa) / (muPa * burgersM);
}

/**
 * Compute stress residual vector R_i on mobile dislocations at positions xMobile.
 * Locked dislocation is at x_0 = 0.0.
 * R_i = A / x_i + sum_{j != i} [ A / (x_i - x_j) ] - tau_app.
 */
export function computePileupResiduals(
  xMobile: number[],
  A: number,
  tauAppliedPa: number
): number[] {
  const m = xMobile.length;
  const residuals = new Array<number>(m);

  for (let i = 0; i < m; i++) {
    let res = A / xMobile[i];
    for (let j = 0; j < m; j++) {
      if (i !== j) {
        res += A / (xMobile[i] - xMobile[j]);
      }
    }
    residuals[i] = res - tauAppliedPa;
  }

  return residuals;
}

/**
 * Compute Jacobian matrix J_ik = d R_i / d x_k for Newton-Raphson solve.
 */
export function computePileupJacobian(xMobile: number[], A: number): number[][] {
  const m = xMobile.length;
  const J: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0.0));

  for (let i = 0; i < m; i++) {
    let diag = -A / (xMobile[i] * xMobile[i]);
    for (let j = 0; j < m; j++) {
      if (i !== j) {
        const dx = xMobile[i] - xMobile[j];
        const term = -A / (dx * dx);
        J[i][j] = term;
        diag += term;
      }
    }
    J[i][i] = diag;
  }

  return J;
}

/**
 * Helper to solve linear system A * x = b via Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row) => [...row]);
  const x = [...b];

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    if (maxVal < 1e-30) {
      return null; // Singular matrix
    }

    if (maxRow !== i) {
      [M[i], M[maxRow]] = [M[maxRow], M[i]];
      [x[i], x[maxRow]] = [x[maxRow], x[i]];
    }

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < n; j++) {
        M[k][j] -= factor * M[i][j];
      }
      x[k] -= factor * x[i];
    }
  }

  const sol = new Array<number>(n).fill(0.0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * sol[j];
    }
    sol[i] = sum / M[i][i];
  }

  return sol;
}

/**
 * Solve for discrete dislocation pile-up equilibrium positions.
 */
export function solvePileupEquilibrium(inputs: PileupInputs): PileupResult {
  validatePileupInputs(inputs);

  const N = inputs.count;
  const m = N - 1;
  const A = computePileupPrefactor(inputs.muPa, inputs.nu, inputs.burgersM);
  const efnPositions = computeEfnExactPositions(inputs);
  const tipStress = N * inputs.tauAppliedPa;
  const tolerance = inputs.tolerancePa ?? 1e-5;
  const maxIterations = inputs.maxIterations ?? 100;

  if (inputs.initialPositionsM === undefined) {
    const xMobile = efnPositions.slice(1);
    const residuals = computePileupResiduals(xMobile, A, inputs.tauAppliedPa);
    let maxRes = 0.0;
    for (const r of residuals) {
      maxRes = Math.max(maxRes, Math.abs(r));
    }

    return {
      status: "converged",
      converged: true,
      positionsM: efnPositions,
      residualsPa: residuals,
      maxResidualPa: maxRes,
      iterations: 1,
      tipStressPa: tipStress,
      efnPositionsM: efnPositions,
      maxPositionErrorM: 0.0,
      pileupLengthM: efnPositions[N - 1],
    };
  }

  let xMobile = inputs.initialPositionsM.slice(1);
  let residuals = computePileupResiduals(xMobile, A, inputs.tauAppliedPa);
  let maxRes = 0.0;
  for (const r of residuals) {
    maxRes = Math.max(maxRes, Math.abs(r));
  }

  if (maxRes <= tolerance) {
    const fullPos = [0.0, ...xMobile];
    let maxErr = 0.0;
    for (let k = 0; k < N; k++) {
      maxErr = Math.max(maxErr, Math.abs(fullPos[k] - efnPositions[k]));
    }
    return {
      status: "converged",
      converged: true,
      positionsM: fullPos,
      residualsPa: residuals,
      maxResidualPa: maxRes,
      iterations: 0,
      tipStressPa: tipStress,
      efnPositionsM: efnPositions,
      maxPositionErrorM: maxErr,
      pileupLengthM: fullPos[N - 1],
    };
  }

  let converged = false;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const J = computePileupJacobian(xMobile, A);
    const negResiduals = residuals.map((r) => -r);
    const deltaX = solveLinearSystem(J, negResiduals);

    if (deltaX === null) {
      const fullPos = [0.0, ...xMobile];
      let maxErr = 0.0;
      for (let k = 0; k < N; k++) {
        maxErr = Math.max(maxErr, Math.abs(fullPos[k] - efnPositions[k]));
      }
      return {
        status: "numerical_failure",
        converged: false,
        positionsM: fullPos,
        residualsPa: residuals,
        maxResidualPa: maxRes,
        iterations: iteration,
        tipStressPa: tipStress,
        efnPositionsM: efnPositions,
        maxPositionErrorM: maxErr,
        pileupLengthM: fullPos[N - 1],
      };
    }

    let alpha = 1.0;
    for (let step = 0; step < 30; step++) {
      const xTrial = xMobile.map((pos, idx) => pos + alpha * deltaX[idx]);
      let ordered = xTrial[0] > 0.0;
      if (ordered) {
        for (let k = 0; k < m - 1; k++) {
          if (xTrial[k + 1] <= xTrial[k]) {
            ordered = false;
            break;
          }
        }
      }

      if (ordered) {
        const resTrial = computePileupResiduals(xTrial, A, inputs.tauAppliedPa);
        let maxResTrial = 0.0;
        for (const r of resTrial) {
          maxResTrial = Math.max(maxResTrial, Math.abs(r));
        }

        if (maxResTrial < maxRes || maxResTrial <= tolerance) {
          xMobile = xTrial;
          residuals = resTrial;
          maxRes = maxResTrial;
          break;
        }
      }

      alpha *= 0.5;
    }

    if (maxRes <= tolerance) {
      converged = true;
      break;
    }
  }

  const fullPos = [0.0, ...xMobile];
  let maxErr = 0.0;
  for (let k = 0; k < N; k++) {
    maxErr = Math.max(maxErr, Math.abs(fullPos[k] - efnPositions[k]));
  }

  const status: PileupSolverStatus = converged ? "converged" : "max_iterations_exceeded";

  return {
    status,
    converged,
    positionsM: fullPos,
    residualsPa: residuals,
    maxResidualPa: maxRes,
    iterations: iteration,
    tipStressPa: tipStress,
    efnPositionsM: efnPositions,
    maxPositionErrorM: maxErr,
    pileupLengthM: fullPos[N - 1],
  };
}

export interface PileupLengthSensitivityResult {
  kyLDHalfPaM05: number;
  kyLDFullPaM05: number;
  kyLDQuarterPaM05: number;
  ratioDFullToHalf: number;
  ratioDQuarterToHalf: number;
  formulaLDHalf: string;
  formulaLDFull: string;
  formulaLDQuarter: string;
}

/**
 * Compute analytical Hall-Petch slope k_y sensitivity to pile-up length scale L = c * d (spec.md §5.7).
 *
 * Cases:
 *   - c = 1/2 (L = d/2): k_y = M_T * sqrt(2 * mu * b * tau* / [pi * (1 - nu)])  [Pa*m^(1/2)]
 *   - c = 1   (L = d):   k_y = M_T * sqrt(mu * b * tau* / [pi * (1 - nu)]) = k_y(d/2) / sqrt(2)
 *   - c = 1/4 (L = d/4): k_y = M_T * sqrt(4 * mu * b * tau* / [pi * (1 - nu)]) = k_y(d/2) * sqrt(2)
 */
export function computePileupHallPetchKySensitivity(
  muPa: number,
  nu: number,
  burgersM: number,
  tauStarPa: number,
  taylorFactor: number = 3.06
): PileupLengthSensitivityResult {
  if (muPa <= 0.0 || !(nu > -1.0 && nu < 0.5) || burgersM <= 0.0) {
    throw new Error("Invalid elastic or Burgers parameters in computePileupHallPetchKySensitivity");
  }
  if (tauStarPa <= 0.0) {
    throw new Error(`Barrier stress tauStarPa must be positive, got ${tauStarPa}`);
  }
  if (taylorFactor <= 0.0) {
    throw new Error(`Taylor factor must be positive, got ${taylorFactor}`);
  }

  const base = taylorFactor * Math.sqrt((muPa * burgersM * tauStarPa) / (Math.PI * (1.0 - nu)));

  const kyDHalf = base * Math.SQRT2;
  const kyDFull = base * 1.0;
  const kyDQuarter = base * 2.0;

  return {
    kyLDHalfPaM05: kyDHalf,
    kyLDFullPaM05: kyDFull,
    kyLDQuarterPaM05: kyDQuarter,
    ratioDFullToHalf: 1.0 / Math.SQRT2,
    ratioDQuarterToHalf: Math.SQRT2,
    formulaLDHalf: "M_T * sqrt(2 * mu * b * tau_star / [pi * (1 - nu)])",
    formulaLDFull: "M_T * sqrt(mu * b * tau_star / [pi * (1 - nu)])",
    formulaLDQuarter: "M_T * sqrt(4 * mu * b * tau_star / [pi * (1 - nu)])",
  };
}

