---
name: migrate-project
description: >
  End-to-end migration of an external project into the workspace standard:
  ensures the GitHub baseline, runs adopt-project, and verifies the migration
  landed correctly. Use when: migrating a legacy/external project, adopting a
  project with verification, running the full project migration flow.
status: active
scope: common
l2_propagate: false
version: 1.0.0
owner: scaffolding-expert
last_reviewed: 2026-09-23
relates_to:
  - skill: adopt-project
    type: composes_with
  - skill: upgrade-project
    type: follows
metadata:
  type: scaffolding
  triggers:
    - migrate project
    - adopt and verify migration
    - run project migration
    - full project migration flow
---

# Skill: migrate-project

## When to Use

- An external project should be migrated into the workspace standard END TO END: GitHub baseline → adoption → verified result.
- You want the migration performed AND inspected — not a checklist of advice.

## Script

**Script**: `scripts/migrate-project.ts`

```bash
# Preview (GitHub baseline check + adoption plan; no writes)
bun scripts/migrate-project.ts <project-path> --variant co-<x> --dry-run

# Full migration: baseline → adopt → verify
bun scripts/migrate-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex] [--org <org>] [--public] [--skip-github] [--yes]
```

## The Four Phases (performed, then inspected)

| Phase | What happens | Failure behavior |
|-------|--------------|------------------|
| 1. GitHub baseline | `ensure-github-repo` subprocess: checks the remote, creates + pushes when absent, verifies the local HEAD is on the remote | aborts — migration without an off-machine copy is unrecoverable |
| 2. Plan preview | `adopt-project --dry-run` always runs first; the collision/rover/workflow plan is shown before anything is written | aborts with adopt-project's pre-flight diagnostics |
| 3. Adoption | `adopt-project` runs for real (interactive confirmations pass through; `--yes` forwarded) | aborts with adopt-project's guided recovery output |
| 4. Verification | machine checklist (below) + git hooksPath + audit smoke, itemized pass/fail | hard failures exit 1 — migration is INCOMPLETE |

## Verification Checklist (phase 4)

- Artifacts: AGENTS.md, docs/context.md, docs/`<variant>`.context.md, .githooks/pre-commit, .gitattributes (with `docs/context.md merge=ours`), scripts/audit.ts, scripts/SCRIPTS.md, memory/MEMORY.md, CHANGELOG.md, provenance marker (declaring `variant=<requested>`), delivery manifest
- Platform twins per `--platform` (all: CLAUDE+GEMINI+CODEX; claude: CLAUDE only; antigravity: GEMINI only; codex: all three)
- git `core.hooksPath` == `.githooks`; GitHub remote present
- Project audit smoke: `bun scripts/audit.ts --skip-memory` (soft — failures are usually pre-existing foreign content, reported loudly)

## Requirements

- `gh` authenticated (for phase 1), git repo with a committed working tree, `bun` installed.
- `--skip-github` exists as an escape hatch but prints a loud warning; the default is to verify the baseline.

## References

- Design: `docs/designs/2026-09-23-migrate-project-design.md`
- Conversion internals: `adopt-project` skill (`docs/designs/2026-09-23-adopt-project-conversion-design.md`)
- Baseline utility: `scripts/ensure-github-repo.ts` (`docs/designs/2026-09-23-pre-adoption-github-repo-design.md`)
