---
status: "Proposed"
---

# ADR-0049: `withRetry` Fail-Fast — `isSuccess` Predicate and `classifyError` Wiring

**Status**: Proposed
**Date**: 2026-07-02
**Author**: architect
**Related**: `docs/designs/retry-handler-fail-fast-design.md`, `memory/meeting-2026-07-02-withretry-nothrow-masks-gh-pr-create-fai.md`

## Context

`withRetry()` in `scripts/retry-handler.ts` determines success or failure exclusively by whether the wrapped `fn()` throws. Bun Shell's `.nothrow()` modifier is designed to suppress exceptions on non-zero exit codes, resolving instead to a `{exitCode, stdout, stderr}` object. Because `withRetry` never inspects that object, any `.nothrow()`-wrapped shell command is unconditionally logged and returned as `"Success on attempt 1"`, regardless of its real exit code.

This was discovered via a real incident pattern: the three `gh pr create` branches in `scripts/dev-sync.ts` (lines 271–290) wrap calls in `withRetry(() => $\`gh pr create ...\`.nothrow(), ...)` and discard the return value entirely. A failed `gh pr create` (e.g., an HTTP 401 from an expired token) is silently treated as success, and `dev-sync.ts` exits 0 having created no pull request — the `/sync` pipeline's final step appears to succeed while its actual deliverable (the PR) does not exist.

A parallel code path — the `git push` block at `dev-sync.ts:252–262` — happens to avoid this defect by manually re-checking `pushProc.exitCode` after the `withRetry` call returns. This is "correct by accident," not by design: nothing in `withRetry`'s contract requires or documents this re-check, so it is easy to omit, and was in fact omitted at three of four call sites in the same file. A fifth call site with the identical pattern, `scripts/dispatch-parallel.ts:104–119`, was found during this design's verification pass; it also happens to re-derive success from `exitCode` independently rather than trusting `withRetry`'s `.success` field.

Separately, `retry-handler.ts` already contains `classifyError()` (categorizes an `Error` into `'tool' | 'context' | 'logic' | 'external'`, with `'tool'` intended to catch permission/access-denied patterns) and `escalateToHuman()` — both exported, both unused by any caller. Because they are wired to nothing, a non-retryable error such as an auth failure currently consumes the full retry budget (up to 3 attempts, exponential backoff up to `maxDelay`, roughly 13–14 seconds by default config) before the caller gives up, even though the second and third attempts cannot possibly succeed.

`scripts/retry-handler.ts` is not workspace-root-scoped in effect: it is registered in `scripts/SCRIPTS.md` as layer `L0+L1` and propagates to `templates/common/scripts/retry-handler.ts` automatically via the `/sync` pipeline's `propagate-to-templates.ts` step, covered by the generic `"scripts"` domain in `scripts/propagation-map.json` (no per-file exclusion). Any change to `withRetry`'s contract therefore reaches every L1/L2 project that inherits this script, not just workspace-root callers — which is why this decision is recorded as an ADR rather than handled as an ad-hoc patch.

## Decision

Extend `RetryConfig` with an optional `isSuccess?: (result: unknown) => boolean` predicate. When omitted, `withRetry`'s behavior is unchanged byte-for-byte (throw = failure, return = success) — this is a strict backward-compatible addition, not a breaking change to the function's contract.

When `isSuccess` is supplied and returns `false` for a given `fn()` result, `withRetry` treats that outcome exactly as it treats a thrown error: it synthesizes an `Error` from the result (preferring `result.stderr`, falling back to an exit-code-derived message), logs the failure, and feeds it into the same retry/backoff decision point a caught exception would use.

That decision point is extended to call the existing `classifyError(error)` before committing to another retry attempt. If the classification is `'tool'` (the bucket intended for permission/access-denied failures, e.g., a `401`/`403`), `withRetry` fails immediately — it does not enter the backoff delay and does not consume the remaining `maxRetries` budget. All other classifications proceed through the existing retry/backoff loop unchanged. `escalateToHuman` remains caller-invoked, not auto-invoked by `withRetry` — this decision governs only the internal retry/backoff gate, not who gets notified of a terminal failure.

