# dev-sync.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.33.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-28
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-10-28 (record seeded at v1.33.0; the script itself predates the record — per-script records are opt-in and this is its first record)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-28 | - | production | Record seeded at v1.33.0 (T-20261028-012, spec docs/designs/2026-10-28-dev-sync-staged-count-design.md): step 6.9 re-derives the commit-time message from the FINAL staged set after step 6.5 staging, fixing the "(0 files)" subject/PR-title class (root PR #1669: 12 files; co-design PR #65: 17 files); memory summary header + MEMORY.md index re-converge when the message changes | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Full sync pipeline: gates (language, main-drift, branch, sensitive-file, merge-in-progress), staging (scoped default / WARN opt-out), commit, push, PR creation
- [x] Step 1 early commit-message composition from the staged set (U-20261008-001) — authoritative for the language gate, memory summary, and branch slug
- [x] Step 6.9 final message composition from the final staged set (T-20261028-012) — commit subject and PR title reflect the set the commit actually contains
- [x] Memory-log session summary + MEMORY.md index stay in sync with the final message (D3 re-convergence)
- [x] Scoped staging with S0/S1 snapshot classification (docs/designs/2026-09-12-dev-sync-scoped-staging-design.md)

## Dependencies

- Bun runtime; git; gh CLI (PR creation; REST fallback per T-20261013-006)
- Consumed by: the `sync` skill (skills/sync/SKILL.md), agents landing work via `/sync`
- Helpers: `scripts/helpers/commit-message.ts`, `scripts/helpers/merge-state.ts`, `scripts/helpers/version-bump.ts`, `scripts/lib/language-guard.ts`

## Domain

**Sync Pipeline** — the workspace root's single landing path (PM Gateway closeout): validate, stage, commit, push, and open the PR for a delivery.

**Key Responsibilities**:
- Enforce the gate battery before any git mutation (fail-closed)
- Derive an honest commit subject and PR title from the change surface (steps 1 + 6.9)
- Keep governance records (memory log, MEMORY.md index, VERSION_MANIFEST, SCRIPTS.md mirrors) converged with the delivered content
