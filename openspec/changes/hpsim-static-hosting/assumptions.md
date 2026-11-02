# Assumptions and Conventions: `hpsim-static-hosting`

**Change ID:** `hpsim-static-hosting`

---

## 1. Physical and Modeling Assumptions

- **A1. Isotropic Linear Elasticity:** Dislocation stress fields and inter-dislocation interaction forces are modeled using isotropic continuum elasticity parametrized by shear modulus $G$ and Poisson's ratio $\nu$.
- **A2. Planar 1D Pile-Up Geometry:** Pile-ups are modeled as 1D arrays of straight, like-signed edge dislocations coplanar on a single slip plane. The leading dislocation is pinned at the grain boundary ($s_1 = 0$), and a single Frank–Read-type source operates at distance $L = d/2$ (grain center).
- **A3. Constant Lattice Friction:** Lattice friction (CRSS $\tau_c$) is represented as a single temperature- and rate-independent constant per material.
- **A4. Seeded Grain Orientations:** Optical micrographs do not yield crystallographic orientations. Grain orientations $R_i \in \mathrm{SO}(3)$ are drawn from a seeded uniform distribution. Results sensitive to orientation are reported across random seeds.
- **A5. Columnar Grain Boundaries:** 3D grain boundaries are assumed to be columnar cylinders whose normal vector lies in the sample plane ($x$–$y$), with the boundary trace passing through the sample thickness.
- **A6. Taylor Yield Factor:** Macroscopic yield stress $\sigma_y$ relates to critical shear stress via the Taylor factor $M_T$ ($\sigma_y = M_T \tau_{crit}$), using standard random-texture values (FCC $\approx 3.06$, BCC $\approx 2.75$).
- **A7. Micron-Scale Hall–Petch Regime:** The model applies strictly to the standard Hall–Petch regime ($d \gtrsim 1\,\mu\mathrm{m}$). Nanocrystalline inverse Hall–Petch behavior is out of scope.
- **A8. Continuum Displacement Visualization (Not Molecular Dynamics):** Atom positions in the 3D lattice view are computed by superimposing analytical continuum displacement fields onto ideal lattice coordinates. They do not simulate interatomic potentials or molecular dynamics.

---

## 2. Static Hosting and Software Architecture Assumptions

- **A9. Zero-Server Client Runtime:** The deployed web application operates entirely within the client's web browser using static HTML, CSS, JavaScript, WebGL (Three.js), and static JSON fixtures. No runtime Python server, container daemon, serverless function, or external API is required.
- **A10. Two-Stage Computer Vision Strategy:** Micrograph image processing (filtering, Canny edge detection, watershed segmentation, ASTM E112 intercept calculations) is executed offline in Python during research and data preparation. The web application displays preprocessed grain boundary polygons, chord distributions, and scale metadata, with client-side drag-and-drop import for custom preprocessed JSON datasets. In-browser client-side segmentation is reserved as a future stretch goal.
- **A11. Deterministic Cross-Language Parity:** Floating-point calculations implemented in TypeScript on V8/JavaScriptCore match the Python NumPy/SciPy reference within strictly declared relative error tolerances ($\le 10^{-12}$ for vectors/tensors, $\le 10^{-9}$ for fields, $\le 10^{-5}$ for discrete equilibrium positions).

---

## 3. Governance, Decisions, and Scientific Integrity Guardrails

- **D1. M3 Grain-Size Sweep:** Rescaling a measured micrograph (FR-10) is approved strictly for controlled parametric sensitivity studies. It does not create new experimental data and is never described as independent empirical validation.
- **D2. M4 Copper Twin Boundary Policy:** Annealing twins are excluded from lineal intercept grain-size measurements $d$ for copper per ASTM E112 and Hansen & Ralph (1982). Segmentation sensitivity must be documented.
- **D3. M5 Steel Phase Policy:** Ferrite phase only is analyzed; pearlite and carbide constituents are masked where reliably distinguishable. Uncertain segmentations are flagged for human review.
- **D4. M6 Material Parameters:** Remains OPEN / UNAPPROVED. Missing or disputed parameters remain `needs_citation` / unresolved. No fabricated presets are allowed.
- **D5. Reconstructed Points Separation:** Points in `data/literature/hall_petch_datasets.csv` are strictly classified as `RECONSTRUCTED_FROM_FIT` (`demonstration_only`). They must never be labeled as measured experimental observations or independent validation.
- **D6. Micrograph Redistribution Guard:** DoITPoMS CC BY-NC-SA 4.0 images are local research assets only and must not be bundled into public static web distribution without explicit permission.
- **D7. Phase 1 Authorization:** Scope is strictly bounded to the pure mathematics kernel. No Phase 2, visual rendering, pile-up solvers, website deployment, or unattended loops are authorized.

