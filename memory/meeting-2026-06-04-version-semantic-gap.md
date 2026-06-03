# Meeting Transcript
**Date**: 2026-06-04
**Topic**: fix-script-versions.ts version-number-only replacement limitation — semantic content alignment guarantee design
**Participants**: architect, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Predecessor**: meeting-2026-06-04-script-version-drift.md (unresolved item follow-up)

---

## Transcript

**[Architect]** (Round 1)

The problem must be separated into two distinct issues. "Semantic alignment between version number and content" conflates two different problems.

First, the immediate risk of Type 2 fixes: if SCRIPTS.md says 1.1.0 but the file contains 1.0.0-level code, bumping the header to 1.1.0 is a false declaration — "this script has 1.1.0 capabilities" — not merely a labeling issue.

Second, the ongoing drift detection problem: the pattern of someone bumping SCRIPTS.md without updating the file may repeat.

Solving both with one mechanism leads to over-engineering. The practical solution for the first is git blame/log-based verification — check whether the file's last modification commit aligns temporally with the SCRIPTS.md version bump commit to detect "version bumped without content change." Automation-engineer, is this git-based approach feasible and performance-acceptable?

**[Automation-Engineer]** (Round 1)

The git blame approach is implementable but we need to evaluate cost vs benefit first.

`git log --follow -1 -- scripts/verify-memory.ts` plus `git log --follow -1 -- scripts/SCRIPTS.md` would detect "SCRIPTS.md changed more recently than the file = possible version bump without content." Performance-wise: 2 git log calls per script, 50 scripts = 100 calls, adding 3–5 seconds to pre-commit even with staged filtering.

More fundamentally: what actual harm does "version number vs content misalignment" cause? From the L2 project perspective, scripts run on file content, not version numbers. The version number is metadata for lifecycle-sync-audit.ts Check A — "is this the file registered at this version?" The real harm is Check A producing false passes. So the problem is Check A's trust level, not a detection gap. Documenting what Check A guarantees may be more practical than git-based detection.

**[Architect]** (Round 2)

Automation-engineer's reframe is correct. This should be redefined as a Check A guarantee scope problem.

Check A currently means: "@version header in the file matches the registered version number in SCRIPTS.md." This is formal consistency, not semantic consistency. Because this is never stated explicitly, developers assume "Check A pass = file is at the correct version."

My proposed solution — instead of git-based detection, explicitly document Check A's guarantee scope:

1. Add to `SCRIPTS.md` Registry section comment: `<!-- Check A verifies @version header matches registry entry (formal consistency only — semantic content alignment is not verified) -->`
2. Add qualifier to lifecycle-sync-audit.ts Check A pass output: `✅ Check A passed (formal version consistency — semantic content not verified)`
3. Include standard warning in Type 2 fix commit messages: `NOTE: @version headers aligned to SCRIPTS.md; file content not verified against version history`

This prevents Check A over-reliance and makes clear that actual content verification belongs in code review. Automation-engineer: does this documentation approach resolve the open question, or is detection still needed?

**[Automation-Engineer]** (Round 2)

Documentation approach resolves the open question. One practical addition: documentation alone lacks a behavioral trigger for the operator to actually check file content during Type 2 fixes.

Propose adding to `fix-script-versions.ts` output after each version replacement:

```
✅ verify-memory.ts: @version updated 1.0.0 → 1.1.0
⚠️  Content verification required: check git log for verify-memory.ts to confirm
   content matches version history before committing.
   Run: git log --oneline -- scripts/verify-memory.ts
```

This naturally prompts developers to check git log after running fix-script-versions.ts. It is printing a command, not executing git — no performance impact, no complex logic. Three output lines added to fix-script-versions.ts.

Combined: architect's documentation (explicit Check A scope) + this warning output = practical resolution without git-based auto-detection.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-05 | automation-engineer | Low | Add git log verification command output to `fix-script-versions.ts` after each version replacement | After A-01/A-02 |
| A-06 | automation-engineer | Low | Add `(formal consistency only)` qualifier to `lifecycle-sync-audit.ts` Check A pass message | With A-03 |
| A-07 | architect | Low | Add Check A guarantee scope comment to `SCRIPTS.md` Registry section | With A-04 ADR |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-04 | Running `fix-script-versions.ts` prints git log check command per replaced file | Manual: run fix on any mismatched file, verify output |
| C-05 | `lifecycle-sync-audit.ts` Check A pass line includes `(formal consistency only)` | Run audit on clean workspace, inspect output |
| C-06 | `SCRIPTS.md` Registry section comment states Check A formal-only guarantee | Read SCRIPTS.md header |
