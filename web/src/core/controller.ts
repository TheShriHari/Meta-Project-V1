/**
 * web/src/core/controller.ts - Timeline controller (play/pause/step/reset/seek) over the fixed-step simulation.
 * Pure TypeScript; uses ONLY the tested kernel for RSS and glide (no duplicated equations).
 * The controller owns physics state; rendering reads it and never writes it. It has no clock:
 * wall-clock pacing lives in playback.ts. History is a list of immutable states; seek() replays,
 * and stepping from a past index truncates the future (deterministic branch from that state).
 */
import type { Vec3 } from "./vectors.ts";
import { makeUniaxialStressTensor, calculateResolvedShearStress } from "./stress.ts";
import { calculateGlideVelocity } from "./glide.ts";
import { advanceStep, type GlideParams, type SimState } from "./simulation.ts";

export interface ControllerConfig {
  params: GlideParams;
  /** Slip direction and plane normal in the specimen frame (unit vectors). */
  s: Vec3;
  n: Vec3;
  /** Loading axis in the specimen frame. */
  loadingAxis: Vec3;
  appliedStress_pa: number;
  initialPos_m?: number;
}

export interface Readout {
  tauRss_pa: number;
  tauC_pa: number;
  velocity_mps: number;
  pos_m: number;
  status: SimState["status"];
  appliedStress_pa: number;
  step: number;
  t_s: number;
  replaying: boolean;
}

export class SimulationController {
  readonly cfg: ControllerConfig;
  history: SimState[];
  index = 0;
  private applied_pa: number;

  constructor(cfg: ControllerConfig) {
    this.cfg = cfg;
    this.applied_pa = cfg.appliedStress_pa;
    this.history = [this.initialState()];
  }

  private initialState(): SimState {
    return {
      step: 0, t_s: 0, pos_m: this.cfg.initialPos_m ?? 0, velocity_mps: 0, tau_rss_pa: 0,
      status: "initial", step_limited: false, applied_stress_pa: this.cfg.appliedStress_pa,
    };
  }

  get state(): SimState { return this.history[this.index]; }
  get appliedStress_pa(): number { return this.applied_pa; }
  get atHead(): boolean { return this.index === this.history.length - 1; }

  tauFor(applied_pa: number): number {
    return calculateResolvedShearStress(
      makeUniaxialStressTensor(applied_pa, this.cfg.loadingAxis), this.cfg.s, this.cfg.n);
  }

  setAppliedStress(pa: number): void { this.applied_pa = pa; }

  step(): void {
    if (!this.atHead) this.history.length = this.index + 1;
    const next = advanceStep(this.state, this.tauFor(this.applied_pa), this.cfg.params);
    this.history.push({ ...next, applied_stress_pa: this.applied_pa });
    this.index = this.history.length - 1;
  }

  seek(i: number): void { this.index = Math.max(0, Math.min(this.history.length - 1, Math.trunc(i))); }

  reset(): void { this.history = [this.initialState()]; this.index = 0; this.applied_pa = this.cfg.appliedStress_pa; }

  /** Instantaneous quantities at the current state (stress that drives its next step). */
  readout(): Readout {
    const s = this.state;
    const stress = this.atHead ? this.applied_pa : this.history[this.index + 1].applied_stress_pa;
    const tau = this.tauFor(stress);
    const p = this.cfg.params;
    return {
      tauRss_pa: tau, tauC_pa: p.tau_c_pa,
      velocity_mps: calculateGlideVelocity(tau, p.tau_c_pa, p.M_d, p.b_m),
      pos_m: s.pos_m, status: s.status, appliedStress_pa: stress, step: s.step, t_s: s.t_s,
      replaying: !this.atHead,
    };
  }
}
