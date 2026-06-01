# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Revision — Socratic method scope: universal policy vs. education-role-only
**Participants**: architect, pm, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Revises**: meeting-2026-06-01-socratic-method-policy.md

---

## Context

Previous meeting concluded Socratic method should be a universal policy in context.md (G-01~G-03). User challenged this: should it only apply when creating education-specific agents or skills?

---

## Transcript

### architect (Round 1)
Re-analyzed previous conclusion. Compared principle types: Research Standards and Computational Integrity are prohibition principles (any agent can violate them, violation causes harm). Socratic method is a methodology principle (only meaningful for education-role agents; misapplied by non-education agents it becomes obstructive). Agreed with user's intuition: Socratic method belongs in agent/skill creation checklists, not universal context.md policy. Direct answer is correct when operational problems need solving — forcing Socratic questioning would be counterproductive.

### docs-writer (Round 1)
Confirmed the distinction using a comparison table. Research/Computational: prohibition principles requiring universal application. Socratic method: methodology principle requiring only role-selective application. Proposed mechanism: agent-lifecycle-manager skill Step 3 checklist already has conditional items for research and numerical roles; add same pattern for education/tutoring/coaching roles. Also add to skill-lifecycle-manager checklist for education-purpose skills. context.md addition is unnecessary.

### pm (Round 2)
Summarized changes from previous meeting: G-01 (context.md section) and G-02 (AGENTS.md baseline) are cancelled. G-03 (agent-lifecycle-manager checklist) is retained. G-03b (skill-lifecycle-manager checklist) is added as new item. G-04 (future grouping refactor) retained but scope reduced since no education section will exist.

### architect (Synthesis)
Final consensus: Socratic method = role-selective methodology principle, not universal prohibition. Implement only via creation checklists. Two Standards sections (Research + Computational) confirmed as universal because any agent can violate them.

---

## Revised Action Items (supersedes G-01~G-04)

| # | Status | Owner | Tier | Deliverable |
|---|--------|-------|------|-------------|
| G-01 | CANCELLED | — | — | ~~context.md Educational Interaction Standards section~~ |
| G-02 | CANCELLED | — | — | ~~AGENTS.md Universal Baseline addition~~ |
| G-03 | RETAINED | PM | Medium | `agent-lifecycle-manager` skill: conditional checklist for education/tutoring/coaching roles |
| G-03b | NEW | PM | Medium | `skill-lifecycle-manager` skill: conditional checklist for education/tutoring purpose skills |
| G-04 | RETAINED (reduced scope) | PM | Low | Future: group Research + Computational Standards under `## Quality & Integrity Standards` |

## Key Design Principle Established

| Principle Type | Example | Universal? | Reason |
|----------------|---------|-----------|--------|
| Prohibition principle | "cite sources", "use external tool for precision math" | Yes | Any agent can violate; violation causes harm |
| Methodology principle | "use Socratic method for teaching" | No | Only education-role agents are relevant; forcing others is counterproductive |
