# Test Runner Script Lifecycle

## Metadata

- **Script**: test-runner
- **Status**: active
- **Version**: 1.8.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31 (v1.8.0 re-inflation guard — BUDGET-HEADROOM WARN + raise policy, T-20261030-002)

## Description

Suite-aware test runner wrapping `bun test` with per-test and per-file wall-time
budgets, suite selection, and CI-timing overrides. SSOT:
`scripts/SCRIPTS.md` registry row (usage: `bun scripts/test-runner.ts [suite] [flags]`,
default suite `integration`).

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v1.8.0 (T-20261030-002, spec 2026-10-31-test-budget-split-design stage 1 of 2): the re-inflation guard — BUDGET-HEADROOM WARN at 60% of a file's resolved suite budget (WARN not FAIL; burn-in visible in every CI log), budget-raise policy recorded at FILE_TIME_BUDGETS (raise requires a ticket with CI-run evidence; 2 raises/quarter → mandatory split/trim review), and an explicit row for the extracted tests/unit/upgrade-policy-decisions.test.ts pinned at the family defaults. Budget on upgrade-decision-log.test.ts HELD at 600s — stage 2 drops it to 300s only after one green win32 run ≤ ~150s. | automation-engineer |
| 2026-10-29 | production | production | v1.7.0 (PR #1723 CI run 40799972562): `upgrade-decision-log.test.ts` suite budget 300s → 600s (test ceiling stays 60s) — the delivery-bookkeeping PR1 wave (spec 2026-10-29-delivery-bookkeeping-engine-design) grew the file to 45 tests / 3087 expects (macOS 16.7s, max per-test 1.4s) and windows-latest printed 41/45 (pass) before the 300s suite wall killed it; win32 per-test max 36.7s < the 60s bun ceiling (no individual timeout — not a hang) and the four never-started tests are full upgrade-project.ts integration runs (~15-37s each); projected win32 total ~330-440s → 600s keeps ~1.4-1.8x. | automation-engineer |
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
