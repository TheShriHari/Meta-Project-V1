"""
hpsim.core.simulation - Deterministic fixed-step single-dislocation glide (reference implementation).

State is the scalar core coordinate pos_m along the slip direction s (metres). One step:
    v = M_d b sgn(tau) max(|tau| - tau_c, 0)         (hpsim.core.glide)
    pos_proposed = pos + v dt
The proposed position is clamped to [domain_min_m, domain_max_m]; a step that would cross a limit
stops AT the limit (status 'at_domain_limit', step_limited=True) so a large step can never tunnel or
wrap. step_limited is also set if |v dt| > max_step_m (the step was larger than the declared
maximum, even if no boundary was reached). No randomness is used. No pinning, no grain boundaries.
Playback speed is not an argument here by design: it is a presentation concern.
"""
from dataclasses import dataclass
from hpsim.core.glide import calculate_glide_velocity


@dataclass(frozen=True)
class GlideParams:
    b_m: float
    tau_c_pa: float
    M_d: float
    dt_s: float
    domain_min_m: float
    domain_max_m: float
    max_step_m: float


@dataclass(frozen=True)
class SimState:
    step: int
    t_s: float
    pos_m: float
    velocity_mps: float = 0.0
    tau_rss_pa: float = 0.0
    status: str = "initial"
    step_limited: bool = False


def advance_step(state: SimState, tau_rss_pa: float, p: GlideParams) -> SimState:
    if p.dt_s <= 0.0 or p.domain_min_m >= p.domain_max_m:
        raise ValueError("invalid time step or domain")
    v = calculate_glide_velocity(tau_rss_pa, p.tau_c_pa, p.M_d, p.b_m)
    proposed = state.pos_m + v * p.dt_s
    limited = abs(v * p.dt_s) > p.max_step_m
    pos = min(max(proposed, p.domain_min_m), p.domain_max_m)
    if v == 0.0:
        status = "below_threshold"
    elif pos != proposed:
        status, limited = "at_domain_limit", True
    else:
        status = "gliding"
    return SimState(state.step + 1, state.t_s + p.dt_s, pos, v, tau_rss_pa, status, limited)


def run_trajectory(initial: SimState, taus_pa, p: GlideParams):
    """Return [initial, state_1, ..., state_N] for a sequence of resolved shear stresses (Pa)."""
    out, s = [initial], initial
    for tau in taus_pa:
        s = advance_step(s, tau, p)
        out.append(s)
    return out
