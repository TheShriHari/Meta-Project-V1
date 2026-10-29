/** Phase 3 TypeScript glide controller / playback / render-isolation tests. Synthetic parameters only. */
import test from "node:test";
import assert from "node:assert/strict";
import { advanceStep, runTrajectory } from "../src/core/simulation.ts";
import { SimulationController } from "../src/core/controller.ts";
import { framesToSteps } from "../src/core/playback.ts";
import { calculateGlideVelocity } from "../src/core/glide.ts";
import { calculateResolvedShearStress, makeUniaxialStressTensor } from "../src/core/stress.ts";
import { getFccSlipSystems } from "../src/core/slipsystems.ts";
import { PerspectiveCamera, Vector3 } from "three";
import { applyViewPreset, VIEW_PRESETS } from "../src/render/camera.ts";

const P = { b_m: 2e-10, tau_c_pa: 5e6, M_d: 1e4, dt_s: 1e-13, domain_min_m: -1e-9, domain_max_m: 1e-9, max_step_m: 5e-11 };
const S0 = { step: 0, t_s: 0, pos_m: 0, velocity_mps: 0, tau_rss_pa: 0, status: "initial", step_limited: false, applied_stress_pa: 0 };
const rel = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} vs ${b}`);

test("zero velocity at/below threshold; linear above; reversal", () => {
  for (const t of [0, 4.9e6, 5e6, -5e6]) assert.equal(advanceStep(S0, t, P).velocity_mps, 0);
  const v1 = advanceStep(S0, 6e6, P).velocity_mps, v2 = advanceStep(S0, 8e6, P).velocity_mps;
  rel(v2 / v1, 3, 1e-12);
  assert.equal(advanceStep(S0, -9e6, P).velocity_mps, -advanceStep(S0, 9e6, P).velocity_mps);
});

test("deterministic + large steps cannot skip the boundary", () => {
  const taus = [...Array(50).fill(9e6), ...Array(30).fill(-9e6)];
  assert.deepEqual(runTrajectory(S0, taus, P), runTrajectory(S0, taus, P));
  const big = { ...P, dt_s: 1 };
  const s = advanceStep(S0, 9e6, big);
  assert.equal(s.pos_m, big.domain_max_m);
  assert.equal(s.status, "at_domain_limit");
  assert.equal(s.step_limited, true);
  assert.equal(advanceStep(S0, -9e6, big).pos_m, big.domain_min_m);
  const end = runTrajectory(S0, Array(3000).fill(9e6), P).at(-1);
  assert.equal(end.pos_m, P.domain_max_m);
});

const sys = getFccSlipSystems()[0];
const cfg = () => ({ params: P, s: sys.s, n: sys.n, loadingAxis: [0, 0, 1], appliedStress_pa: 40e6 });

test("controller: readout matches core RSS and glide velocity exactly", () => {
  const c = new SimulationController(cfg());
  const tau = calculateResolvedShearStress(makeUniaxialStressTensor(40e6, [0, 0, 1]), sys.s, sys.n);
  const ro = c.readout();
  assert.equal(ro.tauRss_pa, tau);
  assert.equal(ro.tauC_pa, P.tau_c_pa);
  assert.equal(ro.velocity_mps, calculateGlideVelocity(tau, P.tau_c_pa, P.M_d, P.b_m));
});

test("controller: step / reset / seek / replay / truncate", () => {
  const c = new SimulationController(cfg());
  for (let i = 0; i < 20; i++) c.step();
  const p20 = c.state.pos_m;
  assert.equal(c.index, 20);
  c.seek(5);
  assert.equal(c.index, 5);
  assert.equal(c.history.length, 21, "seek must not discard history");
  c.seek(20);
  assert.equal(c.state.pos_m, p20);
  c.seek(10); c.step();
  assert.equal(c.history.length, 12, "stepping from the past truncates the future");
  c.reset();
  assert.equal(c.index, 0); assert.equal(c.state.pos_m, 0); assert.equal(c.history.length, 1);
});

test("controller: stress reversal reverses glide direction", () => {
  const c = new SimulationController(cfg());
  for (let i = 0; i < 10; i++) c.step();
  const fwd = c.state.pos_m;
  assert.notEqual(fwd, 0);
  c.setAppliedStress(-40e6);
  for (let i = 0; i < 10; i++) c.step();
  // direction of motion follows the signed Schmid factor, so assert the opposite sign (not a fixed +s)
  assert.ok(Math.sign(c.state.pos_m - fwd) === -Math.sign(fwd));
  assert.ok(Math.abs(c.state.pos_m) < 1e-20, "equal-and-opposite stress returns to start");
});

test("playback speed changes steps-per-frame only, never the trajectory", () => {
  const run = (speed, frames) => {
    const c = new SimulationController(cfg());
    let acc = 0;
    for (let f = 0; f < frames; f++) {
      const r = framesToSteps(acc, 1 / 60, speed, 60);
      acc = r.accumulator;
      for (let k = 0; k < r.steps; k++) c.step();
    }
    return c;
  };
  const slow = run(1, 240), fast = run(4, 60);
  assert.equal(slow.index, 240); assert.equal(fast.index, 240);
  assert.deepEqual(slow.history, fast.history);
  const half = run(0.5, 120);
  assert.deepEqual(half.history, slow.history.slice(0, half.history.length));
});

test("camera presets and render updates never mutate frozen physics state", () => {
  const c = new SimulationController(cfg());
  for (let i = 0; i < 5; i++) c.step();
  const frozen = JSON.stringify(c.history);
  const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };
  c.history.forEach(deepFreeze);
  const cam = new PerspectiveCamera(45, 1, 0.01, 100);
  const controls = { target: new Vector3(), update() {} };
  for (const v of Object.keys(VIEW_PRESETS)) applyViewPreset(cam, controls, v, new Vector3(1, 1, 1), 3);
  c.readout();
  assert.equal(JSON.stringify(c.history), frozen);
  assert.deepEqual(Object.keys(VIEW_PRESETS).sort(), ["front", "isometric", "side", "top"]);
});
