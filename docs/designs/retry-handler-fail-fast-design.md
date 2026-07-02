# Design: `withRetry` Fail-Fast Predicate + Error Classification

- **Status**: Proposed
- **Author**: architect (L0)
- **Date**: 2026-07-02
- **Spec source**: `memory/meeting-2026-07-02-withretry-nothrow-masks-gh-pr-create-fai.md` (action items A-02/A-03)
- **Related**: ADR-0049 (see below)

## Summary

`withRetry()` in `scripts/retry-handler.ts` (lines 37–81) determines success/failure solely by whether the passed `fn()` throws. Bun Shell's `.nothrow()` modifier suppresses the throw on non-zero exit codes and instead resolves to `{exitCode, stdout, stderr}`, so any `.nothrow()`-wrapped shell command is unconditionally reported as `"Success on attempt 1"` — including real, persistent failures such as a `401` from `gh pr create`. Callers that don't manually re-check the exit code (the three `gh pr create` branches in `scripts/dev-sync.ts`) silently exit 0 having created no PR.

This design adds an optional `isSuccess?: (result: T) => boolean` predicate to `RetryConfig`, wires the existing-but-unused `classifyError`/`escalateToHuman` functions into the failure path so non-retryable errors (auth/permission) fail on attempt 1 instead of burning the full retry+backoff budget, and applies the resulting mechanism to all five current `withRetry` call sites (four flagged in the meeting, plus one — `dispatch-parallel.ts` — found during this design pass that has the identical latent defect, currently masked by a manual re-check).

The change is scoped entirely to `scripts/retry-handler.ts`, `scripts/dev-sync.ts`, `scripts/gen-pr-body.ts`, and `scripts/dispatch-parallel.ts` — all L0 (workspace root) files. No `templates/common` edit is required as part of this task; propagation happens automatically through the existing `/sync` pipeline (see Platform Impact).

## Files to change

