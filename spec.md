# spec.md — Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)

**Version:** 2.0 (supersedes the browser/Three.js-only spec)
**Build tool:** Google Antigravity, OpenSpec-driven
**Core stack:** Python 3.11+, NumPy/SciPy, scikit-image/OpenCV, Plotly (interactive 3D), PyVista (offline renders), Streamlit (UI), pytest
**Project type:** Scientific simulation + image analysis + interactive teaching/analysis tool (college capstone-grade)

---

## 0. How the agent must use this file

1. This file is the **source of truth**. If code and spec disagree, the spec wins until a change to the spec is approved.
2. Follow the execution order in §12 exactly: EXPLORE → PLAN → VERIFY PLAN → CREATE TESTS → IMPLEMENT → VERIFY → FIX → VERIFY → ARCHIVE. Never go PLAN → IMPLEMENT.
3. Every phase in §10 ends with a **Quality Gate**. Gates are real stops: after passing a gate, summarize evidence (test output, figures) and **wait for explicit human approval** before the next phase.
4. **No silent assumptions.** Anything not defined here must be written to `openspec/changes/hpsim-v1/assumptions.md` and flagged to the user.
5. **No invented numbers.** Material parameters that are marked `needs_citation` in §5.9 MUST be sourced (web search, textbook, paper) with a reference, or left as `TODO` and reported. Never fabricate σ₀, k_y, τ_c, τ*, or literature datasets.
6. If a skill router (e.g. `master-router`) or domain skills (science, ralph-loop, coderabbit) are available in the workspace, use them where they help (scientific computing checks, code review, iteration loops). The project MUST NOT depend on them to build or run.
7. One bug = one fix cycle (§12, rule 6). No patching without a failing test first.

---

## 1. Project summary

### 1.1 One-sentence thesis
Simulate discrete edge-dislocation **pile-ups** at grain boundaries, drive them with **real grain-size statistics extracted from the user's micrographs** (steel, copper, aluminium), and show that the **Hall–Petch d^(−1/2) law emerges** from the simulation rather than being plotted from an input equation.

### 1.2 Three connected layers
| Layer | What it does | Key output |
|---|---|---|
| **A. Real microstructure** | Segments micrographs, measures grain size (ASTM E112 line-intercept + area-equivalent), builds grain graph, extracts chord-length distributions, assigns seeded orientations | `d̄`, chord distribution, grain adjacency, orientations |
| **B. Dislocation engine** | Single-dislocation glide; boundary transmission (m′ + residual Burgers vector + outgoing resolved stress); 1D discrete pile-up with source shut-off | Pile-up size N, tip stress, transmit/pin decisions with logged reasons |
| **C. Emergent strength** | Finds the applied stress at which the pile-up tip stress reaches the boundary threshold; sweeps grain size; fits σ_y vs d^(−1/2) | Simulated k_y, comparison with analytic EFN scaling and with literature |

A 3D lattice visualization (displacement field of the dislocation) and a micrograph overlay (dislocation paths on the real image) make the science legible. **The visualization never decides physics.**

### 1.3 What is honestly new versus the old spec
- Hall–Petch is **derived from pile-up mechanics** (with one calibrated threshold per material), not just plotted.
- Grain geometry comes from **real micrographs**, not random Voronoi cells.
- Boundary rule uses **three criteria** (Lee–Robertson–Birnbaum style), not m′ alone.
- Every result is checked against **analytic benchmarks and literature**, with a limitations section.

---

## 2. Architectural diagnosis

- **Pattern:** pure-function physics core (no UI imports) → experiment runner (deterministic, seeded) → visualization/UI that only *replays* stored state.
- **Main technical risk:** the pile-up solver (ill-conditioned near the leader; ordering of positions) and mis-matching the analytic reference by a constant factor (convention errors: edge vs screw, ν factor, L = d/2 vs d).
- **Main workflow risk:** the agent "tuning until the plot looks right." Mitigation: calibrate **one** parameter per material on a defined calibration set and report a held-out comparison untouched by tuning.
- **Biggest verification concern:** results that look plausible but are physically unvalidated. Hence the analytic-benchmark suite (V-series, §9.3) is a hard gate.

---

## 3. Assumptions and missing inputs

### 3.1 Assumptions (all MUST be restated in `docs/assumptions.md`)
- A1. Isotropic linear elasticity (G, ν) for dislocation fields and interactions.
- A2. Pile-ups are **1D, planar, single slip plane, edge character, like-signed**, with a fixed obstacle (the boundary) and one source at distance L from it. L is half the chord length through the grain along the slip trace (source at the grain centre).
- A3. Lattice friction/CRSS τ_c is a single constant per material (no temperature, no strain-rate, no forest hardening).
- A4. Grain orientations from optical micrographs are **not measurable**; they are assigned from a seeded distribution (default: uniform random on SO(3)). If EBSD data is supplied, real orientations replace them.
- A5. The 3D grain-boundary plane is unknown from a 2D section; assume a **columnar** boundary whose plane contains the sample normal and the observed 2D trace.
- A6. Macroscopic yield uses a Taylor-type factor M_T applied to the critical resolved stress (M_T sourced and cited per structure; typical random-texture values FCC ≈ 3.06, BCC ≈ 2.75 — verify).
- A7. Hall–Petch regime only (micron-scale grains). Nanocrystalline inverse Hall–Petch is out of scope unless the stretch goal is unlocked.
- A8. Atomic positions in the 3D view are produced by an analytic displacement field; they are **not** molecular dynamics.

