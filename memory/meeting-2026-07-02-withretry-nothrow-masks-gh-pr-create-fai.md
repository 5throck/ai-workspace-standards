# Meeting Transcript
**Date**: 2026-07-02
**Topic**: withRetry + .nothrow() masks gh pr create failures in scripts/dev-sync.ts — what else needs fixing
**Participants**: automation-engineer, security-expert, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Confirmed prior to the meeting: `withRetry` (scripts/retry-handler.ts:37-60) judges success/failure solely by whether `fn()` throws. Bun's `.nothrow()` suppresses the throw and returns `{exitCode, stdout, stderr}` instead, so any `.nothrow()`-wrapped shell command is reported as `"Success on attempt 1"` by `withRetry` regardless of its real exit code. The `git push` block (dev-sync.ts:252-262) works around this by manually re-checking `pushProc.exitCode` after calling `withRetry`. The three `gh pr create` branches (dev-sync.ts:271-290) do not — they discard `withRetry`'s return value entirely, so a failed `gh pr create` (e.g. HTTP 401) is logged as success and the script exits 0 with no PR created.

## Transcript

**[automation-engineer]**: (Round 1)

Looking at retry-handler.ts:37-60 directly, the root cause is structural: `withRetry` only distinguishes success/failure by whether `fn()` throws. Bun's `.nothrow()` modifier is specifically designed to suppress that exception and hand back a `{exitCode, stdout, stderr}` object instead — so any nothrow-wrapped shell command silently satisfies withRetry's success branch regardless of its actual exit code. This isn't unique to dev-sync.ts; scripts/gen-pr-body.ts:144-148 wraps `$\`claude -p ${prompt}\`.quiet().nothrow()` in the exact same withRetry call, and scripts/dispatch-parallel.ts also imports withRetry — I haven't confirmed whether it has the same nothrow pattern, but it's worth checking before we call this a one-file fix.

