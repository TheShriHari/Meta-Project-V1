# HPSim Phase 1 Mathematics Kernel Specification & Mathematical Model

**Document Status:** Complete (Phase 1 Baseline)  
**Date:** 2026-10-20  
**Phase:** Phase 1 (Mathematics Kernel — Pure Core)  
**Quality Gate:** Gate 1  

---

## 1. Overview and Scope

This document details the mathematical conventions, governing equations, coordinate transformations, crystallographic slip systems, and unit standards for the **HPSim (Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator)** core mathematics kernel.

As mandated by **Quality Gate 1**:
- The mathematics kernel is self-contained with **zero dependencies on UI, DOM, Canvas, WebGL, or Three.js** (`hpsim.core` isolation).
- Dual implementations exist in **Python** (`src/hpsim/core/`) and **TypeScript** (`web/src/core/`) with shared deterministic golden fixtures ensuring bitwise/numerical parity.
- The model implements planar crystallographic kinematics and stress resolution. It does **not** claim molecular dynamics fidelity, emergent Hall–Petch grain-size scaling, or grain-boundary transmission at this phase.

---

## 2. Coordinate Systems, Rotations, and Vector Algebra

### 2.1 Coordinate Frames

HPSim distinguishes two Cartesian coordinate reference frames:
1. **Specimen Reference Frame ($\mathcal{S}$):** Defined by orthonormal unit basis vectors $\{\mathbf{e}_X^s, \mathbf{e}_Y^s, \mathbf{e}_Z^s\}$. For 2D/pseudo-3D simulations, the specimen tensile or shear axis is typically aligned with $\mathbf{e}_Z^s$ or $\mathbf{e}_X^s$.
2. **Crystal Lattice Reference Frame ($\mathcal{C}$):** Defined by orthonormal basis vectors aligned with the cubic crystallographic directions: $\{\mathbf{e}_{[100]}^c, \mathbf{e}_{[010]}^c, \mathbf{e}_{[001]}^c\}$.

### 2.2 Rotation Matrix Convention

A 3D rotation matrix $\mathbf{R} \in \mathrm{SO}(3)$ maps crystal-frame vectors $\mathbf{v}^c$ into specimen-frame vectors $\mathbf{v}^s$:
$$\mathbf{v}^s = \mathbf{R} \, \mathbf{v}^c$$

Every rotation matrix $\mathbf{R}$ must strictly satisfy:
$$\mathbf{R}^T \mathbf{R} = \mathbf{I}, \quad \det(\mathbf{R}) = +1$$
Numerical validation in `is_orthonormal_matrix` enforces $\|\mathbf{R}^T \mathbf{R} - \mathbf{I}\|_\infty \le 10^{-6}$ and $|\det(\mathbf{R}) - 1.0| \le 10^{-6}$.

### 2.3 Bunge Euler Angles ($Z-X'-Z''$)

The orientation of a grain's crystal lattice relative to the specimen frame is parameterized using Bunge Euler angles $(\phi_1, \Phi, \phi_2)$ under the standard $Z-X'-Z''$ sequence:
1. Rotation by $\phi_1$ about the initial $Z$-axis.
2. Rotation by $\Phi$ about the intermediate $X'$-axis ($0 \le \Phi \le \pi$).
3. Rotation by $\phi_2$ about the final $Z''$-axis.

The resulting rotation matrix is:
$$\mathbf{R}(\phi_1, \Phi, \phi_2) = \begin{bmatrix}
\cos\phi_1\cos\phi_2 - \sin\phi_1\sin\phi_2\cos\Phi & -\cos\phi_1\sin\phi_2 - \sin\phi_1\cos\phi_2\cos\Phi & \sin\phi_1\sin\Phi \\
\sin\phi_1\cos\phi_2 + \cos\phi_1\sin\phi_2\cos\Phi & -\sin\phi_1\sin\phi_2 + \cos\phi_1\cos\phi_2\cos\Phi & -\cos\phi_1\sin\Phi \\
\sin\phi_2\sin\Phi & \cos\phi_2\sin\Phi & \cos\Phi
\end{bmatrix}$$

### 2.4 Uniform Random Rotations on $\mathrm{SO}(3)$

Random crystal orientations are sampled uniformly with respect to the Haar measure on $\mathrm{SO}(3)$ using the Shoemake subgroup algorithm parameterized by three independent uniform variables $u_1, u_2, u_3 \sim \mathcal{U}[0, 1)$:
$$q = \left(\sqrt{1-u_1}\sin(2\pi u_2), \; \sqrt{1-u_1}\cos(2\pi u_2), \; \sqrt{u_1}\sin(2\pi u_3), \; \sqrt{u_1}\cos(2\pi u_3)\right)$$
and converting the unit quaternion to an orthogonal $3 \times 3$ matrix. All random generators accept an explicit deterministic seed (`SeedSequence` / PCG64).

---

## 3. SI Units and Boundary Conversion

All internal simulation calculations are conducted strictly in coherent **SI base and derived units**. Non-SI units are converted at data input/output boundaries only:

| Physical Quantity | Symbol | Internal SI Unit | Input/Boundary Unit | Conversion Relation |
| :--- | :--- | :--- | :--- | :--- |
| Length / Displacement | $x, y, z, d, b$ | meter ($\text{m}$) | $\text{nm}, \mu\text{m}$ | $1\,\text{nm} = 10^{-9}\,\text{m}$, $1\,\mu\text{m} = 10^{-6}\,\text{m}$ |
| Stress / Pressure | $\sigma, \tau$ | Pascal ($\text{Pa}$) | $\text{MPa}, \text{GPa}$ | $1\,\text{MPa} = 10^6\,\text{Pa}$, $1\,\text{GPa} = 10^9\,\text{Pa}$ |
| Time | $t$ | second ($\text{s}$) | $\text{s}, \text{ms}$ | $1\,\text{s}$ |
| Velocity | $v$ | $\text{m/s}$ | $\text{m/s}, \mu\text{m/s}$ | $1\,\text{m/s}$ |
| Dislocation Mobility | $M_d$ | $(\text{Pa}\cdot\text{s})^{-1}$ | $(\text{Pa}\cdot\text{s})^{-1}$ | Coherent SI |
| Friction Stress | $\tau_c, \tau_0$ | Pascal ($\text{Pa}$) | $\text{MPa}$ | $1\,\text{MPa} = 10^6\,\text{Pa}$ |

Internal variables and functions carry explicit unit suffixes or typed definitions (e.g., `tau_pa`, `sigma_app_pa`, `b_m`, `velocity_mps`).

---

## 4. Crystallographic Slip Systems

A crystallographic slip system $\alpha$ is characterized by:
- A unit slip plane normal $\mathbf{n}^{(\alpha)}$ ($|\mathbf{n}^{(\alpha)}| = 1$).
- A unit slip direction $\mathbf{s}^{(\alpha)}$ ($|\mathbf{s}^{(\alpha)}| = 1$).
- Physical orthogonality: $\mathbf{s}^{(\alpha)} \cdot \mathbf{n}^{(\alpha)} = 0$.

### 4.1 Face-Centered Cubic (FCC) $\{111\}\langle 110 \rangle$
- **Number of unique systems:** Exactly 12.
- **Slip planes:** 4 close-packed planes $\{111\}$: $(1,1,1)$, $(-1,1,1)$, $(1,-1,1)$, $(1,1,-1)$.
- **Slip directions:** 3 close-packed directions per plane: $\langle 110 \rangle / \sqrt{2}$.
- **Burgers vector magnitude:** Given cubic lattice parameter $a$,
  $$b_{\mathrm{FCC}} = \frac{a}{\sqrt{2}}$$

### 4.2 Body-Centered Cubic (BCC) $\{110\}\langle 111 \rangle$
- **Number of unique systems:** Exactly 12.
- **Slip planes:** 6 $\{110\}$ planes: $(1,1,0)$, $(1,-1,0)$, $(1,0,1)$, $(1,0,-1)$, $(0,1,1)$, $(0,1,-1)$.
- **Slip directions:** 2 $\langle 111 \rangle / \sqrt{3}$ directions per plane satisfying $\mathbf{s} \cdot \mathbf{n} = 0$.
- **Burgers vector magnitude:**
  $$b_{\mathrm{BCC}} = \frac{a\sqrt{3}}{2}$$

Sign-inversion duplicates (antiparallel systems $(-\mathbf{n}, -\mathbf{s})$ or $(\mathbf{n}, -\mathbf{s})$) are pruned to maintain exactly 12 linearly independent physical slip planes and directions.

---

## 5. Resolved Shear Stress and Schmid Law

### 5.1 General Tensor Formulation
For a continuous body subject to a macroscopic Cauchy stress tensor $\boldsymbol{\sigma} \in \mathbb{R}^{3 \times 3}$, the resolved shear stress $\tau_{\mathrm{RSS}}^{(\alpha)}$ acting on slip system $\alpha = (\mathbf{s}, \mathbf{n})$ is defined by the tensor contraction:
$$\tau_{\mathrm{RSS}} = \mathbf{s}^T \boldsymbol{\sigma} \mathbf{n} = \sum_{i=1}^3 \sum_{j=1}^3 s_i \sigma_{i j} n_j$$

### 5.2 Uniaxial Stress Oracle
For uniaxial tension or compression with stress magnitude $\sigma_{\mathrm{applied}}$ along unit axis $\mathbf{d}$:
$$\boldsymbol{\sigma} = \sigma_{\mathrm{applied}} (\mathbf{d} \otimes \mathbf{d})$$
Substituting into the tensor definition gives the classical Schmid law:
$$\tau_{\mathrm{RSS}} = \sigma_{\mathrm{applied}} (\mathbf{s} \cdot \mathbf{d}) (\mathbf{n} \cdot \mathbf{d}) = \sigma_{\mathrm{applied}} \cos\lambda \cos\phi = m \cdot \sigma_{\mathrm{applied}}$$
where:
- $\phi = \arccos(\mathbf{n} \cdot \mathbf{d})$ is the angle between the slip plane normal and the loading axis.
- $\lambda = \arccos(\mathbf{s} \cdot \mathbf{d})$ is the angle between the slip direction and the loading axis.
- $m = \cos\phi \cos\lambda$ is the Schmid factor.

**Physical and Geometric Bounds:**
- Geometric maximum: $|m| \le 0.5$ for any loading orientation.
- Under uniaxial loading along $[001]$ in FCC $\{111\}\langle 110 \rangle$:
  - 8 slip systems exhibit $|m| = \frac{1}{\sqrt{6}} \approx 0.408248$.
  - 4 slip systems exhibit $m = 0$.