### 3.2 Missing inputs the human MUST provide (agent stops and asks at Gate 0)
- M1. The micrograph image files, placed in `data/micrographs/`.
- M2. For each image, in `data/micrographs/metadata.csv`: `file, material, structure(FCC|BCC), phase_of_interest, heat_treatment, etchant, magnification, scale_bar_um, pixels_for_scale_bar`.
- M3. How many micrographs exist per material and whether their grain sizes differ (≥3 distinct sizes per material enables a measured Hall–Petch fit; otherwise the **rescaled-micrograph sweep** in §5.8 is used).
- M4. Whether twin boundaries (Cu, some steels) count as grain boundaries in this project. Default: **exclude twin boundaries from d**, state it, and report sensitivity.
- M5. For steel: which phase is analysed (ferrite grains only by default; pearlite regions masked out).
- M6. Approval of the cited material-parameter table (§5.9) before it is used.
- M7. Course rubric / report format, if any (affects §11 deliverables only).

---

## 4. Requirement Freeze

> **Gate statement the agent must emit before writing any proposal:** *"Requirements are frozen. Proceeding to Phase 1."* — only after the human approves this section.

### 4.1 Functional requirements
| ID | Requirement |
|---|---|
| FR-01 | Generate an FCC lattice (and BCC at Phase 8 only if time permits) with correct basis, unit cell, and neighbour pairs. |
| FR-02 | Define slip systems per structure (FCC {111}⟨110⟩ = 12; BCC {110}⟨111⟩ = 12) and transform them by a grain rotation. |
| FR-03 | Compute resolved shear stress from a full stress tensor; expose the uniaxial Schmid-factor special case. |
| FR-04 | Single edge dislocation glide with threshold, mobility law, reversal, and fixed time stepping. |
| FR-05 | Isotropic edge (and later screw) displacement field with core regularization; Burgers-circuit validation. |
| FR-06 | Boundary encounter detection by swept path; transmission/pinning decision using m′, residual Burgers vector, and outgoing RSS; every decision logged with numbers. |
| FR-07 | Discrete 1D pile-up solver with source shut-off; returns N, positions, tip stress, back stress. |
| FR-08 | Yield-onset finder (bisection on applied stress) and grain-size sweep; Hall–Petch fit with uncertainty. |
| FR-09 | Micrograph pipeline: scale calibration, preprocessing, segmentation, QA overlay, line-intercept and area-equivalent grain size, chord distribution, adjacency graph. |
| FR-10 | Rescaled-micrograph sweep: scale the measured chord distribution to emulate other mean grain sizes. |
| FR-11 | Orientation assignment from a seed; optional EBSD import. |
| FR-12 | Material database (`materials.yaml`) with per-parameter source and verification status. |
| FR-13 | Interactive Streamlit app: material + micrograph selection, stress and boundary controls, lattice/glide view (Plotly orbit/pan/zoom, replay slider with play/pause), pile-up view, micrograph overlay, Hall–Petch plots, event log. |
| FR-14 | Deterministic experiment presets and a CLI `hpsim run <preset>` producing reproducible outputs (figures + JSON/CSV + event log). |
| FR-15 | Validation report generator producing `docs/validation_report.md` from test/experiment outputs. |
| FR-16 | Visible labels: every plotted quantity states units, or is marked *normalized/illustrative*, and every parameter set is marked *sourced*, *calibrated*, or *illustrative*. |

### 4.2 Non-functional requirements
| ID | Requirement |
|---|---|
| NFR-01 | **Determinism:** same seed + parameters ⇒ byte-identical event log and identical numeric results (tolerance 0). |
| NFR-02 | **Units:** SI internally; unit conversion only at I/O edges; variable names carry unit suffixes (`_pa`, `_m`, `_mpa`). |
| NFR-03 | **Performance:** pile-up solve for N ≤ 300 in < 2 s on a laptop; 1D sweep of 30 grain sizes < 60 s; Plotly lattice ≤ 4,000 atoms interactive. |
| NFR-04 | **Separation:** `hpsim.core` and `hpsim.micro` MUST NOT import UI or viz modules. |
| NFR-05 | **Typing & style:** `ruff` clean, `mypy --strict` on `core`, docstrings stating equations and units on public physics functions. |
| NFR-06 | **Reproducibility:** `pip install -e .` + `make test` + `make demo` works from a clean checkout; all figures regenerate from scripts. |
| NFR-07 | **Honest labelling:** limitations visible in README, app "About" tab, and report. |
| NFR-08 | **UI accessibility (minimal):** readable contrast, labelled controls, no information conveyed by colour alone in plots. |
| NFR-09 | **Security/hygiene:** no network calls at runtime; user images stay local; no pickled untrusted data. |

### 4.3 Constraints
- Solo student project; target total effort ≈ 5–7 weeks part-time.
- Offline-capable after install.
- Deploy target: local run + optionally Streamlit Community Cloud (public repo only if the user chooses).
- Third-party dependencies limited to the listed stack; any addition needs an ADR.

