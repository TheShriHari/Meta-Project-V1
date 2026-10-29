# Agent rules for hpsim

1. Read [../spec.md](../spec.md) first; it is authoritative (see its §0 and §12).
2. Never go PLAN → IMPLEMENT. Write failing tests before code.
3. Stop at every quality gate and wait for human approval.
4. Never invent material parameters or literature data; use `needs_citation` and report.
5. Never loosen a tolerance or edit a benchmark to make a test pass.
6. `core/` and `micro/` must not import UI or viz modules.
7. Unspecified decisions go to `openspec/changes/hpsim-v1/assumptions.md` and are flagged.
