# Engagement Orchestration Principles

> Defines how skills interact, when they are re-triggered, and how the Engagement Leader manages skill sequencing across a consulting engagement.

---

## Skill Execution Pipeline by Phase

```
Phase 1 ─────────────────────────────────────────────────────────────
  competitive-intelligence  ──┐
  org-readiness-assessment  ──┤──► insight-synthesis
  technical-feasibility (draft)┘
         │
         ▼
Phase 1.5 Cross-Validation ─────────────────────────────────────────
  [PM dispatches validator agents per Cross-Validation Matrix]
  → Validators review Phase 1 deliverables (read-only findings)
  → PM synthesizes findings, requests fixes if needed
  (max 1 revision cycle per deliverable)
         │
         ▼
Phase 1-2 Iteration Loop (max 2x) ─────────────────────────────────
  technical-feasibility ◄──► financial-modeling
  Exit: cost fits budget | Engagement Leader escalates

Phase 2 Gate ──────────────────────────────────────────────────────
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

## Phase 1.5 Cross-Validation

After all Phase 1 research deliverables are complete and before `insight-synthesis`, the PM dispatches validator agents to cross-check deliverable consistency. This step catches contradictions, unsupported claims, and feasibility gaps before synthesis.

### Cross-Validation Matrix

| Validator | Validates | Check Focus |
|-----------|-----------|-------------|
| Strategy Analyst | Industry Expert | Strategic plausibility of industry trends, competitive dynamics, and market sizing |
| Industry Expert | Strategy Analyst | Sector-specific validity of market analysis, competitive assessments, and strategic options |
| SME | Industry Expert | Functional feasibility of sector-specific recommendations and implementation viability |
| Data Analyst | Strategy Analyst | Statistical rigor of data-driven claims, methodology soundness, and evidence quality |
| Change Management Partner | SME | Organizational readiness implications of functional solutions and change impact assessment |

### Validation Principles

1. **Read-only**: Validators review and report findings only — they do NOT modify the original deliverable.
2. **PM orchestrates**: PM dispatches validators, collects findings, and decides whether fixes are needed.
3. **Timing**: Cross-validation runs after all Phase 1 deliverables are marked complete, before `insight-synthesis` begins.
4. **Scope**: Only Phase 1 research deliverables (`deliverables/research/`) are in scope.

### Cross-Validation Checklist

Validators check each deliverable against the following criteria:

| # | Check Item | Severity | Example |
|---|-----------|----------|---------|
| C1 | Key claims do not contradict findings in other agents' deliverables | Critical | Strategy says "market growing 15%" but Industry Expert data shows "mature market, 3% growth" |
| C2 | Data/statistical citations have documented sources and sound methodology | High | Financial model uses unverified growth assumptions |
| C3 | Industry/function recommendations are practically implementable | High | Industry Expert recommends full digital transformation but SME's org readiness assessment shows low digital maturity |
| C4 | Common terminology and definitions are used consistently across agents | Moderate | "Digital transformation" defined differently by Strategy Analyst vs SME |
| C5 | Analysis scope stays within the defined project boundaries | Moderate | SME analysis covers out-of-scope organizational functions |

### Cross-Validation Re-execution Triggers

| Trigger Event | Action | Authorized By |
|---------------|--------|---------------|
| Cross-validation finds Critical (C1) contradiction | Original author revises deliverable → validator re-checks (max 1x) | PM |
| Cross-validation finds High-severity (C2/C3) gap | Original author addresses gap or documents accepted rationale | PM |
| Moderate (C4/C5) finding | Logged as advisory — no mandatory fix; PM may request if pattern detected across multiple agents | PM |
| Max revision cycle exhausted without resolution | PM documents as accepted risk in `memory/YYYY-MM-DD.md`, proceeds to Phase 2 | PM |

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

*engagement-orchestration.md version: 1.1 — added Phase 1.5 Cross-Validation*
