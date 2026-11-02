# User Guide: Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)

Welcome to **`hpsim`**, a dual-stack (Python + zero-server TypeScript/Three.js) scientific simulator that derives macroscopic Hall–Petch grain-boundary strengthening ($\sigma_y = \sigma_0 + k_y d^{-1/2}$) bottom-up from 3D crystallography, single-dislocation glide, Lee–Robertson–Birnbaum (LRB) slip transmission, 1D Eshelby–Frank–Nabarro (EFN) discrete dislocation pile-ups, and real metallographic chord distributions.

---

## 1. Quick Start

### 1.1 Running the Interactive Web Application Locally
```powershell
cd web
npm install
npm run dev
```
Open the local URL shown by Vite (typically `http://localhost:5173`). The entire physics and crystallography engine runs client-side in your browser with zero backend servers.

To build a portable static bundle (supporting both root `/` on Vercel and subpath `/<repo>/` on GitHub Pages):
```powershell
cd web
npm run build
```

### 1.2 Running the Canonical Python Simulation Presets (CLI)
From the repository root:
```powershell
$env:PYTHONPATH="src"
python scripts/run_presets.py
```
To run a single preset or export structured JSON results:
```powershell
$env:PYTHONPATH="src"
python scripts/run_presets.py --preset al_hansen_calibration --json preset_results.json
```

### 1.3 Regenerating the Scientific Validation Report (`V-01` – `V-17`)
```powershell
$env:PYTHONPATH="src"
python scripts/generate_validation_report.py
```
This executes all 17 verification and validation benchmarks and writes `docs/validation_report.md`.

---

## 2. Walkthrough of the 5 Simulation Stages in the Web UI

1. **Header Bar: Material Selector, Experiment Presets & Limitations Modal**
   - **Material Selector:** Switch between **Aluminium (FCC)**, **Copper (FCC)**, **Pure $\alpha$-Iron (BCC)**, and **Ferritic Steel (BCC)**. Each material loads its audited elastic constants ($G, \nu, a, b, M_T$), provenance badges (`sourced`, `calibrated`, `illustrative`), and calibrated barrier strength $\tau^*_{\text{ref}}$.
   - **Canonical Presets:** One-click buttons load the 5 verified simulation configurations (`Hansen 1977 Al`, `Hansen & Ralph 1982 Cu`, `Takeda 2008 IF-Fe`, `Takeda 2008 Fe-C60`, and the `LRB Tilt Misorientation Sweep`).
   - **About & Scientific Limitations Modal:** Displays model assumptions (`A1`–`A8`), held-out literature comparison tables (`V-15`), and data provenance policies (`D1`–`D6`).

2. **3D Atomic Lattice, Volterra Dislocation Field & Glide Playback**
   - Visualizes $\le 4,000$ FCC/BCC atoms via Three.js `InstancedMesh` displaced by the regularized isotropic edge-dislocation continuum field (`V-03`).
   - Use **Play / Pause / Step / Reset** and the **Applied Uniaxial Stress $\sigma_0$** slider to watch overdamped dislocation glide ($v = M_d b (|\tau_{\text{rss}}| - \tau_c)_+$) toward the grain boundary (`V-04`, `V-05`).
   - Camera preset buttons (**Front**, **Top**, **Side**, **Isometric**, **Reset**) inspect the slip plane without mutating simulation state (`V-14`).

