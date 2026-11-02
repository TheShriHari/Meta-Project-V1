# HPSim — Final Bounded Ralph Loop Stabilization (College Demo and Resume Readiness)

**Purpose:** Complete a final, bounded stabilization pass for HPSim as a reliable, understandable, reproducible college project that can be demonstrated locally and described honestly on a resume. This is **not** a production deployment exercise. Use the installed Antigravity subagent capability and Ralph Loop only if their actual configuration supports the safety gates below.

**Execution authorization:** This prompt authorizes inspection, scoped bug fixes, UX/accessibility improvements, measured performance work, test/documentation updates, and **local commits on a dedicated stabilization branch only** once the preflight requirements are satisfied. It does **not** authorize pushing, deployment, publication, release tagging, history rewriting, paid actions, or unapproved package installation.

**Maximum Ralph Loop budget:** 10 iterations. Stop earlier when all objective criteria are satisfied. Never launch an unbounded loop or continue merely to use all iterations.

---

## 1. Mandatory Gate A — Inspect the actual Ralph Loop implementation before running it

The installed `ralph-loop` skill describes a long-running loop driven by `ralph.sh`, using `.agent/PROMPT.md`, `.agent/STEERING.md`, `.agent/tasks.json`, task specs, logs/history, and semantic promise tags. It also states that the loop may create Git commits automatically. Treat this as a clue, **not** a substitute for inspecting the actual installed version in this workspace.

Before executing any Ralph driver:

1. Read the installed `ralph-loop` skill file and inspect the actual `ralph.sh`, initialization script, relevant helper scripts, `.agent/` files if present, and any project-specific configuration.
2. Determine and report:
   - Which agent backend will run (Gemini, Codex, Claude, Cursor, or another actually supported/configured backend).
   - Whether the loop commits automatically, and at which point in an iteration it commits.
   - Whether it can push, deploy, rewrite history, install packages, or trigger other side effects through helper scripts or hooks.
   - How the maximum iteration count is enforced, how completion/blockage is signalled, and how the run can be stopped safely.
   - Whether Docker/WSL/Git Bash/sandbox prerequisites exist and whether the intended backend is already authenticated.
3. Do not reveal or copy credentials, tokens, secrets, or private environment values into logs or reports.
4. Use the installed skill's documented command syntax. Do not invent flags or initialize a second Ralph installation unnecessarily.
5. If the loop cannot enforce the 10-iteration cap, cannot be stopped safely, invokes an unsupported backend, or can push/deploy without a reliable block, **do not start it**. Use the same task plan sequentially under the coordinator and report why Ralph was not used.
6. Do not interpret “overnight” as permission for unlimited autonomy, repeated retries, or an unattended process without an enforced stop condition.

**Preflight deliverable:** Add the inspected behavior and chosen safe invocation to a task ledger before the first iteration. Do not start code changes before Gate A is complete.

## 2. Mandatory Gate B — Protect and isolate the current project state

Latest reported HPSim state, to be checked against the real workspace:
- Phase 8 release hardening reportedly completed and stopped for review.
- Latest reported results: 173 Python tests passed with 2 strict expected failures; 87 Node tests passed; data acquisition audit 6/6; TypeScript clean; root and `/hpsim/` builds passed; Playwright BAT-01..05 reported passing.
- Repository hygiene changes affecting approximately 3,472 tracked generated/dependency files were staged for untracking, but **no commits were made**.
- Other tracked modifications and untracked files may remain. Decision M6 remains unresolved: `tau_star_ref` stays `null` in `materials.yaml`, and ferritic-steel `tau_c` remains `needs_citation`.

These are reported claims, not the current baseline until checked.

### 2.1 Capture and verify the baseline

Before any write operation:

- Verify the existing backup path recorded in `docs/phase8_report.md`; do not overwrite, delete, or alter that backup.
- Capture `git status --short --branch`, current branch and `HEAD`, `git diff`, `git diff --cached --stat`, `git diff --cached --name-status`, untracked file list, `.gitignore`, and relevant phase reports.
- Confirm `web/node_modules/` and `web/dist/` are physically present if expected.
- Inspect staged removals carefully: `git rm --cached` should untrack files without deleting them from disk.
- Record the exact baseline state in the task ledger. Do not blindly re-run any `git rm`, reset, stash, checkout, clean, or restore command.

