# Phase 09 Plan 01 Summary: One-Click Beginner Experience

**Phase:** 09-one-click-beginner-experience  
**Plan:** 09-01  
**Status:** Complete  
**Completed:** 2026-11-02  

## Objectives Achieved

1. **Default Beginner Landing Screen (`web/src/ui/BeginnerScreen.tsx`):**
   - Implemented a clean, accessible default interface with zero cognitive clutter.
   - Prominently displays title: **HPSim — See How Dislocations Move** and subtitle: *"Watch how tiny defects move through crystals and how grain size affects material strength."*
   - Contains a single primary action button: **Simulate Now** (and **Simulate Another Sample** on completion).
   - Removed all dense research controls (preset dropdowns, grain boundary angles, threshold sliders, and candidate slip system tables) from the default landing screen.

2. **One-Click Slow-Motion Simulation:**
   - Automatically selects a validated sample (cycling through Pure Aluminium [001], High-Purity Copper [001], and Aluminium [011]).
   - Automatically computes the optimal slip system with the highest Schmid factor using `bestSystemIndex(axis)` from `web/src/model/demo.ts`.
   - Mounts and frames the 3D WebGL viewer (`web/src/render/viewer.ts`) around the active dislocation on the slip plane.
   - Presentation pacing is executed in slow motion (`speed = 0.2`) via `framesToSteps()` in `web/src/core/playback.ts` without altering the physical time-step ($\Delta t = 2\times 10^{-13}\,\text{s}$), dislocation mobility ($M_d$), or critical stress ($\tau_c$).
   - Simulation glides automatically until reaching the domain limit at the grain boundary (`c.state.status === "at_domain_limit"`), where it safely stops.
   - Clicking **Simulate Another Sample** starts a fresh run with a new material/orientation selection.

3. **Scientific Integrity & Dislocation Character Transparency:**
   - Since the physical engine implements the analytical Volterra edge-dislocation displacement field (`edgeDisplacement`), the animation is explicitly labelled: **Edge Dislocation (Plane Strain) $\bot$**.
   - Includes a clear scientific disclaimer banner: *"The simulator models the analytical Volterra edge-dislocation displacement field and overdamped glide kinetics. Screw dislocation visualization is currently unsupported by the underlying plane-strain continuum engine."* No misleading labelling as screw dislocation.

4. **Simple Hall–Petch SVG Chart (`web/src/ui/HallPetchChart.tsx`):**
   - Clean, lightweight inline SVG chart with zero external charting dependencies.
   - Dynamically recomputes bottom-up discrete pile-up strengthening via `runHallPetchSweep()` from `web/src/core/hallpetch.ts` for the active material.
   - Plots yield strength $\sigma_y\,(\text{MPa})$ vs inverse square root of grain size $d^{-1/2}\,(\mu\text{m}^{-1/2})$.
   - Scientifically transparent provenance label: *"Calibrated model trend: Derived bottom-up from discrete pile-up mechanics. Calibrated to Hansen (1977) / Hansen & Ralph (1982). Not raw experimental scatter."*
   - Displays model parameters $\sigma_0$, $k_y$, and the emergent power-law slope ($-0.483$, matching $-0.5$ theoretical scaling).

5. **Advanced Mode Preservation & Bi-Directional Routing (`web/src/ui/App.tsx`):**
   - Preserves 100% of the existing research dashboard across all Phases 1–8: single-crystal Schmid glide, two-grain LRB grain boundary transmission, 1D discrete dislocation pile-up solver, emergent Hall–Petch derivation sweep, and ASTM E112 micrograph chord analysis.
   - Added prominent **Advanced Simulation $\rightarrow$** button on the beginner landing screen and **$\leftarrow$ Simple View** button on the advanced banner for seamless switching.
   - Implemented as separate component trees (`BeginnerScreen` and `AdvancedDashboard`), avoiding hook count mismatches and ensuring zero performance overhead when on the beginner view.

6. **Test Ladder & Verification Status:**
   - **TypeScript Strict Compilation:** `tsc --noEmit --incremental false` passed with 0 errors.
   - **Vite Production Build:** Clean build in 1.18s (`dist/index.html` + bundles).
   - **Node.js Parity & Smoke Tests:** 87 passed, 0 failed.
   - **Python Pytest Suite:** 173 passed, 2 strict expected failures (`xfail`).
   - **Data Acquisition Audit:** 6/6 checks green (100%).
   - **Static Smoke Tests:** 7/7 passed.
   - **Screenshots:** Captured `docs/screenshots/phase9_before.png` (Advanced Dashboard) and `docs/screenshots/phase9_after.png` (Beginner Landing Screen).