---

## 5. Model specification

### 5.1 Conventions
- Specimen frame (x, y, z); z is the sample surface normal (micrograph plane is x–y).
- Grain orientation R_i maps crystal → specimen. Verify RᵀR = I, det R = +1.
- Slip direction **s**, plane normal **n**, line direction **ξ**, Burgers vector **b** = b·b̂. Edge: b̂·ξ = 0. Screw: b̂ ∥ ξ.
- Burgers magnitude from geometry: FCC b = a/√2; BCC b = a√3/2 (computed in code from lattice parameter `a`, never typed in).

### 5.2 Resolved shear stress
τ_RSS = sᵀ σ n. For uniaxial stress σ along **t**: τ_RSS = σ cosφ cosλ. Keep the tensor form as the implementation; the Schmid form is a test oracle.

### 5.3 Single-dislocation glide (overdamped)
v = M_d · b · sgn(τ_RSS) · max(|τ_RSS| − τ_c, 0)   [M_d in 1/(Pa·s), v in m/s]
r_d(t+Δt) = r_d(t) + v ĝ Δt. Fixed Δt, maximum step displacement, swept-segment boundary test. Playback speed changes presentation only.

### 5.4 Displacement fields (isotropic elasticity)
Edge, b along x, line along z, coordinates relative to the core (x, y), plane strain:
- u_x = (b/2π)[ θ + xy / (2(1−ν)(x²+y²)) ]
- u_y = −(b/2π)[ ((1−2ν)/(4(1−ν))) ln(x²+y²) + (x²−y²) / (4(1−ν)(x²+y²)) ]

Screw: u_z = (b/2π) θ with θ = atan2(y, x).

**Core regularization:** replace x²+y² by x²+y²+r_c² in the logarithmic and rational terms, with r_c ≈ b (documented, configurable). **Branch cut:** place the θ cut *behind* the glide direction along the slip plane so the displacement jump b represents the slipped region; verify with the Burgers-circuit test. Label as continuum visualization, not an atomistic core. Retain ideal positions separately: r_i = R_i + u(R_i; r_d).

### 5.5 Boundary transmission (deterministic, explainable)
For incoming system (s_in, n_in, b_in) at a boundary with neighbouring grain j, for each outgoing candidate k (all vectors in the specimen frame):
1. **Geometric compatibility:** m′ = |s_in·s_out| · |n_in·n_out| ∈ [0, 1].
2. **Residual Burgers vector:** |b_r| = min over sign choice of |b_in ∓ b_out| (same frame).
3. **Outgoing driving stress:** τ_out = |sᵀ_out σ n_out| (σ rotated into specimen frame; same σ). Require τ_out ≥ τ_c,out.

**Candidate acceptance:** m′ ≥ m′_min (config, default 0.5, exposed as a sensitivity parameter), τ_out ≥ τ_c,out, and **tip stress ≥ τ\*(m′)** (see 5.7). **Selection among accepted candidates:** highest m′; ties broken by smallest |b_r|; then by highest τ_out; then by lowest slip-system index (determinism). If none accepted ⇒ **pinned**. If accepted ⇒ **transmitted**: switch to the outgoing system's vectors and continue.

The boundary plane normal is assumed per A5. m′ is a geometric criterion, **not** a complete physical law; the log states which criteria passed/failed and with what values.

### 5.6 Pile-up model (discrete, 1D)
Notation: s_i ≥ 0 is the distance of dislocation i behind the boundary; leader s₁ = 0 (held by the boundary); source at s = L.
- Edge interaction constant per unit length: A = G b² / (2π(1−ν)); define A′ = A / b = G b / (2π(1−ν)) (stress units × length).
- Effective driving stress τ_eff = τ_app,RSS − τ_c (zero if negative ⇒ no pile-up).
- Force balance for followers i = 2…N (divided by b): **−τ_eff + Σ_{j≠i} A′/(s_i − s_j) = 0**.
- Solve with `scipy.optimize.root` using the analytic Jacobian (J_ik = −A′/(s_i−s_k)² for k≠i; J_ii = +Σ_{j≠i} A′/(s_i−s_j)²), parametrize by positive gaps to preserve ordering, and use continuation in N (previous solution + one more dislocation) with a damped-dynamics fallback. Guard: spacing < b ⇒ flag "core overlap" in the event log.
- **Source shut-off (quasi-static emission):** starting at N = 1, add a dislocation while τ_eff − τ_back(L; N) > τ_src, where τ_back(L; N) = Σ_j A′/(L − s_j) and τ_src is the source activation stress (default 0, configurable). Final N is the pile-up size.
- **Tip stress (exact by global balance):** τ_tip = N · τ_eff (force on the leader divided by b). This identity is a unit test.
- **Analytic reference (continuum Eshelby–Frank–Nabarro):** N ≈ π(1−ν) τ_eff L / (G b) for edge character, so τ_tip ≈ π(1−ν) L τ_eff² / (G b).

