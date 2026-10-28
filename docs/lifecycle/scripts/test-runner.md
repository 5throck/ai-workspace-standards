# Test Runner Script Lifecycle

## Metadata

- **Script**: test-runner
- **Status**: active
- **Version**: 1.6.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-28 (v1.6.0 windows timing budgets; record backfilled 2026-10-29 per T-20261029-002 — the only swept script without a lifecycle record)

## Description

Suite-aware test runner wrapping `bun test` with per-test and per-file wall-time
budgets, suite selection, and CI-timing overrides. SSOT:
`scripts/SCRIPTS.md` registry row (usage: `bun scripts/test-runner.ts [suite] [flags]`,
default suite `integration`).

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-28 | production | production | v1.6.0 (PR #1677 CI run 40603661108): `upgrade-decision-log.test.ts` joins FILE_TIME_BUDGETS (suite 300s / test 60s) — the tombstone-engine suites added 17 full upgrade-project.ts integration runs; on windows-latest the file hit the 120s suite wall with every individual test passing (the v1.5.0 override shape). Observed win32 per-test max 25.2s → test 60s keeps ≥2x headroom; projected win32 file total ~126s → suite 300s keeps ~2.4x. | automation-engineer |
| 2026-10-14 | production | production | v1.5.0 (CI run 38412124373, windows timing budgets): (1) Bun per-test ceiling — the runner passes `--timeout` to `bun test` (default 15000ms; bun 1.4 ignores a bunfig `[test] timeout` key, so the CLI flag is the only working knob); spawn-heavy tests overran the implicit 5s on windows-latest with every assertion passing. (2) Per-file budget overrides for files whose win32 wall time legitimately exceeds the suite defaults (mcp-upstream-server, upgrade-tree-sync). | automation-engineer |
| 2026-10-12 | - | production | Established as the workspace test runner (T-20261012 batch era — variant-script registry hygiene wave; versions prior to v1.5.0 predate the annotated-history convention). | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Per-test timeout plumbed to `bun test --timeout` (bun 1.4 ignores bunfig)
- [x] Per-file suite/time budget overrides for CI-verified slow files
- [x] Suite selection with the documented default
- [x] Registry row + this record agree on the version (Check A/H parity)

## Dependencies

- `bun test` runtime
- CI runners (windows-latest timing characteristics drove v1.5.0/v1.6.0)

## Notes

- The 2026-10-29 records-hygiene sweep (T-20261029-002) found this the only
  swept script without a lifecycle record; backfilled from the SCRIPTS.md row
  history. No script content changed.