| File | Change | Risk |
|---|---|---|
| `scripts/retry-handler.ts` | Add `isSuccess?: (result: T) => boolean` to `RetryConfig`; change `withRetry`'s try block to treat a predicate-false result as a failure; on failure (thrown or predicate), run `classifyError` and fail immediately without consuming remaining retries/backoff when classified `'tool'` | Medium — core shared logic, but additive/opt-in |
| `scripts/dev-sync.ts` (~lines 252–262, git push block) | Pass `isSuccess: (r) => r.exitCode === 0` to the existing `withRetry` call; decide fate of the manual `pushProc?.exitCode !== 0` re-check (see Trade-offs #3) | Low |
| `scripts/dev-sync.ts` (~lines 271–290, 3× `gh pr create` branches) | Pass `isSuccess: (r) => r.exitCode === 0`; use `withRetry`'s return value (currently discarded) to detect failure and `process.exit(1)` with an error message instead of falling through silently | Medium — closes the actual reported bug |
| `scripts/gen-pr-body.ts` (~lines 144–148) | Pass `isSuccess: (r) => r.exitCode === 0` to the `claude -p` call; existing `if (body)` fallback logic stays as defense-in-depth | Low |
| `scripts/dispatch-parallel.ts` (~lines 104–119) | Pass `isSuccess: (r) => r.exitCode === 0`; the manual `exitCode !== 0` check at line 119 becomes redundant with upstream detection — apply the same simplify-or-keep decision as the push block (Trade-offs #3) | Low |

No new files. No directory structure changes.

## Directory structure

Not applicable — no new files or directories.

## Verified against current code

I read all four files referenced in the meeting plus `dispatch-parallel.ts` directly before finalizing this design. Findings vs. the meeting's assumptions:

- **`retry-handler.ts`**: Meeting's line numbers hold. `withRetry` is lines 37–81 (meeting said 37–60; the function actually runs to 81, the retry/backoff loop and final failure return are below the success-path lines the meeting quoted — same function, more of it). `escalateToHuman` is lines 86–105, `classifyError` is lines 111–125. Both confirmed dead code — `export`ed at line 142 but not imported anywhere outside `retry-handler.ts` itself.
- **`dev-sync.ts`**: Git push block is lines 252–262 (matches meeting). The three `gh pr create` branches are lines 271–290 (matches meeting) and confirmed the return value of `withRetry(...)` is discarded in all three (no `await` binding used, no exit-code check, no `.success` check).
- **`gen-pr-body.ts`**: `withRetry` call is lines 144–148 (matches meeting). Confirmed the `try`/`catch` around it falls through to a template fallback on any thrown error, and separately checks `if (body)` after extracting `claudeRes?.stdout` — so a non-zero exit with non-empty stdout is the one scenario that currently slips through un-caught (matches meeting's "lower-risk today" framing, but this design closes it explicitly).
- **New finding, not in the meeting**: `scripts/dispatch-parallel.ts:104–119` has the exact same `withRetry(() => $\`...\`.nothrow(), ...)` pattern, but is "correct by accident" — it discards `dispatchRetry.success` and instead extracts `proc.exitCode` from `dispatchRetry.result` (falling back to `exitCode: 1` if `result` is undefined) and checks it at line 119. This is architecturally identical to the git push block's workaround. The meeting's auditor action item A-05 ("audit `dispatch-parallel.ts` and other `withRetry` callers") was still open/unconfirmed at meeting close — this design closes that gap by including it as a fifth call site, since fixing the shared mechanism without updating this call site would leave one more caller relying on manual re-checks that the new predicate makes unnecessary.

## Mechanism design

### 1. `RetryConfig` predicate (meeting conclusion #1)

```
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  isSuccess?: (result: unknown) => boolean;   // NEW, optional
}
```

Contract: when `isSuccess` is `undefined`, behavior is byte-for-byte identical to today (throw = failure, return = success). This is the zero-regression guarantee requested in the meeting and covered by AC-3.

When `isSuccess` is provided:
- `fn()` resolves without throwing → call `isSuccess(result)`.
  - `true` → treat as success (existing return shape).
  - `false` → treat as a failure *of this attempt*, equivalent to a caught exception. Synthesize an `Error` (see below) and route it through the same failure path a thrown error would take (logging, classification, retry/backoff decision).

### 2. Error synthesis for predicate failures

Shell-command results from `.nothrow()` expose `{exitCode, stdout, stderr}`. When `isSuccess` returns `false`, `withRetry` must build an `Error` before it can reuse `classifyError`, which requires an `Error.message`. Proposed synthesis, in priority order:

1. `result.stderr` (stringified, trimmed) if present and non-empty.
2. Fallback: `` `Command failed with exit code ${result.exitCode}` `` if `stderr` is empty (some CLI failures write nothing to stderr).

This requires `withRetry` to introspect `result` defensively (duck-typing `stderr`/`exitCode` fields) since `T` is generic and not necessarily a Bun Shell result — the predicate mechanism must not assume every `T` has these fields. Only reached when `isSuccess` is supplied, so plain throw-based callers never hit this path.

### 3. Wiring `classifyError` (meeting conclusion #2)

Whether a failure arrives via `catch (error)` or via a false predicate synthesizing an `Error`, both must now funnel through one decision point:

```
error → classifyError(error) → if 'tool': fail immediately (no further retry, no backoff)
                              → else: existing retry/backoff loop, unchanged
```

"Fail immediately" means: do not enter the `if (attempt < config.maxRetries)` backoff branch, and return `{ success: false, attempts: attempt, lastError, totalTime }` right away — attempts reported reflects only the attempts actually made (1), not `config.maxRetries`, so callers/logs accurately show a fail-fast exit rather than implying all retries ran.

`escalateToHuman` remains caller-invoked (as it is today in the CLI self-test block), not auto-invoked inside `withRetry` — the meeting did not propose changing who calls `escalateToHuman`, only that `classifyError` gates the retry loop. Keeping `escalateToHuman` caller-side avoids `withRetry` printing escalation banners for every fail-fast case regardless of whether the caller wants that (e.g., `gen-pr-body.ts`'s fallback-template path doesn't want an escalation banner — it recovers silently).

### 4. Call-site changes

All five sites pass `isSuccess: (r) => r.exitCode === 0` (or equivalent typed accessor) and switch from discarding/re-deriving success to trusting `withRetry`'s returned `.success` field directly.

## Trade-offs considered

| # | Decision | Options | Choice | Rationale |
|---|---|---|---|---|
| 1 | Where does exit-code interpretation live? | (a) Keep it caller-side (status quo — each caller re-checks `exitCode`); (b) Move into `withRetry` via predicate | (b) | Meeting consensus: caller-side re-checks are what caused the bug (3 of 5 call sites simply forgot). A structural fix in the shared module removes the "remember to re-check" burden from every future caller. |
| 2 | Default value of `isSuccess` | (a) Default to `() => true` (meeting's architect proposal, round 1); (b) Default to `undefined` and special-case "not provided" as today's throw-only behavior | (b) | Functionally equivalent for existing callers, but (b) is more explicit in code — `if (config.isSuccess && !config.isSuccess(result))` reads as "predicate active only when supplied," avoiding a subtle footgun where a caller passes `isSuccess: () => true` thinking it's a no-op default when it actually is one. Behaviorally identical outcome to the meeting's proposal; this is an implementation-detail refinement, not a scope change. |
| 3 | Fate of the manual exit-code re-checks in `dev-sync.ts` (push block) and `dispatch-parallel.ts` after the predicate makes them redundant | (a) Remove them — trust the predicate exclusively; (b) Keep them as defense-in-depth | **(b) Keep, but simplify** | Explicit call requested by the task: removing them entirely means a bug in the *predicate wiring itself* (e.g., someone forgets to pass `isSuccess` in a future edit) silently regresses to the old masking behavior with no second line of defense. Keeping the manual check but simplifying it to consume `result.success` (the `RetryResult.success` field, now authoritative) rather than re-deriving from `.result.exitCode` keeps a safety net while removing the duplicate exit-code-extraction logic. Net: fewer lines, same defense-in-depth property, and the check now agrees with `withRetry`'s own verdict instead of re-deriving it independently. |
| 4 | Scope: fix `withRetry` alone vs. also touch `dispatch-parallel.ts` | (a) Limit to the 4 sites named in the meeting; (b) Include `dispatch-parallel.ts` as a 5th site | (b) | The meeting's own auditor flagged `dispatch-parallel.ts` as unconfirmed (A-05, still open). This design's code review found it has the identical latent defect. Fixing the shared mechanism while knowingly leaving a confirmed 5th instance unpatched would mean the "structural fix" claim is incomplete at ship time. Including it keeps A-05 from becoming a follow-up bug report next week. |
| 5 | Where `escalateToHuman` gets invoked | (a) Auto-invoke inside `withRetry` on fail-fast; (b) Leave invocation caller-controlled, only gate the retry loop inside `withRetry` | (b) | Not all callers want an escalation banner printed on every fail-fast (e.g., `gen-pr-body.ts` recovers via template fallback). Matches meeting scope — only `classifyError` gating was proposed for `withRetry` internals; `escalateToHuman` stays opt-in per caller, as it is today. |

## Cross-platform considerations

- No OS-specific code introduced. `isSuccess` is a plain predicate function; `classifyError` is pure string matching on `Error.message`. Confirmed safe on both Windows Git Bash and Unix Bash runners per automation-engineer's meeting note (round 2).
- Bun Shell's `.nothrow()` and the `{exitCode, stdout, stderr}` result shape are already cross-platform (Bun Shell abstracts over cmd/sh); this design does not change how commands are invoked, only how their results are interpreted.
- `result.stderr`/`result.stdout` are Bun `Buffer`-like objects requiring `.toString()` — existing call sites already do this correctly (e.g., `dev-sync.ts:259`); the synthesized-`Error` construction in `withRetry` must do the same defensively, matching existing patterns in the codebase.

## Platform Impact

| Platform | Impact | Justification |
|---|---|---|
| Claude Code (CLAUDE.md) | None | No CLAUDE.md changes — this is a script-logic fix, not a workflow/gateway/hook change. |
| Antigravity (GEMINI.md) | None | No GEMINI.md changes — `retry-handler.ts` is not agent/skill/command surface; GEMINI.md governs agent-facing behavior, not internal script contracts. |
| `templates/common` (L1) | **Automatic propagation — no separate template-side edit required in this task** | `scripts/retry-handler.ts` is registered in `scripts/SCRIPTS.md` as layer `L0+L1` and is covered by the generic `"scripts"` domain in `scripts/propagation-map.json` (`source: "scripts"`, `target: "templates/common/scripts"`, `include_pattern: "*.ts"`, no exclusion listed for `retry-handler.ts`). The `/sync` pipeline's step 4.7 (`scripts/propagate-to-templates.ts --apply`) copies the L0 file to `templates/common/scripts/retry-handler.ts` verbatim. Confirmed the two copies are currently byte-identical (empty diff at design time), consistent with straight-copy propagation, not a diverging fork. **Per CLAUDE.md §9 (Workspace & Template Boundary Policy), this task must not manually touch `templates/` files** — the L1 copy updates automatically on the next `/sync` run after this L0 change lands. `dev-sync.ts`, `gen-pr-body.ts`, and `dispatch-parallel.ts` are also plain `scripts/*.ts` files covered by the same domain and propagate the same way. |

**Explicit answer to the meeting's open scope question**: this is an **L0-only change that propagates automatically via existing `/sync` machinery**. Nothing about the predicate/classifyError mechanism requires template-side awareness, divergence, or a variant-specific override — `templates/common/scripts/retry-handler.ts` and its three sibling files should end up identical to the L0 versions after the next successful `/sync`, exactly as they are today.

## Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| AC-1 | All `withRetry(...)` calls wrapping `.nothrow()` shell commands correctly report failure on non-zero exit code | Force a `gh pr create` 401 (or mock), confirm the script exits non-zero with an explicit error message — not `"Success on attempt 1"` |
| AC-2 | Non-retryable errors (classified `'tool'`, e.g. auth/permission) fail on attempt 1 without exhausting `maxRetries`/backoff | Simulate a 401/403-style stderr, confirm exactly 1 attempt is logged and no backoff delay elapses (should complete near-instantly, not ~13–14s) |
| AC-3 | Existing throw-based `withRetry` callers (no `isSuccess` passed) show no behavior change | Run `bun scripts/retry-handler.ts` (the `import.meta.main` CLI self-test at the bottom of the file) before and after the change; output and exit code must be identical — the self-test itself does not pass `isSuccess`, so it directly exercises the zero-regression path |
| AC-4 (added) | All 5 call sites (`dev-sync.ts` ×4, `gen-pr-body.ts` ×1, `dispatch-parallel.ts` ×1 — note: dev-sync.ts has 4 total: push + 3× gh pr create) pass `isSuccess` and trust `withRetry`'s returned `.success`/`.result` instead of independently re-deriving exit-code logic where redundant | Code review: grep for `.nothrow()` in `scripts/*.ts`, confirm every result feeds into a `withRetry` call with `isSuccess` set, and that no call site silently discards the return value the way the pre-fix `gh pr create` branches did |
| AC-5 (added) | The manual re-checks retained per Trade-off #3 read `result.success` (the `RetryResult` field) rather than re-deriving from `.result.exitCode`, so there is exactly one source of truth for success/failure per call | Code review of the simplified push block and `dispatch-parallel.ts` block |

## Open questions

1. **(Carried from meeting, explicitly out of scope for this design per task instructions)** Does `gh pr create`'s actual stderr text on a real `401`/`403` match `classifyError`'s current regex (`message.includes('permission') || message.includes('access denied')`)? This is a **dependency/risk**, not a blocker: if the regex misses GitHub CLI's actual wording, AC-2 will not trigger for that specific case (the failure will still be correctly detected and reported per AC-1, it will just retry 3x with backoff instead of failing fast on attempt 1 — a degraded-but-safe outcome, not a masked failure). Assigned to security-expert per the meeting's action item A-04; the classifier can be extended with the real string once verified.
2. **For PM/user decision**: Trade-off #3 (keep-but-simplify manual re-checks as defense-in-depth) is this design's explicit recommendation, but it does add a small amount of "belt and suspenders" code versus a purer single-source-of-truth design. If the team prefers strict minimalism (option (a): delete the manual checks entirely and trust the predicate exclusively), that's a one-line change to the implementation plan — flagging for explicit sign-off since the task instructions required an unambiguous call, and this design's call is "keep, simplified," not "remove."
3. **Not addressed by this design, surfaced during code verification**: `gen-pr-body.ts`'s fallback path (line 156, bare `catch {}`) swallows the synthesized error from a predicate-driven fail-fast the same way it swallows today's thrown errors — this is consistent with existing behavior (falls through to template fallback) and is not a regression, but it does mean AC-2's "fail fast on attempt 1" is only externally observable via faster wall-clock time and log content for this call site, not via a non-zero process exit (the script recovers and exits 0 with a fallback body). Confirmed this matches the meeting's characterization ("lower-risk today... a template fallback") — noting it here so it isn't mistaken for an AC-2 failure during implementation review.
4. **Naming/typing detail for automation-engineer**: `RetryConfig` is currently a concrete (non-generic) interface, while `withRetry<T>` is generic over the returned type. `isSuccess?: (result: T) => boolean` cannot be declared directly on `RetryConfig` without either making `RetryConfig` generic (`RetryConfig<T>`) or typing `isSuccess` as `(result: unknown) => boolean` and letting callers narrow internally. Recommend the latter (`unknown`) to avoid a breaking generic-signature change to `RetryConfig`'s existing non-generic call sites (`DEFAULT_CONFIG: RetryConfig` at line 27 has no type parameter today). This is an implementation detail but worth flagging before automation-engineer starts, since it affects the exact type signature.