### 5.7 Yield onset and the emergent Hall–Petch relation
- Boundary threshold: **τ\*(m′) = τ\*_ref · (1 + β(1 − m′))**, with β ≥ 0. Default **β = 0** for all calibration and headline results; β > 0 appears only in a labelled sensitivity study.
- **Yield onset:** the smallest τ_app such that τ_tip ≥ τ\*; found by bisection on τ_eff (τ_tip is non-decreasing in τ_eff). Report the plateau resolution caused by integer N.
- With L = d/2, the continuum result gives τ_eff,crit = sqrt( 2 G b τ\* / (π(1−ν) d) ) ∝ d^(−1/2). Macroscopic yield: **σ_y = M_T (τ_c + τ_eff,crit)**, hence the analytic reference **k_y = M_T · sqrt( 2 G b τ\* / (π(1−ν)) )** and σ₀ = M_T τ_c.
- **What is emergent:** the d^(−1/2) *exponent* and the dependence on G, b, ν come from the discrete pile-up solution, not from an input formula.
- **What is calibrated:** one scalar τ\*_ref per material, fit to a **calibration** dataset. Everything else is reported on **held-out** data. Calibrated values are labelled *calibrated*, never *sourced*.
- Fit: OLS of σ_y vs d^(−1/2) with bootstrap confidence intervals for k_y and σ₀; also report log–log slope of τ_eff,crit vs d (target −0.5).

### 5.8 Micrograph pipeline (Layer A)
1. **Calibrate scale** from metadata (µm per pixel); refuse to run without it.
2. **Preprocess:** grayscale, flat-field/CLAHE, denoise (non-local means or bilateral), optional manual mask for non-analysed phase.
3. **Segment:** boundary-enhancement (e.g. ridge filter or Canny) → threshold → skeletonize → close gaps → watershed seeded from distance transform/minima → label grains. Classical methods first; ML tools only through an ADR.
4. **QA (mandatory):** save overlay of boundaries on the original, grain count, border-touching exclusion, and a list of suspicious regions (very small areas). The human approves the overlay at Gate 7.
5. **Grain size:** (a) primary — **mean lineal intercept ℓ̄** by ASTM E112-style intercept lines (horizontal+vertical+diagonals, ≥ 500 intercepts or documented otherwise), reported with a 95 % CI; (b) secondary — area-equivalent diameter of non-border grains. Report both; HP uses (a) unless the user selects otherwise.
6. **Chord-length distribution:** sample random chords per grain and across the image; L = chord/2 feeds the pile-up model.
7. **Adjacency graph:** grains as nodes, shared boundary length and 2D trace direction as edge attributes.
8. **Orientations:** per grain seeded draw from SO(3) (or EBSD), stored with the seed.
9. **Rescaled-micrograph sweep (FR-10):** multiply all lengths by a factor to emulate other mean grain sizes while preserving morphology/distribution shape; label outputs as *synthetic rescaling of a measured distribution*.
10. **Grain-level onset spread:** for each sampled chord compute τ_eff,crit(L); report the 10th–90th percentile band as an *indicative spread*, **not** a statistical prediction of macroscopic yield (macroscopic yield uses d̄).

### 5.9 Material parameter table (`materials.yaml`, schema + starting entries)
Each parameter carries `value`, `unit`, `source`, `status ∈ {sourced, calibrated, illustrative, needs_citation}`.

| Material | Structure | a (nm) | G (GPa) | ν | b (nm, computed) | σ₀, k_y, τ_c, τ\*_ref, M_T |
|---|---|---|---|---|---|---|
| Aluminium | FCC | ≈0.405 | ≈26 | ≈0.34 | a/√2 | needs_citation |
| Copper | FCC | ≈0.361 | ≈48 | ≈0.34 | a/√2 | needs_citation |
| α-Iron / ferritic steel | BCC | ≈0.287 | ≈80 | ≈0.29 | a√3/2 | needs_citation |

The numeric entries above are **typical textbook-order values flagged `needs_citation`**: the agent MUST replace them with cited values (handbook or paper, with temperature and purity/composition noted) and present the table for human approval (M6). Literature σ_y(d) datasets for calibration/validation MUST be sourced with references; if none can be found for a material, state so and skip that validation rather than inventing data.

### 5.10 Visualization rules
- Lattice: Plotly `Scatter3d` (atoms) + line traces (selected bonds); default ≤ 4,000 atoms; orbit/pan/zoom native; standard views buttons (front/side/top/iso); overlays toggled individually: unit cell, slip plane, slip direction, Burgers vector, dislocation line, grain boundary.
- Animation: the engine precomputes a state trajectory; the UI replays it with a slider (play/pause/step). Camera and playback never mutate the stored state.
- PyVista: offline high-quality renders and demo videos only.
- Micrograph overlay: grain boundaries, slip-line chords, pile-up markers, boundary decisions coloured *and* marked by symbol (✓ transmitted, ✗ pinned).
- Event log is first-class: every state change gets a plain-language sentence plus the numbers behind it.
- Every figure: axes with units, legend, parameter-status badge.

---

## 6. Risk register