The proposed patch (mirror the git push block's manual exitCode check into the three gh pr create branches) is correct and should ship immediately — it's a low-risk change. But it treats the symptom at three call sites while leaving the same trap available to every future caller of withRetry. Architect, should we scope a redesign of retry-handler.ts itself so this class of bug becomes structurally impossible, rather than relying on every caller to remember to double-check exitCode?

---

**[security-expert]**: (Round 1)

Automation-engineer's point about "every future caller" is exactly my concern, but I want to flag something more urgent buried in the specific failure mode raised: a 401 from `gh pr create` is not a transient error — it means the token is invalid, expired, or missing scope. Retrying that three times with exponential backoff (1s, 2s, up to maxDelay 10s) doesn't just fail to report the problem, it burns roughly 13-14 seconds pretending to recover from something that will never succeed on attempt 2 or 3. That's actively harmful: it degrades the user's diagnostic experience, and repeated failed auth attempts against GitHub's API risk tripping abuse rate-limiting on the account.

I also want to note that once this reports false success, nothing downstream in the pipeline knows a PR wasn't created — the `/sync` pipeline treats "commit → push → PR" as a single completed unit. If any hook or later automation assumes a PR exists post-sync, it will be silently wrong. Automation-engineer, does the `gh` CLI actually give us a way to distinguish an auth failure from a transient network failure in its exit code or stderr, or do we have to string-match stderr text?

---

**[architect]**: (Round 1)

Automation-engineer, security-expert — I agree this is a systemic gap, not a three-line patch. The cleanest fix is to change retry-handler.ts's contract: `withRetry` currently assumes "no throw = success," which only holds for callers that let errors propagate. For shell-command callers using `.nothrow()`, `RetryConfig` should accept an optional `isSuccess: (result: T) => boolean` predicate, defaulting to `() => true` so every existing throw-based caller keeps identical behavior — zero regression risk. Shell-command callers then pass `(r) => r.exitCode === 0`, and `withRetry` treats a false predicate exactly like a thrown error, including feeding the retry loop and backoff delay.

That single change fixes the push block's redundant double-check, the three gh pr create branches, and gen-pr-body.ts's claude -p call in one place, and it's additive, not breaking. Security-expert's 401 point is a second, separable problem though — even with a correct predicate, we'd still blindly retry a non-retryable auth error 3 times. I don't think we should conflate "detect failure correctly" with "know when not to retry" in the same patch; the latter needs its own design decision about classifying errors.

---

**[automation-engineer]**: (Round 2)

Architect, the predicate approach is implementable exactly as you describe — I can sketch it now: `RetryConfig` gets `isSuccess?: (result: unknown) => boolean`, and `withRetry`'s try block becomes `const result = await fn(); if (config.isSuccess && !config.isSuccess(result)) throw new Error(...stderr...)`. That's a small, additive change to retry-handler.ts, plus updating the 4 call sites in dev-sync.ts/gen-pr-body.ts to pass the predicate. No OS-specific code, no new dependencies — safe for both Windows Git Bash and Unix. One thing I want on record: retry-handler.ts's `console.log` calls (lines 48, 53, 63, 67) all go to stdout, not stderr. dev-sync.ts doesn't currently parse its own stdout, so this isn't breaking anything today, but if dev-sync's output is ever piped into something that parses stdout, "Success on attempt 1" noise mixed with real data would be a problem. Logging it as a note, not a blocker.

---

**[security-expert]**: (Round 2)

Agreed on the predicate mechanism, automation-engineer, but I want to push on the non-retryable case now rather than defer it — retry-handler.ts already has the tooling for it and it's currently dead code. `classifyError()` at retry-handler.ts:111-125 and `escalateToHuman()` at :86-105 are both exported but never called from dev-sync.ts or gen-pr-body.ts. `classifyError` already checks for "permission" / "access denied" in the error message and returns `'tool'` — that's the right bucket for a 401/403. The fix: once we synthesize an Error from a failed exitCode via the predicate approach, run it through `classifyError`, and if it returns `'tool'`, skip remaining retry attempts and fail immediately instead of exhausting maxRetries with backoff delay.

The one thing I can't verify from here is whether `gh pr create`'s actual stderr text on a 401 contains a string that `classifyError`'s current matcher would catch — GitHub CLI's real auth-failure message needs to be checked against the classifier's regex before we trust it to fire correctly. I don't want to ship a "smart" fail-fast path that still doesn't recognize the exact error it was built for.

---

**[architect]**: (Round 2)

Good catch, security-expert — that clarifies the sequencing for me too. To run a shell-command failure through `classifyError`, we need an `Error` object with a `.message`, so the exitCode-predicate path needs to construct one from `result.stderr` before classification can work. Ordering: predicate fails → build `Error(stderr text)` → `classifyError(error)` → if `'tool'`, throw immediately without honoring remaining `maxRetries`; otherwise proceed with normal backoff retry. That unifies both flows through the existing catch block instead of adding a second parallel decision tree. I'll write this up as a short design note before automation-engineer touches retry-handler.ts, since this is a shared script propagated to `templates/common` (CLAUDE.md §4.7 L0→L1 publish) — a redesign here isn't workspace-root-only, it flows downstream to every L1/L2 project that inherited retry-handler.ts.

---

**[auditor]**: (Synthesis)

The group converged quickly on scope: the immediate exitCode-check patch to dev-sync.ts:271-290 is necessary but not sufficient. Automation-engineer and architect independently identified that the defect is in `withRetry`'s contract itself (success = "did not throw"), which is silently defeated by `.nothrow()` at any call site — not just the three flagged here. Security-expert added a second, previously undiscussed defect: `classifyError`/`escalateToHuman` already exist in retry-handler.ts specifically to handle non-retryable errors like auth failures, but are dead code — nothing in dev-sync.ts or gen-pr-body.ts calls them, so a 401 currently gets 3 full retry attempts with backoff instead of failing fast.

**Points of Agreement**:
1. Root cause confirmed: `withRetry` treats "no exception" as success; `.nothrow()`-wrapped shell commands defeat this. Affects dev-sync.ts:271-290 (gh pr create ×3) and gen-pr-body.ts:144-148 (claude -p), not just the originally-reported gh pr create case.
2. The push-block-style manual exitCode check is the correct immediate patch but does not prevent recurrence at future call sites.
3. retry-handler.ts needs a structural fix: add an optional `isSuccess: (result) => boolean` predicate to `RetryConfig`/`withRetry`, defaulting to current throw-based behavior (no regression for existing callers).
4. `classifyError`/`escalateToHuman` are implemented but unused dead code; wiring `classifyError` into the failure path lets non-retryable errors (auth/permission) fail fast instead of wasting ~13-14s across 3 retries with backoff.
5. Because retry-handler.ts is propagated to `templates/common` (L0→L1 publish), any redesign here is not workspace-root-scoped — it needs a proper design pass, not an ad-hoc edit.

**Open Disagreements / Unresolved Questions**:
- Security-expert flagged that `classifyError`'s current regex (matches "permission"/"access denied") is unverified against `gh pr create`'s actual stderr text on a real 401 — needs to be checked empirically before the fail-fast path is trusted.
- Whether `dispatch-parallel.ts`'s use of `withRetry` has the same nothrow-masking pattern is unconfirmed — automation-engineer raised it but no one verified.

**Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Add exitCode check to the 3 `gh pr create` branches in dev-sync.ts:271-290, mirroring the git push block pattern (immediate hotfix) | L0-only (scripts/*.ts, no CLAUDE.md/GEMINI.md/agent-config change) | 4 |
| A-02 | architect | High | Design note/ADR: add optional `isSuccess` predicate to `RetryConfig`/`withRetry`, plus wiring `classifyError` into the failure path for fail-fast on non-retryable errors; must account for `templates/common` propagation | L0-only | 2 |
| A-03 | automation-engineer | Medium | Implement approved design: retry-handler.ts predicate + classifyError wiring, update the 4 callsites (push, 3× gh pr create, gen-pr-body claude call) | L0-only | 4 |
| A-04 | security-expert | Medium | Verify `gh pr create`'s real stderr text on a 401/403 against `classifyError`'s matcher; extend the regex if it doesn't currently catch it | L0-only | 5 |
| A-05 | auditor | Low | Audit `dispatch-parallel.ts` and any other `withRetry` callers for the same nothrow-masking pattern | L0-only | 5 |

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Add exitCode check to the 3 `gh pr create` branches in dev-sync.ts:271-290 | 4 |
| A-02 | architect | High | Design note/ADR for `isSuccess` predicate + `classifyError` wiring in retry-handler.ts | 2 |
| A-03 | automation-engineer | Medium | Implement retry-handler.ts redesign + update 4 callsites | 4 |
| A-04 | security-expert | Medium | Verify gh CLI 401/403 stderr text against classifyError matcher | 5 |
| A-05 | auditor | Low | Audit dispatch-parallel.ts and other withRetry callers for the same pattern | 5 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | All `withRetry(...)` calls wrapping `.nothrow()` shell commands correctly report failure on non-zero exitCode | Manual test: force a `gh pr create` 401 and confirm script exits non-zero with a `❌` message, not `Success on attempt 1` |
| AC-2 | Non-retryable errors (auth/permission) fail on attempt 1 without exhausting maxRetries/backoff | Manual test: simulate 401, confirm only 1 attempt logged and no backoff delay |
| AC-3 | Existing throw-based `withRetry` callers (no `isSuccess` passed) show no behavior change | Run existing test/usage of retry-handler.ts CLI self-test (`bun scripts/retry-handler.ts`) |
