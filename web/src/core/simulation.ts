/**
 * web/src/core/simulation.ts - Deterministic fixed-step single-dislocation glide (pure, no UI).
 * Mirrors hpsim.core.simulation. One step: v = M_d b sgn(tau) max(|tau|-tau_c, 0) via glide.ts, then
 * pos += v dt, clamped to [domain_min_m, domain_max_m] so a step can never tunnel/wrap past a limit.
 * A clamped step reports status 'at_domain_limit'; step_limited is also set when |v dt| > max_step_m.
 * No randomness. No pinning. Playback speed is deliberately not a parameter.
 */
import { calculateGlideVelocity } from "./glide.ts";

export interface GlideParams {
  b_m: number;
  tau_c_pa: number;
  M_d: number;
  dt_s: number;
  domain_min_m: number;
  domain_max_m: number;
  max_step_m: number;
}

export type SimStatus = "initial" | "below_threshold" | "gliding" | "at_domain_limit";

export interface SimState {
  readonly step: number;
  readonly t_s: number;
  readonly pos_m: number;
  readonly velocity_mps: number;
  readonly tau_rss_pa: number;
  readonly status: SimStatus;
  readonly step_limited: boolean;
  /** Applied (macroscopic) stress in effect when this state was produced, Pa. */
  readonly applied_stress_pa: number;
}

export function advanceStep(state: SimState, tauRss_pa: number, p: GlideParams): SimState {
  if (!(p.dt_s > 0) || !(p.domain_min_m < p.domain_max_m)) throw new Error("invalid time step or domain");
  const v = calculateGlideVelocity(tauRss_pa, p.tau_c_pa, p.M_d, p.b_m);
  const proposed = state.pos_m + v * p.dt_s;
  let limited = Math.abs(v * p.dt_s) > p.max_step_m;
  const pos = Math.min(Math.max(proposed, p.domain_min_m), p.domain_max_m);
  let status: SimStatus;
  if (v === 0) status = "below_threshold";
  else if (pos !== proposed) { status = "at_domain_limit"; limited = true; }
  else status = "gliding";
  return {
    step: state.step + 1, t_s: state.t_s + p.dt_s, pos_m: pos, velocity_mps: v,
    tau_rss_pa: tauRss_pa, status, step_limited: limited, applied_stress_pa: state.applied_stress_pa,
  };
}

export function runTrajectory(initial: SimState, taus_pa: ReadonlyArray<number>, p: GlideParams): SimState[] {
  const out = [initial];
  let s = initial;
  for (const t of taus_pa) { s = advanceStep(s, t, p); out.push(s); }
  return out;
}