| ID | Description | Prob. | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Pile-up solver fails to converge or loses position ordering for large N | Med | High | Gap parametrization, analytic Jacobian, continuation in N, damped-dynamics fallback, convergence tests for N up to 300 | Claude |
| R-002 | Constant-factor mismatch with analytic EFN result (edge vs screw, ν factor, L = d/2 vs d) | High | High | Document every convention in `docs/model.md`; V-07/V-09 tests; mismatch triggers Bug Remediation, never silent tolerance loosening | Claude |
| R-003 | Segmentation errors (under/over-segmentation, twins, second phases) bias grain size | High | High | Mandatory QA overlay, manual-intercept cross-check on ≥3 lines per image, twin/phase policy fixed at Gate 0, sensitivity report | User + Claude |
| R-004 | Agent tunes parameters until plots "look right" | Med | High | One calibrated scalar per material, explicit calibration vs held-out split, parameter-status badges | Claude |
| R-005 | Literature data for validation missing or inconsistent (processing, purity, test temperature) | Med | Med | Cite each dataset with conditions; skip rather than invent; report spread between sources | User + Claude |
| R-006 | Optical micrographs give no orientation, so m′ statistics are artefacts of the random draw | High | Med | State A4 prominently; report m′ results as distributions over seeds; EBSD upgrade path | Claude |
| R-007 | Scope creep into 3D polish (Three.js port, screw mode, BCC) before core is validated | Med | Med | Phase gates; stretch goals locked until Gate 7 passes | User |
| R-008 | Plotly 3D laggy with many atoms | Low | Low | Atom cap, optional bonds, level-of-detail slider | Claude |
| R-009 | Floating-point nondeterminism across machines | Low | Med | Seeded `numpy.random.Generator`, fixed dtype, tolerance-zero checks only on the same platform; cross-platform checks use 1e-12 relative | Claude |
| R-010 | Time overrun | Med | Med | MVP at Gate 3, strong project at Gate 6, cut Phase 8 polish first, never Phases 5–6 | User |

---

## 7. OpenSpec change plan and ADRs

### 7.1 Change structure
One master change `openspec/changes/hpsim-v1/` containing: `proposal.md`, `requirements.md` (copy of §4), `assumptions.md` (§3), `risk-register.md` (§6), `design.md`, `tasks.md` (grouped by phase, each task atomic and testable), `test-plan.md` (§9), `adr/`, `specs/` (deltas tagged ADDED/MODIFIED/REMOVED per capability: `lattice`, `slip-systems`, `stress`, `glide`, `fields`, `transmission`, `pileup`, `hall-petch`, `micrograph`, `app`, `experiments`). `rollout-plan.md` and `rollback-plan.md` are marked **N/A (local academic tool)** with one line of justification. `lessons-learned.md` is written at archive.

### 7.2 Pre-decided ADRs (agent writes the files; each uses Context → Decision → Consequences → Alternatives Rejected)
- **ADR-001 Python core instead of a TypeScript/Three.js core.** Image analysis, SciPy solvers and the validation workflow are native in Python; Three.js remains a stretch port reading exported JSON.
- **ADR-002 Plotly for interactive 3D, PyVista for offline renders.** Plotly needs no extra Streamlit component and supports orbit/pan/zoom.
- **ADR-003 Pile-up via force-balance root solve, not time-integrated DDD.** Smaller, testable, matches the analytic reference; DDD rejected as out of scope.
- **ADR-004 Yield onset by pile-up tip stress vs. a single calibrated τ\*_ref per material (β = 0 default).** Minimizes free parameters; documents the calibration/held-out split.
- **ADR-005 Classical segmentation first.** Ridge/Canny + watershed; ML segmentation only with a new ADR and proven benefit.
- **ADR-006 Deterministic seeded randomness and frozen state dataclasses.** Enables replay and the NFR-01 check.
- **ADR-007 Materials database in YAML with per-parameter provenance.** Enforces "no invented numbers".
- **ADR-008 Grain size definition: lineal intercept primary.** ASTM E112 convention; area-equivalent reported for comparison.

---

## 8. Folder architecture

```text
hpsim/
├── openspec/
│   ├── AGENTS.md
│   ├── project.md                  # points to this spec.md
│   ├── specs/<capability>/spec.md
│   └── changes/hpsim-v1/ ...       # see §7.1
├── pyproject.toml
├── Makefile                        # test, lint, demo, report, app
├── src/hpsim/
│   ├── core/                       # pure physics, no UI imports
│   │   ├── units.py  vectors.py  rotations.py  rng.py
│   │   ├── lattice.py  slipsystems.py  stress.py  glide.py
│   │   ├── fields.py               # edge/screw displacement + regularization
│   │   ├── transmission.py         # m', residual b, outgoing RSS, decision + reasons
│   │   ├── pileup.py               # solver, source shut-off, tip stress
│   │   ├── hallpetch.py            # yield onset, sweep, fit, bootstrap
│   │   ├── simulation.py           # fixed-step loop, swept boundary test
│   │   └── events.py               # event dataclasses + plain-language formatter
│   ├── micro/
│   │   ├── io.py  preprocess.py  segment.py  qa.py
│   │   ├── intercept.py  grains.py  chords.py  orientations.py  rescale.py
│   ├── materials/
│   │   ├── materials.yaml          # provenance + status per parameter
│   │   └── loader.py
│   ├── viz/
│   │   ├── lattice3d.py  overlays.py  pileup_plot.py
│   │   ├── micrograph_overlay.py  hp_plots.py  pyvista_render.py
│   ├── experiments/
│   │   ├── presets/*.yaml  run.py  sweeps.py  report.py
│   └── app/
│       └── streamlit_app.py
├── data/
│   ├── micrographs/ (+ metadata.csv)     # user supplied, git-ignored if large
│   ├── literature/ (+ SOURCES.md)        # cited datasets only
│   └── synthetic/                        # generated Voronoi test images
├── tests/
│   ├── unit/  property/  validation/  integration/  regression/  performance/
│   └── golden/                           # frozen reference outputs (small)
├── docs/
│   ├── model.md  assumptions.md  limitations.md
│   ├── validation_report.md  user_guide.md
├── notebooks/                      # exploratory only; nothing the app depends on
└── README.md
```

