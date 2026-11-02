# HPSim — Resume & Technical Interview Project Brief

**Project Title:** HPSim — Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator  
**Role:** Lead Developer & Scientific Modeler (College Project / Engineering Portfolio)  
**Tech Stack:** Python (NumPy, SciPy, OpenCV, pytest), TypeScript, React 19, Three.js (WebGL), Vite  
**Domain:** Computational Materials Science, Dislocation Mechanics, Stereology, Multiscale Modeling  

---

## 1. Truthful Executive Summary

HPSim is an undergraduate computational materials engineering capstone project that models the multiscale origin of the **Hall–Petch strengthening relation** ($\sigma_y = \sigma_0 + k_y d^{-1/2}$). 

Starting from 3D crystallographic slip and single-dislocation glide in FCC and BCC metals, the system evaluates grain-boundary slip transmission using the Lee–Robertson–Birnbaum (LRB) criteria, solves 1D discrete dislocation pile-up equilibria (Eshelby–Frank–Nabarro theory) via a Golub–Welsch Associated Laguerre eigensolver, and extracts complete stereological chord distributions from optical micrographs per ASTM E112.

The project features a **dual-stack architecture**: an audited Python scientific reference suite (173 passing tests, 2 strict expected failures) and an interactive, 100% client-side web application running in modern web browsers without backend server requirements.

> [!IMPORTANT]
> **Truth in Engineering Disclosure:**
> - HPSim is an **analytical and educational simulation**, not an empirical dislocation-tracking validation tool (such as in-situ TEM).
> - The $d^{-1/2}$ power-law exponent is emergent from discrete pile-up force balances; the slope magnitude $k_y$ is calibrated using one literature parameter per material ($\tau^*_{\text{ref}}$).
> - Independent held-out literature predictions honestly report known physical discrepancies (e.g., solid-solution friction shifts and grain-boundary carbon segregation), preserved via strict expected failure tests (`strict=True`).

---

## 2. Three Résumé Bullet Options

Select the version that matches your target role:

### Option A: Computational Materials & Scientific Modeling Focus
> **Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)** | *Python, NumPy, SciPy, OpenCV*
> - Developed a multiscale dislocation mechanics simulator deriving macroscopic Hall–Petch strengthening from 1D discrete dislocation pile-ups (Eshelby–Frank–Nabarro) and ASTM E112 micrograph chord stereology across FCC (Al, Cu) and BCC (Fe, steel) alloys.
> - Solved discrete $N$-dislocation force equilibrium using an Associated Laguerre tridiagonal Jacobi eigensolver with analytic Jacobians, verified to $< 10^{-12}$ against independent 50-digit `mpmath` algebraic polynomial roots.
> - Benchmarked emergent $-0.483$ scaling exponent against held-out experimental literature, honestly isolating solid-solution friction shifts and grain-boundary carbon segregation via 175 automated test suites.

### Option B: Full-Stack Scientific Software & WebGL Engineering Focus
> **HPSim: Interactive 3D Dislocation Mechanics Platform** | *React 19, TypeScript, Three.js, Vite, Python*
> - Built a zero-backend, 100% client-side scientific visualization web application simulating 3D crystallographic slip and grain-boundary transmission for up to 4,000 lattice atoms at 60 FPS in WebGL.
> - Implemented dual-stack parity between Python and pure TypeScript physics controllers, verifying cross-runtime numerical equivalence to $< 10^{-12}$ with automated golden regression fixtures.
> - Engineered an ASTM E112 stereological image pipeline in OpenCV with client-side JSON/CSV ingestion, precomputed vector boundaries, and complete chord length distributions without display bias.

### Option C: Rigorous Algorithm & Systems Focus
> **Dual-Stack Dislocation Pile-Up & Crystallography Engine** | *TypeScript, Python, pytest, Node.js*
> - Architected a deterministic multiscale simulation suite with 173 Python tests and 87 Node.js test suites, enforcing strict float-64 numerical stability, right-handed Euler transformations, and Peach–Koehler force invariants.
> - Eliminated garbage-collection frame drops in 60 FPS Three.js rendering through preallocated typed array buffers and deterministic resource lifecycle disposal.
> - Authored comprehensive scientific documentation, architectural decision records (ADR-010), reproducible benchmarking suites, and an interactive student guided tour.

---

## 3. Five-Minute Interview Demo Scenario

