"""
hpsim.core.boundary - Grain-boundary dislocation transmission decision core.

Conventions & Governing Physics (spec.md §5.5, §5.7, docs/model.md):
For incoming system (s_in, n_in, b_in) at a boundary with neighbouring grain j,
for each outgoing candidate k (all vectors transformed to specimen frame):
1. Geometric compatibility: m' = |s_in . s_out| * |n_in . n_out| in [0, 1].
2. Residual Burgers vector magnitude: |b_r| = min(||b_in - b_out||, ||b_in + b_out||).
3. Outgoing driving stress: tau_out = |s_out^T @ sigma_specimen @ n_out|.
4. Acceptance criteria:
   - m' >= m'_min (default 0.5, configurable)
   - tau_out >= tau_c
   - tau_tip >= tau*(m') = tau*_ref * (1 + beta * (1 - m'))
5. Deterministic tie-breaking among accepted candidates:
   - Highest m'
   - Smallest |b_r|
   - Highest tau_out
   - Lowest slip system index
6. Unresolved parameter handling:
   If tau*_ref is None (M6 pending calibration), the threshold check is marked
   explicitly as unresolved, and the overall outcome is 'unresolved_threshold'.
"""
from dataclasses import dataclass
from typing import List, Optional, Tuple, Union
import numpy as np

from hpsim.core.slipsystems import get_fcc_slip_systems, SlipSystem
from hpsim.core.stress import calculate_resolved_shear_stress
from hpsim.core.rotations import transform_vector_crystal_to_specimen


@dataclass(frozen=True)
class TransmissionThresholds:
    m_prime_min: float = 0.5
    tau_c_pa: float = 0.0
    tau_star_ref_pa: Optional[float] = None
    beta: float = 0.0


@dataclass(frozen=True)
class CandidateEvaluation:
    system_index: int
    plane_miller: Tuple[int, int, int]
    direction_miller: Tuple[int, int, int]
    s_specimen: np.ndarray
    n_specimen: np.ndarray
    m_prime: float
    residual_b_m: float
    tau_out_pa: float
    tau_star_pa: Optional[float]
    passed_m_prime: bool
    passed_tau_out: bool
    passed_tau_tip: Optional[bool]  # None if tau_star_ref is unresolved
    passed_all: bool
    rejection_reasons: List[str]


@dataclass(frozen=True)
class TransmissionResult:
    outcome: str  # "transmitted", "pinned", "unresolved_threshold"
    incoming_system_index: int
    selected_candidate: Optional[CandidateEvaluation]
    candidates: List[CandidateEvaluation]
    summary_log: str


def calculate_geometric_compatibility(
    s_in: Union[np.ndarray, list],
    n_in: Union[np.ndarray, list],
    s_out: Union[np.ndarray, list],
    n_out: Union[np.ndarray, list]
) -> float:
    """
    Compute geometric compatibility factor:
      m' = |s_in . s_out| * |n_in . n_out| in [0, 1]
    """
    s_in_u = np.asarray(s_in, dtype=float) / np.linalg.norm(s_in)
    n_in_u = np.asarray(n_in, dtype=float) / np.linalg.norm(n_in)
    s_out_u = np.asarray(s_out, dtype=float) / np.linalg.norm(s_out)
    n_out_u = np.asarray(n_out, dtype=float) / np.linalg.norm(n_out)

    dot_s = float(abs(np.dot(s_in_u, s_out_u)))
    dot_n = float(abs(np.dot(n_in_u, n_out_u)))

    m_prime = dot_s * dot_n
    return float(np.clip(m_prime, 0.0, 1.0))


def calculate_residual_burgers_magnitude(
    b_in: Union[np.ndarray, list],
    b_out: Union[np.ndarray, list]
) -> float:
    """
    Compute residual Burgers vector magnitude with best sign choice:
      |b_r| = min(||b_in - b_out||, ||b_in + b_out||)
    """
    b1 = np.asarray(b_in, dtype=float)
    b2 = np.asarray(b_out, dtype=float)

    diff_minus = float(np.linalg.norm(b1 - b2))
    diff_plus = float(np.linalg.norm(b1 + b2))
    return min(diff_minus, diff_plus)


