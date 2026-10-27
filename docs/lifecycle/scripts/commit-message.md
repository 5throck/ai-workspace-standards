# commit-message.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.1.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-28
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-10-28 (record seeded at v1.1.1; the helper itself was created 2026-10-11 at v1.0.0 per U-20261008-001 — per-script records are opt-in and this is its first record)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-28 | - | production | Record seeded at v1.1.1 (T-20261028-012, spec docs/designs/2026-10-28-dev-sync-staged-count-design.md): comment-only — documents the two-phase caller contract (dev-sync step 1 early composition; step 6.9 re-composition from the final staged set); no behavior change | automation-engineer |
| 2026-10-12 | (pre-record) | (pre-record) | v1.1.0 (T-20261012-011): the count is always present in fallback subjects — even the zero-classifiable case carries "(N files)" | pm |
| 2026-10-11 | - | production | v1.0.0 (U-20261008-001, spec docs/designs/2026-10-11-backlog-batch-2-design.md): pure commit-message composition for dev-sync step 1 — weak caller shapes replaced by a task-staged-set summary, 72-char budget, spec-id citation | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] `isWeakCommitMessage` classifies the weak fallback shapes (empty, bare "chore: update", bare "chore: (upgrade|resync|sync) template…")
- [x] `deriveCommitMessage` builds a conventional-commit subject from a path set — primary path-group picks type(scope), spec id cited while the 72-char budget allows, count always present (v1.1.0)
- [x] `composeCommitMessage` keeps descriptive caller messages verbatim; derives only for weak shapes
- [x] Pure and import-safe: no git, no I/O — unit-tested from tests/unit/commit-message.test.ts
- [x] Two-phase caller contract documented (v1.1.1): dev-sync calls with the early set (step 1) and the final staged set (step 6.9)

## Dependencies

- No runtime dependencies (pure functions, Bun/TS stdlib only)
- Consumed by: `scripts/dev-sync.ts` (steps 1 and 6.9)

## Domain

**Commit-Message Composition** — descriptive conventional-commit subjects derived from a changed-path set.

**Key Responsibilities**:
- Classify repo-relative paths into (type, scope) groups and pick the primary group
- Guarantee an honest file count in every derived subject — never a bare "chore: update"
- Preserve descriptive caller messages byte-for-byte
