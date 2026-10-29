# System Design: `hpsim-static-hosting`

## 1. Architectural Overview & Context

HPSim is restructured into two distinct, decoupled execution contexts sharing a common mathematical specification:

```text
+-----------------------------------------------------------------------------------+
|                        OFFLINE RESEARCH & VALIDATION (Python)                     |
|                                                                                   |
|  [Raw Micrographs]  --> [OpenCV/scikit-image]  --> [ASTM E112 Line Intercepts]    |
|  [Literature PDFs]  --> [SciPy Reference Solver] -> [Analytical Validation V01-16]|
|                                 |                                                 |
|                                 v (Export Pipeline)                               |
|                  +-----------------------------+                                  |
|                  | Precomputed JSON Fixtures   |                                  |
|                  | - materials.json            |                                  |
|                  | - validation_curves.json    |                                  |
|                  | - sample_micrographs.json   |                                  |
|                  | - presets/*.json            |                                  |
|                  +-----------------------------+                                  |
+---------------------------------|-------------------------------------------------+
                                  | (Committed to repo / static bundle)
                                  v
+-----------------------------------------------------------------------------------+
|                    BROWSER INTERACTIVE RUNTIME (TypeScript / Vite)                |
|                                                                                   |
|  web/public/data/ <-------------- Static HTTP Fetch (First Load Only)             |
|         |                                                                         |
|         v                                                                         |
|  +--------------------+       +---------------------------------------------+     |
|  | Typed Data Loaders | ----> | React UI State Machine (Sliders / Controls) |     |
|  +--------------------+       +---------------------------------------------+     |
|                                              |                                    |
|                                              v                                    |
|                               +------------------------------+                    |
|                               | Pure TypeScript Physics Core |                    |
|                               | - Lattice & Slip Systems     |                    |
|                               | - RSS & Glide Kinematics     |                    |
|                               | - Regularized Displacement   |                    |
|                               | - Boundary Transmission      |                    |
|                               | - Discrete Pile-Up Solver    |                    |
|                               +------------------------------+                    |
|                                              |                                    |
|                     +------------------------+------------------------+           |
|                     |                                                 |           |
|                     v                                                 v           |
|        +-------------------------+                       +----------------------+ |
|        | Three.js 3D Viewport    |                       | Responsive 2D Charts | |
|        | - InstancedMesh Atoms   |                       | - Emergent HP curves | |
|        | - Slip plane & vectors  |                       | - Discrete pile-up   | |
|        | - OrbitControls 60 FPS  |                       | - SVG / Canvas plots | |
|        +-------------------------+                       +----------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 2. Browser Application Design (`web/`)

### 2.1 Technology Stack
- **Framework:** React 18+ with TypeScript (Strict mode enabled).
- **Build Tool:** Vite 5+ (fast HMR, lightweight ES-module production bundling).
- **3D Graphics:** Three.js (vanilla or lightweight React wrapper) using `THREE.InstancedMesh` for rendering thousands of lattice atoms with single draw-call efficiency.
- **Controls:** `OrbitControls` for smooth rotation, panning, zooming, and preset camera perspectives (front, top, side, isometric).
- **2D Visualizations:** Custom SVG or lightweight Canvas charts for dislocation pile-up distributions and σ_y vs d^(−1/2) Hall–Petch curves.
- **State Management:** Pure React state hooks (`useReducer` / context) decoupled from physics calculations. Physics functions take plain parameter objects and return immutable state snapshots.

### 2.2 Directory Layout within `web/`
```text
web/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   ├── favicon.svg
│   └── data/
│       ├── materials.json
│       ├── presets/
│       │   ├── copper_single_glide.json
│       │   ├── steel_boundary_transmit.json
│       │   └── aluminium_pileup_hp.json
│       ├── validation/
│       │   └── reference_curves.json
│       └── micrographs/
│           ├── sample_ferrite.json
│           └── sample_copper.json
├── src/
│   ├── index.css
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   └── Layout.tsx
│   ├── core/                        # PURE TYPESCRIPT PHYSICS ENGINE
│   │   ├── types.ts
│   │   ├── units.ts
│   │   ├── vectors.ts
│   │   ├── rotations.ts
│   │   ├── slipsystems.ts
│   │   ├── stress.ts
│   │   ├── glide.ts
│   │   ├── fields.ts
│   │   ├── transmission.ts
│   │   ├── pileup.ts                # 1D discrete pile-up root solver
│   │   └── hallpetch.ts             # yield onset bisection & HP fit
│   ├── scene3d/                     # THREE.JS RENDERING ENGINE
│   │   ├── LatticeScene.ts
│   │   ├── InstancedAtoms.ts        # THREE.InstancedMesh
│   │   ├── Overlays.ts              # Slip planes, Burgers vectors, line traces
│   │   └── CameraControls.ts
│   ├── charts/                      # 2D CHARTS & MICROGRAPH OVERLAY
│   │   ├── HallPetchChart.tsx
│   │   ├── PileUpChart.tsx
│   │   └── MicrographView.tsx
│   ├── components/                  # UI CONTROLS & PANELS
│   │   ├── ControlPanel.tsx
│   │   ├── TimelineSlider.tsx
│   │   ├── EventLog.tsx
│   │   ├── AboutModal.tsx
│   │   └── DataImport.tsx
│   └── data/
│       └── loaders.ts               # Base-aware JSON loaders
└── tests/                           # VITEST SUITE
    ├── unit/
    └── parity/                      # V-17 Cross-language parity tests