def evaluate_candidate_slip_system(
    candidate_system: SlipSystem,
    s_in_spec: np.ndarray,
    n_in_spec: np.ndarray,
    b_in_spec: np.ndarray,
    R_out: np.ndarray,
    b_magnitude_m: float,
    sigma_specimen: np.ndarray,
    tau_tip_pa: float,
    thresholds: TransmissionThresholds,
) -> CandidateEvaluation:
    """
    Evaluate one candidate outgoing slip system in grain 2.
    """
    # Transform candidate crystal directions to specimen frame
    s_out_spec = transform_vector_crystal_to_specimen(candidate_system.s, R_out)
    n_out_spec = transform_vector_crystal_to_specimen(candidate_system.n, R_out)
    b_out_spec = s_out_spec * b_magnitude_m

    m_prime = calculate_geometric_compatibility(s_in_spec, n_in_spec, s_out_spec, n_out_spec)
    residual_b = calculate_residual_burgers_magnitude(b_in_spec, b_out_spec)

    # Resolved shear stress on candidate system from full Cauchy stress tensor
    tau_rss = calculate_resolved_shear_stress(sigma_specimen, s_out_spec, n_out_spec)
    tau_out = abs(tau_rss)

    reasons: List[str] = []

    # Criterion 1: m' >= m'_min
    passed_m_prime = bool(m_prime >= thresholds.m_prime_min - 1e-12)
    if not passed_m_prime:
        reasons.append(f"m' = {m_prime:.4f} < m'_min ({thresholds.m_prime_min:.4f})")

    # Criterion 2: tau_out >= tau_c
    passed_tau_out = bool(tau_out >= thresholds.tau_c_pa - 1e-6)
    if not passed_tau_out:
        reasons.append(f"tau_out = {tau_out/1e6:.3f} MPa < tau_c ({thresholds.tau_c_pa/1e6:.3f} MPa)")

    # Criterion 3: tau_tip >= tau*(m') = tau*_ref * (1 + beta * (1 - m'))
    passed_tau_tip: Optional[bool] = None
    tau_star_pa: Optional[float] = None

    if thresholds.tau_star_ref_pa is not None:
        tau_star_pa = float(thresholds.tau_star_ref_pa * (1.0 + thresholds.beta * (1.0 - m_prime)))
        passed_tau_tip = bool(tau_tip_pa >= tau_star_pa - 1e-6)
        if not passed_tau_tip:
            reasons.append(f"tau_tip = {tau_tip_pa/1e6:.3f} MPa < tau*(m') ({tau_star_pa/1e6:.3f} MPa)")
    else:
        reasons.append("tau*_ref is unresolved (M6 pending calibration); threshold check blocked")

    if passed_tau_tip is None:
        passed_all = False
    else:
        passed_all = bool(passed_m_prime and passed_tau_out and passed_tau_tip)

    return CandidateEvaluation(
        system_index=candidate_system.index,
        plane_miller=candidate_system.plane_miller,
        direction_miller=candidate_system.direction_miller,
        s_specimen=s_out_spec,
        n_specimen=n_out_spec,
        m_prime=m_prime,
        residual_b_m=residual_b,
        tau_out_pa=tau_out,
        tau_star_pa=tau_star_pa,
        passed_m_prime=passed_m_prime,
        passed_tau_out=passed_tau_out,
        passed_tau_tip=passed_tau_tip,
        passed_all=passed_all,
        rejection_reasons=reasons,
    )


def evaluate_boundary_transmission(
    incoming_system_index: int,
    R_in: np.ndarray,
    R_out: np.ndarray,
    b_magnitude_m: float,
    sigma_specimen: np.ndarray,
    tau_tip_pa: float,
    thresholds: TransmissionThresholds,
) -> TransmissionResult:
    """
    Evaluate transmission across a grain boundary from grain 1 (R_in) to grain 2 (R_out).
    """
    fcc_systems = get_fcc_slip_systems()
    in_sys = fcc_systems[incoming_system_index]

    s_in_spec = transform_vector_crystal_to_specimen(in_sys.s, R_in)
    n_in_spec = transform_vector_crystal_to_specimen(in_sys.n, R_in)
    b_in_spec = s_in_spec * b_magnitude_m

    evaluations: List[CandidateEvaluation] = []
    for cand_sys in fcc_systems:
        ev = evaluate_candidate_slip_system(
            candidate_system=cand_sys,
            s_in_spec=s_in_spec,
            n_in_spec=n_in_spec,
            b_in_spec=b_in_spec,
            R_out=R_out,
            b_magnitude_m=b_magnitude_m,
            sigma_specimen=sigma_specimen,
            tau_tip_pa=tau_tip_pa,
            thresholds=thresholds,
        )
        evaluations.append(ev)

    # Check for unresolved threshold state
    if thresholds.tau_star_ref_pa is None:
        summary = (
            "Transmission decision unresolved: tau_star_ref is unresolved (M6 calibration pending). "
            f"Evaluated {len(evaluations)} candidates for geometric compatibility and driving stress."
        )
        return TransmissionResult(
            outcome="unresolved_threshold",
            incoming_system_index=incoming_system_index,
            selected_candidate=None,
            candidates=evaluations,
            summary_log=summary,
        )

    # Filter accepted candidates
    accepted = [c for c in evaluations if c.passed_all]

    if not accepted:
        summary = (
            "Pinned: No candidate slip system satisfied all transmission criteria "
            f"(m' >= {thresholds.m_prime_min}, tau_out >= {thresholds.tau_c_pa/1e6:.2f} MPa, "
            f"tau_tip >= tau*(m'))."
        )
        return TransmissionResult(
            outcome="pinned",
            incoming_system_index=incoming_system_index,
            selected_candidate=None,
            candidates=evaluations,
            summary_log=summary,
        )

    # Deterministic tie-breaking per spec 5.5:
    # 1. Highest m' (descending)
    # 2. Lowest residual_b (ascending)
    # 3. Highest tau_out (descending)
    # 4. Lowest system_index (ascending)
    def sort_key(c: CandidateEvaluation):
        # Round floating values to 10 decimal digits to prevent platform-dependent epsilon jitter
        return (
            -round(c.m_prime, 10),
            round(c.residual_b_m / b_magnitude_m, 10),
            -round(c.tau_out_pa, 6),
            c.system_index,
        )

    sorted_accepted = sorted(accepted, key=sort_key)
    selected = sorted_accepted[0]

    summary = (
        f"Transmitted: Candidate {selected.system_index} "
        f"({selected.plane_miller})[{selected.direction_miller}] selected. "
        f"m' = {selected.m_prime:.4f}, |b_r| = {selected.residual_b_m*1e10:.3f} Angstrom, "
        f"tau_out = {selected.tau_out_pa/1e6:.3f} MPa >= tau_c, "
        f"tau_tip = {tau_tip_pa/1e6:.3f} MPa >= tau* ({selected.tau_star_pa/1e6:.3f} MPa)."
    )

    return TransmissionResult(
        outcome="transmitted",
        incoming_system_index=incoming_system_index,
        selected_candidate=selected,
        candidates=evaluations,
        summary_log=summary,
    )
