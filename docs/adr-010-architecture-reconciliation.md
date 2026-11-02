# ADR-010: Reconciliation of Web Application Architecture (Streamlit to React / Vite Static App)

**Date:** 2026-10-29  
**Status:** **ACCEPTED**  
**Context:**  
Early project planning in `spec.md` (lines 5, 298–315) outlined a Python-based interactive interface using `Streamlit` with `Plotly` and `PyVista`. During architectural refinement and implementation in Phases 1–7 (documented in `openspec/changes/hpsim-static-hosting/`), the system was migrated to a zero-backend, fully client-side static web application built with **React 19**, **Three.js**, and **Vite**, written in **TypeScript**.

### Motivation for Architecture Reconciliation
1. **Zero-Backend Serverless Portability:** A pure static frontend allows deployment on GitHub Pages, Vercel, Netlify, or local static web servers without requiring dedicated Python runtime servers, container infrastructure, or websocket session state.
2. **Deterministic Browser Parity:** Dislocation mechanics, crystallography rotations, and emergent Hall-Petch solvers were implemented as twin engines in Python (`src/hpsim/core/`) and TypeScript (`web/src/core/`), verified by automated golden fixtures (`tests/golden/`).
3. **Interactive 3D Performance:** Three.js with WebGL provides client-side hardware-accelerated rendering of FCC/BCC lattices, Burgers circuits, and dislocation cores at 60 FPS directly in the browser canvas.

### Decision & Specification Alignment
1. **Active Implementation Truth:** The authoritative user interface is the **React/TypeScript/Vite** web application located in `web/` (`web/src/ui/App.tsx`, `web/src/core/`).
2. **Preservation of `spec.md`:** Per project guidelines, root `spec.md` is preserved as the historical foundational specification. This ADR-010 formally records the architectural supersession of the Streamlit UI sections (§8.1–§8.5) by the React static web application.
3. **Static Hosting Guarantee:** The application shall remain 100% static, executing all simulations and dynamic fixture hydration in the client browser with zero runtime backend dependency.

