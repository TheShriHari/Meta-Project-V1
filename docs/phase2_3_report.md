# HPSim — Combined Phase 2 + 3 Report (Quality Gate 2/3)

**Date:** 2026-10-20 · **Status: READY FOR HUMAN REVIEW — stopped at Gate 2/3. Phase 4 NOT started.**

## 1. Phase 1 baseline (re-run independently before any new work)
| Check | Result |
|---|---|
| `python -m pytest -q` | 24 passed |
| `python scripts/validate_data_acquisition.py` | 6/6 audit checks PASS |
| TS Phase 1 parity (`node --experimental-strip-types --test web/tests/phase1_parity.test.mjs`) | 5/5 pass |
| `hpsim.core` / `web/src/core` UI-free | PASS (Python AST test; new TS `isolation.test.mjs`) |

## 2. Files changed
**Python reference (new):** `src/hpsim/core/{lattice,fields,simulation}.py`, `tests/test_{lattice,fields,simulation}.py`, `scripts/generate_phase23_fixtures.py`, `tests/golden/phase23_fixtures.json`.
**TS core (new, pure):** `web/src/core/{lattice,fields,dislocation,simulation,controller,playback}.ts`.
**TS render/UI (new):** `web/src/render/{camera,viewer}.ts`, `web/src/model/demo.ts`, `web/src/ui/{App.tsx,styles.css}`, `web/src/main.tsx`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig.json`.
**TS tests (new):** `web/tests/{phase23_field,phase3_glide,phase23_parity,isolation}.test.mjs`.
**Docs:** `docs/model.md` (§10 added), `openspec/changes/hpsim-static-hosting/assumptions.md` (§4 added), this report, `docs/screenshots/*.png`.
**Edited existing:** `web/package.json` (scripts + deps). No root `spec.md` edit. No existing Phase 1 source edited.

### Dependencies added (`web/`, all needed)
Runtime: `react`, `react-dom` (UI), `three` (renderer, OrbitControls). Dev: `vite`, `@vitejs/plugin-react` (build/dev), `typescript`, `@types/{react,react-dom,three,node}` (type checking). No test framework added (Node's built-in runner). No Python dependency added. `web/node_modules` is installed locally (not committed anywhere—no git repo).

## 3. Test-first evidence
- **RED (Python):** `pytest tests/test_lattice.py tests/test_fields.py tests/test_simulation.py` → `3 errors … ModuleNotFoundError: No module named 'hpsim.core.simulation'` (collection errors before implementation).
- **RED (TS):** `ERR_MODULE_NOT_FOUND … web\src\core\lattice.ts` / `simulation.ts`; parity: `ENOENT … phase23_fixtures.json` before the fixture was generated.
- **GREEN:** see §4.

### Failures recorded (root cause → fix, tolerances unchanged)
1. `test_fields::branch_cut_jump` — my test expected −b; θ goes −π→+π so the jump crossing y<0→y>0 is **+b**. *Test authoring error*; corrected the expectation to match the documented convention. Field code unchanged.
2. `controller: stress reversal` (TS) — test assumed forward = +s, but system 0 under +σ‖[001] has a negative signed Schmid factor, so motion is along −s. Controller correct; test now asserts the *opposite sign* and return to start. No tolerance changed.
3. Parity script `ModuleNotFoundError: hpsim` — run needed `PYTHONPATH=src` (environment, not code).

## 4. Final commands and output
```
python -m pytest -q                         → 115 passed       (24 Phase 1 + 28 Phase 2/3 + 63 physics review tests)
python scripts/validate_data_acquisition.py → ALL AUTOMATED INTEGRITY AND AUDIT CHECKS PASSED (6/6)
node --experimental-strip-types --test web/tests/*.test.mjs → tests 26 / pass 26 / fail 0
cd web && npx tsc                           → exit 0 (strict)
cd web && HPSIM_BASE=/hpsim/ npx vite build → built; index.html asset URLs /hpsim/assets/...
```
Run `npm test` in `web/` (runs from repo root). Parity tolerance: relative 1e-12 (+1e-24 absolute for ~0 values) — same IEEE doubles; only `atan2/log` libm ulp differences expected. Not widened.

## 5. FCC geometry and Burgers circuit
- Basis = conventional 4 atoms; counts 4·nx·ny·nz (500 for 5³); all coordinates finite and unique; repeatable; NN = a/√2, CN = 12; lattice scales linearly with a. Slip plane lies midway between atomic planes — no atom on the branch cut for all 12 systems.
- **Burgers circuit (spec V-03, tol 1e-3·b), method: θ-unwrapped loop sum on the continuum field.**
  - Enclosing r=3, 10, 50 (r_c=1, ν=0.3; centred & off-centre): closure/b = 0.99999999999998, 1.000000000000001, 0.99999999999998 (error ≲ 2e-14).
  - Non-enclosing: |closure| ≈ 1.5e-16·b. Clockwise: −1.0 (sign convention documented). Too-coarse loop → rejected with ValueError.
  - Limitation: this validates the *field*, not a discrete atom-lattice circuit (not claimed).

## 6. Glide results (Python reference + TS, identical behaviour)
| Property | Result |
|---|---|
| \|τ\| ≤ τ_c → v=0 (incl. exactly τ_c, −τ_c) | PASS |
| Linear in excess stress (ratios 3.0, 6.0 to 1e-12) | PASS |
| Reversing stress reverses v (equal magnitude) | PASS |
| Deterministic (identical trajectories); no randomness exists | PASS |
| Playback speed 0.5/1/4 → identical histories (prefix-equal) | PASS |
| dt-independence of displacement over fixed interval (rel 1e-9) | PASS |
| Huge step cannot skip/wrap boundary; clamps at limit, flags `step_limited` | PASS |
| Readout τ_RSS, v equal kernel values exactly | PASS |
| Camera presets / render updates don't mutate (deep-frozen) physics state | PASS |

## 7. Browser verification (Playwright MCP, Chromium, real app at `http://localhost:5173/hpsim/`)
- Orbit (drag), pan (right-drag), zoom (wheel), 4 presets + reset camera: operated; physics readout identical before/after (`cameraNoPhysicsChange: true`).
- Play/Pause/Step/Reset/timeline scrub: step ×3 → 0.0195 nm; play reaches `stopped at simulation-domain limit` (pos 1.0268 nm); reversing stress then moves back (−0.8354 nm); scrub to step 3 → `replay`, pos 0.0195 nm; reset → 0 nm/0 ps.
- Sliders: σ=−60 → τ=−24.495 MPa, v=−5.582e+1 m/s; σ=3 → τ=1.225 MPa, v=0, state "stationary (|τ_RSS| ≤ τ_c)"; σ=40 → τ=16.330 MPa (=0.4082·40), v=3.244e+1 m/s = M_d·b·(τ−τ_c) ✓.
- Layer checkboxes (bonds, slip plane…) toggle independently.
- **Vite base path:** dev server run with `HPSIM_BASE=/hpsim/`; app served and all assets loaded under `/hpsim/…`; build output also prefixed.
- **Network:** 0 requests outside `localhost:5173` (favicon replaced by inline data URI after a 404 was found); no external fonts/APIs.
- **Small viewport 390×760:** layout stacks (viewport 55vh, panel below); play, step, reset, sliders, view buttons, timeline all visible and step works (`0.80 ps`).
- Real screenshots: `docs/screenshots/phase23_desktop_front.png` (desktop, core displaced to 0.6229 nm, front view) and `docs/screenshots/phase23_mobile_390.png`. Both are captured from the running app, not mockups.

## 8. Run locally
```
cd web
npm install
npm run dev        # http://localhost:5173/   (HPSIM_BASE=/hpsim/ npm run dev  → /hpsim/)
npm test           # 23 TS tests (from repo root)
npm run typecheck
npm run build      # static dist/, no server needed
python -m pytest   # from repo root (PYTHONPATH handled by pyproject)
```

## 9. Known limitations / unresolved
- Continuum, isotropic, infinite-body field in a finite window; **not MD, not an atomistic core**; no surfaces/image forces; fixed slip-plane position.
- Parameters (a, ν, τ_c, M_d, Δt, r_c) are **illustrative** and labelled so in the UI; **M6 remains open**; τ*_ref not calibrated; no `needs_citation` value used.
- Spec's literal ln(x²+y²) normalized by r_c² (rigid translation only) — recorded as A-P2-2; not a root-spec edit.
- Discrete atom-lattice Burgers circuit not implemented. Bond lines connect ideal-neighbours and may look long near the cut (continuum jump of b is shown, not atomistic relaxation).
- Build emits an 800 kB chunk-size warning (three.js); acceptable for now.
- CodeRabbit review **BLOCKED**: workspace is not a git repository and no CLI auth was configured; I did not initialise git. A manual self-review was done (see failures above).
- Not a git repo → no commits/diff; the file list above is the change record.
- No Ralph Loop, deployment, or push performed. Dev server stopped at end.

## 10. Acceptance checklist
| # | Criterion | Status |
|---|---|---|
| 1 | Phase 1 baseline rerun, counts confirmed, core UI-free | PASS |
| 2 | Unresolved material table kept unresolved | PASS |
| 3 | FCC basis/dimensions/counts/repeatability tests | PASS |
| 4 | Finite atom + displacement coordinates | PASS |
| 5 | Edge field far-field, regularization & branch cut documented/tested | PASS |
| 6 | Burgers circuit enclosing = b (tol 1e-3 b) | PASS |
| 7 | Non-enclosing circuit = 0 | PASS |
| 8 | Render/camera don't mutate physics state | PASS |
| 9 | Threshold, linearity, reversal, determinism | PASS |
| 10 | Playback speed doesn't change trajectory | PASS |
| 11 | Large steps can't skip boundary | PASS |
| 12 | Displayed τ/v match core | PASS |
| 13 | Python↔TS parity on golden fixtures | PASS |
| 14 | InstancedMesh, cell/axes/slip plane/Burgers/line/core, bonds toggles, 4 views + reset | PASS |
| 15 | Browser: orbit/pan/zoom/presets/play/pause/step/reset/sliders | PASS |
| 16 | Vite base path respected; no mandatory runtime network | PASS |
| 17 | Smaller viewport usable | PASS |
| 18 | Real screenshot | PASS |
| 19 | Illustrative parameters labelled | PASS |
| 20 | No exclusions implemented (GB, pile-up, yield, segmentation, BCC/screw, deploy) | PASS |
| 21 | CodeRabbit review | BLOCKED (not a git repo) |

**Stopped at Gate 2/3. Awaiting your explicit approval before Phase 4 (grain-boundary transmission).**
