# Scientific Assumptions & Limitations (`hpsim`)

This document catalogs the fundamental physical assumptions, mathematical simplifications, and empirical boundaries of the **Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)**, together with a quantitative explanation of why 1D continuum pile-up mechanics deviates from held-out experimental literature when grain-boundary chemistry or solid-solution impurity levels change.

---

## 1. Fundamental Physical & Mathematical Simplifications

1. **1D Planar Coplanar Single-Slip Pile-Up (`A2`):**
   - Each grain is modeled by a single active primary slip plane containing straight, parallel, like-signed edge dislocations gliding in 1D along $x \in [0, L = d/2]$ between a grain boundary obstacle at $x_0 = 0$ and a Frank–Read-type source at the grain center $x = L$.
   - **Omitted Effects:** Multi-slip forest hardening, latent hardening between intersecting $\{111\}$ or $\{110\}$ planes, cross-slip of screw segments, dislocation dipolar trapping, and 3D curved line tension ($T \approx \frac{1}{2}Gb^2$).

2. **Isotropic Linear Continuum Elasticity (`A1`):**
   - Inter-dislocation interaction forces $\tau_{\text{int}} = A / (x_i - x_j)$ with $A = Gb / (2\pi(1-\nu))$ and the near-core regularized displacement field $\mathbf{u}(x,y)$ use isotropic elastic constants ($G, \nu$).
   - **Omitted Effects:** Elastic anisotropy (e.g., Zener anisotropy ratio $A_Z \approx 3.21$ in Copper vs $A_Z \approx 1.22$ in Aluminium), which alters edge/screw interaction prefactors on specific crystallographic planes.

3. **Quasi-Static Rate- and Temperature-Independent Friction (`A3`):**
   - Lattice friction ($\tau_c$) and grain-boundary barrier strength ($\tau^*_{\text{ref}}$) are treated as rate- and temperature-independent constants at room temperature ($295\text{–}300\,\text{K}$).
   - **Omitted Effects:** Thermally activated Peierls-Nabarro double-kink nucleation in BCC metals ($\alpha$-Fe and ferritic steel) at low temperatures or high strain rates.

4. **Continuum Displacement Superposition, Not Molecular Dynamics (`A8`):**
   - The 3D atomic lattice viewer superimposes analytical Volterra continuum displacement fields (regularized with core radius $r_c$) onto ideal FCC/BCC lattice sites. It does **not** integrate Newton's equations of motion with embedded-atom method (EAM) interatomic potentials or resolve atomistic grain-boundary core reconstructions.

5. **Micron-Scale Grain Size Regime (`A7`):**
   - The discrete pile-up formulation applies strictly to the classical micron-scale Hall–Petch regime ($d \gtrsim 1\,\mu\text{m}$), where $N \ge 2$ dislocations can accumulate between the grain center and boundary.
   - **Omitted Effects:** Breakdown of dislocation pile-ups in nanocrystalline metals ($d \lesssim 20\text{–}100\,\text{nm}$), partial dislocation emission from grain boundaries, and Coble/grain-boundary sliding softening (inverse Hall–Petch effect).

---

## 2. Microstructural & Stereological Limitations

1. **2D Optical Sectioning vs 3D Crystallographic Orientation (`A4`, `A5`):**
   - 2D optical micrographs provide planar boundary traces and ASTM E112 lineal intercept chords $\ell$, not 3D grain morphology or Electron Backscatter Diffraction (EBSD) Euler angles.
   - Grain orientations $R_i \in \mathrm{SO}(3)$ are sampled from a seeded uniform distribution (Shoemake quaternion algorithm, verified in `V-13`), and grain boundaries are idealized as columnar planes normal to the image plane.

2. **Annealing Twins in Copper (`D2` / `M4`) and Pearlite in Ferritic Steel (`D3` / `M5`):**
   - In FCC Copper (`copper_cu997_doitpoms436`), coherent $\Sigma 3$ annealing twin bands are excluded via directional Gabor filtering (`M4_copper_twin_exclusion`) per Hansen & Ralph (1982).
   - In hypoeutectoid Fe-0.2C steel (`ferritic_steel_fe202`), dark pearlite colonies ($13.4\%$ area fraction) are masked out (`M5_ferrite_only_mask`) so that intercept chords sample only the proeutectoid ferrite matrix. Load transfer between ferrite and pearlite colonies is not modeled.

3. **Parametric Chord Rescaling (`D1` / `M3`):**
   - Scaling a measured chord distribution $\{c_i\}$ by $\alpha = \bar{d}_{\text{target}} / \bar{c}$ (`V-16`) preserves the normalized grain-size distribution shape ($\text{CV} = \sigma/\mu$) for parametric sensitivity studies, but does **not** constitute independent experimental micrographs at multiple annealing treatments.

