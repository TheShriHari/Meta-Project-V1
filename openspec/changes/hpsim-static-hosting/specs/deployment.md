# Specification Delta: `deployment`

**Change ID:** `hpsim-static-hosting`  
**Capability:** `deployment`

---

## ADDED Requirements

### Static Hosting Portability
- **Primary Target:** Vercel Static Deployment (configured via `vercel.json` or zero-config Vite preset).
- **Secondary Target:** GitHub Pages Static Hosting via GitHub Actions workflow (`.github/workflows/deploy-pages.yml`).
- No serverless functions, background workers, databases, or runtime backend processes shall be deployed.

### Single Variable Base-Path Configuration
- Vite build must resolve all asset paths, script imports, and data URLs using `import.meta.env.BASE_URL`, configured at build time via `VITE_BASE_PATH`:
  - Vercel: `VITE_BASE_PATH=/`
  - GitHub Pages: `VITE_BASE_PATH=/<repo-name>/`

### Static Host Smoke Test (V-18)
- Automated Playwright smoke test must run against the generated `dist/` directory, verifying:
  1. `index.html` loads without console errors or 404s.
  2. 3D WebGL context initializes and renders atom instanced meshes.
  3. Static JSON data fixtures load and populate the UI controls.
  4. Both root (`/`) and subpath (`/hpsim/`) simulated base paths function correctly.

---

## REMOVED Requirements

### Streamlit Community Cloud Deployment
- Removed dependency on Streamlit Community Cloud and associated Python server container runtime.
