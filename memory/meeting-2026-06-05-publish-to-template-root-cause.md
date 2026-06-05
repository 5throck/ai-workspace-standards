# Meeting Transcript

**Date**: 2026-06-05
**Topic**: publish-to-template Root Cause Analysis and Fundamental Fix
**Participants**: pm (facilitator), architect, automation-engineer, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting addresses the publish-to-template propagation inconsistency issues with the goal of fundamental root cause resolution rather than surface patching.

Pre-investigation confirmed 4 issues:
- I-01 (High): publishDocs() variants list excludes co-consult from CLAUDE.md/GEMINI.md propagation
- I-02 (Medium): check-pm-approval.ts shows differs across all 5 L2 variants
- I-03 (Medium): docs domain exclude logic bug — exact string match prevents "templates/" prefix exclusion
- I-04 (Low): propagation-map.json scripts-lib note inconsistent with actual SCRIPTS.md layer values

Core question: Are these individual bugs, or a pattern derived from structural flaws in the propagation architecture?

---

**[Architect]**: (Round 1)

All 4 issues are symptoms of the same structural flaw: "Overuse of Hardcoded List Pattern".

The current propagation logic mixes three different mechanisms:
- Mechanism A: propagation-map.json based (L1 to L2, domain unit)
- Mechanism B: Hardcoded variant list inside publishDocs() (--docs, L0 to L2) — source of I-01
- Mechanism C: SCRIPTS.md layer column based (L0 to L1, script unit)

These three mechanisms have no Single Source of Truth (SSOT).

Root: I-01 from manual variant list management, I-02 from L1->L2 never being triggered in sync pipeline, I-03 from undocumented exclude semantics, I-04 from notes written at different times causing drift.

Deeper structural problem: publish-to-template.ts handles both L0->L1 publish and L1->L2 propagation, but three SSOTs coexist. This is the core flaw.

Proposed direction: Elevate propagation-map.json to the sole SSOT.

---

**[Automation-engineer]**: (Round 1)

I-02 root cause confirmed: L0 and L1 are identical. L2 is frozen at an older version (no version header, no DEPRECATED comment).

Critical additional finding: dev-sync.ts does NOT call publish-to-template.ts. Running /sync repeatedly will never trigger L2 propagation. This is the direct cause of I-02 persisting undetected.

---

**[Auditor]**: (Round 1)

audit.ts checkScriptSync() only checks L0 vs L1. L1 vs L2 is never checked. This is why I-02 could persist:
- L0 != L1 -> audit.ts FAIL -> commit blocked (enforced)
- L1 != L2 -> audit.ts does not check -> commit passes (not enforced)

All 4 issues share the same governance root: no official trigger enforces "when to run publish".

---

**[Architect]**: (Round 2)

2-Track improvement approach:

Track 1 — Elevate propagation-map.json as SSOT:
- Add governance-claude, governance-gemini, governance-agents domains with mode: "marker-inject"
- Add exclude_prefixes support to docs domain
- Update scripts-lib note

Track 2 — Enforcement:
- Add L1->L2 check to audit.ts
- Add conditional publish execution to dev-sync.ts (workspace-only)

---

**[Automation-engineer]**: (Round 2)

Performance: ~415 SHA256 comparisons, 1-2 seconds, acceptable for /sync pipeline.

dev-sync.ts needs workspace context detection before running publish-to-template:
```
const isWorkspaceRoot = existsSync('templates/common') && existsSync('scripts/propagation-map.json');
```

Bootstrapping problem: the scripts being modified are subject to the propagation system itself.
Solution: Fix-Then-Propagate (manual one-time run after L0 changes).

---

**[Auditor]**: (Round 2)

Fix-Then-Propagate sequence:
1. Modify L0 files
2. Manually run bun scripts/publish-to-template.ts (one-time)
3. Run bun scripts/audit.ts to verify L0=L1=L2
4. Run /sync — automated pipeline active from this point

Phased audit.ts L2 check: Phase 1 as Warning, Phase 2 (next PR) promote to Fail.
This prevents current L2 drift (5 differing files) from immediately blocking commits.

---

**[Automation-engineer]**: (Round 3)

Edge case 1: source_file resolution for marker-inject domains must use workspaceRoot — already defined in current code, safe.
Edge case 2: --domain filter needs mode: "marker-inject" branch in collectDiffs().

Implementation scope: 4 scripts, all changes fit in single PR.

---

**[Auditor]**: (Synthesis)

Root cause: "Three SSOTs coexisting" + "No L1->L2 enforcement mechanism".

All 4 issues resolved by:
- Track 1: propagation-map.json as sole SSOT for all propagation decisions
- Track 2: audit.ts Warning check for L1->L2 drift + dev-sync.ts conditional publish integration
- Fix-Then-Propagate bootstrapping sequence

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | Add governance-claude, governance-gemini, governance-agents domains to propagation-map.json; add exclude_prefixes to docs domain; fix scripts-lib note | L0-only | 4 |
| A-02 | automation-engineer | Medium | Refactor publish-to-template.ts: remove publishDocs() hardcoding, implement propagation-map.json-based mode: marker-inject support, add exclude_prefixes logic | L0-only | 4 |
| A-03 | automation-engineer | Low | Add workspace-only conditional publish-to-template execution to dev-sync.ts | L0-only | 4 |
| A-04 | automation-engineer | Low | Add L1->L2 script sync Warning check to audit.ts (promote to Fail in follow-up PR) | L0-only | 4 |
| A-05 | lifecycle-manager | Medium | Version bump all 4 modified scripts + SCRIPTS.md update + Fix-Then-Propagate manual run to confirm L2 sync | L0-only | 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | publishDocs() reads variant list from propagation-map.json, no hardcoded lists | Code review: no co-design, co-develop array literals in publishDocs() |
| 2 | --docs propagates to co-consult CLAUDE.md and GEMINI.md | dry-run shows co-consult in output |
| 3 | docs domain excludes templates/ prefix correctly | Files under docs/templates/ do not appear in L1 docs/ after publish |
| 4 | dev-sync.ts runs publish-to-template.ts at workspace root | /sync at workspace root triggers L1->L2 propagation |
| 5 | audit.ts emits Warning when L2 script differs from L1 | Modify test file in L1, run audit.ts, confirm Warning appears |
| 6 | All 4 scripts have bumped version and SCRIPTS.md updated | bun scripts/lifecycle-sync-audit.ts passes |
| 7 | bun scripts/audit.ts passes after Fix-Then-Propagate run | Exit code 0, no FAIL entries |
