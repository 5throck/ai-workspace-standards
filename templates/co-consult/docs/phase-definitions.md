# Phase Definitions — co-consult

This document defines the workflow phases used by the `co-consult` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-consult's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md`, the Phase Determination Checklist in `AGENTS.md §3.5`, and the engagement-specific detail in `docs/team-configuration-guide.md` and `docs/engagement-orchestration.md`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Initiation | Orchestrator | PM (Engagement Leader) |
| 1 | Research & Analysis | Observer | `strategy-analyst`, `industry-expert`, `change-management-partner`, `sme`, `data-analyst` |
| 1.5 | Cross-Validation | Gate Keeper (read-only) | Peer validator agents per the Cross-Validation Matrix |
| 2 | Design Review & Approval | Gate Keeper | PM + `change-management-partner`, `industry-expert`, `sme` |
| 3 | Content Creation | Coordinator | `communications-lead`, `solutions-architect`, `sme`, `data-analyst` |
| 4 | Coordination & Delivery | Coordinator | `delivery-manager`, `technology-specialist`, `workstream-lead` |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Initiation
**PM opens the phase**: clarify engagement scope, confirm client objective, assemble the team.
- PM reviews the request and classifies the engagement complexity (see `docs/team-configuration-guide.md` — Scenario 1-4)
- PM identifies which specialist agents are needed (core team: `strategy-analyst`, `communications-lead`; extended/specialist agents added per scope)
- **Output**: confirmed scope, team assignment (project charter)

### Phase 1 — Research & Analysis
**PM observes**: specialists work autonomously.
- `strategy-analyst` (Tier: Medium) leads market analysis, competitive research, and strategic assessment — **read-only for final outputs**
- `industry-expert` (Tier: High, when engaged) provides sector-specific insight and competitive dynamics
- `change-management-partner` (Tier: Medium, when engaged) assesses organizational readiness and stakeholder landscape
- `sme` (Tier: Medium, when engaged) contributes functional expertise
- `data-analyst` (Tier: Low, when engaged) performs statistical analysis and data modeling
- PM intervenes only if quality standards are not met
- **Output**: market/org analysis, findings brief
- **Gate**: none — phase ends when agents signal completion, then Phase 1.5 begins

### Phase 1.5 — Cross-Validation
**PM dispatches read-only validators**: catches contradictions, unsupported claims, and feasibility gaps before synthesis.
- Runs after all Phase 1 deliverables are complete, before `insight-synthesis`
- Validators review peer deliverables per the Cross-Validation Matrix in `docs/engagement-orchestration.md` (e.g. `strategy-analyst` ↔ `industry-expert`, `sme` validates `industry-expert`, `data-analyst` validates `strategy-analyst`, `change-management-partner` validates `sme`)
- Validators are **read-only** — they report findings, they do not modify the original deliverable
- Max 1 revision cycle per deliverable; unresolved findings are logged as accepted risk in `memory/YYYY-MM-DD.md`
- **Output**: validated Phase 1 deliverables, cross-validation findings log

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit client/user approval.
- `change-management-partner` and `industry-expert` (Tier: Medium/High, when engaged) support the review with organizational and sector context
- `sme` (Tier: Medium, when engaged) supports functional feasibility review
- PM (Engagement Leader) synthesizes `insight-synthesis` and `financial-modeling` outputs into a decision-ready recommendation
- **USER/CLIENT APPROVAL REQUIRED** before proceeding to Phase 3
- **Output**: approved strategic approach

### Phase 3 — Content Creation
**PM coordinates**: specialists produce deliverables per the approved plan.
- `communications-lead` (Tier: Medium) transforms findings into the strategy report, narrative, and client-facing content — always engaged
- `solutions-architect` (Tier: Medium, when engaged) translates the approved approach into a technical design and implementation roadmap
- `sme` (Tier: Medium, when engaged) continues functional design support
- `data-analyst` (Tier: Low, when engaged) builds supporting data visualizations and models
- Agents may hand off directly to each other without PM intervention (e.g. `solution-design` → `narrative-framework` → `consulting-report-writing` → `executive-presentation`)
- **Output**: strategy report, technical specs, executive presentation

