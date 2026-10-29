# OpenSpec Change Proposal: `hpsim-static-hosting`

**Change ID:** `hpsim-static-hosting`  
**Status:** Approved in Principle / Accepted for Phase 1 Planning (Date: 2026-10-20)  
**Supersedes:** Streamlit-based deployment and monolithic Python runtime constraints from `spec.md` v2.0 (§0, §4.1 FR-13, §7.2 ADR-001/002, §8, §10)

---

## 1. Formal Decision Record (User Authorization — 2026-10-20)

The following explicit user decisions were recorded on 2026-10-20:

1. **M3 — Grain-Size Sweep:**  
   *Status: Approved for Controlled Sensitivity Studies Only.*  
   Rescaling one measured micrograph (FR-10) is approved solely for parametric sensitivity studies. Rescaling does not create new experimental data and must never be described as independent experimental validation.
2. **M4 — Copper Twin Boundaries:**  
   *Status: Approved.*  
   Annealing twin boundaries are excluded from the mean-intercept grain-size measurement $d$ for copper, in accordance with ASTM E112 and Hansen & Ralph (1982). Documentation must reflect that segmentation sensitivity may affect the result.
3. **M5 — Steel Phase Policy:**  
   *Status: Approved.*  
   Analyze ferrite grains only; pearlite and cementite/carbides are masked when reliably distinguishable. Any uncertain segmentation must be flagged for human review rather than silently classified.
4. **M6 — Material Parameters:**  
   *Status: OPEN / NOT APPROVED YET.*  
   Source verification continues. Missing or disputed parameter values (such as ferritic steel CRSS $\tau_c$) must remain marked as `needs_citation`/`TODO` or explicitly unresolved. They must not be treated as evidence-backed sourced presets.
5. **Hosting Architecture (ADR-009):**  
   *Status: Approved in Principle for Phase 1 Planning.*  
   React + TypeScript + Vite + Three.js is approved for the public static web presentation, with Python retained for offline research, reference calculations, and micrograph processing. No backend or runtime network calls are required. (Note: No site has been deployed; deployment is out of scope for Phase 1).
6. **Phase 1 Authorization:**  
   *Status: Authorized (Mathematics Kernel Only).*  
   Authorization is granted strictly to plan and implement the Phase 1 pure mathematics kernel (test-first). Phase 2, visual rendering, pile-up solvers, web deployment, and unattended Ralph Loops remain unauthorized.

---

## 2. Context and Problem Statement

The current `spec.md` specifies an interactive scientific simulation tool utilizing Python, Streamlit, and Plotly as the primary user interface. However, the application must be presented and hosted statically without managing a dedicated server, targeting **Vercel** as the primary static hosting platform and **GitHub Pages** as the portable fallback.

Streamlit requires an active, stateful Python server process with continuous WebSocket communication. It cannot be compiled into static HTML/CSS/JS or hosted natively on GitHub Pages. While Vercel supports Python serverless functions, they introduce execution timeouts (10s/60s), cold-start latencies, memory caps, and architectural friction that are unnecessary for an interactive educational and research tool.

Furthermore, the public web demo must run reliably without runtime credentials, external API dependencies, web scraping, or database backends.

---

## 3. Proposed Architectural Transition

To reconcile scientific fidelity with zero-server static deployment, we adopt a **static-first, browser-compute architecture**:

1. **Client-Side Interactive Runtime (`web/`):**
   - Built with **React 18+**, **TypeScript**, and **Vite**.
   - **3D Visualization:** Three.js with instanced mesh rendering (`InstancedMesh`) for atom lattices (supporting up to 4,000+ atoms at 60 FPS) and `OrbitControls` for pan, zoom, and orbit.
   - **Interactive Physics Engine:** Deterministic, pure-function TypeScript implementation of slip-system geometry, single-dislocation glide kinematics, 3D displacement fields (regularized isotropic continuum elasticity), obstacle encounter detection, and discrete pile-up force balance.
   - **Charts:** Native SVG / lightweight charting for live Hall–Petch sweeps and validation curves.
   - **Zero Network Execution:** All default material presets, published validation datasets, and preprocessed micrograph samples are bundled as static JSON fixtures under `web/public/data/`. User-selected data import operates purely in client memory without server uploads.
   - **Micrograph Redistribution Guard:** DoITPoMS CC BY-NC-SA micrographs are strictly retained in offline `data/micrographs/` for local research; they are not bundled into public web assets without explicit licensing.

2. **Offline Python Scientific Reference & Data Toolchain (`src/hpsim/`):**
   - Retained in Python (NumPy, SciPy, scikit-image, OpenCV, pytest).
   - Serves as the **scientific ground truth** and analytical reference oracle.
   - Handles offline computer vision pipelines: micrograph scale calibration, preprocessing, edge detection, watershed segmentation, ASTM E112 intercept analysis, and chord distribution extraction.
   - Executes batch parameter sweeps and produces precomputed golden validation tables (`tests/golden/`).
   - Exports sanitized, openly licensed JSON datasets to `web/public/data/`.

3. **Cross-Language Scientific Parity Verification:**
   - Numerical parity tests comparing TypeScript client-side outputs against Python reference calculations across identical test fixtures within declared tolerances.
   - Python remains the analytical baseline; discrepancies are investigated and resolved, never hidden by loosening tolerances.

---

## 4. Impact Assessment

- **Affected Capabilities:**
   - `app`: Switched from Streamlit to Vite + React + Three.js static web application.
   - `viz`: Three.js replaces Plotly for client-side 3D rendering; PyVista retained for offline high-resolution figure/video exports.
   - `core`: Core equations implemented in pure TypeScript (`web/src/core/`) while preserving Python reference implementation (`src/hpsim/core/`).
   - `micro`: Micrograph segmentation remains offline in Python for v1; web client displays precomputed sample overlays and accepts structured JSON/CSV imports.
   - `deployment`: Added dual-target static deployment pipeline (Vercel static + GitHub Pages Actions workflow) with base-path configuration (`BASE_URL`).

- **Unaffected Elements:**
   - Core continuum dislocation theory, Schmid factor calculations, and discrete pile-up governing equations.
   - ASTM E112 grain-size measurement methodology.
   - Scientific honesty and provenance requirements (no fabricated material constants; explicit `needs_citation` tracking; candidate points marked as synthetic demonstrations).
   - Gated development workflow (EXPLORE → PLAN → VERIFY PLAN → CREATE TESTS → IMPLEMENT → VERIFY → FIX → VERIFY → STOP AT GATE).
