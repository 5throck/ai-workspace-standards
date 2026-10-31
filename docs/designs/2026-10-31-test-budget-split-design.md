# upgrade-decision-log test budget — split, dedupe, and the re-inflation guard (T-20261030-002)

- **Status**: Approved (2026-10-31, user gate) — stage 1 of 2 delivered (PR 1: pure-helper split, per-shape fixture dedupe, re-inflation guard; budget held at 600 s); stage 2 (600 s → 300 s) pending its evidence gate.
- **Registry status**: `approved` (docs/specs/registry.json) — flips to `implemented` when stage 2 lands and registers at its own /sync (stage 1 alone is partial delivery by this design's own §4 sequencing, so the registry stays `approved` until then).
- **Date**: 2026-10-31
- **Owner**: automation-engineer (PM Gateway dispatch, after user approval)
- **Ticket**: T-20261030-002 (`kind: manual`, priority low) — test-suite
  hygiene, repeat budget-raise offender
- **Tier**: L0 (workspace-root test suite and test runner)
- **Spec registry id**: `2026-10-31-test-budget-split-design` (registered: proposed)
- **Precedent**: docs/designs/2026-10-30-codeck-render-validation-batch-design.md
  (batch design format); scripts/test-runner.ts FILE_TIME_BUDGETS (the existing
  per-suite budget surface)

## 0. Accessibility exemption statement

This design is backend/pipeline work: test-suite restructuring and test-runner
configuration. It produces no user-facing UI. The ADR-0065 accessibility
sections and the ADR-0070 preview-verification sections are **exempt** for
every artifact in this design.

## 1. Verified fact base

- **The suite**: `tests/unit/upgrade-decision-log.test.ts` — 1352 lines,
  exactly **45 tests** across **11 describe blocks** (counted from source;
  ticket claim confirmed). Two describes are pure-helper suites against
  `scripts/lib/upgrade-policy.ts` exports (decision-log helpers;
  backfillStubFrontmatter). Nine describes are engine suites that spawn
  `bun scripts/upgrade-project.ts` against temp projects.
- **Spawn cost**: 33 `runUpgrade(` call sites (verified; the ticket's "~15
  full upgrade-project integration runs" undercounts — some sites sit in
  loops). Each spawn runs the full engine, which spawns its own bun
  grandchildren (skill-graph / VERSION_MANIFEST / snapshot / provenance
  regeneration). Per-run spawn hygiene is codified in the suite (stdin pinned
  closed, pipes consumed; PR #1677 Windows handle fix). Per-test CI maximum
  36.7 s against a 60 s per-test ceiling (ticket, CI run 40799972562).
- **Budget history — 3 raises in ~2 weeks** (verified in
  scripts/test-runner.ts header and FILE_TIME_BUDGETS):
  v1.5.0 (2026-10-14, CI run 38412124373) raised the suite budget to 300 s;
  v1.6.0 (2026-10-28, PR #1677, run 40603661108) added the explicit
  FILE_TIME_BUDGETS row; v1.7.0 (2026-10-29, PR #1723, run 40799972562)
  raised 300 s → 600 s. Today: `'upgrade-decision-log.test.ts':
  { suite: 600000, test: 60000 }` (test-runner.ts:113).
- **The convention**: the family default suite timeout is 120 s
  (test-runner.ts:90-91); the heavy-file budget rows are 300 s
  (mcp-upstream-server 300 s, upgrade-tree-sync 300 s). Observed win32 file
  total is ~330-440 s (test-runner.ts:16 comment) → 600 s is ~1.4-1.8x
  headroom. The family convention is ~2x headroom — the suite is the outlier.

## 2. Decision — split and dedupe instead of raising again

Target state: observed win32 file total ≤ ~150 s, letting the budget return to
**300 s at the family's ~2x convention**. Three levers, in confidence order:

1. **Extract the pure-helper suites.** The 2 non-spawning describes move to a
   new fast suite `tests/unit/upgrade-policy-decisions.test.ts` (v1.0.0).
   They assert pure functions and run in milliseconds; extracting them
   removes them from the budgeted file's blast radius so future engine growth
   cannot drag them.
2. **Dedupe engine spawns via shared per-shape fixtures.** The 9 engine
   describes spawn overlapping project shapes: tests that set up identical
   temp projects (same variant, same seeded baseline/tombstone state) each
   pay a full engine run to assert one more decision row. Introduce a
   module-scoped fixture cache keyed by a setup signature: the first test
   with a given shape runs the engine; tests in the same shape assert against
   the shared result. Expect ~33 spawn call sites to collapse to ~12-15
   distinct shapes. Fixture reuse must preserve the documented spawn hygiene
   (fresh temp dir per shape, stdin ignore, pipes consumed) and each test
   still asserts its own rows — nothing is deleted, runs are shared.
3. **Merge redundant full re-runs.** Regression additions from v1.4.0
   (TOMBSTONE_CLEARED row assertions, carry-forward prune cases,
   STUB_VERSION_DIVERGENCE) assert rows on scenarios that earlier describes
   already build. Fold the row assertions into the owning scenario's test
   where the setup is identical; delete the duplicate setup-and-run.

**Classification rule** (applies to each of the 45 tests): a test is a *true
integration test* — and keeps its own full run — when it exercises a
multi-step lifecycle the shared fixtures cannot express (deliver → edit →
re-deliver; tombstone → clear → re-deliver; --dry-run refusal paths). A test
is *assertion-only* — and joins a shared fixture — when its unique value is
the rows/manifest it inspects, not the project it builds.

## 3. The re-inflation guard

The per-suite budget rows already exist: `FILE_TIME_BUDGETS` in
scripts/test-runner.ts (basename-keyed `{ suite, test }`) is the single
budget surface, so the guard extends it rather than inventing new config:

1. **Headroom WARN**: test-runner.ts (v1.7.0 → 1.8.0) emits a
   `BUDGET-HEADROOM` WARN row when a suite's elapsed time exceeds 60% of its
   budget. WARN, not FAIL — CI timing variance must not block merges; the row
   makes slow burn-in visible in every CI log instead of at raise time.
2. **Raise policy (recorded, enforced by review)**: a FILE_TIME_BUDGETS raise
   requires a ticket naming the CI run evidence; two raises for the same file
   inside a quarter trigger a mandatory split/trim review. This is the rule
   the 3-raises-in-2-weeks pattern violated silently.
3. **New suite pinned small**: the extracted `upgrade-policy-decisions.test.ts`
   gets a FILE_TIME_BUDGETS row at the family default (120 s). Its runtime
   must stay trivial; the row makes any drift visible.

## 4. Sequencing (2 PRs)

- **PR 1 — split + dedupe, budget unchanged at 600 s**: levers 1-3, the
  headroom WARN, the extracted suite, updated suite header. The 45 tests must
  remain 45 assertions-equivalents (merged tests keep their assertions; the
  count may drop only where setups merge, never coverage).
- **PR 2 — lower the budget, after evidence**: one green win32 CI run of PR 1
  showing the file total ≤ 150 s is the gate condition; then
  FILE_TIME_BUDGETS `'upgrade-decision-log.test.ts'` drops 600000 → 300000.
  If the run shows 150-220 s, lower to 300 s anyway only with the ~2x rule
  satisfied... it is not — in that case PR 2 is deferred and a second trim
  pass is designed against the measured per-describe timings instead.

## 5. Files to change

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/upgrade-decision-log.test.ts` | modify | v1.7.0 → 2.0.0 (major: suite split + shared fixtures); engine describes dedupe onto per-shape fixtures |
| `tests/unit/upgrade-policy-decisions.test.ts` | create | v1.0.0; the 2 pure-helper describes extracted |
| `scripts/test-runner.ts` | modify | v1.7.0 → 1.8.0; BUDGET-HEADROOM WARN; new budget row for the extracted suite; PR 2 lowers the decision-log row to 300000 |
| `scripts/SCRIPTS.md` | modify | test-runner.ts row bump; extracted-suite row if registry-covered per current conventions |

## 6. Validation

`bun run test:unit` (both suites green locally), then CI on win32 — PR 1's
run is the measurement; PR 2 rides the numbers. The engine behaviors under
test are unchanged (no engine file is touched); the risk is fixture-sharing
errors, mitigated by keeping every existing assertion text verbatim where
possible so review is a diff of scaffolding, not of expectations.

## 7. Rollback

Single-commit revert per PR. PR 2 is a one-line budget value change.
Restoring 600 s requires no code motion.

## 8. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (test infrastructure; no agent/platform config) | N/A |
| Antigravity (GEMINI.md) | None (test infrastructure; no agent/platform config) | N/A |
| templates/common | None — tests/unit/ and scripts/test-runner.ts are L0-only; no L1/L2 surface | N/A |

## 9. Open questions

None. The PR 2 gate condition (one green win32 run ≤ 150 s) is objective; the
deferred-trim fallback is stated in §4.