```

---

## 3. Base-Path Resolution Mechanism

To enable seamless deployment to both Vercel (`https://<project>.vercel.app/` -> root `/`) and GitHub Pages (`https://<user>.github.io/<repo>/` -> subpath `/<repo>/`), all asset resolution must be base-path aware.

### 3.1 Vite Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
});
```

### 3.2 Runtime URL Resolution (`loaders.ts`)
Asset fetches and public data URLs will use Vite's `import.meta.env.BASE_URL`:
```typescript
export function getAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const cleanPath = relativePath.replace(/^\//, '');
  return `${base}/${cleanPath}`;
}
```

---

## 4. Cross-Language Scientific Parity Verification (V-17)

To ensure that the TypeScript browser engine reproduces the Python reference calculations exactly:

1. **Golden Test Fixture Generator (`scripts/export_golden_fixtures.py`):**
   - Python script calculates ground-truth values for:
     - 12 FCC and 12 BCC slip system normals and directions.
     - Resolved shear stresses under standard and random stress tensors.
     - Edge and screw displacement vectors across a 2D regular grid.
     - Swept-boundary collision distances.
     - Equilibrium positions and tip stress for discrete pile-ups with N = 2, 5, 10, 25, 50, 100.
     - Yield onset stresses and fitted k_y values across synthetic grain sizes.
   - Outputs serialized test vectors to `tests/golden/fixtures/parity_cases.json`.

2. **TypeScript Parity Test Runner (`web/tests/parity/cross_language.test.ts`):**
   - Vitest imports `parity_cases.json`.
   - Runs TypeScript functions against the same test cases.
   - Asserts numeric equality within declared tolerances:
     - Tensor and geometric quantities: relative error < 1e-12.
     - Core regularized displacements: relative error < 1e-9.
     - Discrete pile-up positions and tip stresses: relative error < 1e-5 (accounting for float64 solver convergence differences between SciPy and client numerical routines).

---

## 5. Security, Privacy, and Data Governance

1. **No External APIs at Runtime:**
   - The application does not contact OpenAlex, Crossref, GitHub, or any third-party telemetry at runtime.
2. **Local Client-Side Storage Only:**
   - Uploaded user micrographs or custom CSV/JSON files are parsed in browser memory via the HTML5 File API and `FileReader`. Zero data leaves the client machine.
3. **Licensing & Bundled Assets:**
   - Public build only includes open-access assets (e.g. Takada 2008 ISIJ iron dataset cited and permitted).
   - High-resolution local research micrographs (such as the 9.5 MB copper scan) remain in local development folders and are not committed into `web/public/` to prevent repository and bundle bloat.
