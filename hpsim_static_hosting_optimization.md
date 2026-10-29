# HPSim Static-Hosting Optimization Plan

**Purpose:** Amend the HPSim specification so the finished interactive simulator can be hosted without managing a server, using GitHub Pages or Vercel static hosting.

## 1. Recommended architecture

Use a **static-first, browser-compute architecture**:

- **Frontend:** React + TypeScript + Vite.
- **3D scene:** Three.js (React Three Fiber is optional if its abstraction is genuinely useful); use instanced rendering for atoms and OrbitControls for orbit, pan, and zoom.
- **Interactive runtime physics:** A UI-independent TypeScript module for the browser-run glide, boundary, pile-up, and Hall–Petch calculations. Keep it pure and deterministic.
- **Scientific reference / data preparation:** Python, NumPy/SciPy, scikit-image/OpenCV, pytest and scripts run locally during development, data acquisition, validation, and batch analysis. Python is not required on the deployed host.
- **Charts:** A lightweight browser chart library or SVG for Hall–Petch and validation plots. Avoid shipping heavyweight analysis libraries to the browser without a demonstrated need.
- **Static data:** Versioned JSON/CSV files in `public/data/` for sourced material parameters, permitted published datasets, micrograph-derived examples, presets and precomputed validation curves.
- **No server:** No database, login, API, secret keys, runtime scraping, file persistence or Python server is required for the public demo.

### Why this change is required

GitHub Pages publishes static files and does not support server-side Python. A Streamlit application therefore cannot run directly on GitHub Pages. Vercel can host Vite static sites and also offers serverless functions, including a Python runtime, but functions introduce deployment/runtime limits and are unnecessary for the initial simulator. The app should not depend on those functions.

References:
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Python runtime: https://vercel.com/docs/functions/runtimes/python
- Vercel function limits: https://vercel.com/docs/functions/limitations

## 2. Science/software boundary

There will be two execution contexts, with a clear purpose for each:

1. **Browser TypeScript runtime:** Runs the interactive model users manipulate live. It must support a rotatable 3D lattice and live parameter changes without network requests.
2. **Offline Python research and validation tools:** Acquire and preprocess allowed data; run SciPy-based reference calculations and batch sweeps; produce validation tables/curves and compact JSON fixtures for the web app.

Because the core equations will exist in two languages, define language-neutral equations, units, conventions and fixed test cases first. Add cross-language parity tests comparing the TypeScript engine with Python reference outputs within predeclared tolerances. Never tune values until two implementations agree; investigate and document discrepancies.

The browser model must not be marketed as molecular dynamics. Atom positions are generated from analytical displacement fields; the pile-up is a reduced-order model. Keep the single-dislocation visualization, discrete pile-up mechanics and macroscopic Hall–Petch fit conceptually distinct and connected only through declared equations.

## 3. Static-hosting rules

- The deployed site must work from static files alone after the first page load.
- No runtime web scraping or calls to OpenAlex, publishers, GitHub APIs, or other research services. Acquisition scripts run locally; curated data is checked into the repository only when redistribution is allowed.
- Do not include API keys, credentials, user-specific paths, private micrographs or unlicensed paper/image files in the public build.
- User-selected files must remain in the browser and must not be uploaded. Do not claim that user-uploaded files are saved to a server.
- Version and label published datasets, source citations, parameter status (`sourced`, `calculated`, `calibrated`, `illustrative`, `needs_citation`) and licence/provenance.
- Include a small, openly licensed example dataset so the public demo works immediately, even if the user has no micrographs. Synthetic examples must be explicitly labelled synthetic.
- For the first public release, image segmentation can remain an offline Python workflow. The web app displays bundled, permitted example images and their derived data, and may accept local JSON/CSV imports. Fully interactive in-browser micrograph segmentation is a stretch goal, not a launch blocker.
- Store large raw images and papers outside `public/`; publish only compact, permitted assets needed by the demo.
- Precompute computationally expensive literature comparisons and parameter sweeps offline. The browser performs only the interactive calculations needed for controls, with conservative limits and progress indicators.
- Camera movements, browser frame rate and animation playback speed must never modify physics parameters or numerical outcomes.

## 4. Hosting recommendation