## 4. Phase 2/3 Authorization Record (2026-10-20)

- **Authorized:** combined Phase 2+3 milestone only — FCC lattice, isotropic edge-dislocation continuum field, stress-driven single-dislocation glide, React+TS+Vite+Three.js local app. Status: implemented, awaiting human review at Quality Gate 2/3.
- **Not authorized / not done:** grain-boundary transmission, pile-up solver, yield search / Hall–Petch sweep, micrograph segmentation, BCC/screw features, root-spec replacement, deployment, archival of this change. No site has been deployed.
- **A-P2-1:** Demo parameters (a, ν, τ_c, M_d, Δt, r_c) are **illustrative**, not sourced. Material-parameter decision **M6 remains open**; no `needs_citation`/null YAML value was consumed. The YAML lattice parameter is reused only as an illustrative number.
- **A-P2-2:** The field's log term is normalized by r_c² (a rigid-translation difference from spec §5.4's literal ln(x²+y²)); recorded in docs/model.md §10.2. No root-spec text was edited.
- **A-P2-3:** Reconstructed Hall–Petch points remain reconstructed/demo-only; nothing in this milestone uses them. DoITPoMS CC BY-NC-SA micrographs are not in `web/` or any public asset.

## 5. Phase 4 Authorization Record (2026-10-21)

- **Authorized:** Phase 4 only — Grain-Boundary Transmission. Implemented deterministic, explainable boundary transmission core in Python (`src/hpsim/core/boundary.py`) and TypeScript (`web/src/core/boundary.ts`), verified with cross-runtime golden parity fixtures (`tests/golden/phase4_fixtures.json`).
- **Not authorized / not done:** Phase 5 pile-up solvers, Phase 6 yield-onset / Hall–Petch sweeps, micrograph segmentation UI, BCC/screw extensions, root-spec migration, deployment, or Ralph Loop.
- **A-P4-1 (Unresolved Parameter M6):** $\tau^*_{\text{ref}}$ is uncalibrated. A missing or null $\tau^*_{\text{ref}}$ produces an explicit `unresolved_threshold` outcome in both Python and TypeScript, not an arbitrary default pass/fail. Illustrative values in tests and UI demo controls are strictly labeled as illustrative and never saved as sourced values in `materials.yaml`.
- **A-P4-2 (Controlled Boundary Geometry):** Controlled two-grain columnar model with synthetic orientations. No 2D optical micrograph traces are used to claim 3D crystallographic orientations.
- **A-P4-3 (Viewer & UI Isolation):** 3D viewer updated to show controlled boundary plane, adjacent grain box, outcome marker, and candidate outgoing slip arrows. Camera controls and rendering remain strictly read-only presentation components unable to mutate physics state.

## 6. Phase 5 Authorization Record (2026-10-21)

- **Authorized:** Phase 5 only — Discrete Dislocation Pile-Up Engine. Implemented 1D discrete single-slip edge dislocation array force balance solver and Eshelby–Frank–Nabarro (EFN 1951) associated Laguerre polynomial root benchmark in Python (`src/hpsim/core/pileup.py`) and TypeScript (`web/src/core/pileup.ts`), verified with cross-runtime golden parity fixtures (`tests/golden/phase5_fixtures.json`).
- **Not authorized / not done:** Phase 6 yield-onset / Hall–Petch sweeps, Hall–Petch regression, claiming Hall–Petch relation emerged, calibration of $\tau^*_{\text{ref}}$, micrograph segmentation, deployment, push, commit, or Ralph Loop.
- **A-P5-1 (Governing Model & Benchmark):** One-dimensional array of identical like-signed straight edge dislocations under uniform applied shear stress accumulated against an impenetrable obstacle at $x=0$. Benchmarked against exact roots of $L_{N-1}^{(1)}(\xi) = 0$ computed via Golub–Welsch (1969) tridiagonal Jacobi matrix eigensolver and classical Eshelby tip stress multiplication $\tau_{\text{tip}} = N \tau_{\text{app}}$.
- **A-P5-2 (Asymptotic vs Discrete Scaling):** Classical continuum approximation $N_{\text{asymp}} \approx \pi (1-\nu) L \tau_{\text{app}} / (\mu b)$ is verified as an asymptotic limit as $N \to \infty$ with $O(N^{-2/3})$ rate per Szegő's theorem; at small $N$, finite-size discrete deviations are expected and documented.
- **A-P5-3 (Decision M6 Status Unaltered):** $\tau^*_{\text{ref}}$ remains completely unresolved and uncalibrated; no values were added to `materials.yaml`. Material parameters in demo/tests are strictly labeled illustrative.
- **A-P5-4 (UI Read-Only Presentation):** Interactive 1D pile-up diagram and controls added to `App.tsx` displaying exact computed equilibrium positions, obstacle boundary at $x=0$, tip stress concentration, and EFN comparison. Failure states (e.g. iteration budget exceeded) are explicitly communicated without showing stale positions.

