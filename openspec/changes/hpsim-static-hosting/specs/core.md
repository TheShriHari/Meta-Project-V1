# Specification Delta: `core`

**Change ID:** `hpsim-static-hosting`  
**Capability:** `core`

---

## MODIFIED Requirements

### Dual Language Implementation
- **WAS:** Python-only physics core in `src/hpsim/core/`.
- **NOW:** Core analytical models exist in both:
  1. Python reference package (`src/hpsim/core/`): Ground-truth implementation used for offline batch analysis, literature benchmarking, and analytical validation.
  2. Pure TypeScript module (`web/src/core/`): Client-side deterministic implementation used for interactive real-time simulation in the web browser.
- **Rules:** Both implementations must use identical variable conventions, SI units, and governing equations. Neither implementation may import UI or rendering libraries.

---

## ADDED Requirements

### Cross-Language Numerical Parity (V-17)
- CI test harness must verify that TypeScript physics functions reproduce Python reference values across standardized test fixtures (`parity_cases.json`):
  - Geometric transformations and resolved shear stress: relative error < 1e-12.
  - Core regularized displacements: relative error < 1e-9.
  - Discrete pile-up equilibrium positions and tip stresses: relative error < 1e-5.
- Discrepancies between implementations must trigger code remediation rather than tolerance loosening.