All five current call sites that wrap `.nothrow()` shell results (`dev-sync.ts` push block + 3× `gh pr create` branches, `gen-pr-body.ts`'s `claude -p` call, and `dispatch-parallel.ts`'s dispatch call) adopt `isSuccess: (r) => r.exitCode === 0` and are updated to trust `withRetry`'s returned `.success`/`.result` rather than independently re-deriving exit-code logic. The two sites that previously carried a manual re-check as an accidental workaround (`dev-sync.ts` push block, `dispatch-parallel.ts`) retain a simplified re-check that reads `RetryResult.success` as defense-in-depth against a future regression in `isSuccess` wiring, rather than being deleted outright — full rationale and the alternative considered are recorded in the design doc's Trade-offs table (#3).

This is treated as an L0-only implementation task. No `templates/common` file is edited directly; the fix reaches L1 automatically on the next `/sync` run through existing propagation machinery, consistent with how `retry-handler.ts` has always been maintained.

## Consequences

**Positive:**
- Closes the specific reported defect: a failed `gh pr create` now correctly causes `dev-sync.ts` to exit non-zero with a visible error, instead of silently exiting 0.
- Removes the "every caller must remember to re-check exit code" trap structurally, rather than patching the three call sites that forgot and leaving the pattern available to the next caller of `withRetry`.
- Non-retryable auth/permission failures fail in ~1 attempt instead of ~13–14 seconds of guaranteed-futile retries, improving diagnostic latency and reducing repeated-auth-attempt exposure against GitHub's API (security-expert's concern from the meeting).
- Activates `classifyError`/`escalateToHuman`, removing two functions' dead-code status.
- Zero-regression guarantee for existing throw-based callers, verifiable directly against `retry-handler.ts`'s own `import.meta.main` CLI self-test, which passes no `isSuccess`.
- Change propagates to `templates/common` (L1) automatically via existing `/sync` machinery — no separate template-authoring effort required.

**Negative / risks:**
- `classifyError`'s `'tool'` classification currently matches only `message.includes('permission') || message.includes('access denied')`. Whether `gh pr create`'s actual `401`/`403` stderr text matches this regex is **unverified** as of this decision (assigned to security-expert, meeting action item A-04). If it doesn't match, the fail-fast path silently degrades to the pre-ADR retry-then-fail behavior for that specific case — the failure is still correctly detected and reported (AC-1 still holds), just not fast-failed (AC-2 does not trigger). This is a bounded, non-silent degradation, not a masking regression, but the regex may need extension after empirical verification.
- Adds a small amount of duplicated defense-in-depth logic (the retained-but-simplified manual re-checks) rather than a single, purely centralized source of truth. This is an explicit, documented trade-off (design doc Trade-off #3), not an oversight — reversible later if the team prefers strict minimalism.
- `RetryConfig`'s `isSuccess` is typed as `(result: unknown) => boolean` rather than `(result: T) => boolean` to avoid making `RetryConfig` itself generic, which would be a breaking signature change for existing non-generic `RetryConfig` values (e.g., `DEFAULT_CONFIG`). Callers narrow `unknown` internally. This is a minor type-safety compromise at the config boundary, scoped to this one field.
- Every downstream L1/L2 project that has previously copied or diverged from `templates/common/scripts/retry-handler.ts` (rather than staying in sync via propagation) will not receive this fix automatically and may need manual reconciliation — out of scope for this ADR to enumerate, flagged as a general propagation caveat.

**Follow-ups (not blocking this decision):**
- security-expert to verify `gh pr create`'s real `401`/`403` stderr text against `classifyError`'s matcher and extend the regex if needed (meeting action item A-04).
- Confirmed during this design's verification (not previously tracked): `dispatch-parallel.ts` has the same latent pattern as the `git push` block and is included in this ADR's scope as a fifth call site, closing meeting action item A-05 for that specific file.