### 5.3 Sign Convention
- $\tau_{\mathrm{RSS}} > 0$: Resolved shear stress drives dislocation motion in the positive $+\mathbf{s}$ slip direction.
- $\tau_{\mathrm{RSS}} < 0$: Resolved shear stress drives dislocation motion in the opposite $-\mathbf{s}$ direction.

---

## 6. Overdamped Dislocation Glide Kinematics

In the viscous glide regime (lattice resistance and phonon drag dominating over inertial terms), dislocation motion is modeled using an overdamped mobility law:

$$v = M_d \, b \, \operatorname{sgn}(\tau_{\mathrm{RSS}}) \, \max\left(|\tau_{\mathrm{RSS}}| - \tau_c, \; 0\right)$$

where:
- $v$ is the glide velocity ($\text{m/s}$).
- $M_d$ is the dislocation mobility coefficient ($(\text{Pa}\cdot\text{s})^{-1}$).
- $b$ is the Burgers vector magnitude ($\text{m}$).
- $\tau_{\mathrm{RSS}}$ is the resolved shear stress ($\text{Pa}$).
- $\tau_c$ is the lattice friction / critical resolved shear stress ($\text{Pa}$).

### 6.1 Velocity Properties
1. **Threshold Behavior:** For $|\tau_{\mathrm{RSS}}| \le \tau_c$, $v \equiv 0$.
2. **Linear Mobility:** For $|\tau_{\mathrm{RSS}}| > \tau_c$, $|v| = M_d b (|\tau_{\mathrm{RSS}}| - \tau_c)$.
3. **Directional Symmetry:** $v(-\tau_{\mathrm{RSS}}) = -v(\tau_{\mathrm{RSS}})$.

### 6.2 Numerical Integration and Discretization Independence
Under constant applied shear stress $\tau$, the dislocation position after physical time interval $\Delta T$ is:
$$\Delta x = \int_0^{\Delta T} v \, dt = v \Delta T$$
Numerical integration using discrete time step $\Delta t = \Delta T / N$ satisfies:
$$x_N = x_0 + \sum_{k=1}^N v \Delta t = x_0 + v \cdot (N \Delta t) = x_0 + v \Delta T$$
This guarantees that displacement over any constant physical interval is independent of time-step discretization to within floating-point machine precision.

---

## 7. Material Data Status and Provenance Model

To prevent unverified values from corrupting simulation outcomes, material data ingested from `src/hpsim/materials/materials.yaml` enforces strict status tracking:

```
  Status Enum:
    - sourced           # Backed by audited, cited peer-reviewed publication
    - needs_citation    # Parameter identified but awaiting bibliographic verification
    - calibrated_preset # Parameter determined from calibrated optimization (Phase 3+)
    - synthetic_fixture # Explicit test fixture; strictly prohibited in physics claims
```

### 7.1 Access Policy and Error Handling
- Attempting to access an empirical parameter marked `needs_citation`, `TODO`, or `null` raises an explicit `UnresolvedParameterError`.
- Silent substitution of default numerical values is strictly forbidden.
- Tests verify that `get_material("aluminium")["lattice_parameter_m"]` resolves to $4.0495 \times 10^{-10}\,\text{m}$, while accessing unverified parameters fails loudly.

---

## 8. Dual-Engine Verification & Parity Standards

The Python (`src/hpsim/core/`) and TypeScript (`web/src/core/`) kernels are coupled through deterministic golden test fixtures (`tests/golden/phase1_fixtures.json`):

1. **Units Parity:** Floating-point conversion tolerances $\le 10^{-12}$ relative difference.
2. **Matrix Algebra & Rotations:** Orthonormality $\|\mathbf{R}^T \mathbf{R} - \mathbf{I}\|_\infty \le 10^{-12}$, $\det(\mathbf{R}) = 1 \pm 10^{-12}$.
3. **Slip Systems:** Exact system-by-system correspondence for all 12 FCC and 12 BCC systems.
4. **Resolved Shear Stress:** Machine-precision agreement ($\le 10^{-12}$ relative for non-zero stresses; absolute tolerance $\le 1\,\mu\text{Pa}$ for orthogonal zero-stress systems).
5. **Glide Law:** Exact matching across sub-threshold, super-threshold, and reverse-stress regimes.

---

## 9. Scientific Assumptions and Current Limitations

1. **Planar Slip Assumption:** Dislocation motion is confined to crystallographic glide planes; cross-slip, climb, and junction formation are omitted at Phase 1.
2. **Inertialess Dynamics:** Dislocation mass acceleration is neglected ($m_d \dot{v} \approx 0$), valid for phonon-drag-dominated glide velocities ($v \ll c_s$, shear wave speed).
3. **No Molecular Dynamics:** This is a discrete continuum crystallographic model, not an atomistic or molecular dynamics code.
4. **No Grain Boundary Transmission (Gate 1 boundary):** Grain boundaries, dislocation pile-up backstresses, and Hall–Petch hardening are Phase 2 and Phase 3 scope and are not operational in Phase 1.
5. **Material Parameter Freeze (M6):** Material parameter verification remains an open, unresolved activity. No default empirical values are assumed.

---

## 10. Phase 2/3 Additions: FCC Lattice, Edge-Dislocation Field, Stress-Driven Glide

**Status:** Combined Phase 2+3 milestone (Quality Gate 2/3). Continuum visualization only.

