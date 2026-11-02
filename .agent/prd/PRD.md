# HPSim Final Submission Readiness — Product Requirements Document (PRD)

## 1. Objective
Deliver a submission-ready, scientifically faithful, four-chapter interactive learning experience for a first-year materials science student studying dislocations, grain boundaries, dislocation pile-ups, and Hall–Petch strengthening.

## 2. Key Chapters & Architecture
- **Chapter 1: The Defect** — Single-crystal FCC lattice, extra half-plane of atoms ending at dislocation line, Burgers vector $b$, slow-motion glide under shear stress, textbook Dislocation View.
- **Chapter 2: The Wall** — Two-grain orientation interface with translucent indigo grain boundary, variable misalignment angle $\theta \in [0^\circ, 90^\circ]$, Lee–Robertson–Birnbaum geometric compatibility ($m' \ge m'_{\min}$) and resolved shear stress transmission vs pinning.
- **Chapter 3: More Walls, More Strength** — Equiaxed non-overlapping polycrystalline Voronoi mosaic, monotonic physical grain size scaling (10 to 300 μm), interactive prediction feedback honoring both fine and coarse grain mechanics, vertical yield strength meter, and no stale Chapter 2 messages.
- **Chapter 4: The Pattern Has a Name** — Term-by-term Hall–Petch equation reveal ($\sigma_y = \sigma_0 + k_y d^{-1/2}$), student-generated scatter plot from recorded Chapter 3 experiments overlaid on calibrated theory curve, extrapolative prediction challenge, and gateway to Research Mode.
- **Global & Cross-Cutting** — Shared navigation, non-overlapping responsive layout (narration strip, controls, scene badges, experiment log drawer), zero camera resetting on simulation actions, 100% preservation of verified physics core.

## 3. Subagent Ownership
- **Coordinator**: Shared interfaces (`learningTypes.ts`, `learningState.ts`), global CSS (`styles.css`), viewer camera pose management (`camera.ts`, `viewer.ts`), and final integration.
- **Agent A**: `web/src/ui/chapters/Chapter1Defect.tsx`, `web/src/render/extraHalfPlane.ts`.
- **Agent B**: `web/src/ui/chapters/Chapter2Wall.tsx`, `web/src/render/boundaryMesh.ts`.
- **Agent C**: `web/src/ui/chapters/Chapter3Strength.tsx`.
- **Agent D**: `web/src/ui/chapters/Chapter4Equation.tsx`.
- **Agent E**: Playwright MCP student journey test suite, mobile/desktop viewports, regression verification.