**Primary target: Vercel static deployment. Secondary target: GitHub Pages.** Keep the same Vite build portable to both.

- Vercel is the simplest default for a Vite frontend connected to a Git repository.
- GitHub Pages provides a provider-independent fallback and keeps deployment easy to inspect in GitHub Actions.
- Do not use serverless functions in the first version.
- Configure Vite base paths through one build variable: `/` for Vercel and `/<repository-name>/` for a GitHub Pages project site. Ensure asset and data URLs use Vite base-aware URL helpers rather than hard-coded `/data/...` paths.
- Add a CI build that runs tests and `npm run build` on every pull request. Deployment should happen only from the designated production branch.
- Add a static-host smoke test that checks generated `index.html`, JS/CSS assets, and all required JSON/data paths in the built `dist/` directory.

## 5. Revised proposed project layout

```text
hpsim/
├── spec.md
├── openspec/
│   ├── project.md
│   ├── AGENTS.md
│   └── changes/hpsim-static-hosting/...
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── scene3d/          # atoms, bonds, displacement fields, controls
│   │   ├── core/             # pure TS equations and deterministic runtime model
│   │   ├── experiments/      # UI presets and client-side sweep controls
│   │   ├── charts/
│   │   └── data/             # typed data loaders / schemas
│   ├── public/data/          # only small, permitted runtime data assets
│   └── tests/
├── src/hpsim/                # Python offline reference, research and validation tools
│   ├── core_reference/
│   ├── micro/
│   ├── materials/
│   ├── experiments/
│   └── reports/
├── data/
│   ├── literature/
│   ├── micrographs/          # local research inputs; do not publish by default
│   └── derived/              # intermediate products, not automatically public
├── scripts/                  # acquisition, conversion, validation, export
├── tests/                    # Python validation and cross-language fixtures
├── docs/
│   ├── model.md
│   ├── assumptions.md
│   ├── limitations.md
│   ├── deployment.md
│   └── validation_report.md
└── .github/workflows/
    ├── test.yml
    └── deploy-pages.yml
```

Adjust this layout to avoid needless duplication with the repository already present. Do not move or delete existing user files without approval.

## 6. Static web MVP

The MVP should be independently deployable and include:

1. A real 3D FCC lattice with atoms, unit-cell axes and optional bonds.
2. Orbit, pan, zoom, standard camera views and reset-camera controls.
3. Edge-dislocation displacement visualization with slip plane, Burgers vector and line direction overlays.
4. Stress controls; play/pause/step/reset; live resolved shear stress, threshold state and velocity.
5. A deterministic client-side glide model with tests for threshold, linear response above threshold, sign reversal and fixed-time consistency.
6. At least one pile-up demo with a prevalidated parameter preset, plus live controls only after the TypeScript solver passes parity/benchmark tests.
7. Hall–Petch plots showing source data, model predictions, calibration points and held-out points using distinct labels and symbols.
8. An event log explaining motion, pinning and transmission with the numerical criteria used.
9. An About/Model/References panel explaining assumptions and that browser atom positions are a continuum visualization, not MD.
10. A no-network demo mode: the core demo loads from the deployment URL without credentials or external API access.

## 7. Testing and scientific gates

Before deployment:

- Unit-test FCC slip-system geometry, orthogonality, Burgers-vector calculations, resolved shear stress and glide laws.
- Validate the pile-up solver against the analytical reference in the Python test suite and compare fixed cases with the browser TypeScript implementation.
- Check seeded repeatability and that visualization/camera interactions do not mutate simulation state.
- Keep calibration and held-out literature datasets separate by study/specimen where possible.
- Ensure all plots have units, source citations and parameter-status labels.
- Verify the Vite production build works under both `/` and a GitHub Pages repository subpath.
- Confirm no unlicensed or private images are included in `web/public/` or the production `dist/` output.
- Confirm there are no required environment variables, runtime secrets or backend endpoints.
- Use a browser test to load the production build and exercise orbit/pan/zoom, play/pause, sliders, plots and data loading.

Do not silently weaken scientific acceptance criteria to pass static deployment. If the browser solver cannot meet the required validation/performance criteria, ship the static visualization with clearly labelled precomputed validated trajectories and keep unsupported controls disabled, rather than pretending a nonvalidated live model is reliable.