3. **Two-Grain Boundary Transmission & Explainable Event Log (`V-06`)**
   - Adjust Euler angles $(\varphi_1, \Phi, \varphi_2)$ of the adjacent grain and the transmission threshold parameters ($m'_{\min}, \tau^*_{\text{ref}}, \beta$).
   - The 3D boundary scene renders the columnar grain boundary plane, outgoing slip-system candidate vectors, and a **Transmitted / Pinned / Unresolved** badge.
   - The **Explainable Event Log** ranks all 12 outgoing slip systems by geometric compatibility $m' = (\mathbf{n}_{\text{in}}\cdot\mathbf{n}_{\text{out}})(\mathbf{s}_{\text{in}}\cdot\mathbf{s}_{\text{out}})$, residual Burgers vector $|\mathbf{b}_r| = |\mathbf{b}_{\text{in}} - \mathbf{b}_{\text{out}}|$, and outgoing resolved shear stress $\tau_{\text{out}}$.

4. **1D Discrete Dislocation Pile-Up & Eshelby–Frank–Nabarro Benchmark (`V-07`, `V-08`)**
   - Computes exact equilibrium positions $0 = x_0 < x_1 < \dots < x_{N-1}$ of $N$ edge dislocations piled up against the grain boundary at $x=0$ under effective shear stress $\tau_{\text{eff}}$.
   - Overlays the discrete equilibrium positions against the analytical roots of the associated Laguerre polynomial $L_{N-1}^{(1)}$ (Golub–Welsch tridiagonal eigensolver) and verifies tip stress multiplication $\tau_{\text{tip}} = N\tau_{\text{eff}}$.

5. **Emergent Hall–Petch Plot (`V-09`, `V-10`, `V-15`) & Micrograph Chord Overlay (`V-11`, `V-12`, `V-16`)**
   - **Hall–Petch Chart:** Runs quasi-static source shut-off and yield-onset bisection across $d \in [10, 400]\,\mu\text{m}$, plotting discrete pile-up yield points, OLS regression with 95% bootstrap confidence bands, the continuum analytical curve, and verified experimental literature fits.
   - **Micrograph View & Custom Data Import:** Inspect precomputed vector grain-boundary overlays, ASTM E112 intercept lines, and seeded $\mathrm{SO}(3)$ slip traces for Aluminium, Copper (`M4` twin exclusion), Pure Iron, Ferritic Steel (`M5` ferrite-only mask), and Synthetic Voronoi (`V-11`), or drag-and-drop custom `.json`/`.csv` chord datasets (`DataImport`) and rescale target mean grain size $\bar{d}$ (`V-16`).

---

## 3. Reproducible 3–5 Minute College Demo Walkthrough Scenario

This step-by-step presentation script is tailored for a college capstone evaluation or technical interview demonstration:

### Step 1: Launch and First-Run Overview (0:00 – 0:45)
1. Launch the web application via `npm run dev` in `web/` and navigate to `http://localhost:5173`.
2. Point out the zero-backend architecture: all physics, 3D WebGL rendering, and numerical eigensolvers run 100% client-side in the browser.
3. Click **"Guided Tour & Quick Start 🎓"** in the top banner. Highlight the 3-panel summary:
   - Simulation phase progression from crystal lattice to macro yield.
   - Standard SI units (MPa, $\mu\text{m}$, $\text{Pa}\cdot\text{m}$, $\text{MPa}\cdot\mu\text{m}^{1/2}$).
   - Outcome distinctions: green solid border for **Transmitted**, red double border for **Pinned**, amber dashed border for **Unresolved Threshold (Decision M6)**.
4. Close the tour panel.

### Step 2: Single-Dislocation Glide & 3D Crystal Viewer (0:45 – 1:30)
1. Select preset **"1. FCC Single-Crystal Schmid Glide ([001] Al)"**.
2. Notice the 3D lattice in the viewport. Click **"front"**, **"top"**, and **"isometric"** camera views to observe the (111) slip plane and Burgers vector arrow.
3. In the **Playback** card, click **"Play"**. Observe the dislocation gliding toward the grain boundary under resolved shear stress $\tau_{\text{RSS}} = 16.33\ \text{MPa} > \tau_c = 5.0\ \text{MPa}$.
4. Click **"Step"** to advance single increments, or drag the timeline slider. Point out that playback speed affects only frames-per-step and never corrupts deterministic physics.

### Step 3: Grain-Boundary Transmission & LRB Criteria (1:30 – 2:30)
1. Scroll to **"Grain-Boundary Transmission Phase 4"**.
2. Point out the default state: **⚠ UNRESOLVED THRESHOLD**. Explain Decision M6: the obstacle barrier strength $\tau^*_{\text{ref}}$ is uncalibrated in Phase 4 without experimental literature fitting, so the engine honestly refuses to guess a pass/fail outcome.
3. Check **"Supply illustrative $\tau^*_{\text{ref}}$ demo only"**. Notice the explicit `"ILLUSTRATIVE VALUES — NOT SOURCED"` warning.
4. Move the **Adjacent Grain 2 Columnar Tilt $\theta$** slider:
   - Set $\theta = 0^\circ$ (Identical grain): outcome switches to **✔ TRANSMITTED** on candidate #0 with $m' = 1.000$ and zero residual Burgers vector.
   - Set $\theta = 45^\circ$ (High-angle boundary): outcome switches to **✕ PINNED** because geometric compatibility $m'$ drops below $m'_{\min} = 0.70$.
   - Point out the 12 candidate slip systems table in the UI ranking $m'$, $|\mathbf{b}_r|/b$, and outgoing stress $\tau_{\text{out}}$.

### Step 4: 1D Discrete Dislocation Pile-Up & EFN Solution (2:30 – 3:30)
1. Scroll to **"Discrete Dislocation Pile-Up Phase 5"**.
2. Explain the setup: $N$ dislocations emitted from a Frank–Read source accumulate against the boundary at $x=0$.
3. Adjust the **Dislocation Count $N$** slider from 4 to 8 to 16.
4. Observe the 1D pile-up SVG diagram: dislocations crowd near the obstacle with an exact density gradient.
5. Highlight the exact Eshelby tip stress multiplication:
   $$\tau_{\text{tip}} = N \cdot \tau_{\text{app}}$$
   Notice the tip stress readout: at $N=8$ and $\tau_{\text{app}} = 50\ \text{MPa}$, $\tau_{\text{tip}} = 400.0\ \text{MPa}$ ($\times 8$ stress concentration), with force residuals $< 10^{-6}\ \text{Pa}$.

### Step 5: Emergent Hall–Petch Scaling & Literature Comparison (3:30 – 4:30)
1. Scroll to **"Emergent Hall–Petch Phase 6"**.
2. Select **"Aluminium (99.999% High-Purity Al)"**.
3. Point out the OLS regression and shaded 95% bootstrap confidence band across the 16-point grain size sweep ($10\text{–}400\ \mu\text{m}$).
4. Switch **Chart Mode** to **"$\log_{10}(\tau_{\text{eff,crit}})$ vs $\log_{10}(d)$"**. Show the emergent log–log slope:
   $$\text{Slope} = -0.4829 \quad (\text{Benchmark } V-09: -0.50 \pm 0.05)$$
   Emphasize that the $-0.5$ exponent was not programmed into the solver; it emerges naturally from the discrete pile-up force balances!
5. Point out the literature comparison table and explain the **strict expected failure (xfail)** for Aluminium AA1050: 28.9% unadjusted error due to Fe/Si solid-solution friction shift, demonstrating scientific honesty rather than curve-fitting.

### Step 6: Micrograph Stereology & Custom Import (4:30 – 5:00)
1. Scroll to **"Micrograph & Chord Rescaling Phase 7"**.
2. Toggle between **Aluminium**, **Copper** (M4 twin exclusion), and **Ferritic Steel** (M5 ferrite-only mask).
3. Point out that ASTM lineal intercept $\bar{\ell}_{\text{ASTM}} = L_T / P = 8.11\ \mu\text{m}$ matches the full population of 963 chords without display bias or truncation.
4. Show the drag-and-drop dropzone for custom chord datasets, noting client-side JSON/CSV parsing.
5. Conclude: HPSim provides an end-to-end, rigorous, multiscale educational bridge from crystal dislocations to engineering yield strength.
