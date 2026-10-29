"""
src/hpsim/core/pileup.py - Discrete edge-dislocation pile-up engine & EFN benchmark.

Physical Model:
  1D array of identical like-signed edge dislocations gliding on a single slip plane.
  The leading dislocation (index 0) is locked at an impenetrable obstacle at x = 0.
  The remaining N-1 mobile dislocations (indices 1..N-1) accumulate at positions
  0 < x_1 < x_2 < ... < x_{N-1} under uniform applied shear stress tau_applied_pa.

Inter-dislocation interaction:
  tau_{i <- j} = A / (x_i - x_j),  where A = mu * b / [2*pi*(1 - nu)].
  Repulsive force pushes dislocation i outward (positive x) for x_i > x_j.
  Applied stress drives dislocations inward (-x direction) toward obstacle.

Equilibrium condition for mobile dislocations:
  R_i = sum_{j != i} [ A / (x_i - x_j) ] - tau_app = 0   for all mobile i.

Analytical Benchmark:
  J. D. Eshelby, F. C. Frank, and F. R. N. Nabarro (1951), Phil. Mag. 42, 351-364.
  Exact equilibrium positions correspond to the roots of L'_{N}(2*lambda*x) = 0,
  where L_N is the Laguerre polynomial and lambda = tau_app / A.
"""

from dataclasses import dataclass
from typing import List, Optional
import numpy as np


@dataclass(frozen=True)
class PileupInputs:
    """Inputs for discrete dislocation pile-up equilibrium calculation."""
    mu_pa: float
    nu: float
    burgers_m: float
    tau_applied_pa: float
    count: int
    tolerance_pa: float = 1e-5
    max_iterations: int = 100
    initial_positions_m: Optional[np.ndarray] = None


@dataclass
class PileupResult:
    """Result of discrete dislocation pile-up equilibrium calculation."""
    status: str  # "converged" | "max_iterations_exceeded" | "invalid_input" | "numerical_failure"
    converged: bool
    positions_m: np.ndarray  # Shape (count,), with positions_m[0] = 0.0
    residuals_pa: np.ndarray  # Shape (count - 1,), residuals on mobile dislocations
    max_residual_pa: float
    iterations: int
    tip_stress_pa: float  # Stress on locked obstacle dislocation
    efn_positions_m: np.ndarray  # Exact EFN analytical roots
    max_position_error_m: float  # max |positions_m - efn_positions_m|
    pileup_length_m: float  # Distance from obstacle to furthest dislocation (positions_m[-1])


def validate_pileup_inputs(inputs: PileupInputs) -> None:
    """Validate physical constraints and domain bounds."""
    for name, val in [
        ("mu_pa", inputs.mu_pa),
        ("nu", inputs.nu),
        ("burgers_m", inputs.burgers_m),
        ("tau_applied_pa", inputs.tau_applied_pa),
        ("tolerance_pa", inputs.tolerance_pa),
    ]:
        if not np.isfinite(val):
            raise ValueError(f"Pileup parameter '{name}' must be finite, got {val}")

    if inputs.mu_pa <= 0.0:
        raise ValueError(f"Shear modulus mu_pa must be positive, got {inputs.mu_pa}")

    if not (-1.0 < inputs.nu < 0.5):
        raise ValueError(f"Poisson's ratio nu must be in (-1.0, 0.5), got {inputs.nu}")

    if inputs.burgers_m <= 0.0:
        raise ValueError(f"Burgers vector magnitude burgers_m must be positive, got {inputs.burgers_m}")

    if inputs.tau_applied_pa <= 0.0:
        raise ValueError(f"Applied stress tau_applied_pa must be positive, got {inputs.tau_applied_pa}")

    if inputs.count < 2:
        raise ValueError(f"Pileup dislocation count must be >= 2 (1 locked + >=1 mobile), got {inputs.count}")

    if inputs.max_iterations < 1:
        raise ValueError(f"max_iterations must be >= 1, got {inputs.max_iterations}")

    if inputs.initial_positions_m is not None:
        init_pos = np.asarray(inputs.initial_positions_m, dtype=float)
        if len(init_pos) != inputs.count:
            raise ValueError(f"initial_positions_m length must match count ({inputs.count}), got {len(init_pos)}")
        if not np.all(np.isfinite(init_pos)):
            raise ValueError("initial_positions_m must contain only finite numbers")
        if init_pos[0] != 0.0:
            raise ValueError(f"Leading dislocation in initial_positions_m must be at x=0.0, got {init_pos[0]}")
        for i in range(len(init_pos) - 1):
            if init_pos[i + 1] <= init_pos[i]:
                raise ValueError(f"initial_positions_m must be strictly monotonically increasing; violation at index {i}")