Rules: OpenSpec artifacts never live in `src/`. `core` and `micro` never import `viz` or `app`. State objects are frozen dataclasses; viz functions take them read-only.

---

## 9. Test plan (written BEFORE implementation)

### 9.1 Levels (Python adaptation of the 10-level ladder)
| Level | Type | Scope |
|---|---|---|
| 1 | Static analysis | `ruff`, `ruff format --check`, `mypy --strict src/hpsim/core` |
| 2 | Unit tests | vectors, rotations, slip systems, stress, glide, fields, transmission, pile-up pieces |
| 3 | Property-based tests (hypothesis) | rotation orthonormality, m′ ∈ [0,1], invariance of RSS under common rotation of σ, s, n |
| 4 | Validation (analytic benchmarks) | V-series below; the scientific gate |
| 5 | Integration | micrograph → grain graph → chords → pile-up sweep → HP fit; experiment runner end-to-end |
| 6 | App smoke tests | Streamlit app starts headless, loads a preset, renders each tab without exception |
| 7 | Accessibility/legibility checks | every figure has units, legend, status badge; no colour-only encoding (checked by figure-metadata test) |
| 8 | Performance | NFR-03 timings with generous CI margins |
| 9 | Security/hygiene | no network access at runtime, input path validation, safe YAML loading |
| 10 | Regression | full suite after every fix; golden outputs for 3 presets |

### 9.2 Test-first rule
For each task in `tasks.md`, the failing test is written and run (red) before the implementation (green). The agent logs red→green evidence in the task record.

### 9.3 Validation benchmarks (V-series)
| ID | Benchmark | Pass condition |
|---|---|---|
| V-01 | Slip-system geometry | FCC and BCC each have 12 unique systems; |s|=|n|=1; s·n=0 within 1e-12; b computed = a/√2 (FCC), a√3/2 (BCC) |
| V-02 | Schmid oracle | Uniaxial tension along [001] on FCC {111}⟨110⟩: 8 active systems each with factor 1/√6 ≈ 0.408, 4 with 0; tensor RSS equals cosφcosλ within 1e-12; max Schmid factor ≤ 0.5 for random axes |
| V-03 | Burgers circuit | Analytic-gradient (or θ-unwrapped) loop integral enclosing the core = b within 1e-3·b for edge and screw; = 0 for loops not enclosing the core |
| V-04 | Glide law | Zero velocity for |τ| ≤ τ_c; linear in (|τ|−τ_c) above; sign reverses with stress; position after fixed time independent of Δt within 1e-9 for constant stress |
| V-05 | Swept boundary | A step 100× larger than the boundary distance still triggers the boundary event at the correct crossing point |
| V-06 | Compatibility | Identical orientations ⇒ some candidate has m′ = 1 and |b_r| = 0; constructed 90°-rotated pair gives the analytically expected m′ |
| V-07 | Pile-up force balance | Converged follower residual < 1e-9·τ_eff; **τ_tip = Nτ_eff** within 1e-6 relative |
| V-08 | Pile-up vs analytic N | Discrete N within 25 % of π(1−ν)τ_eff L/(Gb) for N ≥ 10, with the observed ratio vs N tabulated in the validation report (a failure triggers Bug Remediation; tolerance is not edited to pass) |
| V-09 | Emergent exponent | Log–log slope of τ_eff,crit vs d over ≥ 1.5 decades of d equals −0.5 ± 0.05 |
| V-10 | k_y consistency | Fitted simulated k_y within 15 % of the analytic k_y formula in §5.7 for the same parameters |
| V-11 | Intercept method | Synthetic Voronoi images of known mean grain size: recovered ℓ̄ within 10 % across ≥ 3 sizes and seeds |
| V-12 | Segmentation cross-check | On each real micrograph, automatic intercept count vs. user's manual count on ≥ 3 lines within 15 % (requires user input; if missing, status = BLOCKED, not PASS) |
| V-13 | Determinism | Same seed ⇒ identical orientations, event-log hash, and results; different seed ⇒ different orientations |
| V-14 | Viz isolation | State hash before/after every viz call is identical |
| V-15 | Literature comparison | On held-out sourced data, report predicted vs. literature σ_y with error; pass if within a pre-declared band chosen by the user at Gate 5 (default ±25 %); report honestly if outside |
| V-16 | Rescaling | Rescaled chord distribution has mean = target within 1e-9 relative and unchanged coefficient of variation |

---

