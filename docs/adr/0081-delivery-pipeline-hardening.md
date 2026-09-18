---
status: Accepted
date: 2026-09-18
author: PM
---

# ADR-0081: Delivery Pipeline Hardening — Publish-Gate Determinism, Branch Integration, and Fleet Backport

## Context

Four delivery-pipeline failures were observed on 2026-09-18 while landing the
PM team-management authority work (ADR-0080, PRs #954/#955). Every one is a
recurring structural class, not a one-off: three blocked CI or push on the
day, and the fourth is the long-standing Fork Model backport gap that this
same landing re-confirmed ("existing projects inherit via scaffold/upgrade,
not retro-actively").

1. **VERSION_MANIFEST date-column lag (full-history CI).** The manifest's
   per-row "Last Modified" cells derive from `git log -1` (committed history,
   `generate-version-manifest.ts` `getGitTimestamp`). dev-sync generates the
   manifest (step 4.7) BEFORE the commit (step 6), so the committed manifest
   records the PRE-PR commit's date for every file the PR changes. On CI's
   merge preview the PR commit becomes the last toucher, so the regenerated
   date columns shift by one commit — invisible when the previous toucher is
   same-day, fatal across a day boundary. PR #954's first CI run failed on
   exactly this ("1 differing line"), and the only fix was an extra
   convergence commit (`eb6901ab`). The audit compares date cells literally
   whenever history is full; date masking applies only to shallow checkouts
   (T-20260916-013). T-20260916-013 itself named the deeper alternative —
   "date-source-aware comparator" — and deferred it.
2. **Main-integration dead-end for open PR branches.** origin/main advanced
   (#951–#953) while PR #954 was open; five shared pipeline files conflicted
   (CHANGELOG.md, memory/MEMORY.md, VERSION_MANIFEST.md, agents/pm.md,
   lifecycle records — the §3.3 conflict surface). Concluding a conflicted
   merge locally is impossible by design: the pre-commit hook requires the
   SYNC_ACTIVE context (dev-sync only), and dev-sync's MERGE_HEAD gate is
   fail-closed. The only exit was a full branch rebuild — resolve the merge,
   `git reset --hard origin/main`, replay the resolved tree, re-commit via a
   second dev-sync, force-with-lease push. Recovery took three extra
   pipeline runs and a history rewrite.
3. **Absolute line-number pin on the intentional-duplicate marker.** PR #955
   (a docs-only change) failed CI on all three OSes: inserting ten lines into
   the COMMON-CONTEXT block shifted the §3 marker in
   `templates/common/docs/context.md` from line 421 to 429, and
   `tests/unit/intentional-duplicate-parser.test.ts` pins that absolute line.
   A marker's line position is incidental; pinning it turns any upstream
   insertion into a red cross-OS run.
4. **Fleet policy backport gap.** ADR-0080's authority text shipped to L0 and
   L1 managed blocks, but the 11 `Projects/co-*` fleet receives COMMON-CONTEXT
   and pm.md body content only through scaffold or the manual `project-resync`
   runbook (last run: 2026-09-16, 12 hand-created upgrade PRs). Until that
   runs again, the fleet operates under the old doctrine.

## Decision

Implementation is deferred to tickets T-20260918-001..004; this ADR fixes the
directions.

1. **Manifest date columns become non-normative (T-20260918-001).** `--check`
   masks "Last Modified" columns on both comparison sides in FULL-history
   mode too — the shallow-mode behavior of T-20260916-013 becomes the default.
   Structural rows (names, files, tiers, versions, paths, triggers) continue
   to be compared literally, so no real drift class is lost; the date columns
   remain published as informational content. Rejected alternative:
   post-commit regeneration + amend (adds a churn commit to every PR and
   widens the §3.3 conflict surface).
2. **Main-drift detection + sanctioned conflict conclusion (T-20260918-002).**
   dev-sync gains (a) a pre-flight step that fetches origin/main and loudly
   warns — naming the diverged shared pipeline files — when main has advanced
   past the branch's merge-base, and (b) a `--conclude-merge` mode that runs
   the standard gate battery over an in-progress merge's resolved tree and
   creates the merge commit itself (same SYNC_ACTIVE context contract),
   replacing today's abort-and-rebuild dead-end. CONSTITUTION §3.3
   (sequential branch dependency) remains the primary defense; these are
   recovery rails, not a license for parallel branches.
3. **Marker tests pin identity, not position (T-20260918-003).** The
   intentional-duplicate parity test asserts marker identity — one marker per
   known file, correct section/source/hash — and drops the absolute line
   expectation (both context.md and variant.context.template.md). Position is
   incidental and already proven stable by the scanner walking the file.
4. **Fleet policy backport becomes a standing policy (T-20260918-004).**
   Policy-class L1 changes — content in the COMMON-CONTEXT, COMMON-AGENTS, or
   pm.md WORKSPACE-MANAGED managed blocks — require a fleet backport ticket
   (`project-resync` / `upgrade-project` sweep) landed within one release
   cycle, instead of the current ad-hoc practice. The ADR-0080 backport is
   the first instance of this policy.

## Consequences

- **Positive**: removes the three CI/push failure classes observed today
  (fewer red cross-OS runs, no more day-boundary manifest churn, no
  force-push recovery marches); makes the Fork Model backport gap an explicit,
  ticket-tracked obligation instead of a memory-dependent practice.
- **Cost**: masking date columns weakens one incidental signal (a file whose
  date went stale without content change is no longer flagged) — accepted
  because the signal was already unreliable (one-commit lag by construction)
  and the content columns carry the real contract. `--conclude-merge` adds a
  second privileged dev-sync mode that must keep the gate battery identical.
- **Neutral**: §3.3 sequential branching is unchanged as the primary rule;
  published manifests still carry dates for human readers.

## References

- Design: `docs/designs/2026-09-18-delivery-pipeline-hardening-design.md`
- Tickets: T-20260918-001 (manifest dates), T-20260918-002 (main-drift
  detection + conclude-merge), T-20260918-003 (marker pin), T-20260918-004
  (fleet backport policy)
- ADR-0080 (authority content that triggered the observations), ADR-0061
- T-20260916-013 (shallow-mode date masking — the narrow predecessor of
  Decision 1); CONSTITUTION §3.3 (sequential branch dependency rule);
  `docs/templates/known-issues.json` ISSUE-009..012
