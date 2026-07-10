# Phase Definitions

This document defines the standard workflow phases used across all variants. Each variant customizes the specialist agents for phases 1–5 while the overall structure remains consistent.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation | Orchestrator | PM + variant setup agents |
| 1 | Research / Analysis | Observer | Specialist agents (variant-defined) |
| 1-2 | Research & Architecture | Observer / Gate Keeper | Specialist agents (variant-defined) |
| 2 | Design Review & Approval | Gate Keeper | PM + senior specialist agents |
| 3 | Execution / Creation | Coordinator | Specialist agents (variant-defined) |
| 4 | Delivery / Integration | Coordinator | Specialist agents (variant-defined) |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, /sync, creates PR) |

---

## Phase Details

### Phase 0 — Project Initiation
**PM opens the phase**: clarify objective, confirm scope, assemble the team.
- PM reviews the request and classifies it
- PM identifies which specialist agents are needed
- Setup agents (if any) prepare the environment
- **Output**: confirmed scope, team assignment

### Phase 1 — Research / Analysis
**PM observes**: specialists work autonomously.
- Research agents gather data, evidence, and context
- Analysis agents synthesize findings
- PM intervenes only if quality standards are not met
- **Output**: research findings, analysis report
- **Gate**: none — phase ends when agents signal completion

### Phase 1-2 — Combined Research & Architecture
Some variants combine phases 1 and 2 when research and architecture planning are tightly coupled. In this case, specialist agents perform both research and architectural design before PM's approval gate. The approval gate still applies at the end of phase 1-2.

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit user approval.
- Senior specialist agents present the proposed approach
- PM synthesizes findings into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3
- **Output**: approved implementation plan

### Phase 3 — Execution / Creation
**PM coordinates**: specialists implement per the approved plan.
- Content, design, or code agents execute their domain work
- Agents may hand off directly to each other without PM intervention
- PM reviews output quality at phase end
- **Output**: primary deliverables (documents, designs, code, etc.)

### Phase 4 — Delivery / Integration
**PM coordinates**: delivery agents finalize output.
- Platform integration, publication, or deployment agents act
- Project coordinators manage stakeholder communication
- **Output**: delivered and integrated work product

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

## Variant Customization Points

Each variant declares its specialist agents per phase in `AGENTS.md § Phase Summary` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter
phases: [1, 2]
handoff_to: [next-agent]
handoff_from: [pm]
required_skills: [skill-name]
```

The PM role and Phase 0/5/6 structure are identical across all variants. Variants differ in phases 1–4.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Set objective, nominate team | Confirm setup complete | Scope document |
| 1 | Brief analysts on research goal | Check quality of findings | Key findings summary |
| 2 | Present findings for approval | — | Decision + approved plan |
| 3 | Hand off approved plan | Intervene if off-plan | Quality review |
| 4 | Confirm delivery targets | Track completion | Delivery confirmation |
| 5 | Update governance records | Verify lifecycle drift | Drift report or "no drift" confirmation |
| 6 | Run audit + /sync | Fix issues (max 2 iterations) | Audit pass report + PR link |