## 10. Implementation roadmap (phases, gates, estimates)

Each phase: write tests first, implement, verify, then stop at the gate with evidence and wait for approval.

### Phase 0 — Foundations (1–2 days)
- Repo, `pyproject.toml`, Makefile, lint/type config, OpenSpec folders, ADR files, `assumptions.md`.
- Gather missing inputs M1–M7; build and cite the material-parameter table.
- **Gate 0:** inputs received, parameter table cited and approved, requirements frozen.

### Phase 1 — Math kernel, no visuals (3–4 days)
- `vectors`, `rotations`, `slipsystems`, `stress`, `glide`, `units`, `rng`, `materials` loader.
- **Gate 1:** V-01, V-02, V-04 (static part), property tests green; mypy strict clean.

### Phase 2 — Lattice + static edge dislocation (4–5 days)
- `lattice`, `fields`, Plotly lattice view with overlays and standard views, PyVista render script.
- **Gate 2:** V-03 green; human can rotate the 3D view; overlays toggle independently; V-14 green.

### Phase 3 — Stress-driven glide and animation (3–4 days) — **MVP**
- `simulation` with fixed Δt and swept-boundary test; trajectory replay with play/pause/step; live τ_RSS, v, state.
- **Gate 3:** V-04, V-05 green; demo run reproducible. *If time collapses, this is the minimum deliverable.*

### Phase 4 — One boundary (4–5 days)
- `transmission` with m′, residual Burgers vector, outgoing RSS, deterministic selection, event log; two-grain scene.
- **Gate 4:** V-06 green; an accepted and a rejected case each produce a logged, numerically explained decision.

### Phase 5 — Pile-up (5–6 days) — **heart of the project**
- `pileup` solver, source shut-off, tip stress, quasi-static build-up animation, pile-up plots.
- **Gate 5:** V-07, V-08 green; validation table of N vs. analytic saved. Human selects the V-15 tolerance band here.

### Phase 6 — Emergent Hall–Petch (3–4 days)
- `hallpetch` yield-onset bisection, grain-size sweep, OLS + bootstrap fit; calibration of τ\*_ref on the calibration set only; held-out comparison.
- **Gate 6:** V-09, V-10, V-15 evaluated and reported; one figure with simulated points, fit, analytic line, and literature overlay. *This is the strong-project line.*

### Phase 7 — Real micrographs (4–5 days; may start any time after Phase 1 in parallel)
- Preprocess → segment → QA → intercept/area sizes → chords → adjacency → orientations → rescaled sweep; feed into Phases 5–6.
- **Gate 7:** V-11, V-12, V-16 evaluated; QA overlays approved by the human; per-material d̄ with CI and predicted σ_y range. *This is the excellent-project line.*

### Phase 8 — Packaging (4–5 days)
- Streamlit app wired end-to-end, presets, CLI, `validation_report.md`, `limitations.md`, README, demo video, report/poster figures.
- **Gate 8:** full ladder (levels 1–10) green; documentation complete; final human sign-off.
- **Stretch (only after Gate 7, each needing a new OpenSpec change):** screw dislocations; BCC full workflow; EBSD orientations; β > 0 sensitivity study; inverse Hall–Petch regime; Three.js viewer reading exported JSON.

---

## 11. Deliverables and acceptance matrix

### 11.1 Deliverables
1. Source repository with passing CI-style `make test`.
2. `docs/validation_report.md` (auto-generated tables + figures).
3. `docs/limitations.md` and `docs/model.md` (equations, conventions, assumptions).
4. Final report/poster figures regenerated by `make report`.
5. 3-minute demo video (PyVista/Plotly screen capture).
6. Streamlit app with About tab listing limitations.

### 11.2 Acceptance Criteria Matrix
| Criterion | Testable? | Test level | Pass condition | Status |
|---|---|---|---|---|
| Slip systems and Schmid factors correct | Yes | Validation | V-01, V-02 | ⬜ |
| Dislocation field has correct Burgers closure | Yes | Validation | V-03 | ⬜ |
| Glide obeys threshold/linearity/reversal, step-size independent | Yes | Unit/Validation | V-04 | ⬜ |
| No boundary tunnelling at large steps | Yes | Unit | V-05 | ⬜ |
| Boundary decisions explainable and deterministic | Yes | Unit/Integration | V-06, V-13; log contains m′, \|b_r\|, τ_out, τ_tip, τ\* | ⬜ |
| Pile-up solver correct | Yes | Validation | V-07, V-08 | ⬜ |
| d^(−1/2) emerges | Yes | Validation | V-09, V-10 | ⬜ |
| Predictions compare honestly with literature | Yes | Validation | V-15 reported with held-out data | ⬜ |
| Grain size from micrographs trustworthy | Yes | Validation/Integration | V-11, V-12, approved QA overlays | ⬜ |
| Rescaled sweep consistent | Yes | Unit | V-16 | ⬜ |
| Viz never mutates physics | Yes | Unit | V-14 | ⬜ |
| App runs and every tab renders | Yes | Smoke | Level 6 green | ⬜ |
| Performance targets | Yes | Performance | NFR-03 | ⬜ |
| Parameter provenance visible | Yes | Unit/Static | Every parameter has source+status; no `needs_citation` used in a headline result | ⬜ |
| Reproducible from clean checkout | Yes | Integration | `make test demo` succeeds | ⬜ |
| No regressions | Yes | Regression | Full suite green after every fix | ⬜ |