### 2.2 Create safe branch/worktree isolation

The Ralph Loop must not work directly on `main`.

1. Create a uniquely named local branch such as `hpsim/final-stabilization-YYYYMMDD-HHMM` or a dedicated Git worktree for the run. Do not create a release tag.
2. The project currently may contain staged changes, unstaged changes, and untracked work. A branch switch alone does **not** isolate uncommitted files. Choose and document a method that preserves the exact current implementation state while keeping `main` unchanged.
3. Preferred approach: review and safely carry the intended current working-tree changes into the isolated branch/worktree; verify by comparing source diffs, untracked files, and critical file hashes. If a local baseline/checkpoint commit is necessary, it must be on the dedicated branch only, after inspecting its full staged contents and confirming there are no secrets, unrelated files, or accidental dependency/build payloads. Never commit the checkpoint on `main`.
4. Do not drop a stash, patch, backup, or untracked file until the isolated copy is verified and the existing workspace remains recoverable.
5. If the current modified state cannot be transferred safely without risking loss or including unclear user changes, stop and report a blocked preflight instead of guessing.
6. Confirm the active branch/working directory for the actual Ralph process before launch. Its automatic commits must land only on the dedicated local branch.

## 3. Commit and side-effect policy

Local automatic commits are permitted **only on the isolated stabilization branch** and only for scoped, verified project changes. All other rules are strict:

- **Never push** any branch or commit to any remote.
- **Never deploy** to Vercel, Netlify, GitHub Pages, or any other hosting provider.
- **Never create release tags or GitHub releases.**
- **Never rewrite history** or run force pushes, `git-filter-repo`, BFG, `git rebase --onto`, or destructive reset/clean operations.
- Do not commit secrets, environment files, downloaded research papers, raw restricted micrographs, unrelated files, or generated build output unless specifically justified and allowed by existing project policy.
- Keep the repository-hygiene change that untracks `web/node_modules/`, `web/dist/`, and `*.pyc` distinct from unrelated scientific/UI changes where practical. Preserve all disk files during index cleanup.
- Inspect every auto-generated commit after it is created. If a commit includes unrelated or prohibited changes, stop; do not try to conceal it with a history rewrite.
- Do not install dependencies or update lockfiles without explicit user approval. Use only tools already installed in the environment.
- Do not invoke paid actions or other autonomous loops.

If the actual Ralph setup has a mandatory auto-push or cannot guarantee local-only commits, do not run it.

## 4. Use subagents with clear ownership

Use one coordinating agent and at most four specialist subagents at once. Subagents are useful for independent bounded audit/review tasks, but do not let multiple agents concurrently edit the same files or run their own autonomous loops.

- **Agent A — Science and numerical tests (read-only review first):** audit `A`/`A'` notation and dimensions, Phase 5 EFN oracles/residuals, Phase 6 blind prediction protocol, calibration disclosures, M6, and any discrepancy between `spec.md`, `docs/model.md`, and code.
- **Agent B — Browser UX and accessibility:** inspect user workflows, units, controls, keyboard/focus use, error/empty/loading states and visual provenance labels. Edit only UI/accessibility files explicitly assigned by the coordinator.
- **Agent C — Performance and runtime:** measure startup, fixture load/parse, rendering/interaction responsiveness and bundle size first. Make only targeted, evidence-supported improvements in files assigned by the coordinator.
- **Agent D — Micrograph, static hosting and release QA:** inspect complete chord-population metrics, ASTM intercept versus arithmetic chord mean, license/provenance guardrails, root/subpath fetches, browser tests and onboarding docs. Avoid simultaneous edits to Agent B's files; use sequential handoff if `App.tsx` needs changes from multiple tracks.
- **Coordinator:** owns the task ledger, Ralph iteration decisions, file ownership, integration, regression suite, commit review, and final report.