### Phase 4 — Coordination & Delivery
**PM coordinates**: delivery and logistics agents finalize output.
- `delivery-manager` (Tier: Low, when engaged) manages schedules, stakeholder review cycles, and delivery tracking
- `technology-specialist` (Tier: Low, when engaged) supports collaboration-platform setup and digital workflow implementation
- `workstream-lead` (Tier: Medium, when 3+ parallel workstreams run) coordinates multi-workstream delivery
- **Output**: stakeholder review cycle complete, delivered work product

### Phase 5 — Lifecycle Finalization
**PM owns**: updates governance records for any changed artifacts.
- PM updates governance documents for agent/skill/script changes
- PM logs decisions to `memory/YYYY-MM-DD.md`
- Lifecycle state synced for any modified lifecycle-tracked artifacts
- **Output**: governance records updated, drift report or "no drift" confirmation

### Phase 6 — Quality Assurance & Finalization
**PM owns**: finalizes the session.
- PM runs `audit-workspace` skill
- PM runs `validate-docs-links` skill
- Maximum 2 fix iterations before escalating to user
- PM runs `/sync` pipeline
- PR opened with English title and description
- Memory log updated
- **Output**: passing audit report, merged PR or open PR link

---

## Agent-to-Phase Mapping (Source of Truth)

Per each agent's frontmatter `phases:` field in `templates/co-consult/agents/*.md` (also mirrored in `AGENTS.md §2` and `§3.5`):

| Agent | Phases | Tier | Core / Extended / Specialist |
|-------|--------|------|-------------------------------|
| `strategy-analyst` | 1 | Medium | Core |
| `communications-lead` | 3 | Medium | Core |
| `change-management-partner` | 1, 2 | Medium | Extended (organizational change) |
| `industry-expert` | 1, 2 | High | Specialist (deep industry knowledge) |
| `sme` | 1, 2, 3 | Medium | Specialist (functional depth) |
| `data-analyst` | 1, 3 | Low | Specialist (quantitative modeling) |
| `solutions-architect` | 3 | Medium | Extended (technical solutions) |
| `delivery-manager` | 4 | Low | Extended (multi-workstream coordination) |
| `technology-specialist` | 4 | Low | Extended (platform/tool implementation) |
| `workstream-lead` | 4 | Medium | Extended (3+ parallel workstreams) |

Core-vs-Extended-vs-Specialist classification per `docs/team-configuration-guide.md § Core Team vs. Extended Team`; `variant.json → agent_manifest.optional` is currently empty, meaning PM decides team composition per engagement scope rather than a hardcoded optional-agent list.

---

## Variant Customization Points

co-consult declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (change-management-partner)
phases: [1, 2]
handoff_to: [pm]
handoff_from: [pm]
required_skills: [stakeholder-alignment, org-readiness-assessment, change-impact-assessment]
```

The PM role and Phase 0/5/6 structure are identical to the workspace-standard phase model. co-consult differs from the standard template by:
- Inserting a **Phase 1.5 Cross-Validation** sub-phase between Research (1) and Design Review (2), documented in `docs/engagement-orchestration.md`.
- Spanning several agents (`change-management-partner`, `industry-expert`, `sme`) across both Phase 1 and Phase 2, reflecting their dual research/review-support role.
- Splitting delivery agents (`delivery-manager`, `technology-specialist`, `workstream-lead`) into a single Phase 4 rather than separate execution/delivery phases.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Set engagement objective, nominate team | Confirm setup complete | Project charter |
| 1 | Brief research agents on scope | Check quality of findings | Findings brief |
| 1.5 | Dispatch cross-validation matrix | Collect validator findings | Validated deliverable set |
| 2 | Present findings for client approval | — | Approved strategic approach |
| 3 | Hand off approved plan to content/design agents | Intervene if off-plan | Strategy report + technical specs |
| 4 | Confirm delivery targets with coordination agents | Track completion | Delivery confirmation |
| 5 | Update governance records | Verify lifecycle drift | Drift report or "no drift" confirmation |
| 6 | Run audit + `/sync` | Fix issues (max 2 iterations) | Audit pass report + PR link |
