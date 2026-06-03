# Engagement Orchestration Principles

> Defines how skills interact, when they are re-triggered, and how the Engagement Leader manages skill sequencing across a consulting engagement.

---

## Skill Execution Pipeline by Phase

```
Phase 1 ─────────────────────────────────────────────────────────────
  competitive-intelligence  ──┐
  org-readiness-assessment  ──┤──► insight-synthesis ──► Phase 2 Gate
  technical-feasibility (draft)┘

Phase 1-2 Iteration Loop (max 2x) ───────────────────────────────────
  technical-feasibility ◄──► financial-modeling
  Exit: cost fits budget | Engagement Leader escalates

Phase 2 Gate ────────────────────────────────────────────────────────
  insight-synthesis output + financial-modeling output
  → Engagement Leader presents → Client/User approval required

Phase 3 ─────────────────────────────────────────────────────────────
  change-impact-assessment ──┐
  solution-design            ├──► narrative-framework
  (insight-synthesis done)   │         │
                             │         ▼
                             └──► consulting-report-writing
                                       │
                                       ▼
                                 executive-presentation
                                 (requires: technical-feasibility
                                  + org-readiness-assessment
                                  + financial-modeling)

Phase 4 ─────────────────────────────────────────────────────────────
  project-delivery ──► stakeholder-review-management
```

---

## Skill Re-execution Trigger Conditions

Any skill may be re-triggered if a downstream analysis reveals that its inputs were insufficient or incorrect. The Engagement Leader must authorize re-execution beyond the first retry.

| Trigger Event | Skill(s) to Re-execute | Authorized By |
|--------------|----------------------|---------------|
| Budget constraint invalidates cost model | `technical-feasibility` → `financial-modeling` (loop, max 2x) | Automatic (up to 2x), then Engagement Leader |
| Change resistance assessment changes solution scope | `org-readiness-assessment` → `technical-feasibility` → `financial-modeling` | Engagement Leader |
| Phase 2 approval rejected — strategy direction changes | `insight-synthesis` + affected Phase 1 skills | Engagement Leader |
| Executive review reveals misaligned message | `narrative-framework` → `consulting-report-writing` → `executive-presentation` | Communications Lead (1x), then Engagement Leader |
| New stakeholder group identified post-Phase 2 | `stakeholder-alignment` → `change-impact-assessment` | Change Management Partner (1x), then Engagement Leader |

---

## Escalation Protocol

When iteration limits are reached without resolution:

1. Engagement Leader documents the blocking issue in `memory/YYYY-MM-DD.md`
2. Engagement Leader schedules client/user clarification on the specific constraint
3. After clarification, reset the iteration counter and re-enter the affected skill pipeline
4. If client/user cannot resolve within 2 business days, mark the deliverable section as "TBD — Pending Client Input" and continue with remaining deliverables

---

## Prerequisites Enforcement

Skills with declared prerequisites must not be invoked until all prerequisites are complete. The Engagement Leader is responsible for gate-keeping:

| Skill | Prerequisites | Gate Check |
|-------|--------------|-----------|
| `financial-modeling` | `technical-feasibility`, `org-readiness-assessment` | Engagement Leader confirms both outputs received |
| `executive-presentation` | `technical-feasibility`, `org-readiness-assessment`, `financial-modeling` | Engagement Leader confirms all three outputs received |
| `change-impact-assessment` | `org-readiness-assessment` | Change Management Partner confirms output received |
| `consulting-report-writing` | `narrative-framework` | Communications Lead confirms blueprint received |
| `stakeholder-review-management` | `stakeholder-alignment`, `consulting-report-writing` | Delivery Manager confirms both outputs received |
| `project-delivery` | `solution-design` | Delivery Manager confirms roadmap + dependency map received |

---

*engagement-orchestration.md version: 1.0 — created 2026-06-03*