Do not spawn agents merely to increase agent count. Have each specialist return exact evidence, relevant file names/line ranges, tests run, and uncertainties. The coordinator must reconcile disagreements against code, equations and independent tests—not simply accept a `PASS` summary.

## 5. Scope — finish HPSim as a strong college demo, not a production service

Retain the current architecture: React + TypeScript + Vite + Three.js static frontend, browser-side TypeScript simulation core, and Python scientific reference/processing tools. Do not migrate engines or add a backend as part of this work.

The aim is a **user-friendly, reproducible college project**:
- A new user can launch it locally from documented instructions.
- The main simulation controls and units are understandable without reading source code.
- Scientific results are distinguishable from demonstrations and calibration targets.
- Common failure modes show useful messages instead of silent bad values.
- Browser interactions remain responsive during calculation and playback.
- Tests and reports allow a reviewer to reproduce the reported outcomes.

Explicitly out of scope:
- Cloud/public deployment, hosting setup that publishes to a remote, login/accounts, database, telemetry, payments, or production infrastructure.
- New physics phases such as cross-slip, climb, or Frank–Read source kinetics.
- Recalibration or promotion of `tau_star_ref`; changing literature fit values; weakening or removing strict expected-failure tests.
- Claims of empirical validation against TEM dislocation pile-ups when the available work is analytical verification against EFN theory.
- Copying raw CC BY-NC-SA 4.0 DoITPoMS micrographs into public web assets.
- Editing the root `spec.md` silently. If code/spec conflicts require a decision, record the conflict and stop for human review.

## 6. Ten-iteration maximum plan

The coordinator may combine adjacent tasks and should stop early when all acceptance criteria are satisfied. Each Ralph iteration must address one highest-priority incomplete task, make a small justified change, run targeted tests, record evidence, and commit only a coherent verified change on the isolated branch.

### Iteration 1 — Verify Ralph safety and establish the isolated baseline
- Complete Gates A and B before starting the loop.
- Confirm current source state has transferred correctly into the isolated branch/worktree.
- Run baseline tests and record exact commands, exit codes and counts.
- Create/confirm the `.agent/` PRD/tasks/steering files required by the installed Ralph workflow. Keep task descriptions atomic and verifiable; do not scaffold a duplicate framework if the required files already exist.

### Iteration 2 — Critical scientific consistency
- Check the current implementation and reports for the `A` versus `A'` / `G` versus `mu` convention; use the reconciled SI units consistently (`Pa·m` for stress prefactor and the appropriate units for force per unit length).
- Verify independent N=2, N=3, N=4 and N=5 EFN roots/oracles, force residuals and independently summed tip stress. Confirm that reference results are not produced by the solver under test.
- Verify the `L=d/2` assumption and sensitivity summary, the stereological grain-size convention, and literature comparability documentation. Do not recalibrate material values to improve fits.

### Iteration 3 — Phase 6 scientific honesty and parity
- Confirm the headline held-out metric is blind and does not use the held-out dataset's own `sigma_0`.
- Keep intercept-adjusted numbers clearly subordinate and marked **NOT blind**.
- Ensure `tau_star_ref` is not presented as an emergent prediction: it is a calibrated scalar targeting published `k_y`; only the exponent's emergence is a model result.
- Retain both strict expected failures and recompute their metrics from live code. Do not change thresholds to make them pass.
- Verify Python/TypeScript logic and canonical 10–400 µm sweep contract remain aligned.

### Iteration 4 — Phase 7 micrograph integrity
- Confirm real/synthetic/rescaled/reported-literature provenance is conspicuous in UI, figures and generated reports, not merely tests.
- Confirm complete chord arrays are exported, or use a clearly documented representative sample plus exact full-population summary statistics if data size demands it. Never take the first N entries and imply they are representative.
- Keep ASTM grid intercept `L_T/P` separate from arithmetic chord mean, standard deviation, CV and percentiles.
- Check scale-bar calibration is mandatory when needed and failure is explicit when metadata is missing.
- Re-check V-11 and V-12 independence and document remaining segmentation sensitivity. Do not tune segmentation to force agreement with a target grain size.
- Preserve image licensing restrictions and attribution; review derived fixtures before recommending public redistribution.