---

## 3. Quantitative Analysis of Held-Out Literature Discrepancies (`V-15`)

### 3.1 Literature Comparability Table (4 Audited Materials)

The table below catalogs the experimental literature sources, metallurgical conditions, grain size measurement conventions, strength definitions, and source DOIs for the 4 calibrated materials and their corresponding held-out evaluation datasets from `data/literature/hall_petch_verified_fits.csv`:

| Material | Dataset Role | Source Citation & DOI | Purity & Composition | Heat Treatment / Condition | Grain Size Measurement Method | Yield Strength Definition | Reported $\sigma_0$ (MPa) | Reported $k_y$ ($\text{MPa}\cdot\mu\text{m}^{1/2}$) | Known Mismatches & Systematic Drivers |
|---|---|---|---|---|---|---|---|---|---|
| **Aluminium** (FCC) | **Calibration** | Hansen (1977) [10.1016/0001-6160(77)90171-7](https://doi.org/10.1016/0001-6160(77)90171-7) | 99.999 wt% High-Purity Al | Cold-rolled, recrystallised at 673–873 K, equiaxed annealed | Mean lineal intercept $d = \bar{\ell}$ (ASTM E112) | 0.2% offset proof stress ($\dot{\varepsilon} = 10^{-4}\,\text{s}^{-1}$) | $10.0$ | $67.0$ | Baseline reference high-purity single-phase matrix. |
| **Aluminium** (FCC) | **Held-Out** | Hansen (1977) AA1050 [10.1016/0001-6160(77)90171-7](https://doi.org/10.1016/0001-6160(77)90171-7) | 99.5 wt% Commercial Al (AA1050; Fe $\approx 0.35\%$, Si $\approx 0.15\%$) | Cold-rolled and annealed at 673–873 K | Mean lineal intercept $d = \bar{\ell}$ | 0.2% offset proof stress | $16.5$ | $78.0$ | **Lattice friction shift:** Solid-solution Fe/Si and fine intermetallic dispersoids raise lattice friction by $\Delta\sigma_0 = +6.5\,\text{MPa}$ (+65%). Unadjusted blind error is $28.9\%$ (fails 25% band); adjusting for $\sigma_0$ reduces error to $3.34\%$. |
| **Copper** (FCC) | **Calibration** | Hansen & Ralph (1982) [10.1016/0001-6160(82)90221-8](https://doi.org/10.1016/0001-6160(82)90221-8) | 99.999 wt% High-Purity Copper | Cold-rolled 90%, recrystallised at 673–973 K | Mean lineal intercept with coherent $\Sigma 3$ annealing twins excluded ($d = \bar{\ell}_{\text{no twins}}$) | 0.2% offset proof stress | $20.0$ | $125.0$ | High-purity calibration reference; coherent annealing twin boundaries excluded per Hansen & Ralph protocol (`M4`). |
| **Copper** (FCC) | **Held-Out** | Feltham & Meakin (1957) [10.1080/14786435708231728](https://doi.org/10.1080/14786435708231728) | 99.95 wt% Polycrystalline Copper | Annealed at 873–1123 K, grain sizes $14\text{–}150\,\mu\text{m}$ | Mean lineal intercept $d = \bar{\ell}$ (historical protocol; twin exclusion partial/unspecified) | 0.2% offset proof stress | $23.5$ | $144.0$ | **Twin protocol & purity difference:** 99.95% purity has slight oxygen/impurity solid-solution hardening ($\Delta\sigma_0 = +3.5\,\text{MPa}$); historical 1957 chord intercept protocol did not systematically separate coherent twin boundaries from general high-angle boundaries, raising apparent $k_y$ by $13.2\%$. Unadjusted blind error is $12.8\%$ (passes 25% band). |
| **Pure $\alpha$-Iron** (BCC) | **Calibration** | Takeda et al. (2008) IF-Fe [10.2355/isijinternational.48.1122](https://doi.org/10.2355/isijinternational.48.1122) | Interstitial-Free (IF) Iron (Ti-stabilised, $\le 4\,\text{ppm}$ C, $9\,\text{ppm}$ N) | Cold-rolled 90%, annealed at 973–1123 K, water-quenched | Quadrature lineal intercept $d = 1.128\sqrt{\bar{\ell}_x \bar{\ell}_y}$ | Elastic limit / Upper yield point (sharp yield drop) | $56.0$ | $114.0$ | Ti scavenging prevents interstitial C/N grain-boundary segregation; clean, unpinned ferrite boundaries. |
| **Pure $\alpha$-Iron** (BCC) | **Held-Out** | Takeda et al. (2008) Base Fe [10.2355/isijinternational.48.1122](https://doi.org/10.2355/isijinternational.48.1122) | Base Pure Iron ($5\,\text{ppm}$ free solute C, $9\,\text{ppm}$ N; unstabilized) | Cold-rolled 90%, annealed at 973–1123 K, water-quenched | Quadrature lineal intercept $d = 1.128\sqrt{\bar{\ell}_x \bar{\ell}_y}$ | Elastic limit / Upper yield point | $72.0$ | $188.0$ | **Grain-boundary carbon segregation:** Just $5\,\text{ppm}$ free solute C segregates to ferrite grain boundaries during quenching, increasing grain boundary dislocation pinning and raising $k_y$ by $+64.9\%$ ($114 \to 188\,\text{MPa}\cdot\mu\text{m}^{1/2}$). 1D continuum pile-up lacks chemical segregation physics, leading to a $39.4\%$ slope underprediction and $27.5\%$ unadjusted error (fails 25% band). |
| **Ferritic Steel** (BCC) | **Calibration** | Takeda et al. (2008) C60 [10.2355/isijinternational.48.1122](https://doi.org/10.2355/isijinternational.48.1122) | C60 Low-Carbon Steel ($56\,\text{ppm}$ / $0.0056\,\text{wt}\%$ C, $11\,\text{ppm}$ N) | Cold-rolled 90%, annealed at 973 K for 60–600 s, water-quenched | Quadrature lineal intercept $d = 1.128\sqrt{\bar{\ell}_x \bar{\ell}_y}$ | Upper yield stress $\sigma_{UY}$ (Lüders band nucleation) | $61.0$ | $516.0$ | Single-phase ferrite matrix with saturated grain boundary carbon segregation; strong boundary obstacle locking. |
| **Ferritic Steel** (BCC) | **Held-Out** | Armstrong et al. (1962) [10.1080/14786436208201857](https://doi.org/10.1080/14786436208201857) | $0.15\,\text{wt}\%$ C ($1500\,\text{ppm}$ C) Mild Steel | Normalized / annealed at 1173 K | Mean lineal intercept $d = \bar{\ell}$ | Lower yield stress $\sigma_{LY}$ (Lüders band propagation) | $68.0$ | $620.0$ | **Microstructure & yield definition mismatch:** Hypoeutectoid mild steel has $\approx 15\text{--}20\%$ pearlite colonies (two-phase aggregate) vs single-phase C60 ferrite; yield definition is lower yield stress $\sigma_{LY}$ vs upper yield stress $\sigma_{UY}$; carbon level is 27× higher ($1500\,\text{ppm}$ vs $56\,\text{ppm}$). Unadjusted blind error is $13.4\%$ (passes 25% band). |

---

### 3.2 Quantitative Held-Out Benchmark Results (`V-15`)

In `V-15`, the single scalar barrier parameter $\tau^*_{\text{ref}}$ is calibrated on each material's primary calibration dataset and tested against the held-out secondary dataset:

| Material | Structure | Calibrated $\tau^*_{\text{ref}}$ (MPa) | Calibration Target $k_y$ ($\text{MPa}\cdot\mu\text{m}^{1/2}$) | Held-Out Target $k_y$ ($\text{MPa}\cdot\mu\text{m}^{1/2}$) | Slope Diff (`held_out_k_y_rel_diff`) | Primary Headline Metric (`held_out_unadjusted_mean_rel_error`, **BLIND**) | Secondary Diagnostic (`held_out_intercept_adjusted_mean_rel_error`, **NOT BLIND**) | `V-15` $\le 25\%$ Headline Band Status |
|---|---|---|---|---|---|---|---|---|
| **Aluminium** | FCC | $80.89$ | $67.0$ | $78.0$ | $14.1\%$ | **$28.9\%$** | $3.34\%$ | **FAIL** (solute friction offset) |
| **Copper** | FCC | $172.26$ | $125.0$ | $144.0$ | $13.2\%$ | **$12.7\%$** | $4.89\%$ | **PASS** |
| **Pure $\alpha$-Iron** | BCC | $118.35$ | $114.0$ | $188.0$ | $39.4\%$ | **$27.5\%$** | $12.89\%$ | **FAIL** (grain-boundary C segregation) |
| **Ferritic Steel** | BCC | $2115.93$ | $516.0$ | $620.0$ | $16.8\%$ | **$13.4\%$** | $9.16\%$ | **PASS** |

> [!IMPORTANT]
> **Headline Metric Protocol (Task 1):**
> `held_out_unadjusted_mean_rel_error` is the **PRIMARY HEADLINE BLIND PREDICTION METRIC**. In this metric, neither the held-out material's friction stress $\sigma_0$ nor its slope $k_y$ is used anywhere in the simulation. The simulation predicts yield stress using only the calibration $\sigma_{0,\text{cal}}$ and calibrated $\tau^*_{\text{ref}}$.
> `held_out_intercept_adjusted_mean_rel_error` is strictly secondary and explicitly labeled **NOT BLIND**, as it injects the held-out specimen's known experimental friction stress $\sigma_{0,\text{held}}$.

---

### 3.3 Stereological Convention & Disclosure of No Silent 3D Multiplier

A critical stereological distinction in grain-size quantification is between:
1. **2D Mean Lineal Intercept ($\bar{\ell}$):** The average chord length intercepted across 2D planar grain sections by random test lines (ASTM E112).
2. **3D True Volumetric Grain Diameter ($D_{\text{3D}}$):** The spatial diameter of equivalent volumetric spherical grains.

In stereological literature (e.g. Underwood 1970, ASTM E112), analytical relations relate 2D mean chord $\bar{\ell}$ to 3D sphere diameter $D$ via conversion factors:
$$D_{\text{sphere}} = \frac{4}{\pi} \bar{\ell} \approx 1.273 \bar{\ell} \quad \text{(mean sphere)}, \qquad D_{3D} \approx 1.57 \bar{\ell} \text{ to } 1.74 \bar{\ell} \quad \text{(equiaxed spatial grain diameter)}$$

**Explicit Convention & Disclosure:**
- `hpsim` uses the mean linear intercept $\bar{d} = \bar{\ell}$ **directly as the grain size $d$** in all macroscopic Hall–Petch sweeps and pile-up lengths ($L = d / 2$).
- **No silent stereological conversion factor (such as $1.57$, $1.74$, or $\pi/2$) is applied.**
- **Rationale for Direct Comparability:**
  1. The foundational experimental literature fits in `hall_petch_verified_fits.csv` (Hansen 1977, Hansen & Ralph 1982, Feltham & Meakin 1957, Armstrong et al. 1962) were reported with regression equations fitted directly against $\bar{\ell}^{-1/2}$, reporting $k_y$ in units of $\text{MPa}\cdot\mu\text{m}^{1/2}$ defined on mean lineal intercept chords.
  2. The 1D dislocation pile-up length $L = d / 2$ physically corresponds to the half-span of a planar slip band traversing an individual grain in the cross-section plane, directly matching the 1D lineal chord dimension.
  3. Silently scaling $d$ by $1.74$ would alter $d^{-1/2}$ by a factor of $1.74^{-1/2} \approx 0.758$, shifting the apparent slope $k_y$ by $32\%$ and obscuring direct physical comparison against published literature values.

---

### 3.4 Dislocation Source Distance Sensitivity ($L = d/2$ vs $L \in \{d/4, d/2, d\}$)

In the standard Hall–Petch pile-up model, the Frank–Read dislocation source is located at the center of the grain: $L = d / 2$. To test model sensitivity to source placement, `hpsim` evaluates source distances across the ratio set $L \in \{d/4, d/2, d\}$ ($\alpha = L/d \in \{0.25, 0.5, 1.0\}$).

**Analytical Derivation:**
From Eshelby, Frank & Nabarro (1951), the pile-up tip stress under quasi-static emission with source shut-off at distance $L$ is:
$$\tau_{\text{tip}} \approx N \tau_{\text{eff}} \approx \frac{\pi (1-\nu) L \tau_{\text{eff}}^2}{\mu b}$$
Equating $\tau_{\text{tip}} = \tau^*$ at yield onset yields:
$$\tau_{\text{eff,crit}} = \sqrt{\frac{\mu b \tau^*}{\pi (1-\nu) L}} = \frac{1}{\sqrt{\alpha}} \sqrt{\frac{\mu b \tau^*}{\pi (1-\nu) d}}$$
Thus, the macroscopic Hall–Petch slope $k_y = M_T \frac{\tau_{\text{eff,crit}}}{d^{-1/2}}$ scales analytically with $1/\sqrt{L}$:
$$k_y(L = \alpha d) \propto \frac{1}{\sqrt{\alpha}} \implies k_y(d/2) \sim \sqrt{\frac{2}{d}}, \quad k_y(d) \sim \sqrt{\frac{1}{d}}, \quad k_y(d/4) \sim \sqrt{\frac{4}{d}}$$
Analytically:
$$\frac{k_y(d/4)}{k_y(d/2)} = \sqrt{2} \approx 1.4142, \qquad \frac{k_y(d)}{k_y(d/2)} = \frac{1}{\sqrt{2}} \approx 0.7071$$

**Simulation Findings (Verified via `evaluate_source_distance_sensitivity`):**
Across a $1.6$-decade grain size sweep ($10\text{--}400\,\mu\text{m}$, 16 points) on Aluminium ($\tau^*_{\text{ref}} = 80.89\,\text{MPa}$):
- For $L = d/4$ ($\alpha = 0.25$): Simulated $k_y = 93.58\,\text{MPa}\cdot\mu\text{m}^{1/2}$; empirical ratio to $d/2$ is **$1.397$** (vs theoretical $\sqrt{2} = 1.414$, $-1.2\%$ finite-$N$ discrete difference).
- For $L = d/2$ ($\alpha = 0.50$): Simulated $k_y = 67.00\,\text{MPa}\cdot\mu\text{m}^{1/2}$; reference baseline ($1.000$).
- For $L = d$ ($\alpha = 1.00$): Simulated $k_y = 48.59\,\text{MPa}\cdot\mu\text{m}^{1/2}$; empirical ratio to $d/2$ is **$0.725$** (vs theoretical $1/\sqrt{2} = 0.707$, $+2.5\%$ discrete difference).
- **Emergent Exponent Invariance (`V-09`):** The log-log power-law slope $d(\log \tau_{\text{eff,crit}})/d(\log d)$ is $-0.4796$ ($L=d/4$), $-0.4829$ ($L=d/2$), and $-0.4862$ ($L=d$), all strictly within the $-0.50 \pm 0.05$ `V-09` benchmark window. This proves that the emergent $d^{-1/2}$ power law is robustly invariant to the source distance convention.

---

### 3.5 Calibration Transparency & Decision M6 Status

1. **Calibration Target Transparency:**
   $\tau^*_{\text{ref}}$ is a **CALIBRATION TARGET**, not an emergent property. It is determined by numerical bisection so that the simulated discrete pile-up slope $k_y$ matches published experimental Hall–Petch slopes. The **only emergent property** derived by the simulator is the $d^{-1/2}$ power-law exponent (`V-09`), which arises naturally from the discrete $1/x_{ij}$ force balance and source shut-off condition.
2. **Decision M6 Preservation:**
   - In `materials.yaml`, `tau_star_ref.value` remains strictly `null` across all materials (`status: calibrated`). Calibrated numerical values are exported only to `web/public/data/materials.json` under `tau_star_ref_calibrated`.
   - In `materials.yaml`, `ferritic_steel.tau_c` remains `35.0 MPa` with `status: needs_citation` because room-temperature single-crystal CRSS in carbon-segregated ferrite lacks a definitive peer-reviewed experimental citation (unlike pure iron tested by Spitzig & Keh 1970).
   - In the web application, ferritic steel is permanently labeled with an explicit `"unresolved citation"` badge. Notice that because the Hall–Petch sweep uses the experimental friction offset $\sigma_{0,\text{offset}} = 61.0\,\text{MPa}$, the unverified $\tau_c$ parameter does not enter or contaminate any quantitative Hall–Petch prediction.

---

## 4. Data Provenance & Licensing Guardrails (`D4`, `D5`, `D6`)

- **Provenance Badges (`D4`):** Every parameter is explicitly badged in `materials.yaml`, `web/public/data/materials.json`, and the web UI as `sourced` (peer-reviewed literature), `calibrated` ($\tau^*_{\text{ref}}$ fit to primary literature $k_y$), or `illustrative` (e.g., BCC representative room-temperature effective CRSS $\tau_c$ in polycrystalline Fe and C60 steel).
- **Reconstructed Literature Points (`D5`):** Points in `data/literature/hall_petch_datasets.csv` are sampled from the published regression equations in `data/literature/hall_petch_verified_fits.csv` and are strictly labeled `RECONSTRUCTED_FROM_FIT` (`demonstration_only`).
- **Micrograph Redistribution (`D6`):** Raw DoITPoMS micrographs (`aluminium_al995_doitpoms609.jpg`, `copper_cu997_doitpoms436.jpg`, `ferritic_steel_fe202.jpg`) are governed by CC BY-NC-SA 4.0 and remain strictly local in `data/micrographs/`. Only extracted vector grain-boundary polygons and chord distributions are exported to `web/public/data/micrographs/`.
