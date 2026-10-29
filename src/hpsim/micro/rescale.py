"""
src/hpsim/micro/rescale.py - Chord distribution mean rescaling (V-16) and chord-ensemble Hall-Petch evaluation.
"""

from dataclasses import dataclass
from typing import Dict, Optional, Sequence
import numpy as np

from hpsim.core.hallpetch import YieldOnsetInputs, find_yield_onset


@dataclass(frozen=True)
class RescaledChordResult:
    """Result of affine chord distribution rescaling to a target mean grain size (V-16)."""
    chords_m: np.ndarray
    mean_m: float
    std_m: float
    cv: float
    scale_factor: float


def rescale_chords(
    chords_m: Sequence[float],
    target_mean_m: float,
) -> RescaledChordResult:
    """
    Rescale an empirical chord distribution {c_k} by target_mean_m / mean(c_k)
    so the new mean equals target_mean_m while preserving the dimensionless
    coefficient of variation CV = std / mean within machine precision (V-16).
    """
    if target_mean_m <= 0.0:
        raise ValueError(f"target_mean_m must be positive, got {target_mean_m}")

    arr = np.asarray(chords_m, dtype=np.float64)
    arr = arr[arr > 0.0]
    if arr.size == 0:
        raise ValueError("chords_m must contain at least one positive chord length")

    raw_mean = float(np.mean(arr))
    scale = float(target_mean_m / raw_mean)
    scaled = arr * scale
    new_mean = float(np.mean(scaled))
    new_std = float(np.std(scaled))
    new_cv = float(new_std / new_mean) if new_mean > 0.0 else 0.0

    return RescaledChordResult(
        chords_m=scaled,
        mean_m=new_mean,
        std_m=new_std,
        cv=new_cv,
        scale_factor=scale,
    )


def evaluate_chord_ensemble_hall_petch(
    chords_m: Sequence[float],
    mu_pa: float,
    nu: float,
    burgers_m: float,
    tau_c_pa: float,
    taylor_factor: float,
    tau_star_ref_pa: float,
    sigma_0_offset_pa: Optional[float] = None,
) -> Dict[str, object]:
    """
    Evaluate emergent Hall-Petch yield stress across an ensemble of grain chord lengths {c_k}
    and compare the ensemble mean <sigma_y(c_k)> against the single mean-intercept evaluation
    sigma_y(<c_k>) (Jensen's inequality / lognormal spread effect).
    """
    arr = np.asarray(chords_m, dtype=np.float64)
    arr = arr[arr > 0.0]
    if arr.size == 0:
        raise ValueError("chords_m must contain at least one positive chord length")

    yields_pa = []
    for c_m in arr:
        onset = find_yield_onset(
            YieldOnsetInputs(
                mu_pa=mu_pa,
                nu=nu,
                burgers_m=burgers_m,
                grain_size_m=float(c_m),
                tau_star_ref_pa=tau_star_ref_pa,
                tau_c_pa=tau_c_pa,
                taylor_factor=taylor_factor,
                sigma_0_offset_pa=sigma_0_offset_pa,
            )
        )
        yields_pa.append(onset.sigma_y_pa)

    yields_np = np.array(yields_pa, dtype=np.float64)
    mean_chord_m = float(np.mean(arr))
    mean_onset = find_yield_onset(
        YieldOnsetInputs(
            mu_pa=mu_pa,
            nu=nu,
            burgers_m=burgers_m,
            grain_size_m=mean_chord_m,
            tau_star_ref_pa=tau_star_ref_pa,
            tau_c_pa=tau_c_pa,
            taylor_factor=taylor_factor,
            sigma_0_offset_pa=sigma_0_offset_pa,
        )
    )

    return {
        "mean_chord_m": mean_chord_m,
        "ensemble_mean_sigma_y_pa": float(np.mean(yields_np)),
        "ensemble_std_sigma_y_pa": float(np.std(yields_np)),
        "mean_intercept_sigma_y_pa": float(mean_onset.sigma_y_pa),
        "chord_yields_pa": [float(v) for v in yields_np],
    }