### Iteration 5 — Static hosting and browser robustness
- Verify pure asset-path helper behavior at `/`, `/hpsim/`, non-trailing-slash `/hpsim`, relative base, and the actual supported local HTTP workflow.
- Do not promise `file:///` JSON loading; modern browser origin restrictions may prohibit dynamic file fetches.
- Build at both root and `/hpsim/` base paths.
- Keep `.nojekyll` if required and verify it reaches the build output.
- Use Playwright MCP or an already-installed browser automation path to test the production preview. Do not install a new package without approval.

### Iteration 6 — First-run experience and UX
- Ensure the README gives exact Python/web setup, launch, test and troubleshooting commands.
- Add/finish a short user guide: controls, play/pause/step/reset, inputs, units, outcome meanings, limitations and a reproducible 3–5 minute demo sequence.
- Provide useful loading/error/empty-state messages; make measured, synthetic, calibrated and unresolved data visually distinct.
- Avoid color-only encoding; include text labels, distinct markers/shapes and reasonable keyboard/focus behavior.
- Do not add unrelated features or over-redesign the application.

### Iteration 7 — Measured performance pass
- Capture a same-machine/browser baseline for startup/build size, representative micrograph hydration/rendering, 3D scene responsiveness and slider/playback interaction.
- Profile before optimizing. Only make targeted changes when a measured bottleneck is identified.
- Keep the solver deterministic and independent of rendering frame rate. Use Web Workers only if profiling shows main-thread blocking and integration fits the current architecture without a new dependency.
- Report before/after measurements using the same workload, or clearly state that no improvement was measurable. Do not invent speedup claims.

### Iteration 8 — Reproducibility and resume portfolio
- Update `README.md`, `docs/user_guide.md`, `docs/reproducibility.md`, `docs/limitations.md`, and `docs/resume_project_brief.md` as needed.
- Include exact local commands, software prerequisites, seeds/fixture generation where applicable, data/license notes, current known failures and a system architecture diagram.
- Make sure screenshots and demo steps refer only to files/screens that actually exist.
- Prepare truthful resume bullet options and interview talking points. Do not claim empirically validated prediction, production deployment, or “all bugs fixed.”
- Do not automatically choose a software license for the repository; report the decision needed, separating code licensing from data/derivative asset terms.

### Iteration 9 — Focused bug backlog and edge cases
- Review issues discovered in previous iterations and target tests, including N=1 pile-up, zero-variance chord distribution, invalid/missing scale bar, malformed/missing fixture JSON, root/subpath loading, responsive layout, no-WebGL/unsupported-browser behavior, and high-count solver/performance behavior.
- Fix only confirmed defects within scope. If a scientific conclusion needs judgment, literature support, changing the governing model, or resolving M6, stop and document a decision request instead of guessing.

### Iteration 10 — Final integration, regression and report
Run the appropriate commands for the current project layout, capturing full output, exit status and duration. Example Windows PowerShell commands:

```powershell
$env:PYTHONPATH="src"
$env:PYTHONDONTWRITEBYTECODE="1"
python -m pytest -p no:cacheprovider -q
python scripts/validate_data_acquisition.py
node --experimental-strip-types --test web/tests/*.test.mjs
Push-Location web
npx tsc --noEmit --incremental false
npx vite build --base=/hpsim/ --outDir "$env:TEMP\hpsim_final_dist" --emptyOutDir
Pop-Location
python scripts/run_presets.py
python scripts/generate_validation_report.py
```

- Run a root-base build too; do not rely on a subpath build alone.
- Run actual Playwright browser checks against production preview if an installed MCP is available. Separate live-browser evidence from Node filesystem smoke tests.
- Confirm no raw restricted images have entered `web/public/` or output bundles.
- Inspect `git status --short`, `git diff`, `git diff --cached`, and all local commits created on the stabilization branch.
- Create `docs/final_stabilization_report.md` with exact evidence, current branch and commits, subagent ownership, modified files, tests/results, performance metrics, known limitations and a verdict: `READY FOR COLLEGE DEMO`, `READY WITH CONDITIONS`, or `NOT READY`.