1. **Launch App:** Start local server (`npm run dev` in `web/`) and open `http://localhost:5173`.
2. **First-Run Tour:** Click **"Guided Tour & Quick Start 🎓"** in the top banner. Explain the multi-phase progression: Single Glide $\to$ Boundary Transmission $\to$ 1D Discrete Pile-Up $\to$ Emergent Hall–Petch $\to$ Micrograph Stereology.
3. **3D Dislocation Glide:** Select **"1. FCC Single-Crystal Schmid Glide"**. Click **"Play"**; show the dislocation gliding along (111)[-101] under applied stress $\tau_{\text{RSS}} = 16.33\ \text{MPa} > \tau_c = 5.0\ \text{MPa}$. Use camera buttons (front, top, isometric) to inspect lattice site displacements.
4. **LRB Grain Boundary Transmission:** Scroll to Phase 4. Point out the default **⚠ UNRESOLVED THRESHOLD** state, explaining **Decision M6** (barrier $\tau^*_{\text{ref}}$ is uncalibrated without literature fitting; the engine refuses to fabricate a pass/fail outcome). Check illustrative demo mode, set tilt $\theta = 0^\circ$ (Transmitted, $m' = 1.0$), then $\theta = 45^\circ$ (Pinned, $m' < 0.70$).
5. **Discrete Pile-Up Equilibrium:** Scroll to Phase 5. Drag the dislocation slider $N$ from 4 to 8 to 16. Show the 1D pile-up SVG with dislocations crowding near the obstacle. Verify the exact Eshelby tip stress multiplication: $\tau_{\text{tip}} = N \cdot \tau_{\text{app}} = 400.0\ \text{MPa}$ for $N=8, \tau = 50\ \text{MPa}$.
6. **Emergent Hall–Petch Exponent:** Scroll to Phase 6. Switch chart mode to $\log_{10}(\tau) \text{ vs } \log_{10}(d)$. Show the emergent log–log slope $-0.4829$ (matching theoretical $-0.50 \pm 0.05$). Explain that this power law was not assumed—it emerges from discrete dislocation equilibrium!
7. **Micrograph Stereology:** Scroll to Phase 7. Show real segmented contours and ASTM E112 grid lines ($\bar{\ell}_{\text{ASTM}} = 8.11\ \mu\text{m}$, 963 chords). Explain that DoITPoMS educational micrographs are distributed solely as vector geometry to comply with CC BY-NC-SA 4.0.

---

## 4. Technical Interview Talking Points & Deep Dives

### Question 1: "Is this model empirically validated against real dislocations?"
- **Answer:** *"No, and we make that boundary very clear in the documentation. HPSim is an analytical and numerical verification of 1D continuum dislocation pile-up theory (Eshelby, Frank & Nabarro 1951), not empirical validation against in-situ TEM dislocation imaging. 1D pile-ups assume straight parallel edge dislocations without cross-slip, climb, or forest hardening. It serves as a rigorous bridge between textbook continuum formulas and discrete mechanics."*

### Question 2: "What is emergent in Hall–Petch, and what is calibrated?"
- **Answer:** *"The emergent property is the $d^{-1/2}$ power-law exponent (log–log slope $-0.483 \pm 0.015$). In our simulation, dislocations are emitted from a Frank–Read source until back-stress shuts off the source; bisection then determines the critical applied stress where the obstacle tip stress reaches barrier threshold $\tau^*$. This yields the $-0.5$ exponent naturally. However, the absolute slope $k_y$ is calibrated: the barrier strength $\tau^*_{\text{ref}}$ is a single fitted scalar per material matching published literature fits. We explicitly document that $k_y$ is a calibration target, not an emergent prediction."*

### Question 3: "Why did you use an Associated Laguerre eigensolver instead of generic optimization?"
- **Answer:** *"Eshelby, Frank, and Nabarro proved in 1951 that the equilibrium positions of $N-1$ mobile edge dislocations held by an obstacle correspond to the roots of the first derivative of the $N$-th Laguerre polynomial, $L_{N-1}^{(1)}(\xi) = 0$. Generic numerical root-finding can get trapped in local minima or fail at large $N$. By using the Golub–Welsch symmetric tridiagonal Jacobi matrix eigensolver, we find all roots simultaneously in $O(N^2)$ time with zero sensitivity to initial guesses. We verified this in our test suite against independent 50-digit `mpmath` algebraic root oracles to $< 10^{-12}$ error."*

### Question 4: "Why do you have two strict expected-failure tests (xfail)?"
- **Answer:** *"Because scientific honesty is more important than presenting an artificial 100% green suite. In our held-out literature benchmarks (V-15):
  1. For commercial Aluminium (AA1050), solid-solution Fe/Si impurities raise lattice friction by +65%, leading to a 28.9% blind unadjusted error.
  2. For pure alpha-iron, 5 ppm interstitial carbon segregates to grain boundaries during quenching, increasing dislocation pinning and raising $k_y$ by +64.9%. Because our 1D elastic model does not simulate chemical segregation, it underpredicts slope transfer by 39.4%.
  Rather than artificially adjusting parameters to make tests pass, we guarded both cases with `@pytest.mark.xfail(strict=True)`. If either test accidentally passed, the suite would fail, ensuring that physical mismatches are explicitly documented."*

### Question 5: "Why did you migrate from Streamlit to React and Three.js (ADR-010)?"
- **Answer:** *"Streamlit requires a continuous Python server process, web-socket state synchronization, and cannot render 60 FPS hardware-accelerated 3D WebGL scenes for interactive lattice rotation. By migrating to React 19, TypeScript, and Three.js (formalized in ADR-010), we created a zero-backend static web application. It runs locally via any static file server, deploys seamlessly to static hosts (GitHub Pages, Vercel), and executes identical mathematical algorithms directly in the user's browser."*

### Question 6: "How did you optimize Three.js rendering performance?"
- **Answer:** *"During performance profiling of the 3D crystal viewer, we found that calculating displaced lattice site coordinates on every frame generated significant garbage collection overhead from Float64Array allocations. We refactored `displacedPositions` to accept an optional pre-allocated typed array buffer, reducing re-allocation to zero during animation loops (a 3.7× execution speedup in buffer throughput). Additionally, we implemented recursive geometry and material disposal on boundary scene updates, preventing WebGL memory leaks during interactive parameter sweeps."*

