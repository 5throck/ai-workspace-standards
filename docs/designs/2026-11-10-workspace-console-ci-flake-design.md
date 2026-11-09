# Workspace Admin-Console CI Flake — Windows Time Budget and M5 Rejection Containment — Design (Row 0)

- **Spec id**: `2026-11-10-workspace-console-ci-flake-design`
- **Date**: 2026-11-10
- **Status**: implemented (spec registered via spec-register at implementation; tracking ticket T-20261110-001)
- **Author**: automation-engineer (PM-dispatched)
- **Tracking ticket**: T-20261110-001
- **Related**: `scripts/test-runner.ts` FILE_TIME_BUDGETS mechanism (T-20261106-008, v1.10.0), PR #1942 CI run 42656818953 (attempt 1 mode b / attempt 2 mode a / attempt 3 PASS), PR #1945 CI (two failures then a pass), precedent T-20261105-001 (mcp-upstream-server win32 flake), `tests/unit/co-workspace-admin-console.test.ts` (review M5), `services/co-workspace/src/routes/admin/users.ts` (CSV import — read-only reference, NOT modified)

## 1. Problem statement

`tests/unit/co-workspace-admin-console.test.ts` (66 tests — sqlite stores, tmpdir fixtures, argon2 hashing via `Bun.password.hash`) fails intermittently on windows-latest with two alternating modes on an identical base where PR-3's CI passed all platforms first try; root cause is win32 platform timing variance, not the PRs' diffs:

- **Mode (a) TIMEOUT**: the heavy async service suite exceeds the unit suite's default 120s per-file wall. Same shape as the v1.6.0 upgrade-decision-log override: individual tests are not hanging; the file is killed at the suite wall.
- **Mode (b) LEAK**: the review M5 test ("a failure part-way through still writes the user.import audit row") stubs `createTempPasswordAsync` to throw `Error("simulated hash failure")` on the second call. The server's 500 handler consumes and logs the rejection and the test awaits the 500 response, but on windows-latest bun's native async hash machinery can deliver residual settle callbacks after the test body returns; the rejection surfaces as an unhandled error and aborts the whole `bun test` run.

## 2. Goals and non-goals

**Goals**

- G1: Join the file to the existing FILE_TIME_BUDGETS mechanism (extend, not invent) with a single budget sized for the slowest observed platform — the mechanism's rows are basename-keyed and OS-independent, and adding per-platform rows would be a larger mechanism change than the ticket warrants.
- G2: Contain the M5 rejection deterministically inside the test so the simulated throw is always consumed before the test finishes, without weakening any assertion (500 status, async-path-not-sync-hasher contract, cap behavior, audit row).
- G3: Keep the change mechanism-first and compact: one budget row, one test-file containment block, version-bump lockstep, Design Gate spec.

**Non-goals**

- No change to `services/co-workspace/src` — the service is correct (the 500 handler catches the throw; the audit row writes in `finally`).
- No suite split or test trimming (the v1.8.0 split/trim review trigger — two raises in one quarter — does not apply; this is a first-time row).
- No per-platform budget support in the runner (evaluated; deferred — the family budget has ≥2.5x headroom over the observed healthy win32 ceiling).

## 3. Design

### 3.1 Budget (mode a)

`scripts/test-runner.ts` FILE_TIME_BUDGETS gains `"co-workspace-admin-console.test.ts": { suite: 300000, test: 45000 }`.

Evidence basis: healthy win32 attempts complete inside the 120s cap (run 42656818953 attempt 3; PR #1945's pass), so the observed healthy win32 ceiling is <120s; the same base runs ~1s on macOS (66 tests, measured locally 2026-11-10). Suite 300s keeps ≥2.5x over that ceiling and absorbs the win32 FS-pressure variance band — the family convention (mcp-upstream-server, upgrade-tree-sync, upgrade-decision-log, hub-bootstrap all sit at 300s). Test ceiling 45s follows the hub-bootstrap precedent; no per-test timeout was implicated in either failure mode. First-time row under the v1.9.0 ticket-evidence policy (a raise would require CI-run evidence; this entry cites run 42656818953).

### 3.2 Containment (mode b)

In the M5 audit test, after the `expect(res.status).toBe(500)` assertion (the 500 response is already awaited — the handler consumes the throw), the test drains the microtask/macrotask queue with three `setTimeout(0)` rounds before asserting the audit row. Any residual settle callback from the import's native async hash machinery therefore lands inside the test's awaited scope instead of after bun test has moved on. Assertions are unchanged and nothing is weakened: the stub still throws, the handler still consumes it, the 500 status and audit-row content (`created=1`, `skipped=1`, `reasons=login_taken:1`, `error=Error`) are still asserted.

Honest limitation: macOS cannot reproduce either Windows mode locally (the suite runs in ~1s); the containment addresses the scheduling window the CI evidence identifies, and the budget addresses the timeout mode directly.

## 4. Affected surfaces

- `scripts/test-runner.ts` v1.10.0 → v1.11.0 (budget row + header entry; no runner logic change).
- `tests/unit/co-workspace-admin-console.test.ts` → `@version 1.1.0` (header added; M5 containment block).
- `scripts/SCRIPTS.md` test-runner row (version + note, lockstep).
- `docs/lifecycle/scripts/test-runner.md` (phase-history row, lockstep).
- `docs/designs/2026-11-10-workspace-console-ci-flake-design.md` (this spec).

## 5. Acceptance criteria

- A1: The FILE_TIME_BUDGETS row resolves for the unit suite (runner picks it up by basename; `bun run test:unit` green on macOS).
- A2: `bun test ./tests/unit/co-workspace-admin-console.test.ts` — 66/66 pass, 0 fail.
- A3: The M5 audit test still asserts 500 + audit row with unchanged content; the drain adds no assertions and removes none.
- A4: `bun scripts/typecheck.ts` and `bun scripts/audit.ts` pass.
- A5: Spec registered via `bun scripts/spec-register.ts --source manual --status implemented` and the doc header flipped to implemented in the same change set.
- A6: Windows CI (next windows-latest run on this base) shows the suite completing under the 300s budget with no unhandled-rejection abort — verified by review of the next CI run, not locally.

## 6. Rollback

Single-commit revert of the change set: remove the budget row (the file returns to the 120s unit default) and the drain block (the test returns to its v1.0.0 body). No data, schema, or service surface is touched; rollback is mechanical and side-effect-free.

## 7. Accessibility exemption

Test-runner and unit-test containment changes only — no user-facing UI surface is modified; the accessibility audit (ADR accessibility gates) is exempt for this change set.