## 7. Stop and escalate conditions

Immediately stop the loop and emit a blocked/incomplete status if any of these occur:

- Current project state or backup cannot be verified or safely isolated.
- The Ralph driver cannot enforce the iteration limit or automatic commits cannot be restricted to the dedicated branch.
- A test or implementation requires guessing scientific parameters, inventing citations, changing the model specification, or closing M6 without evidence/authorization.
- The same blocker fails twice without a credible new hypothesis.
- A task would require deleting user data, force-resetting Git, rewriting history, pushing, deploying, publishing restricted data, installing packages, or incurring costs.
- Subagents disagree on scientific correctness and evidence cannot resolve the disagreement.
- The 10-iteration budget is exhausted with incomplete acceptance criteria.

Do not declare complete solely because every task JSON item is marked `passes: true`; tie each claimed pass to fresh, inspectable test output and acceptance evidence.

## 8. Definition of complete

The stabilization may be declared complete only when:
1. Ralph ran with a hard cap of at most 10 iterations, or the report explains why it was not safe to run.
2. All verified high-priority defects in scope are fixed or explicitly blocked with evidence.
3. Tests, strict XFAILs, data audit, Python/TypeScript parity, root/subpath builds, presets and real-browser checks are accurately reported.
4. Scientific provenance, calibration-vs-emergence distinction, limitations, license restrictions and M6 state remain correct and visible.
5. Any performance claims have before/after measurements.
6. The project can be launched locally by following the README and demonstrated using the user guide.
7. All Ralph-created commits are local and belong only to the isolated stabilization branch. No commits or changes occur on `main`; no push, tag, deployment, or history rewrite occurs.
8. `docs/final_stabilization_report.md` is complete and residual risks are explicit.

Only when these criteria are evidenced may the agent emit the installed Ralph skill's success promise, such as `<promise>COMPLETE</promise>`. If blocked, use the documented `<promise>BLOCKED:reason</promise>` form. Use `<promise>DECIDE:question</promise>` when a human decision is required. Do not fake promise tags or emit `COMPLETE` on a partial result.

## 9. Final response required from Antigravity

Return a concise executive summary and a detailed report that includes:
- Whether Ralph Loop actually ran, its exact invocation/backend, and iteration count; if not, why not.
- How Ralph's auto-commit behavior was verified and how isolation was established.
- Branch name and each local commit hash/message; confirm `main` was not changed.
- Subagent names, bounded roles, and changed-file ownership.
- Exact test commands, exit codes, counts, durations, strict XFAIL explanations, and browser results.
- Before/after performance numbers, or an explicit statement that no measurable gain was established.
- Remaining scientific limitations, release risks and user decisions required.
- Files created for onboarding, reproducibility, user guide and resume use.
- Explicit confirmation: no pushes, tags, deployments, history rewrites, package installs or paid operations.

## 10. Relevant installed plugins, skills and MCPs

Use only existing installed tools that are relevant:
- **Ralph Loop (`ralph-loop` skill):** run only after Gates A and B; maximum 10 iterations; local commits only on the isolated branch; never push/deploy/tag.
- **`master-router`:** route to applicable skills/tools.
- **`mattpocock-skills`:** TDD, debugging, codebase design and review skills where installed.
- **`science`:** scientific reasoning, units, numerical assumptions and cautious claims.
- **`modern-web-guidance-plugin`:** frontend UX, accessibility, responsive UI and static asset paths.
- **Playwright MCP:** real-browser acceptance and screenshots if currently available.
- **Graft/codebase intelligence:** optional, read-only mapping of dependencies and ownership.
- **CodeRabbit:** optional review only if useful; do not apply automatic fixes.
- **Hindsight/AgentMemory:** optional context only; current repository evidence takes precedence.

Do not install additional plugins or MCPs. Do not execute a second autonomous loop inside a Ralph iteration. Keep one coordinator responsible for each decision, integration, full regression and final status.