---

## 12. Ready-to-paste Antigravity prompt

```text
You are building the project defined in spec.md (repo root). spec.md is the single source of truth.
Do not write implementation code until EXPLORE, PLAN, VERIFY PLAN and CREATE TESTS are complete.

EXECUTION ORDER (never deviate):
EXPLORE → PLAN → VERIFY PLAN → CREATE TESTS → IMPLEMENT → VERIFY → FIX → VERIFY → ARCHIVE
Never go PLAN → IMPLEMENT.

1. EXPLORE: read spec.md fully; inspect openspec/ (create openspec/AGENTS.md and openspec/project.md if missing,
   with project.md pointing to spec.md); list data/micrographs/ and metadata.csv if present.
2. Report missing inputs M1–M7 (spec §3.2) and STOP for the human before Phase 1 if any are missing.
3. PLAN: create openspec/changes/hpsim-v1/ with proposal.md, requirements.md, assumptions.md,
   risk-register.md, design.md, tasks.md, test-plan.md, adr/ (ADR-001…008 per spec §7.2), and specs/ deltas
   (ADDED/MODIFIED/REMOVED). rollout/rollback = "N/A (local academic tool)".
4. VERIFY PLAN: check every FR/NFR maps to at least one task and one test (V-series, spec §9.3). Emit
   "Requirements are frozen. Proceeding to Phase 1." ONLY after the human approves.
5. CREATE TESTS: write tests for the current phase first and show them failing (red). Then implement (green).
6. IMPLEMENT phases 0–8 in order (spec §10). Keep changes atomic; do not broaden scope; no unrelated refactors.
   After each task run its tests; after each phase run the full relevant suite.
7. At each Quality Gate: print evidence (test output, validation tables, figures), update the acceptance matrix,
   and WAIT for explicit human approval. Never auto-proceed.
8. BUG CYCLE: on any failure create a bug record (ID, description, repro, severity), root-cause it, write a
   failing test, fix, verify, run the full regression suite, close. One bug per cycle. Never patch without a
   failing test. Never loosen a tolerance or edit a benchmark to make a test pass; if you believe a benchmark is
   wrong, write the argument and ask the human.
9. SCIENCE RULES: MUST NOT invent material parameters or literature data; use materials.yaml status flags;
   MUST cite sources. MUST keep core/ and micro/ free of UI imports. MUST label figures with units and
   parameter status (sourced/calibrated/illustrative). MUST calibrate only τ*_ref, only on the calibration
   set, and report held-out comparisons separately. MUST state that atom displacements are an analytic
   continuum visualization, not MD.
10. MUST report blockers immediately instead of working around them silently. MUST NOT declare completion until
    levels 1–10 pass and the human signs off at Gate 8.
11. ARCHIVE: merge accepted specs into openspec/specs/, write lessons-learned.md, regenerate
    docs/validation_report.md, clean the change workspace.

If a skill router or domain skills are available, use them where useful (scientific-computing checks, code
review, iteration loops), but the project must build and run without them.

Start now with EXPLORE and step 2.
```

---

## 13. Definition of done

The project is complete when all of the following hold:
- Every item in the acceptance matrix (§11.2) is ✅ or explicitly documented as BLOCKED with the reason (e.g. missing literature data).
- The headline figure exists: simulated pile-up-derived yield points vs. d^(−1/2), the fitted line, the analytic prediction, and the literature comparison, for at least one material end-to-end and for all three if data allows.
- Micrograph-derived grain sizes have QA overlays approved by the human and confidence intervals.
- A limitations section states plainly what the model omits (temperature, boundary structure, dislocation sources and forest hardening, orientation unknown from optical images, grain-size distribution effects on macroscopic yield, nanoscale regime).
- A clean checkout runs `make test` and `make demo` successfully.

**First milestone to build:** Phases 0–3 (math kernel → lattice + one edge dislocation → stress-driven glide with replay). Validate before touching boundaries or pile-ups.

---

## Appendix A — Glossary
- **CRSS (τ_c):** critical resolved shear stress for glide.
- **m′:** Luster–Morris geometric compatibility factor.
- **Pile-up:** like-signed dislocations stacked against an obstacle.
- **Tip stress (τ_tip):** force on the leading dislocation divided by b; equals N·τ_eff.
- **ℓ̄:** mean lineal intercept length.
- **Calibrated vs sourced:** *calibrated* values are fitted to data in this project; *sourced* values come from cited literature.

## Appendix B — Key references to consult (agent: verify and cite precisely)
- Hirth & Lothe, *Theory of Dislocations* (displacement fields, pile-ups).
- Hull & Bacon, *Introduction to Dislocations* (Hall–Petch via pile-ups).
- Eshelby, Frank & Nabarro (1951) on pile-up stress concentration; Hall (1951) and Petch (1953).
- Luster & Morris (1995); Lee, Robertson & Birnbaum (1990) on slip transmission.
- ASTM E112 (grain-size determination).
- MTEX documentation for slip transmission and EBSD handling.
