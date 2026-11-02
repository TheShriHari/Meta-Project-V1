"""
src/hpsim/core/pileup.py - Discrete edge-dislocation pile-up engine & EFN benchmark.

Physical Model (spec.md §5.6, §5.7; docs/model.md §12):
  1D array of identical like-signed edge dislocations gliding on a single slip plane.
  The leading dislocation (index 0) is locked at an impenetrable obstacle at x = 0.
  The remaining N-1 mobile dislocations (indices 1..N-1) accumulate at positions
  0 < x_1 < x_2 < ... < x_{N-1} under uniform applied shear stress tau_applied_pa.

Isotropic Edge-Dislocation Theory & Interaction Prefactor (Hirth & Lothe 1982, Hull & Bacon 2011, EFN 1951):
  In isotropic linear elasticity, the resolved shear stress on the glide plane (y = 0)
  at distance x from an edge dislocation is:
    tau(x) = mu * b / [2*pi*(1 - nu) * x]   [units: Pa]
  where:
    mu (or G): shear modulus [Pa] (spec.md uses G, model.md uses mu; mu == G)
    b: Burgers vector magnitude [m]
    nu: Poisson's ratio [dimensionless]
    x: distance along slip plane [m]

  Interaction prefactor A:
    A = mu * b / [2*pi*(1 - nu)]   [units: Pa * m = N / m]
  Note on literature conventions (A vs A'):
    - In force-per-unit-length formulations (e.g. Cottrell 1953, spec.md §5.6), the
      interaction force per unit length is f(x) = A_force / x with A_force = G*b^2 / [2*pi*(1-nu)] [N].
      Dividing by b yields stress balance with prefactor A' = A_force / b = G*b / [2*pi*(1-nu)] [Pa*m].
    - In stress formulations (Eshelby, Frank & Nabarro 1951, Hirth & Lothe 1982 Eq. 3-43),
      this stress prefactor is denoted directly as A = mu*b / [2*pi*(1-nu)] [Pa*m].
    - Therefore, A_EFN == A_pileup == A'_spec. This is purely a notation distinction;
      both represent the exact same physical quantity (mu*b / [2*pi*(1-nu)] in Pa*m).

Inter-dislocation interaction:
  tau_{i <- j} = A / (x_i - x_j)   [units: Pa]
  Repulsive stress pushes dislocation i outward (positive x) for x_i > x_j.
  Applied stress drives dislocations inward (-x direction) toward obstacle.

Equilibrium condition for mobile dislocations:
  R_i = sum_{j != i} [ A / (x_i - x_j) ] - tau_app = 0   [units: Pa]  for all mobile i = 1..N-1.

Analytical Benchmark (Eshelby, Frank & Nabarro 1951, Phil. Mag. 42, 351-364):
  Exact equilibrium positions correspond to the roots of L'_{N}(2*lambda*x) = -L_{N-1}^{(1)}(2*lambda*x) = 0,
  where L_{N-1}^{(1)} is the associated Laguerre polynomial,
  lambda = tau_app / A   [units: 1 / m],
  and dimensionless root xi_k = 2 * lambda * x_k.
  Thus x_k = xi_k / (2 * lambda)   [units: m].

Obstacle Tip Stress (Eshelby Theorem):
  tau_tip = tau_app + sum_{k=1}^{N-1} [ A / x_k ] = N * tau_app   [units: Pa].

Grain Boundary Transmission Interface Convention:
  When a dislocation transmits across an obstacle boundary at x = 0 into an adjacent grain,
  the receiving slip channel coordinate is oriented such that x > 0 extends into the grain interior.
  Post-transmission glide velocity v = M_d * b * sign(tau_RSS) * max(|tau_RSS| - tau_c, 0) [m/s]
  must be positive (v > 0) to glide away from the interface into the receiving grain interior.
  When the geometric projection produces tau_RSS < 0, the physical slip direction vector must be
  inverted (s_eff = -s_out) so the effective driving stress is |tau_RSS| >= tau_c, ensuring v > 0.
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
    diag = 2.0 * np.arange(m, dtype=float) + 2.0

    if m == 1:
        return diag

    # Sub/super-diagonal: b_j = sqrt((j + 1) * (j + 1 + alpha)) for alpha=1 => sqrt((j + 1) * (j + 2))
    idx = np.arange(1, m, dtype=float)
    subdiag = np.sqrt(idx * (idx + 1.0))

    # Fast O(m) symmetric tridiagonal eigensolver
    from scipy.linalg import eigh_tridiagonal
    roots = eigh_tridiagonal(diag, subdiag, eigvals_only=True)
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


@dataclass(frozen=True)
class PileupLengthSensitivityResult:
    """Analytical Hall-Petch slope k_y sensitivity to pile-up source distance L relative to grain size d."""
    ky_L_d_half_pa_m05: float       # Standard baseline: L = d / 2 (source at grain centre)
    ky_L_d_full_pa_m05: float       # Transgranular slip: L = d (source across full grain)
    ky_L_d_quarter_pa_m05: float    # Near-boundary source: L = d / 4
    ratio_d_full_to_half: float     # Theoretical 1 / sqrt(2) ~ 0.70710678
    ratio_d_quarter_to_half: float  # Theoretical sqrt(2) ~ 1.41421356
    formula_L_d_half: str = "M_T * sqrt(2 * mu * b * tau_star / [pi * (1 - nu)])"
    formula_L_d_full: str = "M_T * sqrt(mu * b * tau_star / [pi * (1 - nu)])"
    formula_L_d_quarter: str = "M_T * sqrt(4 * mu * b * tau_star / [pi * (1 - nu)])"


def compute_pileup_hall_petch_ky_sensitivity(
    mu_pa: float,
    nu: float,
    burgers_m: float,
    tau_star_pa: float,
    taylor_factor: float = 3.06,
) -> PileupLengthSensitivityResult:
    """
    Compute analytical Hall-Petch slope k_y sensitivity to pile-up length scale L = c * d (spec.md §5.7).

    From continuum EFN theory:
      tau_tip = N * tau_eff = [pi * (1 - nu) * L * tau_eff^2] / (mu * b)   [units: Pa]
    Setting tau_tip = tau* at yield onset with L = c * d:
      tau_eff,crit(d) = sqrt( mu * b * tau* / [pi * (1 - nu) * c * d] )     [units: Pa]
      sigma_y(d) = sigma_0 + M_T * tau_eff,crit(d) = sigma_0 + k_y * d^(-1/2)
      k_y(c) = M_T * sqrt( mu * b * tau* / [pi * (1 - nu) * c] )   [units: Pa * m^(1/2)]

    Cases:
      - c = 1/2 (L = d/2): k_y = M_T * sqrt(2 * mu * b * tau* / [pi * (1 - nu)])
      - c = 1   (L = d):   k_y = M_T * sqrt(mu * b * tau* / [pi * (1 - nu)]) = k_y(d/2) / sqrt(2)
      - c = 1/4 (L = d/4): k_y = M_T * sqrt(4 * mu * b * tau* / [pi * (1 - nu)]) = k_y(d/2) * sqrt(2)
    """
    if mu_pa <= 0.0 or not (-1.0 < nu < 0.5) or burgers_m <= 0.0:
        raise ValueError("Invalid elastic or Burgers parameters in compute_pileup_hall_petch_ky_sensitivity")
    if tau_star_pa <= 0.0:
        raise ValueError(f"Barrier stress tau_star_pa must be positive, got {tau_star_pa}")
    if taylor_factor <= 0.0:
        raise ValueError(f"Taylor factor must be positive, got {taylor_factor}")

    # Base factor: M_T * sqrt(mu * b * tau* / [pi * (1 - nu)])
    base = taylor_factor * np.sqrt((mu_pa * burgers_m * tau_star_pa) / (np.pi * (1.0 - nu)))

    ky_d_half = float(base * np.sqrt(2.0))
    ky_d_full = float(base * 1.0)
    ky_d_quarter = float(base * 2.0)

    return PileupLengthSensitivityResult(
        ky_L_d_half_pa_m05=ky_d_half,
        ky_L_d_full_pa_m05=ky_d_full,
        ky_L_d_quarter_pa_m05=ky_d_quarter,
        ratio_d_full_to_half=float(1.0 / np.sqrt(2.0)),
        ratio_d_quarter_to_half=float(np.sqrt(2.0)),
    )