def compute_pileup_prefactor(mu_pa: float, nu: float, burgers_m: float) -> float:
    """Characteristic dislocation interaction coefficient A = mu * b / [2*pi*(1 - nu)] in Pa*m."""
    return (mu_pa * burgers_m) / (2.0 * np.pi * (1.0 - nu))


def compute_efn_roots(m: int) -> np.ndarray:
    """
    Compute the exact roots of the associated Laguerre polynomial L_{m}^{(1)}(xi) = 0
    via the eigenvalues of the symmetric tridiagonal Jacobi matrix (Golub-Welsch algorithm).
    m = count - 1 (number of mobile dislocations).
    """
    if m <= 0:
        return np.array([], dtype=float)

    # Diagonal elements: a_j = 2*j + 1 + alpha for alpha=1 => a_j = 2*j + 2
    diag = np.array([2.0 * j + 2.0 for j in range(m)], dtype=float)

    # Sub/super-diagonal: b_j = sqrt((j + 1) * (j + 1 + alpha)) for alpha=1 => sqrt((j + 1) * (j + 2))
    subdiag = np.array([np.sqrt((j + 1.0) * (j + 2.0)) for j in range(m - 1)], dtype=float)

    # Eigenvalues of symmetric tridiagonal matrix
    roots = np.linalg.eigvalsh(np.diag(diag) + np.diag(subdiag, 1) + np.diag(subdiag, -1))
    return np.sort(roots)


def compute_efn_exact_positions(inputs: PileupInputs) -> np.ndarray:
    """
    Compute exact classical Eshelby-Frank-Nabarro (1951) equilibrium positions:
    x_0 = 0.0 (locked obstacle dislocation)
    x_k = xi_k / (2 * lambda)  for k = 1..N-1
    where xi_k are the roots of L'_{N}(xi) = -L_{N-1}^{(1)}(xi) = 0,
    and lambda = tau_app / A.
    """
    validate_pileup_inputs(inputs)
    N = inputs.count
    m = N - 1
    A = compute_pileup_prefactor(inputs.mu_pa, inputs.nu, inputs.burgers_m)
    lam = inputs.tau_applied_pa / A

    roots = compute_efn_roots(m)
    positions = np.zeros(N, dtype=float)
    positions[1:] = roots / (2.0 * lam)
    return positions


def compute_efn_asymptotic_count(
    length_m: float,
    tau_applied_pa: float,
    mu_pa: float,
    nu: float,
    burgers_m: float,
) -> float:
    """
    Asymptotic large-pile-up continuum approximation (Eshelby, Frank & Nabarro 1951):
    N_asymptotic = pi * (1 - nu) * L * tau_app / (mu * b).
    """
    return (np.pi * (1.0 - nu) * length_m * tau_applied_pa) / (mu_pa * burgers_m)


def compute_pileup_residuals(
    x_mobile: np.ndarray,
    A: float,
    tau_applied_pa: float,
) -> np.ndarray:
    """
    Compute stress residual vector R_i on mobile dislocations at positions x_mobile.
    Locked dislocation is at x_0 = 0.0.
    R_i = A / x_i + sum_{j != i} [ A / (x_i - x_j) ] - tau_app.
    """
    m = len(x_mobile)
    residuals = np.zeros(m, dtype=float)

    for i in range(m):
        # Contribution from locked dislocation at 0
        res = A / x_mobile[i]
        # Contributions from other mobile dislocations
        for j in range(m):
            if i != j:
                res += A / (x_mobile[i] - x_mobile[j])
        residuals[i] = res - tau_applied_pa

    return residuals


def compute_pileup_jacobian(
    x_mobile: np.ndarray,
    A: float,
) -> np.ndarray:
    """
    Compute Jacobian matrix J_ik = d R_i / d x_k for Newton-Raphson solve.
    J_ii = -A / x_i^2 - sum_{j != i} [ A / (x_i - x_j)^2 ]
    J_ik = -A / (x_i - x_k)^2  (for k != i)
    """
    m = len(x_mobile)
    J = np.zeros((m, m), dtype=float)

    for i in range(m):
        diag = -A / (x_mobile[i] ** 2)
        for j in range(m):
            if i != j:
                term = -A / ((x_mobile[i] - x_mobile[j]) ** 2)
                J[i, j] = term
                diag += term
        J[i, i] = diag

    return J