## 8. Migration rules for the existing specification

Create an OpenSpec change/ADR before editing the source of truth. At minimum add an ADR explaining why Streamlit cannot serve the public GitHub Pages application and why the runtime physics layer is browser-compatible TypeScript, while Python remains the offline reference and data-processing environment.

Update all affected sections consistently: stack, architecture, functional/non-functional requirements, folder layout, test plan, phases, deliverables, risks and deployment steps. Do not leave contradictory requirements such as “Streamlit is the UI” in one section and “static-only frontend” in another.

Keep Gate 0 scientific data acquisition independent. Missing micrographs or literature data must be reported honestly; they should not block building an explicitly labelled synthetic/analytical MVP, but they must block claims of experimental validation.

Do not implement the app during this task. Inspect the repository, prepare the proposed OpenSpec change, map every changed requirement to tasks/tests, report trade-offs and wait for human approval before changing `spec.md` or starting implementation.

## 9. Definition of done for this planning task

- Static hosting architecture selected and justified.
- Proposed OpenSpec change and ADR drafted.
- Every old Streamlit/server-dependent requirement is reconciled with static hosting.
- Data licensing and base-path requirements are documented.
- Browser/Python parity strategy is testable.
- Revised milestones show an MVP before the pile-up / Hall–Petch stretch features.
- No physics/application implementation has started.

---

# Antigravity prompt: optimize HPSim for static hosting

Read `spec.md` fully and inspect the current repository before editing anything. The user has no server and must present the finished interactive simulator using GitHub Pages or Vercel static hosting.

Use this file's recommendations to draft an OpenSpec change named `hpsim-static-hosting`, including an ADR for the static-first architecture. Vercel static hosting is the primary deployment target; GitHub Pages is the secondary portability target. Do not use serverless functions or require an always-running backend in the first version.

Important constraints:

1. Do not implement the simulator in this task. Explore the repository, propose the changes, map all requirement changes to tests/tasks, identify migration risks, then stop for approval.
2. Preserve scientific honesty. Python remains the offline research, micrograph-processing, batch-analysis and reference-validation environment. The interactive browser engine is TypeScript and requires cross-language numerical parity tests against Python reference cases.
3. The public demo must work without credentials, APIs, runtime scraping, a database or a backend. Use only small, permitted, cited data assets. Keep private/unlicensed source material out of the production bundle.
4. Do not claim browser-rendered atoms are molecular dynamics. Keep synthetic examples visibly labelled synthetic; missing experimental data blocks experimental-validation claims, not the ability to create a labelled demo.
5. Ensure Vite base-path configuration supports both root hosting on Vercel and `/<repository-name>/` hosting on GitHub Pages.
6. Update the architecture, FR/NFRs, directory layout, phase plan, tests, risks, deployment instructions and acceptance criteria consistently. Do not leave Streamlit as the public UI requirement.
7. Maintain the project’s gated workflow: EXPLORE → PLAN → VERIFY PLAN → CREATE TESTS → IMPLEMENT → VERIFY → FIX → VERIFY → ARCHIVE. In this task, stop after PLAN/VERIFY PLAN and wait for approval; do not execute implementation phases.
8. If a requirement conflicts with the new hosting constraint or the scientific goals, explain the trade-off and ask rather than making a silent assumption.

Return: (a) repository findings, (b) proposed ADR and OpenSpec change files, (c) requirement migration matrix, (d) hosting and bundle risks, (e) proposed MVP/cut list, and (f) the exact approval decision needed from the user.

## Plugins, skills and MCP to use

Use only existing installations relevant to this task:
- `master-router` to route the work.
- `mattpocock-skills`: `research`, `codebase-design`, `to-spec`, and `tdd` if available and relevant.
- `modern-web-guidance-plugin` for the static frontend architecture and accessibility constraints.
- `science` for scientific-computing and validation implications.
- `playwright` MCP later for production-browser checks; not necessary for this planning-only task.
- `coderabbit` only after implementation code exists; not needed now.
- `ralph-loop` is not authorized for this task. Do not run an unattended loop.

No additional plugin or MCP installation is required. If a named skill is unavailable, state that and continue without making the project depend on it.