## 7. Phase 6 Authorization Record (2026-10-29)

- **Authorized:** Phase 6 — Emergent Hall–Petch Derivation. Implemented quasi-static source shut-off at $x = L = d / 2$, yield-onset bisection on $\tau_{\text{eff}}$, multi-grain-size Hall–Petch sweeps with seeded bootstrap 95% confidence intervals, and single-scalar $\tau^*_{\text{ref}}$ calibration in Python (`src/hpsim/core/hallpetch.py`) and TypeScript (`web/src/core/hallpetch.ts`).
- **A-P6-1 (Governing Source Shut-Off & Yield Onset):** Starting from $N = 1$ at $x_0 = 0$, dislocations are emitted while $\tau_{\text{eff}} - \tau_{\text{back}}(L; N) > \tau_{\text{src}}$ and $x_j < L = d / 2$. Yield onset occurs at the smallest $\tau_{\text{eff}}$ where $\tau_{\text{tip}}(L, \tau_{\text{eff}}) = N \tau_{\text{eff}} \ge \tau^*(m')$.
- **A-P6-2 (Single-Parameter Calibration & Provenance Guardrails):** $\tau^*_{\text{ref}}$ (with $\beta = 0, m' = 1$) is calibrated strictly on each material's primary high-purity verified literature fit in `data/literature/hall_petch_verified_fits.csv` and evaluated without refitting on the held-out secondary dataset (`V-15`). In `src/hpsim/materials/materials.yaml`, `tau_star_ref` retains `value: null` to preserve raw literature provenance, while calibrated values are stored in `CALIBRATED_MATERIALS` and `web/public/data/materials.json` (`tau_star_ref_calibrated`).
- **A-P6-3 (Solute Segregation Limitation in Iron/Steel):** The 39.4% slope increase between Ti-stabilized IF-iron ($k_y = 114\,\text{MPa}\cdot\mu\text{m}^{1/2}$) and Base iron with 5 ppm free carbon ($k_y = 188\,\text{MPa}\cdot\mu\text{m}^{1/2}$) is explicitly analyzed as an unmodeled grain-boundary carbon segregation mechanism per `spec.md` §10.2 (`V-15`).

## 8. Phase 7 & Phase 8 Authorization Record (2026-10-29)

- **Authorized:** Phase 7 (Micrograph Preprocessing & Web Data Integration) and Phase 8 (Final Packaging, Validation Report & Static Build Verification).
- **A-P7-1 (Micrograph CV Policies & Licence Guardrails):** Implemented offline Python CV pipeline (`src/hpsim/micro/`) with synthetic Voronoi stereological verification (`V-11`), automated vs reference-line intercept cross-checks (`V-12`), seeded uniform $\mathrm{SO}(3)$ orientations (`V-13`), and chord rescaling (`V-16`). Enforced `M4` Cu annealing twin exclusion, `M5` steel pearlite masking ($13.4\%$ masked), and `D6` prohibition on bundling raw CC BY-NC-SA 4.0 DoITPoMS `.jpg` files in `web/public/`.
- **A-P8-1 (Full V&V Report & Honest Held-Out Disclosure):** Generated `docs/validation_report.md` (`scripts/generate_validation_report.py`), `docs/limitations.md`, and `docs/user_guide.md`, reporting all 17 checks (`V-01`–`V-17`) and disclosing both specimen-$\sigma_0$-adjusted ($3.34\%\text{–}12.89\%$) and unadjusted-$\sigma_0$ ($12.7\%\text{–}28.9\%$) held-out literature comparisons alongside physical explanations of grain-boundary carbon segregation and solid-solution friction shifts.