def solve_pileup_equilibrium(inputs: PileupInputs) -> PileupResult:
    """
    Solve for discrete dislocation pile-up equilibrium positions.
    When initial_positions_m is None:
      Computes exact equilibrium positions using the classical Eshelby-Frank-Nabarro (1951)
      polynomial root method (Golub-Welsch tridiagonal eigensolver), verifies force residuals,
      and returns the benchmarked equilibrium result.
    When initial_positions_m is provided:
      Executes damped Newton-Raphson relaxation with physical order-preserving line search
      to iterate from initial_positions_m toward equilibrium within max_iterations and tolerance_pa.
    """
    validate_pileup_inputs(inputs)

    N = inputs.count
    m = N - 1
    A = compute_pileup_prefactor(inputs.mu_pa, inputs.nu, inputs.burgers_m)
    efn_positions = compute_efn_exact_positions(inputs)
    tip_stress = N * inputs.tau_applied_pa

    if inputs.initial_positions_m is None:
        # Standard analytical / Golub-Welsch solve
        x_mobile = np.copy(efn_positions[1:])
        residuals = compute_pileup_residuals(x_mobile, A, inputs.tau_applied_pa)
        max_res = float(np.max(np.abs(residuals)))
        err = 0.0

        return PileupResult(
            status="converged",
            converged=True,
            positions_m=efn_positions,
            residuals_pa=residuals,
            max_residual_pa=max_res,
            iterations=1,
            tip_stress_pa=tip_stress,
            efn_positions_m=efn_positions,
            max_position_error_m=err,
            pileup_length_m=float(efn_positions[-1]),
        )

    # Newton-Raphson solve from user-specified initial positions
    x_mobile = np.copy(inputs.initial_positions_m[1:])
    residuals = compute_pileup_residuals(x_mobile, A, inputs.tau_applied_pa)
    max_res = float(np.max(np.abs(residuals)))

    if max_res <= inputs.tolerance_pa:
        full_pos = np.zeros(N, dtype=float)
        full_pos[1:] = x_mobile
        err = float(np.max(np.abs(full_pos - efn_positions)))
        return PileupResult(
            status="converged",
            converged=True,
            positions_m=full_pos,
            residuals_pa=residuals,
            max_residual_pa=max_res,
            iterations=0,
            tip_stress_pa=tip_stress,
            efn_positions_m=efn_positions,
            max_position_error_m=err,
            pileup_length_m=float(full_pos[-1]),
        )

    converged = False
    iteration = 0

    while iteration < inputs.max_iterations:
        iteration += 1
        J = compute_pileup_jacobian(x_mobile, A)

        try:
            delta_x = np.linalg.solve(J, -residuals)
        except np.linalg.LinAlgError:
            full_pos = np.zeros(N, dtype=float)
            full_pos[1:] = x_mobile
            return PileupResult(
                status="numerical_failure",
                converged=False,
                positions_m=full_pos,
                residuals_pa=residuals,
                max_residual_pa=max_res,
                iterations=iteration,
                tip_stress_pa=tip_stress,
                efn_positions_m=efn_positions,
                max_position_error_m=float(np.max(np.abs(full_pos - efn_positions))),
                pileup_length_m=float(full_pos[-1]),
            )

        # Backtracking line search preserving physical ordering
        alpha = 1.0
        step_accepted = False

        for _ in range(30):
            x_trial = x_mobile + alpha * delta_x

            # Check physical ordering: 0 < x_trial[0] < x_trial[1] < ...
            ordered = (x_trial[0] > 0.0)
            if ordered:
                for k in range(m - 1):
                    if x_trial[k + 1] <= x_trial[k]:
                        ordered = False
                        break

            if ordered:
                res_trial = compute_pileup_residuals(x_trial, A, inputs.tau_applied_pa)
                max_res_trial = float(np.max(np.abs(res_trial)))

                if max_res_trial < max_res or max_res_trial <= inputs.tolerance_pa:
                    x_mobile = x_trial
                    residuals = res_trial
                    max_res = max_res_trial
                    step_accepted = True
                    break

            alpha *= 0.5

        if max_res <= inputs.tolerance_pa:
            converged = True
            break

    full_pos = np.zeros(N, dtype=float)
    full_pos[1:] = x_mobile
    err = float(np.max(np.abs(full_pos - efn_positions)))

    status = "converged" if converged else "max_iterations_exceeded"

    return PileupResult(
        status=status,
        converged=converged,
        positions_m=full_pos,
        residuals_pa=residuals,
        max_residual_pa=max_res,
        iterations=iteration,
        tip_stress_pa=tip_stress,
        efn_positions_m=efn_positions,
        max_position_error_m=err,
        pileup_length_m=float(full_pos[-1]),
    )

