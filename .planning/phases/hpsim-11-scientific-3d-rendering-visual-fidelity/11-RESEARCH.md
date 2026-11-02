# Phase 11 Research: Scientific 3D Rendering & Visual Fidelity

**Target Codebase:** `web/src/render/*`, `web/src/model/*`, `web/src/core/*`, `web/src/ui/chapters/*`  
**Three.js Version:** `^0.186.1` (with `@types/three: ^0.186.0`)  
**Units & Conventions:** Scene units = 1.0 nm ($10^{-9}\text{ m}$). Z-up orientation ($[001]_{\text{crystal}} = +Z$).

---

## 1. Executive Summary & Rendering Capability Matrix

| Feature / Element | Current State (Pre-Phase 11) | Identified Limitations | Target State (Phase 11 Implementation) |
| :--- | :--- | :--- | :--- |
| **Atom Geometry** | `SphereGeometry(radius, 14, 10)` | Low polygonal tessellation (14x10 segments) appears facetted, capsule-shaped, and distorted from shallow viewing angles. | High-fidelity `SphereGeometry(radius, 32, 24)` with strict uniform scaling `(1, 1, 1)` and zero shear distortion. Atom centres accurately match Volterra displacement. |
| **Ghost Lattice** | Not present | Displaced lattice looks like an isolated distorted cluster with no visual reference for original atomic equilibrium positions. | Static secondary `InstancedMesh` of faint white spheres (12-14% opacity, `depthWrite: false`) representing undisplaced ideal crystal lattice $\mathbf{R}_i^0$. |
| **Color Coding** | Binary blue (`#5ec8ff`) vs orange (`#ffb35e`) across slip plane | Gives false impression of a bi-material junction rather than a single homogeneous FCC single crystal. | Unified metallic gold palette: Grain 1 (`#D4A843`), Grain 2 (`#B8912E`), with dynamic cyan-white (`#e0f2fe` → `#38bdf8`) gradient indicating displacement magnitude $\|\mathbf{u}_i\|$. |
| **Grain Boundary** | Thin amber plane (`0xf59e0b`, opacity 0.22) with basic wireframe | Looks like an artificial divider or line; lacks depth and clarity as a physical interface. | Translucent indigo 3D interface (`0x818cf8`, opacity 0.12, `DoubleSide`, `depthWrite: false`) with bright violet-white border (`0xc7d2fe`). Rendered ONLY when physical boundary exists (e.g. Ch 2, not Ch 1). |
| **Slip Plane** | Purple quad (`0x7c5cff`, opacity 0.18) | Can visually clash with grain boundary; needs distinct crystallographic presentation. | Translucent warm amber plane (`0xf59e0b`, opacity 0.14) with distinct boundary lines matching $[\mathbf{s}, \boldsymbol{\xi}, \mathbf{n}]$ basis. |
| **Burgers Vector** | `ArrowHelper` (`0xff9f1c`) | Often disabled in Chapter 1 default layers; lacks world-space crystallographic annotation. | Prominent amber arrow at dislocation core along true slip direction $\mathbf{s}$, scaled for visual clarity, annotated with world-space CSS2D pill `b`. |
| **Annotations** | Static 2D HTML absolute position cards | Disconnected from 3D camera transforms; do not follow dislocation core or boundary during orbit/zoom. | World-space `CSS2DRenderer` pill badges anchored to 3D positions: `Dislocation core (⊥)`, `Grain boundary`, `Slip plane`, and `b`. Fully disposed on teardown. |
| **Lighting & Depth** | Flat ambient (0.8) + single directional (2.2) | Over-illuminated, blown-out highlights, flat shadows, lack of 3D depth perception. | 3-point scientific lighting: ambient/hemisphere fill + warm directional key light + cool secondary fill + subtle rim light for sphere contour definition. |
| **Camera Framing** | Distance $3.4 \times L_x$, tight margins | Atoms can clip viewport edges during orbit; feels cramped. | Distance $4.0 \times L_x$ providing ~15% comfortable breathing room, centered on crystal centroid. |

---

## 2. Scientific & Architectural Invariants

The following physical foundations are frozen and must never be altered:
1. **Volterra Displacement Field**:
   $$u_x = \frac{b}{2\pi} \left[ \theta + \frac{x y}{2(1-\nu) (r^2 + r_c^2)} \right]$$
   $$u_y = -\frac{b}{2\pi} \left[ \frac{1-2\nu}{4(1-\nu)} \ln\left(\frac{r^2 + r_c^2}{r_c^2}\right) + \frac{x^2 - y^2}{4(1-\nu) (r^2 + r_c^2)} \right]$$
2. **Dislocation Kinematics**:
   - Overdamped glide law $v = \frac{M_d}{\mu} (\tau - \tau_c)$.
   - Timestep $\Delta t = 2 \times 10^{-13}\text{ s}$.
3. **Crystallographic Slip Systems & Boundaries**:
   - 12 FCC slip systems $\{111\}\langle 110\rangle$.
   - Grain boundary transmission criteria ($m', |\mathbf{b}_r|, \tau_{\text{out}}, \tau^*(m')$).
4. **Coordinate Frames**:
   - SI metres ($m$) in all physics modules.
   - Nanometres ($10^9\text{ nm/m}$) in Three.js scene coordinates with Z-up ($[001] = +Z$).
   - Dual array architecture: `demo.ideal` (frozen ideal positions) vs `viewer.renderPositions` (displaced positions).

---

## 3. Subagent Work Distribution

To satisfy strict phase isolation and prevent file collision:
- **Agent A (Read Only)**: Rendering & Geometry Audit (Completed).
- **Agent B (Implementation)**: `web/src/render/atomMesh.ts` — Implements `AtomMeshManager` for perfect spherical atoms, ghost reference lattice, gold material palette, and dynamic displacement-magnitude color mapping.
- **Agent C (Implementation)**: `web/src/render/annotations.ts` and `web/src/render/boundaryMesh.ts` — Implements CSS2D world-space annotations, translucent indigo grain-boundary plane, distinct slip plane styling, and Burgers vector helper.
- **Coordinator**: Integrates helper modules into `web/src/render/viewer.ts` and `web/src/render/camera.ts`, ensures Chapter 1-4 and Research Mode work seamlessly, runs test ladder, captures screenshots, and closes Phase 11.
- **Agent D (Read Only)**: Inspects visual fidelity, lighting, camera framing, performance, and regression checks.

