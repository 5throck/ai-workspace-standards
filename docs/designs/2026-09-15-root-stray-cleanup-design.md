---
schemaVersion: 1.0.0
spec-id: root-stray-cleanup
---

# Root Stray Cleanup and Workspace-Root Target Guards Design

## 1. Overview

Removes 15 template-copy directories left at the workspace root by the
2026-09-12 root-upgrade incident, and closes the two script path hazards that
made the incident possible. `project-resync` is exonerated: it ran ~3 hours
after the incident against `Projects/co-*` targets (PRs #908/#909).

## 2. Investigation findings

- **What the strays are**: `co-abap`, `co-consult`, `co-deck`, `co-design`,
  `co-develop`, `co-export`, `co-game`, `co-hr`, `co-news`, `co-price`,
  `co-safety`, `co-security`, `co-work`, `common/`, and an empty `procedures/`
  at the workspace root — all created 2026-09-12 19:27:14–15 in one batch.
  Byte-comparison against `git archive b163891c:templates/...` proves they are
  a verbatim snapshot of the template tree (the only exceptions are gitignored
  build outputs in `co-design/playground/`, identical to the copies in
  `templates/` on disk). No `.git`, no user content.
- **Root cause**: an `upgrade-project` run targeted the workspace ROOT
  (documented in `memory/2026-09-12.md`, incident recovery commit `6a4ece8c`).
  `scripts/upgrade-project.ts` resolved `<project-path>` CWD-relative with no
  workspace-root guard; the root passes the `existsSync` and git-repo
  pre-flight checks. The empty `procedures/` is the PROCEDURES SYNC signature
  (mkdir-before-copy where the source holds only `_template`).
- **Why cleanup missed them**: `.gitignore` line 10 is `/*/` — root-level
  directories are invisible to `git status` and `git clean`, so the 2026-09-13
  disposal removed only the git-visible deliveries.
- **Second hazard**: `scripts/new-project.ts` scaffolded to
  `join(workspaceRoot, <name>)` — any bare-name scaffold landed at the root.
  `tests/reflect-skill-graph-to-project.ts` shares the raw-relative-path shape.

## 3. Resolution

1. **Cleanup**: all 15 strays verified (mtime frozen at the incident second,
   no `.git`, template-snapshot byte match) then archived to
   `../root-strays-20260912.tar.gz` (outside the repo, 3647 files) and deleted.
   `Projects/` was never touched.
2. **`upgrade-project.ts` 1.26.0 → 1.27.0**: a `<project-path>` resolving to
   the workspace ROOT is rejected with an error; targets outside `Projects/`
   print a warning.
3. **`new-project.ts` 1.15.1 → 1.16.0**: bare names scaffold under
   `Projects/<name>`; path-like names (containing `/`) stay workspace-relative
   so `scripts/test-new-project.ts` keeps scaffolding into `tests/.temp/`; a
   resolved target that escapes the workspace root is rejected.
4. **`tests/reflect-skill-graph-to-project.ts`**: rejects a workspace-ROOT
   target.
5. **Tests**: `tests/unit/project-target-guards.test.ts` (4 spawn-based tests)
   pins all guards. Docs updated: `scripts/SCRIPTS.md` (2 registry rows +
   `new-project.ts` section), `skills/promote-variant/SKILL.md`,
   `skills/simulate-pipeline/SKILL.md`.

## 4. Requirements and acceptance criteria

1. Run `bun scripts/upgrade-project.ts .` at the workspace root. The command exits 1. Output contains "workspace ROOT".
2. Run `bun scripts/new-project.ts <bare-name>` at the workspace root. The scaffold target is `Projects/<bare-name>`.
3. Run `bun scripts/test-new-project.ts <name>`. The harness scaffolds into `tests/.temp/Test-<name>` unchanged.
4. Run the guard test file. All tests pass.
5. The workspace root contains no `co-*`, `common/`, or `procedures/` directories.

## 5. Accessibility

Not applicable — this change touches CLI scripts and documentation only. No
user-facing UI is introduced or modified.

## 6. Preview verification

Not applicable — no UI surface. Verification is via the acceptance criteria in
§4 and `bun test`.

## 7. Consequences

- The incident class (template tree delivered into the repo root) is closed at
  the tool level: the two most-run project scripts now refuse or redirect
  root-level targets.
- Bare-name scaffolds land in the canonical `Projects/` layout; the
  `promote-variant` skill's post-promotion test instructions now match actual
  script behavior.
- L1 snapshots of both scripts under `templates/common/scripts/` refresh via
  the normal propagate step in `/sync` (L0 rows may be newer than L1 between
  publishes).
