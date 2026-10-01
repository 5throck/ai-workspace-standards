---
status: Accepted
date: 2026-10-01
author: automation-engineer
owner: architect
---

# ADR-0095: L3 extends pointers are valid iff they resolve on disk

## Context

The 13 `Projects/co-*` projects carry three different forms of `agents/pm.md`, verified 2026-10-01:

| Form | Projects | Resolves from the project file? |
|---|---|---|
| `extends: ../../../agents/pm.md` (L0 pointer) | co-architect, co-newbiz | YES |
| `extends: ../../common/agents/pm.md` (dangling) | co-abap, co-consult, co-deck, co-develop, co-export, co-game, co-price, co-safety, co-security (9) | NO — `Projects/common` does not exist |
| Inlined full body (no extends) | co-design, co-work | n/a — settled |

The dangling form never heals: `new-project.ts` resolves stubs at scaffold/adopt (ADR-0033), but upgrade-policy v1.15.0 makes the upgrade agents pass skip stub files (protection against the v1.35.0 clobber of co-work's resolved body), so an already-surviving stub is untouched by every upgrade. Meanwhile agent-lifecycle-audit v1.6.0 resolves tier through the extends chain and passes both pointer forms — it validates tier, not target existence.

Two prior sessions reached opposite conclusions on the same state (PR #1263 retarget, reverted by PR #1268 and re-reverted nightly), so the question was escalated to a Design Gate decision instead of another unilateral write.

Design: `docs/designs/2026-10-01-l3-pm-stub-decision-design.md` (T-20261001-008, decided 2026-10-01).

## Decision

1. **Validity rule**: at L3, an extends pointer is VALID if and only if it resolves on disk from the project file's location. The L0 pointer `../../../agents/pm.md` is a legitimate settled form at L3 — it is the ADR-0039 chain terminating one level higher. The dangling `../../common/agents/pm.md` form is the sole INVALID state.
2. **Correction is a pointer swap only**: replace `../../common/agents/pm.md` with `../../../agents/pm.md` in the 9 affected projects. No body inlining, no content change, no version bump beyond the frontmatter line.
3. **Scope is unchanged elsewhere**: templates keep extending within the template tree; inlined L3 bodies (co-design, co-work) are settled fork-model divergence and are NOT converted back to pointers. ADR-0033's resolve-and-inline remains scaffold/adopt-time only; ADR-0095 governs the surviving L3 pointer form.

## Consequences

- Every L3 `pm.md` resolves after the swap; L0 improvements keep reaching L3 projects through the pointer, which is the fork model's shared-but-overridable mechanism. Inlining would freeze a body snapshot and silently cut that channel.
- Blast radius is 1 line per file across 9 projects, reviewable in full — deliberately not the fleet-wide body rewrite class that produced the #1263/#1268 incident.
- The swap is idempotent: it matches the exact dangling literal; after the swap the file no longer matches, so re-runs are no-ops.
- No changes to `templates/`, `agents/` (L0), `new-project.ts`, or `upgrade-project.ts`. The upgrade stub-skip stays correct: it protects resolved bodies, and a one-line pointer file has no body to clobber. Fresh scaffolds are unaffected — today's L1 `pm.md` exists, so scaffold never produces a surviving stub.
- Audit v1.6.0 already chain-resolves and needs no change for the valid form; a dangling-pointer check (fail, report-only) MAY be added later as a separate hardening.

## References

- Design: `docs/designs/2026-10-01-l3-pm-stub-decision-design.md`
- ADR-0031 (fork model), ADR-0033 (stub resolution at scaffold/adopt), ADR-0039 (extends chain L0→L1→L2), ADR-0047/ADR-0048 (variant PM forms at L2)
