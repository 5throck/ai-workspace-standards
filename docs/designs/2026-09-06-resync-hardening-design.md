---
schemaVersion: 1.0.0
spec-id: resync-hardening
---

# Post-Resync Hardening Design

## 1. Overview

Resolves the eight issues surfaced by the first project-resync live cycle
(fleet sync + backport + upgrade, 2026-09-06) and encodes the end-of-cycle
branch-cleanup/root-sync procedure into the `project-resync` skill.

## 2. Resolutions

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | upgrade-project leaves newly delivered scripts out of the project's SCRIPTS.md registry (version-less file skipped by SYNC_IF_NEWER) → "Unregistered script" gate failures | `upgrade-project.ts` v1.18.0: `syncVariantScripts` now calls `reconcileScriptRegistry(rel2)` after every copy (NEW + UPDATE paths); `reconcileScriptRegistry` insertion point bounded to the registry table (stops at the first `#### \`…` detail header, whose flag tables contain similar rows) |
| 2 | ad-hoc `@version` extraction matched prose ("@version comment") during manual registry repair | no shipped-code change (the tool never extracted versions); repair procedure now uses line-anchored comment-marker regex — documented here |
| 3 | dev-sync `--spec-exempt` believed not to forward | false alarm: flag and env both forward; the observed failures were OTHER lifecycle checks in the same audit run. No change |
| 4 | design-lint gate inert in L3 (reads L0-only `docs/workspace-schema.json`) | `audit.ts` v2.29.2: when the schema is absent, applies conventional default `{enabled, scanRoots: [./playground/src, ./src]}` (roots that exist); schema still overrides when present |
| 5 | co-newbiz unit-test flake (up to 140 varying failures) | root-caused to non-monotonic ULID: same-millisecond rows raced on the random suffix under `decided_at DESC, id DESC` tiebreaks. `db/lib/ulid.ts` v1.1.0 (project): standard monotonic-ULID — new-ms seeds full 80-bit randomness, same-ms increments. 960/960 ×2 |
| 6 | k-opendata dangling `relates_to` edges (co-export-only targets) | edges removed at L1 (`templates/common/.claude/skills/k-opendata/`); composition recorded as a prose note pointing at `templates/co-export/skills/` |
| 7 | 15 specs stuck "approved >14d" | `spec-register.ts` gains the `archived` terminal status; the 15 stale approved specs archived with `archive_note` (reversible by status edit) |
| 8 | docs propagation domain "disabled pending ADR" ambiguity | **ADR-0069**: L1 docs/ stays independently maintained by decision; propagation-map note cites ADR-0069 |

## 3. project-resync skill v1.1.0

Adds **Step 6 — fleet branch cleanup + root final sync**: merged remote/local
`pr/*` branch deletion with prune, per-repo return to default branch + pull,
root on clean `main`, and a final zero-state table
(dirty / unpushed / open PRs / template version per project).

## 4. Verification

- `bun scripts/audit.ts` exit 0 (incl. design-lint gate, no stale-spec warnings)
- `verify-scripts.ts --verify` 0 errors; `validate-skills.ts` 0 errors
- propagate dry-run in sync
- co-newbiz `bun test tests/unit/` 960/960 ×2
