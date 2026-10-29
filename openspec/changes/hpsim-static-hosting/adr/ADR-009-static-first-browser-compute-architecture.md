# ADR-009: Static-First Browser-Compute Architecture for Zero-Server Deployment

**Status:** Approved in Principle / Accepted for Phase 1 Planning  
**Date:** 2026-10-20  
**Deciders:** User & Antigravity  
**Supersedes:** ADR-001 (Python core instead of TypeScript/Three.js core) and ADR-002 (Plotly for interactive 3D in Streamlit)

---

## 1. Context

The original specification (`spec.md` v2.0) specified a Python-only core with a Streamlit UI (ADR-001) and Plotly for 3D visualization (ADR-002).

However, hosting requirements dictate that the simulator must be publicly deployable without managing or paying for an always-running server. The deployment targets are **Vercel** (primary static hosting) and **GitHub Pages** (portable static hosting).

Key hosting constraints:
1. **GitHub Pages** serves static HTML, CSS, JavaScript, and asset files only. It cannot execute server-side Python (Streamlit or Flask/FastAPI).
2. **Vercel** excels at hosting static frontend builds (Vite/Next.js). While Vercel provides a serverless Python runtime, serverless functions impose cold-start delays, memory limitations, maximum execution duration caps (10s on hobby tiers), and state synchronization challenges, violating the requirement for smooth 60 FPS slider interactions.
3. **Streamlit Community Cloud** is prone to container sleep/spin-up delays, resource limits, and external service lock-in, and does not provide an embeddable zero-server static build.
4. Browser runtime performance in modern JavaScript/TypeScript engines (V8, JavaScriptCore) is more than sufficient to compute single-dislocation glide kinematics and solve 1D pile-up force balance systems (N ≤ 300) in under 10–50 ms.

---

## 2. Decision

We adopt a **static-first, browser-compute architecture**:

1. **Frontend / Web Runtime (`web/`):**
   - **Framework:** React 18+ with TypeScript and Vite.
   - **3D Engine:** Three.js with `InstancedMesh` for rendering atom lattices (up to 4,000+ atoms) and `OrbitControls` for camera manipulation.
   - **Interactive Physics Engine:** A dedicated, pure-function TypeScript module (`web/src/core/`) implementing slip systems, resolved shear stress, 3D regularized continuum displacement fields, glide kinematics, boundary transmission criteria, and discrete 1D pile-up equilibrium.
   - **Data Layer:** Precomputed, openly licensed material parameters, validation datasets, and sample micrograph statistics are served as static JSON fixtures from `web/public/data/`. User-supplied files are processed entirely in the browser memory (no server upload).

2. **Offline Python Scientific Toolchain (`src/hpsim/`):**
   - Python 3.11+ is retained strictly for **offline research, data curation, image segmentation, batch parameter sweeps, and ground-truth analytical reference calculations**.
   - Offline tasks include: OpenCV/scikit-image micrograph segmentation, ASTM E112 intercept calculations, batch parameter sweeps, and generation of static JSON fixtures for the web application.

3. **Cross-Language Scientific Parity:**
   - Numerical parity tests (V-17) are added to the test suite to verify that the TypeScript physics engine produces results identical to the Python reference implementation within declared tolerances.
   - Discrepancies between Python and TypeScript must be investigated and documented; tolerances must never be loosened to force parity.

---

## 3. Consequences

### Positive:
- **Zero Server Maintenance & Cost:** Deployable to any static host (Vercel, GitHub Pages, Cloudflare Pages, Netlify, or local static file server) with zero ongoing hosting costs or container management.
- **Immediate Interactivity:** Instant load time and 60 FPS client-side rendering with no WebSocket latency or server round-trips.
- **Enhanced 3D Experience:** Three.js `InstancedMesh` provides significantly better performance, lighting, and interactivity than Plotly `Scatter3d` inside Streamlit.
- **Privacy & Security:** Micrographs and user data never leave the user's browser. No backend endpoints, databases, credentials, or API keys are required.
- **Reproducibility:** Static assets and deterministic algorithms guarantee consistent behavior across clients.

### Negative & Mitigations:
- **Dual Implementation of Math Kernels:** The core physics equations exist in both Python (reference) and TypeScript (client).
  - *Mitigation:* Strict cross-language parity test fixtures (`tests/golden/fixtures/`) verified in CI to ensure zero drift.
- **Micrograph Segmentation in Browser:** Computer vision pipelines (watershed, CLAHE, ridge detection) are complex to port to client-side JS.
  - *Mitigation:* Keep heavy CV in Python for v1. Ship preprocessed, verified micrograph datasets as static JSON fixtures; accept client-side JSON/CSV chord imports for custom data. Interactive browser-based CV is relegated to a future phase.

---

## 4. Alternatives Considered and Rejected

1. **Pyodide / WebAssembly in Browser:**
   - *Description:* Compile Python runtime and NumPy/SciPy into WebAssembly to run Python directly in the browser.
   - *Why Rejected:* Pyodide requires downloading a 30–50 MB WebAssembly payload and Python wheel bundle, causing 5–15 second startup delays on typical network connections. It creates complex debugging hurdles for WebGL integration. Pure TypeScript is instantaneous, type-safe, and weighs < 500 KB.
2. **Vercel Serverless Python Functions:**
   - *Description:* Host a static React frontend on Vercel with Python serverless functions handling the physics calculations.
   - *Why Rejected:* Introduces runtime latency for every slider change, subjects the app to serverless timeout and memory limits, requires network connectivity, and breaks zero-server portability to GitHub Pages.
3. **Streamlit Community Cloud:**
   - *Description:* Keep Streamlit and deploy to Streamlit Community Cloud.
   - *Why Rejected:* Community Cloud apps go to sleep after inactivity, have noticeable cold-boot latencies, cannot be embedded seamlessly into static portfolios or GitHub Pages, and depend on a proprietary hosted container service.
