"""
src/hpsim/core/hallpetch.py - Emergent Hall-Petch derivation from 1D discrete dislocation pile-ups.

Architectural constraint (NFR-04): Pure mathematical/physical core; zero UI or visualization imports.

Governing Equations (spec.md §5.6, §5.7):
  1. Source Shut-Off (Quasi-Static Emission at x = L = d / 2):
     Starting at N = 1 (leader pinned at x_0 = 0), add dislocations while:
       tau_eff - tau_back(L; N) > tau_src
     where tau_back(L; N) = sum_{j=0}^{N-1} A / (L - x_j), A = mu * b / [2*pi*(1 - nu)],
     and all equilibrium positions x_j < L.
     Tip stress on leader: tau_tip(L, tau_eff) = N(L, tau_eff) * tau_eff.

  2. Boundary Obstacle Threshold:
     tau*(m') = tau*_ref * (1 + beta * (1 - m')), default beta = 0.0, m' = 1.0.

  3. Yield Onset (Bisection on tau_eff):
     Smallest tau_eff > 0 such that tau_tip(L = d/2, tau_eff) >= tau*(m').
     Macroscopic yield stress: sigma_y(d) = sigma_0_base + M_T * tau_eff,crit(d),
     where sigma_0_base = M_T * tau_c (or reported friction stress sigma_0 for polycrystal comparison).

  4. Analytic Continuum Reference (Eshelby-Frank-Nabarro 1951):
     tau_eff,crit,cont(d) = sqrt( 2 * mu * b * tau* / [pi * (1 - nu) * d] )
     k_y,analytic = M_T * sqrt( 2 * mu * b * tau* / [pi * (1 - nu)] )
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence
import numpy as np

from hpsim.core.pileup import compute_efn_roots, compute_pileup_prefactor


# Precomputed cache of EFN associated Laguerre roots (including x_0 = 0.0)
_EFN_ROOTS_CACHE: Dict[int, np.ndarray] = {0: np.array([0.0], dtype=float)}


def _get_cached_efn_roots_with_zero(mobile_count: int) -> np.ndarray:
    """Return sorted dimensionless positions [0, xi_1, ..., xi_m] for m mobile dislocations."""
    if mobile_count not in _EFN_ROOTS_CACHE:
        if mobile_count <= 0:
            _EFN_ROOTS_CACHE[mobile_count] = np.array([0.0], dtype=float)
        else:
            roots = compute_efn_roots(mobile_count)
            _EFN_ROOTS_CACHE[mobile_count] = np.concatenate(([0.0], roots))
    return _EFN_ROOTS_CACHE[mobile_count]


@dataclass(frozen=True)
class SourceShutoffInputs:
    """Inputs for quasi-static pile-up formation with source shut-off at x = L."""
    mu_pa: float
    nu: float
    burgers_m: float
    tau_eff_pa: float
    source_distance_m: float
    tau_src_pa: float = 0.0
    max_count: int = 300


@dataclass(frozen=True)
class SourceShutoffResult:
    """Equilibrium pile-up state determined by source shut-off at x = L."""
    count: int
    tip_stress_pa: float
    back_stress_pa: float
    net_source_stress_pa: float
    positions_m: np.ndarray
    pileup_length_m: float
    asymptotic_count: float
    core_overlap_flagged: bool


@dataclass(frozen=True)
class YieldOnsetInputs:
    """Inputs for finding critical yield onset stress for a grain of size d."""
    mu_pa: float
    nu: float
    burgers_m: float
    grain_size_m: float
    tau_star_ref_pa: float
    m_prime: float = 1.0
    beta: float = 0.0
    tau_c_pa: float = 0.0
    taylor_factor: float = 3.06
    sigma_0_offset_pa: Optional[float] = None
    tau_src_pa: float = 0.0
    max_count: int = 300
    bisection_iterations: int = 40
    source_distance_ratio: float = 0.5  # L = source_distance_ratio * grain_size_m (default L = d/2)


@dataclass(frozen=True)
class YieldOnsetResult:
    """Result of yield-onset bisection at grain size d (L = d/2)."""
    converged: bool
    grain_size_m: float
    source_distance_m: float
    tau_star_effective_pa: float
    tau_eff_crit_pa: float
    tau_eff_analytic_pa: float
    critical_count: int
    tip_stress_pa: float
    sigma_y_pa: float
    sigma_y_analytic_pa: float
    plateau_width_pa: float


@dataclass(frozen=True)
class HallPetchSweepInputs:
    """Inputs for a multi-grain-size Hall-Petch sweep and regression."""
    mu_pa: float
    nu: float
    burgers_m: float
    tau_c_pa: float
    taylor_factor: float
    tau_star_ref_pa: float
    grain_sizes_m: Sequence[float]
    m_prime: float = 1.0
    beta: float = 0.0
    sigma_0_offset_pa: Optional[float] = None
    tau_src_pa: float = 0.0
    bootstrap_samples: int = 200
    seed: int = 42
    source_distance_ratio: float = 0.5  # L = source_distance_ratio * grain_size_m (default L = d/2)


@dataclass(frozen=True)
class HallPetchPoint:
    """Single point in a simulated Hall-Petch grain-size sweep."""
    grain_size_m: float
    inv_sqrt_d_m05: float
    tau_eff_crit_pa: float
    tau_eff_analytic_pa: float
    sigma_y_pa: float
    sigma_y_analytic_pa: float
    critical_count: int
    plateau_width_pa: float


@dataclass(frozen=True)
class HallPetchSweepResult:
    """Complete result of an emergent Hall-Petch grain-size sweep."""
    points: List[HallPetchPoint]
    fitted_sigma_0_pa: float
    fitted_k_y_pa_m05: float
    analytic_sigma_0_pa: float
    analytic_k_y_pa_m05: float
    k_y_ci95_low_pa_m05: float
    k_y_ci95_high_pa_m05: float
    sigma_0_ci95_low_pa: float
    sigma_0_ci95_high_pa: float
    r_squared: float
    log_log_slope: float
    log_log_intercept: float
    k_y_rel_error_vs_analytic: float
    v09_passed: bool
    v10_passed: bool


def compute_effective_tau_star(
    tau_star_ref_pa: float, m_prime: float = 1.0, beta: float = 0.0
) -> float:
    """
    Compute obstacle barrier threshold tau*(m') = tau*_ref * (1 + beta * (1 - m')) (spec.md §5.7).
    """
    if tau_star_ref_pa <= 0.0:
        raise ValueError(f"tau_star_ref_pa must be positive, got {tau_star_ref_pa}")
    if not (0.0 <= m_prime <= 1.0):
        raise ValueError(f"m_prime must be in [0, 1], got {m_prime}")
    if beta < 0.0:
        raise ValueError(f"beta must be >= 0, got {beta}")
    return float(tau_star_ref_pa * (1.0 + beta * (1.0 - m_prime)))


def compute_analytic_hall_petch_ky(
    mu_pa: float,
    nu: float,
    burgers_m: float,
    tau_star_pa: float,
    taylor_factor: float = 3.06,
    source_distance_ratio: float = 0.5,
) -> float:
    """
    Continuum Eshelby-Frank-Nabarro Hall-Petch slope (spec.md §5.7):
    k_y = M_T * sqrt( mu * b * tau* / [pi * (1 - nu) * source_distance_ratio] ) in Pa * m^(1/2).
    For source at grain center (source_distance_ratio = 0.5), this recovers:
    k_y = M_T * sqrt( 2 * G * b * tau* / [pi * (1 - nu)] ).
    """
    if source_distance_ratio <= 0.0:
        raise ValueError(f"source_distance_ratio must be positive, got {source_distance_ratio}")
    return float(
        taylor_factor
        * np.sqrt((mu_pa * burgers_m * tau_star_pa) / (np.pi * (1.0 - nu) * source_distance_ratio))
    )


def compute_analytic_tau_star_from_ky(
    k_y_pa_m05: float,
    mu_pa: float,
    nu: float,
    burgers_m: float,
    taylor_factor: float = 3.06,
) -> float:
    """
    Invert the continuum EFN Hall-Petch formula to obtain the analytical barrier stress tau*:
    tau*_analytic = [pi * (1 - nu) / (2 * G * b)] * (k_y / M_T)^2.
    """
    return float(
        (np.pi * (1.0 - nu) / (2.0 * mu_pa * burgers_m))
        * ((k_y_pa_m05 / taylor_factor) ** 2)
    )


def solve_pileup_with_source(inputs: SourceShutoffInputs) -> SourceShutoffResult:
    """
    Determine equilibrium pile-up dislocation count N and positions under quasi-static
    emission from a source at distance L = source_distance_m from the obstacle (spec.md §5.6).
    """
    if inputs.mu_pa <= 0.0 or not (-1.0 < inputs.nu < 0.5) or inputs.burgers_m <= 0.0:
        raise ValueError("Invalid elastic or Burgers parameters in SourceShutoffInputs")
    if inputs.source_distance_m <= 0.0:
        raise ValueError(f"source_distance_m must be positive, got {inputs.source_distance_m}")

    L = inputs.source_distance_m
    tau_eff = inputs.tau_eff_pa
    if tau_eff <= inputs.tau_src_pa:
        return SourceShutoffResult(
            count=0,
            tip_stress_pa=0.0,
            back_stress_pa=0.0,
            net_source_stress_pa=float(tau_eff - inputs.tau_src_pa),
            positions_m=np.array([], dtype=float),
            pileup_length_m=0.0,
            asymptotic_count=0.0,
            core_overlap_flagged=False,
        )

    A = compute_pileup_prefactor(inputs.mu_pa, inputs.nu, inputs.burgers_m)
    lam = tau_eff / A
    L_dim = 2.0 * lam * L
    asymp_n = float((np.pi * (1.0 - inputs.nu) * L * tau_eff) / (inputs.mu_pa * inputs.burgers_m))

    N = 1
    cand_n = min(inputs.max_count - 1, max(1, int(asymp_n * 0.85)))
    if cand_n > 1:
        r_cand = _get_cached_efn_roots_with_zero(cand_n - 1)
        if r_cand[-1] < L_dim:
            tb_cand = float(np.sum(A / (L - r_cand / (2.0 * lam))))
            if tau_eff - tb_cand > inputs.tau_src_pa:
                N = cand_n

    while N < inputs.max_count:
        roots_n = _get_cached_efn_roots_with_zero(N - 1)
        if roots_n[-1] >= L_dim:
            break
        pos_n = roots_n / (2.0 * lam)
        tau_back = float(np.sum(A / (L - pos_n)))
        if tau_eff - tau_back > inputs.tau_src_pa:
            roots_next = _get_cached_efn_roots_with_zero(N)
            if roots_next[-1] < L_dim:
                N += 1
            else:
                break
        else:
            break

    roots_final = _get_cached_efn_roots_with_zero(N - 1)
    positions_m = roots_final / (2.0 * lam)
    if positions_m[-1] < L:
        back_stress_pa = float(np.sum(A / (L - positions_m)))
    else:
        back_stress_pa = float("inf")

    core_overlap = False
    if N >= 2:
        min_gap = float(np.min(np.diff(positions_m)))
        if min_gap < inputs.burgers_m:
            core_overlap = True

    return SourceShutoffResult(
        count=N,
        tip_stress_pa=float(N * tau_eff),
        back_stress_pa=back_stress_pa,
        net_source_stress_pa=float(tau_eff - back_stress_pa),
        positions_m=positions_m,
        pileup_length_m=float(positions_m[-1]),
        asymptotic_count=asymp_n,
        core_overlap_flagged=core_overlap,
    )


def find_yield_onset(inputs: YieldOnsetInputs) -> YieldOnsetResult:
    """
    Find the critical effective driving stress tau_eff,crit at grain size d (L = source_distance_ratio * d)
    such that tau_tip(L, tau_eff) >= tau*(m') via bisection (spec.md §5.7).
    """
    if inputs.grain_size_m <= 0.0:
        raise ValueError(f"grain_size_m must be positive, got {inputs.grain_size_m}")
    if inputs.source_distance_ratio <= 0.0:
        raise ValueError(f"source_distance_ratio must be positive, got {inputs.source_distance_ratio}")

    L = inputs.source_distance_ratio * inputs.grain_size_m
    tau_star = compute_effective_tau_star(
        inputs.tau_star_ref_pa, inputs.m_prime, inputs.beta
    )

    tau_eff_analytic = float(
        np.sqrt(
            (inputs.mu_pa * inputs.burgers_m * tau_star)
            / (np.pi * (1.0 - inputs.nu) * L)
        )
    )

    # Bracket [lo, hi] tightly around analytic estimate
    lo = max(inputs.tau_src_pa + 1.0, 0.2 * tau_eff_analytic)
    hi = max(1.6 * tau_eff_analytic, inputs.tau_src_pa + 100.0)

    # Ensure hi reaches tau_star
    for _ in range(10):
        res_hi = solve_pileup_with_source(
            SourceShutoffInputs(
                mu_pa=inputs.mu_pa,
                nu=inputs.nu,
                burgers_m=inputs.burgers_m,
                tau_eff_pa=hi,
                source_distance_m=L,
                tau_src_pa=inputs.tau_src_pa,
                max_count=inputs.max_count,
            )
        )
        if res_hi.tip_stress_pa >= tau_star:
            break
        hi *= 2.0

    for _ in range(inputs.bisection_iterations):
        mid = 0.5 * (lo + hi)
        res_mid = solve_pileup_with_source(
            SourceShutoffInputs(
                mu_pa=inputs.mu_pa,
                nu=inputs.nu,
                burgers_m=inputs.burgers_m,
                tau_eff_pa=mid,
                source_distance_m=L,
                tau_src_pa=inputs.tau_src_pa,
                max_count=inputs.max_count,
            )
        )
        if res_mid.tip_stress_pa >= tau_star:
            hi = mid
        else:
            lo = mid

    final_res = solve_pileup_with_source(
        SourceShutoffInputs(
            mu_pa=inputs.mu_pa,
            nu=inputs.nu,
            burgers_m=inputs.burgers_m,
            tau_eff_pa=hi,
            source_distance_m=L,
            tau_src_pa=inputs.tau_src_pa,
            max_count=inputs.max_count,
        )
    )

    N_crit = max(final_res.count, 1)
    # Integer-N step plateau resolution: tau_star / N_crit vs tau_star / (N_crit + 1)
    plateau_width_pa = float(tau_star / N_crit - tau_star / (N_crit + 1))

    sigma_0_base = (
        float(inputs.sigma_0_offset_pa)
        if inputs.sigma_0_offset_pa is not None
        else float(inputs.taylor_factor * inputs.tau_c_pa)
    )
    sigma_y_pa = float(sigma_0_base + inputs.taylor_factor * hi)
    sigma_y_analytic_pa = float(sigma_0_base + inputs.taylor_factor * tau_eff_analytic)

    return YieldOnsetResult(
        converged=bool(final_res.tip_stress_pa >= tau_star * (1.0 - 1e-6)),
        grain_size_m=float(inputs.grain_size_m),
        source_distance_m=float(L),
        tau_star_effective_pa=tau_star,
        tau_eff_crit_pa=float(hi),
        tau_eff_analytic_pa=tau_eff_analytic,
        critical_count=N_crit,
        tip_stress_pa=final_res.tip_stress_pa,
        sigma_y_pa=sigma_y_pa,
        sigma_y_analytic_pa=sigma_y_analytic_pa,
        plateau_width_pa=plateau_width_pa,
    )


def _ols_linear_fit(x: np.ndarray, y: np.ndarray):
    """Ordinary least squares fit y = intercept + slope * x, returning (slope, intercept, r2)."""
    x_mean = float(np.mean(x))
    y_mean = float(np.mean(y))
    dx = x - x_mean
    dy = y - y_mean
    denom = float(np.sum(dx * dx))
    if denom <= 0.0:
        return 0.0, y_mean, 0.0
    slope = float(np.sum(dx * dy) / denom)
    intercept = float(y_mean - slope * x_mean)
    y_pred = intercept + slope * x
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum(dy * dy))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0.0 else 1.0
    return slope, intercept, r2


def run_hall_petch_sweep(inputs: HallPetchSweepInputs) -> HallPetchSweepResult:
    """
    Sweep grain sizes d, compute emergent yield stress sigma_y(d), fit OLS Hall-Petch
    sigma_y = sigma_0 + k_y * d^(-1/2) with deterministic seeded bootstrap 95% CI,
    and evaluate V-09 and V-10 benchmarks.
    """
    if len(inputs.grain_sizes_m) < 3:
        raise ValueError("HallPetchSweepInputs requires at least 3 grain sizes")

    points: List[HallPetchPoint] = []
    for d in inputs.grain_sizes_m:
        onset = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=inputs.mu_pa,
                nu=inputs.nu,
                burgers_m=inputs.burgers_m,
                grain_size_m=float(d),
                tau_star_ref_pa=inputs.tau_star_ref_pa,
                m_prime=inputs.m_prime,
                beta=inputs.beta,
                tau_c_pa=inputs.tau_c_pa,
                taylor_factor=inputs.taylor_factor,
                sigma_0_offset_pa=inputs.sigma_0_offset_pa,
                tau_src_pa=inputs.tau_src_pa,
                source_distance_ratio=inputs.source_distance_ratio,
            )
        )
        points.append(
            HallPetchPoint(
                grain_size_m=onset.grain_size_m,
                inv_sqrt_d_m05=float(onset.grain_size_m ** (-0.5)),
                tau_eff_crit_pa=onset.tau_eff_crit_pa,
                tau_eff_analytic_pa=onset.tau_eff_analytic_pa,
                sigma_y_pa=onset.sigma_y_pa,
                sigma_y_analytic_pa=onset.sigma_y_analytic_pa,
                critical_count=onset.critical_count,
                plateau_width_pa=onset.plateau_width_pa,
            )
        )

    inv_sqrt_d = np.array([p.inv_sqrt_d_m05 for p in points], dtype=float)
    sigma_y = np.array([p.sigma_y_pa for p in points], dtype=float)
    d_arr = np.array([p.grain_size_m for p in points], dtype=float)
    tau_crit_arr = np.array([p.tau_eff_crit_pa for p in points], dtype=float)

    fitted_k_y, fitted_sigma_0, r2 = _ols_linear_fit(inv_sqrt_d, sigma_y)
    log_slope, log_intercept, _ = _ols_linear_fit(
        np.log10(d_arr), np.log10(tau_crit_arr)
    )

    tau_star_eff = compute_effective_tau_star(
        inputs.tau_star_ref_pa, inputs.m_prime, inputs.beta
    )
    analytic_k_y = compute_analytic_hall_petch_ky(
        inputs.mu_pa,
        inputs.nu,
        inputs.burgers_m,
        tau_star_eff,
        inputs.taylor_factor,
        source_distance_ratio=inputs.source_distance_ratio,
    )
    analytic_sigma_0 = (
        float(inputs.sigma_0_offset_pa)
        if inputs.sigma_0_offset_pa is not None
        else float(inputs.taylor_factor * inputs.tau_c_pa)
    )

    # Deterministic cross-language LCG bootstrap for 95% confidence intervals
    n_pts = len(points)
    n_boot = max(inputs.bootstrap_samples, 10)
    boot_ky = []
    boot_s0 = []
    state = int(inputs.seed) & 0xFFFFFFFF

    for _ in range(n_boot):
        idx = []
        for _ in range(n_pts):
            state = (1664525 * state + 1013904223) & 0xFFFFFFFF
            idx.append(state % n_pts)
        bx = inv_sqrt_d[idx]
        by = sigma_y[idx]
        bslope, binter, _ = _ols_linear_fit(bx, by)
        if bslope > 0.0:
            boot_ky.append(bslope)
            boot_s0.append(binter)

    boot_ky.sort()
    boot_s0.sort()
    lo_idx = int(0.025 * (len(boot_ky) - 1))
    hi_idx = int(0.975 * (len(boot_ky) - 1))

    rel_err = abs(fitted_k_y - analytic_k_y) / analytic_k_y
    v09_passed = bool(abs(log_slope - (-0.5)) <= 0.05)
    v10_passed = bool(rel_err <= 0.15)

    return HallPetchSweepResult(
        points=points,
        fitted_sigma_0_pa=fitted_sigma_0,
        fitted_k_y_pa_m05=fitted_k_y,
        analytic_sigma_0_pa=analytic_sigma_0,
        analytic_k_y_pa_m05=analytic_k_y,
        k_y_ci95_low_pa_m05=float(boot_ky[lo_idx]),
        k_y_ci95_high_pa_m05=float(boot_ky[hi_idx]),
        sigma_0_ci95_low_pa=float(boot_s0[lo_idx]),
        sigma_0_ci95_high_pa=float(boot_s0[hi_idx]),
        r_squared=r2,
        log_log_slope=log_slope,
        log_log_intercept=log_intercept,
        k_y_rel_error_vs_analytic=float(rel_err),
        v09_passed=v09_passed,
        v10_passed=v10_passed,
    )


@dataclass(frozen=True)
class SourceDistanceSensitivityResult:
    """Summary of Hall-Petch slope sensitivity to dislocation source distance L = ratio * d."""
    ratios: List[float]
    results: Dict[float, HallPetchSweepResult]
    fitted_ky_by_ratio: Dict[float, float]
    analytic_ky_by_ratio: Dict[float, float]
    ratio_to_half_d_scaling: Dict[float, float]
    expected_analytic_scaling: Dict[float, float]


def evaluate_source_distance_sensitivity(
    base_inputs: HallPetchSweepInputs,
    ratios: Sequence[float] = (0.25, 0.5, 1.0),
) -> SourceDistanceSensitivityResult:
    """
    Evaluate sensitivity of emergent Hall-Petch slope k_y to dislocation source
    distance L in {d/4 (0.25), d/2 (0.5), d (1.0)}.

    Governing physics & scaling:
      In the EFN continuum formulation, the pile-up tip stress is tau_tip ~ N * tau_eff,
      where N ~ pi*(1-nu)*L*tau_eff / (mu*b). Equating tau_tip = tau* gives:
        tau_eff,crit = sqrt( mu * b * tau* / [pi * (1 - nu) * L] )
      Because L = alpha * d:
        tau_eff,crit = (1 / sqrt(alpha)) * sqrt( mu * b * tau* / [pi * (1 - nu) * d] )
      Consequently, macroscopic k_y scales analytically as sqrt(1 / L):
        k_y(alpha) = (1 / sqrt(alpha)) * k_y(alpha=1)
        k_y(d/2) ~ sqrt(2/d)
        k_y(d)   ~ sqrt(1/d)   => k_y(d) / k_y(d/2) = 1 / sqrt(2) ~ 0.7071
        k_y(d/4) ~ sqrt(4/d)   => k_y(d/4) / k_y(d/2) = sqrt(2) ~ 1.4142

      The log-log power-law exponent (V-09) remains d^(-1/2) regardless of the chosen
      source distance ratio alpha, since L proportional to d preserves the -0.5 slope.
    """
    res_dict: Dict[float, HallPetchSweepResult] = {}
    fitted_ky: Dict[float, float] = {}
    analytic_ky: Dict[float, float] = {}
    scaling_to_half: Dict[float, float] = {}
    expected_scaling: Dict[float, float] = {}

    for r in ratios:
        r_flt = float(r)
        sweep_inp = HallPetchSweepInputs(
            mu_pa=base_inputs.mu_pa,
            nu=base_inputs.nu,
            burgers_m=base_inputs.burgers_m,
            tau_c_pa=base_inputs.tau_c_pa,
            taylor_factor=base_inputs.taylor_factor,
            tau_star_ref_pa=base_inputs.tau_star_ref_pa,
            grain_sizes_m=base_inputs.grain_sizes_m,
            m_prime=base_inputs.m_prime,
            beta=base_inputs.beta,
            sigma_0_offset_pa=base_inputs.sigma_0_offset_pa,
            tau_src_pa=base_inputs.tau_src_pa,
            bootstrap_samples=base_inputs.bootstrap_samples,
            seed=base_inputs.seed,
            source_distance_ratio=r_flt,
        )
        sweep_res = run_hall_petch_sweep(sweep_inp)
        res_dict[r_flt] = sweep_res
        fitted_ky[r_flt] = sweep_res.fitted_k_y_pa_m05
        analytic_ky[r_flt] = sweep_res.analytic_k_y_pa_m05
        expected_scaling[r_flt] = float(np.sqrt(0.5 / r_flt))

    ref_ky = fitted_ky.get(0.5, list(fitted_ky.values())[0])
    for r_flt, ky in fitted_ky.items():
        scaling_to_half[r_flt] = float(ky / ref_ky)

    return SourceDistanceSensitivityResult(
        ratios=[float(r) for r in ratios],
        results=res_dict,
        fitted_ky_by_ratio=fitted_ky,
        analytic_ky_by_ratio=analytic_ky,
        ratio_to_half_d_scaling=scaling_to_half,
        expected_analytic_scaling=expected_scaling,
    )


def calibrate_tau_star_ref(
    target_k_y_pa_m05: float,
    mu_pa: float,
    nu: float,
    burgers_m: float,
    tau_c_pa: float,
    taylor_factor: float,
    grain_sizes_m: Sequence[float],
    sigma_0_offset_pa: Optional[float] = None,
    iterations: int = 24,
) -> float:
    """
    Calibrate the single scalar boundary barrier parameter tau*_ref (with beta=0, m'=1)
    so that the simulated discrete pile-up Hall-Petch slope k_y matches target_k_y_pa_m05
    on the calibration grain-size range (spec.md §5.7).
    """
    tau_star_analytic = compute_analytic_tau_star_from_ky(
        target_k_y_pa_m05, mu_pa, nu, burgers_m, taylor_factor
    )
    lo = 0.5 * tau_star_analytic
    hi = 2.0 * tau_star_analytic

    for _ in range(iterations):
        mid = 0.5 * (lo + hi)
        sweep = run_hall_petch_sweep(
            HallPetchSweepInputs(
                mu_pa=mu_pa,
                nu=nu,
                burgers_m=burgers_m,
                tau_c_pa=tau_c_pa,
                taylor_factor=taylor_factor,
                tau_star_ref_pa=mid,
                grain_sizes_m=grain_sizes_m,
                sigma_0_offset_pa=sigma_0_offset_pa,
                bootstrap_samples=20,
                seed=42,
            )
        )
        if sweep.fitted_k_y_pa_m05 >= target_k_y_pa_m05:
            hi = mid
        else:
            lo = mid

    return float(0.5 * (lo + hi))


# Verified material calibration & held-out specifications from hall_petch_verified_fits.csv
VERIFIED_MATERIAL_SPECS = {
    "aluminium": {
        "name": "Aluminium (99.999% High-Purity Al)",
        "structure": "FCC",
        "mu_pa": 26.0e9,
        "nu": 0.345,
        "burgers_m": 2.86343e-10,
        "tau_c_pa": 0.8e6,
        "tau_c_status": "sourced",
        "taylor_factor": 3.06,
        "calibration_fit": {
            "source_id": "Hansen (1977)",
            "doi": "10.1016/0001-6160(77)90171-7",
            "purity": "99.999% High-Purity Al",
            "d_min_um": 25.0,
            "d_max_um": 450.0,
            "sigma_0_pa": 10.0e6,
            "k_y_pa_m05": 67000.0,
        },
        "held_out_fit": {
            "source_id": "Hansen (1977) AA1050",
            "doi": "10.1016/0001-6160(77)90171-7",
            "purity": "99.5% Commercial Al (AA1050)",
            "d_min_um": 18.0,
            "d_max_um": 380.0,
            "sigma_0_pa": 16.5e6,
            "k_y_pa_m05": 78000.0,
        },
    },
    "copper": {
        "name": "Copper (99.999% High-Purity Cu)",
        "structure": "FCC",
        "mu_pa": 46.4e9,
        "nu": 0.343,
        "burgers_m": 2.55620e-10,
        "tau_c_pa": 0.65e6,
        "tau_c_status": "sourced",
        "taylor_factor": 3.06,
        "calibration_fit": {
            "source_id": "Hansen & Ralph (1982)",
            "doi": "10.1016/0001-6160(82)90221-8",
            "purity": "99.999% High-Purity Copper",
            "d_min_um": 12.0,
            "d_max_um": 220.0,
            "sigma_0_pa": 20.0e6,
            "k_y_pa_m05": 125000.0,
        },
        "held_out_fit": {
            "source_id": "Feltham & Meakin (1957)",
            "doi": "10.1080/14786435708231728",
            "purity": "99.95% Polycrystalline Copper",
            "d_min_um": 14.0,
            "d_max_um": 150.0,
            "sigma_0_pa": 23.5e6,
            "k_y_pa_m05": 144000.0,
        },
    },
    "pure_iron": {
        "name": "Pure Alpha-Iron (Ti-Stabilised IF Iron)",
        "structure": "BCC",
        "mu_pa": 81.6e9,
        "nu": 0.291,
        "burgers_m": 2.48246e-10,
        "tau_c_pa": 27.5e6,
        "tau_c_status": "sourced",
        "taylor_factor": 2.75,
        "calibration_fit": {
            "source_id": "Takeda et al. (2008) IF-Fe",
            "doi": "10.2355/isijinternational.48.1122",
            "purity": "Ti-stabilised IF Iron (4 ppm C)",
            "d_min_um": 7.7,
            "d_max_um": 69.4,
            "sigma_0_pa": 56.0e6,
            "k_y_pa_m05": 114000.0,
        },
        "held_out_fit": {
            "source_id": "Takeda et al. (2008) Base Fe",
            "doi": "10.2355/isijinternational.48.1122",
            "purity": "Base Pure Iron (5 ppm C)",
            "d_min_um": 8.2,
            "d_max_um": 82.6,
            "sigma_0_pa": 72.0e6,
            "k_y_pa_m05": 188000.0,
        },
    },
    "ferritic_steel": {
        "name": "Ferritic Steel (C60 Low-Carbon 56 ppm C)",
        "structure": "BCC",
        "mu_pa": 81.0e9,
        "nu": 0.290,
        "burgers_m": 2.48289e-10,
        "tau_c_pa": 35.0e6,
        "tau_c_status": "needs_citation",
        "taylor_factor": 2.75,
        "calibration_fit": {
            "source_id": "Takeda et al. (2008) C60",
            "doi": "10.2355/isijinternational.48.1122",
            "purity": "C60 Low-Carbon Steel (56 ppm C)",
            "d_min_um": 6.9,
            "d_max_um": 59.2,
            "sigma_0_pa": 61.0e6,
            "k_y_pa_m05": 516000.0,
        },
        "held_out_fit": {
            "source_id": "Armstrong et al. (1962)",
            "doi": "10.1080/14786436208201857",
            "purity": "0.15% C Mild Steel",
            "d_min_um": 10.0,
            "d_max_um": 160.0,
            "sigma_0_pa": 68.0e6,
            "k_y_pa_m05": 620000.0,
        },
    },
}


CALIBRATION_PROTOCOL = {
    "comparison_contract": "10-400 um, 16 log-spaced points (np.geomspace) for the calibration sweep; "
    "held-out evaluation at 5 log-spaced points over the held-out source's own d range",
    "calibrated_parameters": {
        "tau_star_ref_pa": "ONE scalar per material, fitted by bisection so the simulated Hall-Petch "
        "slope k_y matches calibration_fit.k_y_pa_m05. It is a CALIBRATION TARGET, not an emergent "
        "prediction. beta=0, m'=1.",
    },
    "fixed_inputs_from_calibration_source": ["sigma_0_pa (friction intercept of calibration_fit)"],
    "not_calibrated": ["mu_pa", "nu", "burgers_m", "taylor_factor", "tau_src_pa (=0)"],
    "predicted_on_held_out": "sigma_y(d) at held-out grain sizes, compared with held_out_fit "
    "sigma_0 + k_y d^-1/2",
    "headline_metric": "held_out_unadjusted_mean_rel_error: held-out material's own sigma_0 and k_y are "
    "NOT used anywhere in the prediction (uses calibration sigma_0 + calibrated tau*_ref).",
    "non_blind_diagnostics": {
        "held_out_intercept_adjusted_mean_rel_error": "uses held-out sigma_0 (leaks intercept; NOT blind)",
        "held_out_k_y_rel_diff": "slope-only: |k_y_sim(calibrated) - k_y_held|/k_y_held; no intercept used; "
        "k_y_held is only the comparison target",
    },
    "v15_band": "v15_within_25pct_band = (headline unadjusted mean rel error <= 0.25); may be False.",
    "held_out_data_status": "verified_fits rows only; reconstructed hall_petch_datasets.csv rows are "
    "demonstration_only and never used here. tau_c_pa is unused when sigma_0_offset_pa is given; "
    "ferritic tau_c (needs_citation) therefore does not enter any result.",
}


def evaluate_literature_calibration_and_validation() -> Dict[str, dict]:
    """
    Calibrate tau*_ref on each material's primary verified literature fit, verify V-09/V-10 over
    the canonical 10-400 um / 16-point sweep, and compare against the held-out secondary fit.
    See the module constant CALIBRATION_PROTOCOL for the exact protocol.

    Held-out metrics (no held-out leakage in the headline):
      - `held_out_unadjusted_mean_rel_error` (HEADLINE, blind): sigma_0 of the *calibration*
        source + calibrated tau*_ref; nothing from the held-out fit enters the prediction.
      - `held_out_intercept_adjusted_mean_rel_error` (NOT blind): replaces sigma_0 by the
        held-out source's own sigma_0.
      - `held_out_k_y_rel_diff` (slope-only, not blind w.r.t. target k_y).
    """
    results: Dict[str, dict] = {}
    sweep_d_m = np.geomspace(10.0e-6, 400.0e-6, 16)

    for mat_key, spec in VERIFIED_MATERIAL_SPECS.items():
        cal = spec["calibration_fit"]
        held = spec["held_out_fit"]

        tau_star_cal = calibrate_tau_star_ref(
            target_k_y_pa_m05=cal["k_y_pa_m05"],
            mu_pa=spec["mu_pa"],
            nu=spec["nu"],
            burgers_m=spec["burgers_m"],
            tau_c_pa=spec["tau_c_pa"],
            taylor_factor=spec["taylor_factor"],
            grain_sizes_m=sweep_d_m,
            sigma_0_offset_pa=cal["sigma_0_pa"],
        )

        tau_star_analytic = compute_analytic_tau_star_from_ky(
            cal["k_y_pa_m05"],
            spec["mu_pa"],
            spec["nu"],
            spec["burgers_m"],
            spec["taylor_factor"],
        )

        sweep = run_hall_petch_sweep(
            HallPetchSweepInputs(
                mu_pa=spec["mu_pa"],
                nu=spec["nu"],
                burgers_m=spec["burgers_m"],
                tau_c_pa=spec["tau_c_pa"],
                taylor_factor=spec["taylor_factor"],
                tau_star_ref_pa=tau_star_cal,
                grain_sizes_m=sweep_d_m,
                sigma_0_offset_pa=cal["sigma_0_pa"],
                bootstrap_samples=200,
                seed=42,
            )
        )

        held_d_m = np.geomspace(held["d_min_um"] * 1e-6, held["d_max_um"] * 1e-6, 5)
        err_unadj = []
        err_adj = []
        for d_val in held_d_m:
            sigma_lit_held = held["sigma_0_pa"] + held["k_y_pa_m05"] * (d_val ** (-0.5))
            for s0, bucket in ((cal["sigma_0_pa"], err_unadj), (held["sigma_0_pa"], err_adj)):
                onset = find_yield_onset(
                    YieldOnsetInputs(
                        mu_pa=spec["mu_pa"],
                        nu=spec["nu"],
                        burgers_m=spec["burgers_m"],
                        grain_size_m=float(d_val),
                        tau_star_ref_pa=tau_star_cal,
                        tau_c_pa=spec["tau_c_pa"],
                        taylor_factor=spec["taylor_factor"],
                        sigma_0_offset_pa=s0,
                    )
                )
                bucket.append(abs(onset.sigma_y_pa - sigma_lit_held) / sigma_lit_held)

        mean_unadj = float(np.mean(err_unadj))
        ky_held_rel_diff = abs(sweep.fitted_k_y_pa_m05 - held["k_y_pa_m05"]) / held["k_y_pa_m05"]

        results[mat_key] = {
            "material": spec["name"],
            "structure": spec["structure"],
            "tau_c_status": spec["tau_c_status"],
            "calibrated_tau_star_ref_pa": tau_star_cal,
            "analytic_tau_star_ref_pa": tau_star_analytic,
            "calibration_source": cal["source_id"],
            "calibration_target_k_y_pa_m05": cal["k_y_pa_m05"],
            "simulated_k_y_pa_m05": sweep.fitted_k_y_pa_m05,
            "analytic_k_y_at_calibrated_tau_star_pa_m05": sweep.analytic_k_y_pa_m05,
            "calibration_k_y_rel_error": abs(sweep.fitted_k_y_pa_m05 - cal["k_y_pa_m05"]) / cal["k_y_pa_m05"],
            "v10_rel_error_vs_analytic": sweep.k_y_rel_error_vs_analytic,
            "log_log_slope": sweep.log_log_slope,
            "v09_passed": sweep.v09_passed,
            "v10_passed": sweep.v10_passed,
            "held_out_source": held["source_id"],
            "held_out_k_y_pa_m05": held["k_y_pa_m05"],
            "held_out_k_y_rel_diff": float(ky_held_rel_diff),
            "held_out_unadjusted_mean_rel_error": mean_unadj,
            "held_out_unadjusted_max_rel_error": float(np.max(err_unadj)),
            "held_out_intercept_adjusted_mean_rel_error": float(np.mean(err_adj)),
            "held_out_intercept_adjusted_max_rel_error": float(np.max(err_adj)),
            "v15_within_25pct_band": bool(mean_unadj <= 0.25),
        }

    return results
