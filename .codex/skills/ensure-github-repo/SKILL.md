---
name: ensure-github-repo
description: >
  Ensures a project has a GitHub-backed baseline BEFORE adoption/migration runs:
  performs the check, creates and pushes the GitHub repo when absent, and verifies
  the remote actually carries the local history. Use when: checking github repo
  before migration, creating a github repo for a legacy project, backing up
  history off-machine before adopt-project.
status: active
scope: common
l2_propagate: false
version: 1.0.0
owner: scaffolding-expert
last_reviewed: 2026-09-23
relates_to:
  - skill: adopt-project
    type: enables
  - skill: upgrade-project
    type: follows
metadata:
  type: scaffolding
  triggers:
    - check github repo before migration
    - create github repo for project
    - prepare github baseline
    - ensure github repo
---

# Skill: ensure-github-repo

## When to Use

- Before `adopt-project` migration: the project's history must be safe off-machine first.
- An existing project has no GitHub remote (or the remote may be stale) and it needs a verified GitHub baseline.

This skill does not stop at advice — it **performs** the work (repo creation + push) and **verifies** the result (the remote provably carries the local HEAD). Exit 0 means the GitHub baseline is in place.

## Script

**Script**: `scripts/ensure-github-repo.ts`

```bash
bun scripts/ensure-github-repo.ts <project-path> [--org <org>] [--public] [--remote <name>] [--dry-run]
```

## What It Does (execute + verify)

| Phase | Action |
|-------|--------|
| 1. Readiness | git repository required, at least one commit, clean-tree warning, `gh` installed and authenticated — each failure prints the exact remediation command |
| 2. Detection | `git remote -v` scanned for a github.com remote; `owner/repo` parsed from https/ssh forms |
| 3. Execution | When no GitHub remote: `gh repo create` (private by default, `--public` opt-in, `--org` supported) with `--source` + `--push` — the full local history lands on GitHub |
| 4. Verification | Mandatory on every path: `gh repo view` confirms existence and visibility; `git ls-remote` confirms the local HEAD sha is present on the remote branch. A failed verification exits non-zero with the manual push command |
| 5. Hand-off | Prints the recommended `adopt-project` command (dry-run first, then real) |

## Requirements

- `gh` CLI installed and authenticated (`gh auth login`).
- The project is a git repository with at least one commit.
- Uncommitted changes are never pushed — commit them first (the script warns).

## Safety Model

- Repos are created **private** unless `--public` is passed explicitly.
- Push transmits committed history only; no working-tree content leaves the machine.
- `--dry-run` prints the planned create/push and verification without touching anything.

## References

- Design: `docs/designs/2026-09-23-pre-adoption-github-repo-design.md`
- Next step skill: `adopt-project` (Scenario B migration, `docs/variant-conversion-guide.md` §3)
- E2E-adjacent tests: `tests/unit/ensure-github-repo.test.ts`
