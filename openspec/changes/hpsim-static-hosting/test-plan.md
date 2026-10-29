# Test Plan: `hpsim-static-hosting`

**Change ID:** `hpsim-static-hosting`  
**Test-First Rule:** Every task must write and execute failing tests before implementation begins. Discrepancies between Python and TypeScript implementations must trigger bug remediation, never silent tolerance loosening.

---

## 1. 10-Level Test Ladder (Adapted for Static Dual-Stack)

| Level | Type | Scope & Tooling | Pass Condition |
|---|---|---|---|
| **1** | Static Analysis | Python: `ruff`, `mypy --strict src/hpsim/core`. Web: `eslint`, `tsc --noEmit`. | 0 errors, 0 warnings. |
| **2** | Unit Tests | Python (`pytest`) & TypeScript (`vitest`): vectors, rotations, slip systems, stress tensors, glide law, displacement fields, swept boundary, pile-up components. | 100% passing across both suites. |
| **3** | Property-Based Tests | `hypothesis` (Python) / `fast-check` (TS): rotation matrix orthonormality (RᵀR = I, det R = 1), m′ ∈ [0, 1], frame invariance of resolved shear stress. | ≥ 1000 randomized cases with 0 failures. |
| **4** | Scientific Validation (V-Series) | Ground-truth physical benchmarks against analytical solutions (see §2 below). | All pass criteria strictly satisfied. |
| **5** | Integration | Micrograph CV pipeline -> chord extraction -> pile-up sweep -> Hall–Petch fit (Python). End-to-end simulation loop and replay state machine (TypeScript). | End-to-end execution without exceptions. |
| **6** | Web App Component & Smoke Tests | React Testing Library + Vitest: renders control panels, 3D viewport canvas, timeline slider, chart components without crashing. | Headless mount and render pass. |
| **7** | Accessibility & Scientific Legibility | Axe / automated contrast checks; every plotted curve displays units and parameter status badge; no information conveyed by color alone. | WCAG 2.1 AA compliance; badges verified. |
| **8** | Performance Benchmarks | Client-side pile-up solver for N = 100 runs in < 50 ms. Three.js renders 4,000 atoms at ≥ 55 FPS. Web production bundle gzip < 2 MB. | Performance thresholds met on standard laptop. |
| **9** | Security & Static Hygiene | Zero external network requests at runtime. Local file drag-and-drop does not upload to server. No credentials or API keys in repository. | Static bundle inspection passes. |
| **10** | Regression & Parity (Golden) | Parity tests comparing TypeScript output with Python golden fixtures (`V-17`). Full regression suite clean after every bug fix. | Zero drift between platforms. |

---

## 2. Validation Benchmarks (V-Series)

| ID | Benchmark | Pass Condition | Implementation |
|---|---|---|---|
| **V-01** | Slip-system geometry | FCC and BCC each have 12 unique systems; \|s\|=\|n\|=1; s·n = 0 within 1e-12; b = a/√2 (FCC), a√3/2 (BCC). | Python & TypeScript Unit |
| **V-02** | Schmid oracle | Uniaxial tension along [001] on FCC {111}⟨110⟩: 8 active systems each with factor 1/√6 ≈ 0.408, 4 with 0; tensor RSS equals cosφcosλ within 1e-12; max Schmid factor ≤ 0.5 for random axes. | Python & TypeScript Unit |
| **V-03** | Burgers circuit | Loop integral of regularized displacement field enclosing core yields b within 1e-3·b; non-enclosing loops yield 0. | Python & TypeScript Validation |
| **V-04** | Glide law | Zero velocity for \|τ\| ≤ τ_c; linear above; sign reverses with stress; final position after fixed time independent of Δt within 1e-9. | Python & TypeScript Unit |
| **V-05** | Swept boundary | Step 100× larger than obstacle distance triggers boundary event at exact intersection point without tunneling. | Python & TypeScript Unit |
| **V-06** | Boundary compatibility | Identical orientations produce candidate with m′ = 1 and \|b_r\| = 0; constructed 90° boundary reproduces analytical m′. | Python & TypeScript Unit |
| **V-07** | Pile-up force balance | Converged follower force residual < 1e-9·τ_eff; exact identity **τ_tip = N·τ_eff** satisfied within 1e-6 relative. | Python & TypeScript Validation |
| **V-08** | Pile-up vs analytic N | Discrete N within 25% of Eshelby–Frank–Nabarro continuum prediction π(1−ν)τ_eff L/(Gb) for N ≥ 10. | Python Validation Table |
| **V-09** | Emergent Hall–Petch exponent | Log–log slope of simulated τ_eff,crit vs d over ≥ 1.5 decades of grain size equals −0.5 ± 0.05. | Python & TypeScript Validation |
| **V-10** | k_y consistency | Fitted simulated k_y within 15% of the analytical continuum formula for the same material parameters. | Python & TypeScript Validation |
| **V-11** | Intercept method (ASTM E112) | Synthetic Voronoi images of known grain size: recovered mean intercept ℓ̄ within 10% across ≥ 3 seeds. | Python Offline Validation |
| **V-12** | Segmentation cross-check | Automatic intercept count on real micrographs matches manual user intercept count on ≥ 3 test lines within 15%. | Offline User Gate |
| **V-13** | Determinism | Identical seed and inputs yield identical state trajectory and event-log hash (tolerance 0). | Python & TypeScript Regression |
| **V-14** | Visualization isolation | Simulation state hash before and after Three.js rendering calls is identical. | TypeScript Unit |
| **V-15** | Literature comparison | Reported predicted yield stress on held-out literature data falls within pre-declared experimental tolerance band (default ±25%). | Validation Report |
| **V-16** | Rescaling consistency | Synthetically rescaled chord distribution matches target mean within 1e-9 relative with identical coefficient of variation. | Python & TypeScript Unit |
| **V-17** | **Cross-Language Parity (NEW)** | TypeScript physics outputs match Python golden reference fixtures (`parity_cases.json`) within declared tolerances (tensors < 1e-12, pile-up < 1e-5). | Vitest Parity Suite |
| **V-18** | **Static-Host Deployment Smoke (NEW)** | Production `dist/` bundle loads correctly under root (`/`) and subpath (`/hpsim/`), renders 3D lattice, and loads all static JSON fixtures without 404s. | Playwright Smoke Test |
