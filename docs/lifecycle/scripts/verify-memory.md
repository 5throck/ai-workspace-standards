# verify-memory.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.3.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-13
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-11-13 (record seeded at v1.3.0; the script itself predates the record — per-script records are opt-in and this is its first record)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-11-13 | production | production | v1.3.0 (U-20261112-007, spec docs/designs/2026-11-13-memory-index-link-validator-design.md): whole-index link integrity check (Check 3c) — every flat .md link anywhere in MEMORY.md (Sessions, Meetings, ADRs) must resolve to a file in memory/; missing targets WARN with a count, deduped against Check 3b's Sessions ERRORs. Archive/… and ../docs/… escapes plus fragment anchors out of scope. New exported findMissingIndexLinks() pinned by tests/unit/verify-memory-dead-links.test.ts v1.1.0. L0+L1 mirror updated verbatim; both SCRIPTS.md registries bumped to 1.3.0. | automation-engineer |
| 2026-09-09 | — | production | v1.2.0 (T-20260909-002, record backfilled at seed time): reverse dead-link check — MEMORY.md Sessions rows whose session log no longer exists are ERRORS; CLI dispatch import-guarded for unit tests. | automation-engineer |

## Ownership

- **Owner**: automation-engineer (memory-battery scripts family)
- **Review cadence**: follows the quarterly skill/script review schedule (docs/governance/agents/workflows.md §10)
