# Specification Delta: `app`

**Change ID:** `hpsim-static-hosting`  
**Capability:** `app`

---

## MODIFIED Requirements

### App Framework and Runtime
- **WAS:** Monolithic Streamlit Python application running on a Python web server or Streamlit Community Cloud.
- **NOW:** Static single-page application built with React 18+, TypeScript, and Vite. Executes entirely client-side in standard web browsers.

### 3D Lattice Visualizer
- **WAS:** Plotly `Scatter3d` embedded in Streamlit with native orbit/pan/zoom.
- **NOW:** Three.js WebGL canvas utilizing `THREE.InstancedMesh` for rendering up to 4,000+ lattice atoms with single draw-call performance at 60 FPS, paired with `OrbitControls` for camera interactions (front, top, side, isometric, reset).

### Data and State Synchronization
- **WAS:** Streamlit server session state caching with Python object persistence.
- **NOW:** Unidirectional React state machine (`useReducer`) updating purely in browser memory, reading versioned static JSON fixtures from `public/data/`.

---

## ADDED Requirements

### Base-Path Awareness
- Web application routes and static asset loaders must resolve relative to `BASE_URL` to allow hosting at root (`/` on Vercel) or repository subpath (`/<repo-name>/` on GitHub Pages).

### Local Client-Side File Import
- Users may import custom micrograph analysis JSON or CSV chord files via local drag-and-drop into browser memory without uploading to a remote server.

### Scientific Honesty Drawer / Modal
- Dedicated "Model, Assumptions & Limitations" modal visible from all views, explicitly documenting:
  1. Continuum displacement field visualization vs. Molecular Dynamics.
  2. Provenance of loaded material parameters (`sourced`, `calibrated`, `illustrative`, `needs_citation`).
  3. Distinction between synthetic Voronoi demonstrations and real micrograph-derived distributions.
