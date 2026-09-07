# Phase Definitions — co-hr

This document defines the workflow phases used by the `co-hr` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-hr's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination Checklist in `AGENTS.md §3.5`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation | Orchestrator | PM + variant setup |
| 1 | Research & Analysis | Observer | `labor-compliance-analyst`, `safety-health-officer`, `data-analyst`, `change-management-partner`, `labor-relations-specialist` |
| 2 | Design Review & Approval | Gate Keeper | PM + HR advisory specialists |
| 3 | Implementation & Delivery | Coordinator | `org-design-consultant`, `data-analyst` |
| 4 | Coordination & Delivery | Coordinator | PM (routes specialist outputs) |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Project Initiation
**PM opens the phase**: clarify objective, confirm scope, assemble the team.
- PM classifies the HR request and selects which of the 12 specialist agents are in scope
- **Output**: confirmed scope, team assignment

### Phase 1 — Research & Analysis
**PM observes**: specialists work autonomously.
- `labor-compliance-analyst` (Phase 1) — statutory/regulatory groundwork
- `safety-health-officer` (Phase 1) — safety & health context
- `data-analyst` (Phase 1, 3) — HR data investigation
- `change-management-partner` (Phase 1, 2) and `labor-relations-specialist` (Phase 1, 2) — organizational and labor-relations context
- **Gate**: findings complete before design entry

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit user approval.
- Advisory specialists (`career-succession-consultant`, `compensation-benefits-analyst`, `learning-development-specialist`, `performance-management-consultant`, `talent-acquisition-specialist`) shape the design; `org-design-consultant` (Phase 2, 3) bridges design and implementation
- PM synthesizes findings into a decision recommendation
- **Gate**: explicit user approval required before Phase 3

### Phase 3 — Implementation & Delivery
**PM coordinates**: approved design is executed.
- `org-design-consultant` (Phase 2, 3) and `data-analyst` (Phase 1, 3) deliver the approved artifacts
- **Output**: deliverables per the approved design

### Phases 4–6
Same as the workspace standard: coordination and delivery (4), PM-owned lifecycle finalization with governance records (5), and QA/finalization with audit scripts and `/sync` (6).

---

## Governance
- Dispatch triggers per agent are in `AGENTS.md` (specialist dispatch table)
- Tier assignments are in each agent's frontmatter and `variant.json`