### 10.1 FCC lattice
Conventional 4-atom cell, fractional basis (0,0,0), (1/2,1/2,0), (1/2,0,1/2), (0,1/2,1/2); atoms = 4·nx·ny·nz (complete cells, free surfaces unrelaxed, no seeded randomness exists in this milestone). Ordering: cell i,j,k then basis (identical in `hpsim.core.lattice` and `web/src/core/lattice.ts`). Nearest-neighbour distance a/√2, coordination 12 (tested).
Ideal positions `R_i` are never modified. Render positions are `r_i = R_i + u(R_i; r_d)` computed into a separate array.

### 10.2 Edge-dislocation displacement field (spec §5.4)
Local frame (right-handed): x ∥ slip direction **s**, y ∥ slip-plane normal **n**, dislocation line **ξ** = **s** × **n** (along z), so det([s, n, ξ]) = +1.
```
u_x = (b/2π)[ θ + x y / (2(1−ν)(r²+r_c²)) ]
u_y = −(b/2π)[ (1−2ν)/(4(1−ν)) ln((r²+r_c²)/r_c²) + (x²−y²)/(4(1−ν)(r²+r_c²)) ]
θ = atan2(y, x),  r² = x²+y²
```
- **Core regularization:** r² → r²+r_c² in the log and rational terms (r_c = b by default, configurable). θ is not regularized (bounded; it carries the Burgers jump).
- **Log normalization:** the log argument is divided by r_c², making it dimensionless. This changes u_y by a uniform rigid translation only; strains and the Burgers circuit are unchanged. (The spec's literal ln(x²+y²) differs by that constant.)
- **Branch cut:** `atan2` places the cut on the negative local x axis (y=0, x<0), i.e. along the slip plane *behind* a core gliding in +x. Crossing from y<0 to y>0 gives a jump of +b in u_x (the slipped region). The cut stays fixed in the core's local frame when the core reverses. The slip plane sits midway between atomic {111} planes (offset d₁₁₁/2, d₁₁₁ = a/√3) so no atom lies on the cut (tested for all 12 systems).
- **Sign:** a counter-clockwise loop enclosing the core closes on **+b** (displacement-jump/Volterra convention); clockwise gives −b.
- Plane strain, isotropic, single straight edge dislocation. **Not molecular dynamics; not an atomistic core.**

### 10.3 Burgers circuit validation (spec V-03)
Method: θ-unwrapped loop sum. Each segment's du uses the angle increment wrapped to (−π, π]; the single-valued smooth terms telescope. The routine **rejects** a loop whose segments subtend > 0.75π at the core (unwrapping ambiguous) instead of returning a wrong number. Tolerance: 1e-3·b (spec). Achieved ≈ 2e-14·b for enclosing loops (r=3, 10, 50 r_c; centred and off-centre) and ≈ 1.5e-16·b for a non-enclosing loop. The test is on the continuum field at sampled loop points, not on discrete atom positions (an atomic-lattice Burgers circuit is not part of this milestone).

### 10.4 Single-dislocation glide controller
Scalar core coordinate `pos` along **s** from p0. Per fixed step Δt: `v = M_d b sgn(τ) max(|τ|−τ_c,0)` (kernel `calculateGlideVelocity`), `pos += v Δt`, clamped to the domain `[tMin, tMax]` (slip-line extent inside the finite block, inset by one lattice parameter). A step that would cross a limit stops *at* the limit (`at_domain_limit`, `step_limited=true`); `step_limited` is also raised if |vΔt| > 0.25 b. No pinning, no grain boundaries. RSS uses the kernel tensor form `sᵀσn` with σ = σ_app t⊗t. Direction of motion follows the **signed** resolved stress (positive τ_RSS → +s).
- **Timeline:** immutable state history; `seek` replays without recomputation; stepping from a past index truncates the future (deterministic branch).
- **Playback speed** only changes how many *fixed* steps are consumed per wall-clock second (`framesToSteps`); it never alters Δt, v or any state value (tested: speeds 0.5/1/4 give identical histories).
- Pacing: 60 steps/s at speed 1.

### 10.5 Illustrative parameters (not verified; M6 open)
a = 4.0495e-10 m (Al-like, taken from the YAML but used only as an illustrative number), ν = 0.33, τ_c = 5 MPa, M_d = 1e4 1/(Pa·s), Δt = 2e-13 s, r_c = b. These are chosen only to make motion visible. They are labelled illustrative in the UI and are not material predictions.

### 10.6 Limitations
Continuum field only; no Peierls/atomistic relaxation; free surfaces and image forces ignored (the field is the infinite-body solution); slip-plane position is fixed; a single dislocation; no grain-boundary or pile-up physics; no yield or Hall–Petch inference. The block boundary is a visualization window, not a boundary condition of the elastic solution.

---

## 11. Phase 4 Additions: Grain-Boundary Transmission Core & Criteria

**Status:** Phase 4 milestone (Quality Gate 4). Pure mathematical core in Python (`src/hpsim/core/boundary.py`) and TypeScript (`web/src/core/boundary.ts`), verified with cross-runtime golden parity tests.

### 11.1 Coordinate Transformations and Candidate Systems
For an incoming dislocation on slip system $(\mathbf{s}_{\text{in}}, \mathbf{n}_{\text{in}}, \mathbf{b}_{\text{in}})$ arriving at a boundary between Grain 1 (incoming, rotation $\mathbf{R}_{\text{in}}$) and Grain 2 (outgoing candidate grain, rotation $\mathbf{R}_{\text{out}}$):
1. Both crystal vectors are transformed into the specimen coordinate frame using the right-handed rotation matrix:
   $$\mathbf{s}_{\text{spec}} = \mathbf{R} \mathbf{s}_{\text{cryst}}, \quad \mathbf{n}_{\text{spec}} = \mathbf{R} \mathbf{n}_{\text{cryst}}$$
2. All 12 FCC candidate slip systems $\{111\}\langle 110\rangle$ in Grain 2 are evaluated systematically in deterministic order (index 0 to 11).

### 11.2 Geometric Compatibility Metric ($m'$)
Geometric alignment between incoming and candidate outgoing slip systems is computed via the Livingston–Gorczyca compatibility parameter:
$$m' = |\hat{\mathbf{s}}_{\text{in}} \cdot \hat{\mathbf{s}}_{\text{out}}| \, |\hat{\mathbf{n}}_{\text{in}} \cdot \hat{\mathbf{n}}_{\text{out}}|$$
- Rigorously bounded in $[0, 1]$ (clamped to prevent numerical drift beyond $1.0$).
- $m' = 1.0$ for identical orientations with parallel slip planes and directions.
- Criterion: $m' \ge m'_{\min}$ (default illustrative threshold $0.70$).

### 11.3 Residual Burgers Vector Magnitude ($|b_r|$)
To minimize the energy of the residual dislocation left in the boundary interface, the residual Burgers vector magnitude minimizes across relative sign:
$$|b_r| = \min\left(\|\mathbf{b}_{\text{in}} - \mathbf{b}_{\text{out}}\|, \|\mathbf{b}_{\text{in}} + \mathbf{b}_{\text{out}}\|\right)$$
- Sign-invariant under inversion of Burgers vector direction.
- For identical orientations, $|b_r| = 0.0$ when the matching sign is selected.

### 11.4 Outgoing Driving Stress ($\tau_{\text{out}}$)
Computed directly from the full 3D specimen Cauchy stress tensor $\boldsymbol{\sigma}$:
$$\tau_{\text{out}} = |\mathbf{s}_{\text{out}}^T \boldsymbol{\sigma} \mathbf{n}_{\text{out}}|$$
- Criterion: $\tau_{\text{out}} \ge \tau_c$ (driving stress must equal or exceed lattice resistance).

### 11.5 Dislocation Tip Stress Criterion ($\tau_{\text{tip}}$) & Unresolved Calibration
The required boundary penetration resistance stress $\tau^*(m')$ follows the misorientation-dependent heuristic:
$$\tau^*(m') = \tau^*_{\text{ref}} \left[1 + \beta (1 - m')\right]$$
Criterion: $\tau_{\text{tip}} \ge \tau^*(m')$.
- **Strict Parameter Handling:** Material parameter $\tau^*_{\text{ref}}$ is uncalibrated (Decision M6 pending).
- If $\tau^*_{\text{ref}}$ is `None` / `null`, the criterion cannot be physically evaluated without early fabrication of data. In this case, `passed_tau_tip` is set to `null` and the overall outcome is explicitly flagged as `"unresolved_threshold"`.
- A missing threshold produces an explicit configuration state, never an unearned pass or fail.

### 11.6 Deterministic Tie-Breaking
When multiple candidate slip systems in Grain 2 satisfy all transmission criteria, deterministic selection follows the exact hierarchy:
1. **Highest geometric compatibility $m'$** (descending; rounded to 10 decimal digits).
2. **Lowest residual Burgers vector magnitude $|b_r|/b$** (ascending; rounded to 10 decimal digits).
3. **Highest outgoing resolved shear stress $\tau_{\text{out}}$** (descending; rounded to 6 decimal digits / 1 Pa).
4. **Lowest slip system index** (ascending integer index 0..11).

If no candidate meets all criteria, the decision returns `"pinned"` accompanied by numerical reason logs for every candidate.

### 11.7 Parameter Provenance Categorization
| Parameter | Category | Value / Status | Note |
|---|---|---|---|
| $a_{\text{fcc}}$ | Sourced / Literature Reference | $4.0495 \times 10^{-10}\text{ m}$ (Al-like) | In `materials.yaml` |
| $b_{\text{fcc}}$ | Derived Crystallographic | $a/\sqrt{2} \approx 2.8634 \times 10^{-10}\text{ m}$ | Pure geometric derivation |
| $\tau_c$ | Test Illustrative | $5.0\text{ MPa}$ | Demo visibility only |
| $m'_{\min}$ | Test Illustrative | $0.70$ | Demonstration threshold |
| $\tau^*_{\text{ref}}$ | **Unresolved (Decision M6)** | `null` / uncalibrated | Never fabricated or guessed |
| $\beta$ | Test Illustrative | $1.0$ | Misorientation sensitivity demo |
| $\tau_{\text{tip}}$ | Test Illustrative | $80.0\text{ MPa}$ | Dislocation arrival tip stress demo |

### 11.8 Physical Limitations
1. **Columnar Two-Grain Boundary:** Grain boundary plane is modeled under a controlled columnar assumption with vertical normal perpendicular to the columnar growth axis. Real 3D polycrystalline boundaries have arbitrary non-planar curved facets.
2. **No Pile-up Stress Concentration (Phase 5 scope):** $\tau_{\text{tip}}$ is supplied as a controlled test input; multi-dislocation pile-up backstresses and collective pile-up amplification $\tau_{\text{tip}} = n_{\text{pile}} \tau_{\text{eff}}$ are deferred to Phase 5.
3. **No Hall–Petch Sweeps (Phase 6 scope):** Boundary transmission is evaluated on single dislocation arrival events. Grain size sweeps and yield onset determination remain Phase 6 scope.

---

## 12. Discrete Dislocation Pile-Up Engine & Eshelby–Frank–Nabarro (EFN) Benchmark (Phase 5)

### 12.1 Physical Model Scope & Exclusions
The Phase 5 discrete dislocation pile-up engine models a one-dimensional array of identical like-signed edge dislocations gliding on a single slip plane in linear, isotropic elastic medium.
- **Leading Dislocation:** Locked at an immovable, impenetrable planar obstacle (e.g. grain boundary) at position $x = 0$.
- **Mobile Dislocations:** $N - 1$ mobile dislocations glide along the common slip plane at ordered 1D positions $0 < x_1 < x_2 < \dots < x_{N-1}$.
- **Driving Stress:** A uniform, positive resolved shear stress $\tau_{\text{app}}$ drives all mobile dislocations inward (in the $-x$ direction) toward the obstacle at $x = 0$.
- **Model Exclusions:** No dislocation climb, no cross-slip, no thermal fluctuations, no source-generation kinetics (Frank-Read sources), no finite line curvature / 3D bow-out, no anisotropic elasticity, no multiple intersecting slip systems, and no atomistic/molecular-dynamics effects. It is a continuum-elasticity discrete-dislocation model.

### 12.2 Governing Equations & Sign Conventions
For identical edge dislocations of Burgers vector magnitude $b$, shear modulus $\mu$, and Poisson ratio $\nu$, the characteristic isotropic elastic interaction parameter is:
$$A = \frac{\mu b}{2\pi (1 - \nu)} \quad [\text{units: } \text{Pa}\cdot\text{m}]$$

The shear stress exerted at position $x_i$ by another dislocation at position $x_j$ is:
$$\tau_{i \leftarrow j} = \frac{A}{x_i - x_j}$$
- For $x_i > x_j$, $\tau_{i \leftarrow j} > 0$, exerting a repulsive force in the $+x$ direction (pushing dislocation $i$ away from dislocation $j$ and away from the obstacle).
- For $x_i < x_j$, $\tau_{i \leftarrow j} < 0$, repelling dislocation $i$ in the $-x$ direction.
- The external applied shear stress $\tau_{\text{app}} > 0$ drives dislocations in the $-x$ direction toward the obstacle.

The net stress residual $R_i$ on mobile dislocation $i \in \{1, \dots, N-1\}$ is:
$$R_i(x_1, \dots, x_{N-1}) = \frac{A}{x_i} + \sum_{j \neq i, j=1}^{N-1} \frac{A}{x_i - x_j} - \tau_{\text{app}} = 0$$

### 12.3 Eshelby–Frank–Nabarro (EFN 1951) Benchmark
**Primary Reference:**
> J. D. Eshelby, F. C. Frank, and F. R. N. Nabarro, "The equilibrium of linear arrays of dislocations," *Philosophical Magazine*, 42 (1951), pp. 351–364. DOI: [10.1080/14786445108561060](https://doi.org/10.1080/14786445108561060).

EFN proved that the polynomial whose zeros are the equilibrium positions $f(x) = \prod_{k=1}^{N-1} (x - x_k)$ satisfies the differential equation:
$$x f'' + 2(1 - \lambda x) f' + 2 (N - 1) \lambda f = 0, \quad \text{where } \lambda = \frac{\tau_{\text{app}}}{A} = \frac{2\pi(1-\nu)\tau_{\text{app}}}{\mu b}$$

Substituting the dimensionless variable $\xi = 2\lambda x$ transforms this into the defining differential equation for the associated Laguerre polynomial $L_{N-1}^{(1)}(\xi) = 0$:
$$\xi \frac{d^2 L_m^{(1)}}{d\xi^2} + (2 - \xi) \frac{d L_m^{(1)}}{d\xi} + m L_m^{(1)} = 0 \quad (m = N - 1)$$

Therefore, the exact equilibrium positions are:
$$x_0 = 0.0 \quad (\text{locked}), \quad x_k = \frac{\xi_k}{2\lambda} = \frac{\xi_k \mu b}{4\pi(1 - \nu)\tau_{\text{app}}} \quad (k = 1, \dots, N - 1)$$
where $\xi_1 < \xi_2 < \dots < \xi_{N-1}$ are the exact real, positive zeros of $L_{N-1}^{(1)}(\xi)$.

#### Exact Closed-Form Solutions for Small $N$:
- **$N = 2$ (1 locked, 1 mobile):**
  $$L_1^{(1)}(\xi) = 2 - \xi = 0 \implies \xi_1 = 2 \implies x_1 = \frac{A}{\tau_{\text{app}}} = \frac{\mu b}{2\pi(1-\nu)\tau_{\text{app}}}$$
- **$N = 3$ (1 locked, 2 mobile):**
  $$L_2^{(1)}(\xi) = \frac{1}{2}(\xi^2 - 6\xi + 6) = 0 \implies \xi = 3 \pm \sqrt{3}$$
  $$x_1 = \frac{3 - \sqrt{3}}{2\lambda}, \quad x_2 = \frac{3 + \sqrt{3}}{2\lambda}$$

#### Classical Eshelby Tip Stress Theorem:
The total concentrated stress acting on the locked obstacle dislocation at $x=0$ is:
$$\tau_{\text{tip}} = \tau_{\text{app}} + \sum_{k=1}^{N-1} \frac{A}{x_k} = N \tau_{\text{app}}$$
The obstacle experiences an exact stress magnification factor equal to the total dislocation count $N$.

### 12.4 Golub–Welsch Jacobi Matrix Algorithm
To compute the exact Laguerre roots $\xi_k$ unconditionally without numerical search, HPSim implements the Golub–Welsch (1969) algorithm:
The zeros of orthogonal polynomial $L_m^{(1)}(\xi)$ are the eigenvalues of the symmetric tridiagonal Jacobi matrix $T \in \mathbb{R}^{m \times m}$:
- Diagonal: $T_{j, j} = 2j + 2$ for $j = 0, \dots, m-1$.
- Sub/super-diagonal: $T_{j+1, j} = T_{j, j+1} = \sqrt{(j + 1)(j + 2)}$ for $j = 0, \dots, m-2$.

The eigenvalues of $T$ are computed via:
- **Python:** `numpy.linalg.eigvalsh(T)` (LAPACK `dstev`/`dsteqr`).
- **TypeScript:** Pure TypeScript tridiagonal QL algorithm with implicit Wilkinson shift (`tridiagonalEigenvalues`).

The eigenvalues are guaranteed real, strictly positive, and monotonic, matching across runtimes to $< 10^{-13}$.

### 12.5 Asymptotic Continuum vs. Finite-$N$ Discrete Scaling
The classical continuum approximation for the length $L = x_{N-1}$ and count $N$ of a single-ended edge dislocation pile-up is:
$$N_{\text{asymp}} \approx \frac{\pi (1 - \nu) L \tau_{\text{app}}}{\mu b} \iff L_{\text{asymp}} \approx \frac{N \mu b}{\pi (1 - \nu) \tau_{\text{app}}}$$
- **Asymptotic Limitation:** As proven by Szegő (1939), the largest zero of $L_m^{(1)}(\xi)$ scales as:
  $$\frac{\xi_{\max}}{4m} = 1 - O(m^{-2/3})$$
  Because $L = \xi_{\max} / (2\lambda) = \frac{\xi_{\max} A}{2\tau_{\text{app}}}$, the continuum ratio $N_{\text{asymp}} / N = \xi_{\max} / (4N)$ converges to $1.0$ only asymptotically as $N \to \infty$:
  - $N = 3$: ratio $\approx 0.394$ (finite-size discrete boundary).
  - $N = 10$: ratio $\approx 0.703$.
  - $N = 30$: ratio $\approx 0.852$.
  - $N = 100$: ratio $\approx 0.923$.
- **Scientific Rule:** The continuum approximation must never be treated as exact for small $N$; discrete positions must be obtained from the exact polynomial roots.

### 12.6 Numerical Solver, Line Search & Convergence States
In addition to the analytical Golub–Welsch solver, HPSim provides a damped Newton-Raphson relaxation solver to verify force-balance conditioning:
- **Jacobian Matrix:** $J_{ik} = \partial R_i / \partial x_k$.
  $$J_{ii} = -\frac{A}{x_i^2} - \sum_{j \neq i} \frac{A}{(x_i - x_j)^2}, \quad J_{ik} = -\frac{A}{(x_i - x_k)^2} \quad (k \neq i)$$
  The Jacobian is symmetric, negative-definite, and strictly diagonally dominant everywhere in the physical domain $0 < x_1 < \dots < x_{N-1}$.
- **Order-Preserving Line Search:** Damping parameter $\alpha \in (0, 1]$ is reduced by factor $0.5$ until the trial step $x_{\text{trial}} = x + \alpha \Delta x$ preserves strict physical order ($0 < x_1 < \dots < x_{N-1}$) and decreases the residual norm.
- **Convergence / Failure Status States:**
  - `"converged"`: Max residual $\max_i |R_i| \le \text{tolerance\_pa}$.
  - `"max_iterations_exceeded"`: Iteration budget reached without meeting tolerance.
  - `"invalid_input"`: Physical parameter out of bounds ($\mu \le 0, \nu \notin (-1, 0.5), b \le 0, \tau_{\text{app}} \le 0, N < 2$).
  - `"numerical_failure"`: Singular Jacobian matrix encountered.

### 12.7 Cross-Runtime Parity & Provenance
| Case | Dislocation Count $N$ | Material | Applied Stress $\tau_{\text{app}}$ | Python / TypeScript Position Parity | Max Force Residual |
|---|---|---|---|---|---|
| Case 1 | $N=3$ | Al ($\mu=26\text{ GPa}, \nu=0.33, b=0.286\text{ nm}$) | $50\text{ MPa}$ | $< 10^{-14}\text{ m}$ (exact match) | $1.49 \times 10^{-8}\text{ Pa}$ |
| Case 2 | $N=8$ | Al ($\mu=26\text{ GPa}, \nu=0.33, b=0.286\text{ nm}$) | $45\text{ MPa}$ | $< 10^{-13}\text{ m}$ | $2.16 \times 10^{-7}\text{ Pa}$ |
| Case 3 | $N=15$ | Cu ($\mu=48\text{ GPa}, \nu=0.34, b=0.256\text{ nm}$) | $60\text{ MPa}$ | $< 10^{-12}\text{ m}$ | $9.83 \times 10^{-7}\text{ Pa}$ |
| Case 4 | $N=25$ | Al ($\mu=26\text{ GPa}, \nu=0.33, b=0.286\text{ nm}$) | $120\text{ MPa}$ | $< 10^{-12}\text{ m}$ | $3.80 \times 10^{-6}\text{ Pa}$ |
| Case 5 | $N=4$ | Al, perturbed $+5\%$ | $50\text{ MPa}$ | Bit-for-bit status (`max_iterations_exceeded`) | $2.38 \times 10^{6}\text{ Pa}$ |

---

## 13. Emergent Hall–Petch Derivation, Source Shut-Off & Boundary Calibration (Phase 6)

### 13.1 Quasi-Static Source Shut-Off at $x = L = d / 2$
In a grain of diameter $d$, a dislocation source at the grain center ($x = L = d / 2$) emits identical like-signed edge dislocations toward the leading obstacle at $x = 0$ under an effective resolved shear stress $\tau_{\text{eff}} = \tau_{\text{app}} - \tau_c > 0$.

Starting from $N = 1$ (a single leader dislocation pinned at $x_0 = 0$), mobile dislocations are added one by one while the net shear stress at the source exceeds the source operation stress $\tau_{\text{src}}$ (default $0.0\text{ Pa}$):
$$\tau_{\text{eff}} - \tau_{\text{back}}(L; N) > \tau_{\text{src}}, \quad \text{where } \tau_{\text{back}}(L; N) = \sum_{j=0}^{N-1} \frac{A}{L - x_j}, \quad A = \frac{\mu b}{2\pi (1 - \nu)}$$
and all $N + 1$ equilibrium positions satisfy $x_j < L$.

Once source emission shuts off at equilibrium count $N(L, \tau_{\text{eff}})$, the concentrated tip shear stress acting on the leading dislocation at $x = 0$ is given by Eshelby's theorem:
$$\tau_{\text{tip}}(L, \tau_{\text{eff}}) = N(L, \tau_{\text{eff}}) \, \tau_{\text{eff}}$$

### 13.2 Boundary Obstacle Threshold & Yield Onset Bisection
The critical shear stress required for slip transmission across the grain boundary follows the Lee–Robertson–Birnbaum compatibility relation:
$$\tau^*(m') = \tau^*_{\text{ref}} \left[ 1 + \beta (1 - m') \right]$$
where $\tau^*_{\text{ref}} > 0$ is the single calibrated material barrier parameter, $m' \in [0, 1]$ is the LRB geometric compatibility factor, and $\beta \ge 0$ (default $\beta = 0.0$ per `spec.md` §5.7) controls misorientation sensitivity.

For a grain of size $d$ ($L = d / 2$), the critical effective shear stress $\tau_{\text{eff,crit}}(d)$ is determined via 60-step bisection as the smallest $\tau_{\text{eff}} > 0$ such that:
$$\tau_{\text{tip}}(L = d / 2, \tau_{\text{eff}}) \ge \tau^*(m')$$
The emergent macroscopic polycrystal yield stress is then:
$$\sigma_y(d) = \sigma_0 + M_T \, \tau_{\text{eff,crit}}(d)$$
where $\sigma_0$ is the lattice friction stress ($\sigma_0 = M_T \tau_c$ or the specimen's experimental friction stress intercept) and $M_T$ is the Taylor orientation factor ($3.06$ for FCC, $2.75$ for BCC).

### 13.3 Continuum Eshelby–Frank–Nabarro Scaling vs. Discrete Step Plateaus
In the continuum limit ($N \to \infty$), substituting $N_{\text{asymp}}(L = d / 2, \tau_{\text{eff}}) = \frac{\pi (1 - \nu) d \, \tau_{\text{eff}}}{2 \mu b}$ into $\tau_{\text{tip}} = N \tau_{\text{eff}} = \tau^*$ yields the classical analytic Hall–Petch relation:
$$\tau_{\text{eff,crit,cont}}(d) = \left[ \frac{2 \mu b \tau^*}{\pi (1 - \nu)} \right]^{1/2} d^{-1/2}, \quad k_{y,\text{analytic}} = M_T \left[ \frac{2 \mu b \tau^*}{\pi (1 - \nu)} \right]^{1/2}$$
- **Log–Log Exponent (`V-09`):** A linear regression of $\log_{10}(\tau_{\text{eff,crit}})$ against $\log_{10}(d)$ over $\ge 1.5$ decades of grain size recovers the theoretical $-0.5$ power-law exponent within $\pm 0.05$.
- **Discrete Integer-$N$ Step Plateaus (`V-10`):** Because the physical dislocation count $N \in \mathbb{Z}^+$ is an integer, $\tau_{\text{eff,crit}}(d)$ exhibits discrete quantization steps of width $\Delta \tau_{\text{plateau}} = \tau^* / N_{\text{crit}} - \tau^* / (N_{\text{crit}} + 1)$, and the discrete fitted slope $k_y$ agrees with $k_{y,\text{analytic}}$ within $15\%$ across the multi-dislocation pile-up regime.



