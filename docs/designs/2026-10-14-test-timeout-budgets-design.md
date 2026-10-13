# Test Runner Timing Budgets for Slow CI Runners — bun per-test ceiling + per-file suite overrides

- **Date**: 2026-10-14
- **Status**: Implemented
- **Spec ID**: 2026-10-14-test-timeout-budgets-design
- **Related**: CI run 38412124373 (windows-latest failure on the PR #1542 merge), CHANGELOG 2026-10-12 hook-post-write-lifecycle 30s→120s entry (same flake family), T-20261004-011 (prior mcp-upstream-server win32 flake remediation), `scripts/test-runner.ts`, `scripts/SCRIPTS.md`

## 1. Background

CI run 38412124373 (the PR #1542 merge onto main) failed the `windows-latest` job with three unit-test files failing while **every individual assertion passed**:

| File | Failure mode | Detail |
|------|--------------|--------|
| `tests/unit/mcp-upstream-server.test.ts` | Runner file timeout (120s) | ~60 tests, each spawning server child processes; file killed at the suite wall. The one in-file failure (E13d, 5.68s) overran bun's implicit 5000ms per-test default. |
| `tests/unit/upgrade-tree-sync.test.ts` | Runner file timeout (120s) | Full `upgrade-project` runs per test take 15–30s on win32; cumulative total exceeds 120s with all tests passing. |
| `tests/unit/script-registry-audit.test.ts` | bun per-test timeout (5s) | The "validate-templates.ts missing templates/common" test copies the whole `scripts/` tree and spawns bun in a temp dir — 5.27s on win32, 0.13s on macOS (≈40x). |

The merge commit itself (VERSION_MANIFEST.md, memory log, a Dockerfile pin bump) touches none of these files, and runs #1540/#1541 passed the identical suite hours earlier. The root cause is timing margin, not a regression: windows-latest runners are an order of magnitude slower on process spawn + filesystem work, and the unit suite runs 185 files at concurrency 4 on a small runner.

Two independent budget mechanisms are involved:

1. **Runner kill budget** (`scripts/test-runner.ts` → `executeTestFile`): kills the whole `bun test` child at `suite.timeout` (unit: 120000ms).
2. **Bun per-test ceiling**: bun's implicit default 5000ms per `test()`. bun 1.4 **ignores a `bunfig.toml` `[test] timeout` key** (verified empirically with bun 1.4.3: a 500ms bunfig value did not fire), so the only working knob is the `bun test --timeout <ms>` CLI flag.

## 2. Goals / Non-Goals

**Goals**

- G1: Raise the bun per-test ceiling above the observed win32 worst cases without weakening any assertion.
- G2: Give files whose legitimate wall time exceeds the suite defaults a larger runner kill budget, keyed per file (basename, OS-independent).
- G3: Keep an explicit `--timeout` CLI flag as the highest-priority override for manual runs.
- G4: Zero behavior change on healthy/fast runners (macOS, linux) — budgets only ever absorb slack.

**Non-Goals**

- N1: Not changing any test assertion. E13d's remaining wall-clock bounds (`<450ms` ping ordering, `<2500ms` fallback) are a separate, deliberate timing-semantics decision (T-20261004-011) and stay as-is; if they flake again on win32, that is a follow-up design change.
- N2: Not changing CI workflow concurrency, runners, or the bun pin.
- N3: Not splitting slow test files or optimizing `upgrade-project` test speed.

## 3. Design

`scripts/test-runner.ts` v1.5.0:

1. **`DEFAULT_TEST_TIMEOUT_MS = 15000`** — passed as `bun test --timeout 15000 <file>` for every bun-test-mode file (the `scripts` suite runs as plain `bun <file>` and is unaffected). 15s is ≥3x the worst observed overran-outside-the-list case (5.68s) and keeps genuinely hung tests loud.
2. **`FILE_TIME_BUDGETS`** — basename-keyed `{ suite, test }` overrides:
   - `mcp-upstream-server.test.ts` → suite 300000ms, test 30000ms (observed: file >120s, max test 5.7s → ~2.5x / ~5x headroom)
   - `upgrade-tree-sync.test.ts` → suite 300000ms, test 60000ms (observed: file >120s, max test 29.8s → ~2.5x / 2x headroom)
3. **Precedence** (in `resolveBudgets`): explicit CLI `--timeout` → `FILE_TIME_BUDGETS[basename(file)]` → suite default (kill) / `DEFAULT_TEST_TIMEOUT_MS` (per-test).
4. The FAIL report line prints the file's resolved suite budget instead of a single suite-wide number.

## 4. Risks

- A test that relied on bun's 5s default to time out cannot exist productively (a passing suite never exercises a timeout), and raising the ceiling can only turn spurious failures into passes. Verified against the full local suite at the sync gate (version-bump gate runs `bun run test:unit` for the @version bump).
- Longer worst-case windows-runner duration (~+2–3 min when the heavy files actually need the budget). Acceptable: the job has no `timeout-minutes` pressure at that scale.
- Per-file override list is manual: a future heavy file must be added here. Mitigated by the FAIL line printing the resolved budget, making the needed value obvious.

## 5. Acceptance

- `bun scripts/typecheck.ts` clean (typecheck gate).
- Targeted files pass locally; full `bun run test:unit` passes via the sync version-bump gate.
- CI windows-latest job green on the PR.
