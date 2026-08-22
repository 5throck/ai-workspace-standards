# Engagement Orchestration Principles

> Defines how skills interact, when they are re-triggered, and how PM manages skill sequencing across a co-hr engagement. Unlike co-consult's fixed pipeline, co-hr routes each engagement to one of 11 archetypes (see [`co-hr.context.md`](co-hr.context.md) — Team Configuration Scenarios); this document describes the generic pattern that pipeline applies within any archetype.

---

## Skill Execution Pipeline by Phase

```
Phase 0 ─────────────────────────────────────────────────────────────
  [PM classifies request → assigns archetype lead + support]

Phase 1 ─────────────────────────────────────────────────────────────
  k-law (statutory research)                    ──┐
  hr-metrics-analysis (workforce data)           ──┤
  archetype lead's owned skill, e.g.:              │
    org-design-framework                           │
    compensation-benchmarking                      ├──► consulting-report-writing
    performance-system-design                       │        (Phase 4 formatting)
    talent-acquisition-strategy                      │
    learning-curriculum-design                       │
    career-path-succession-planning                  │
    stakeholder-alignment / org-readiness-assessment ─┘
         │
         ▼
Phase 1.5 Compliance & Cross-Validation ────────────────────────────
  [PM dispatches validators per Cross-Validation Matrix]
  k-law outputs → labor-compliance-analyst sign-off (legal exposure)
  hr-metrics-analysis outputs → data-analyst validates any quantitative claim
  → Validators review Phase 1 deliverables (read-only findings)
  → PM synthesizes findings, requests fixes if needed
  (max 1 revision cycle per deliverable)
         │
         ▼
Phase 2 Gate ──────────────────────────────────────────────────────
  Archetype lead's design/recommendation output
  → PM presents → Client/User approval required

Phase 3 ─────────────────────────────────────────────────────────────
  org-readiness-assessment ──► change-management-partner stakeholder validation
  (required for any org-wide rollout regardless of archetype lead)
         │
         ▼
Phase 4 ─────────────────────────────────────────────────────────────
  consulting-report-writing (shared, owner: pm) ──► final deliverable
```

---

## Skill Re-execution Trigger Conditions

Any skill may be re-triggered if a downstream analysis reveals that its inputs were insufficient or incorrect. PM must authorize re-execution beyond the first retry.

| Trigger Event | Skill(s) to Re-execute | Authorized By |
|--------------|----------------------|---------------|
| Phase 1.5 compliance sign-off rejects the approach | Archetype lead's Phase 1 skill, re-executed with compliance constraints incorporated | labor-compliance-analyst |
| Market/benchmark data used in `compensation-benchmarking` is stale (>12 months) | `compensation-benchmarking` (refreshed sourcing) | Automatic (up to 1x), then pm |
| Change readiness assessment (`org-readiness-assessment`) reveals the design is not implementable as scoped | Archetype lead's Phase 2 design (loop back) | change-management-partner (max 2x), then escalate to pm |

---

## Escalation Protocol

When iteration limits are reached without resolution:

1. PM documents the blocking issue in `memory/YYYY-MM-DD.md`
2. PM schedules client/user clarification on the specific constraint
3. After clarification, reset the iteration counter and re-enter the affected skill pipeline
4. If client/user cannot resolve within 2 business days, mark the deliverable section as "TBD — Pending Client Input" and continue with remaining deliverables

---

## Phase 1.5 Cross-Validation

After all Phase 1 research/design deliverables are complete and before Phase 2, PM dispatches validator agents to cross-check deliverable consistency, legal exposure, and methodology. This step catches compliance gaps, contradictions, and unsupported claims before the approval gate.

### Cross-Validation Matrix

| Validator | Validates | Check Focus |
|-----------|-----------|--------------|
| labor-compliance-analyst | org-design-consultant | Legal exposure of restructuring plans |
| labor-compliance-analyst | compensation-benefits-analyst | Wage/hour law compliance of pay structures |
| data-analyst | compensation-benefits-analyst | Statistical rigor of market benchmarking claims |
| change-management-partner | org-design-consultant | Change readiness of the proposed structure |
| safety-health-officer | org-design-consultant | Safety compliance impact of restructuring |

### Validation Principles

1. **Read-only**: Validators review and report findings only — they do NOT modify the original deliverable.
2. **PM orchestrates**: PM dispatches validators, collects findings, and decides whether fixes are needed.
3. **Timing**: Cross-validation runs after all Phase 1 deliverables are marked complete, before Phase 2 design begins.
4. **Scope**: Only Phase 1 research/design deliverables are in scope.

---

*engagement-orchestration.md version: 1.0 — initial co-hr archetype-routed orchestration model*
