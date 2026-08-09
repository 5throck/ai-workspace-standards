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
| 5 | Quality Assurance | Owner | PM (runs audit scripts) |
| 6 | PR & Handoff | Owner | PM (runs /sync, creates PR) |

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

### Phase 5 — Quality Assurance
**PM owns**: runs audit scripts directly.
- PM runs `audit-workspace` skill
- PM runs `validate-docs-links` skill
- Maximum 2 fix iterations before escalating to user
- **Output**: passing audit report

### Phase 6 — PR & Handoff
**PM owns**: finalizes the session.
- PM runs `/sync` pipeline
- PR opened with English title and description
- Memory log updated
- **Output**: merged PR or open PR link

---

## Recurring Sub-Process Pattern (Post-Delivery)

Not all variant work fits a single linear pass through Phases 0–6. Some work recurs
independently *within* an already-approved engagement — triggered by a new event (e.g. a new
export shipment) rather than by a new engagement — and should not re-run the full Phase 0–2 setup
and gate for every occurrence.

A recurring sub-process:
- Is declared as a normal specialist agent (`phases: [3]` or similar in its frontmatter) — it does
  **not** get its own phase number; it runs *inside* Phase 3 of the parent engagement
- Reuses compliance findings already approved at the parent engagement's Phase 2 gate (e.g. a
  confirmed HS classification) rather than re-triggering **USER APPROVAL REQUIRED** for every
  occurrence
- Re-triggers the Phase 2 gate only if its own output would change a previously approved
  compliance finding (e.g. a reclassification)
- Still produces its own deliverable and still passes through Phase 5 (audit) before Phase 6
  (`/sync`/PR) once the deliverable is committed

**Co Export example — Customs Duty Drawback**: `customs-duty-drawback-specialist`
(see [`agents/customs-duty-drawback-specialist.md`](../agents/customs-duty-drawback-specialist.md),
workflow: [`customs-duty-drawback-workflow`](../skills/customs-duty-drawback-workflow/SKILL.md))
runs once per export shipment as a Phase 3 sub-process, reusing the HS code and tariff rate
already confirmed under the parent engagement's Phase 1-2 classification. It does not require a
fresh Phase 2 approval gate per shipment — only if the underlying HS classification or refund
method changes. See [`docs/co-export.context.md` § Dispatch / Handoff Chain](co-export.context.md#dispatch--handoff-chain)
for the full trigger condition.

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
| 5 | Run audit scripts | Fix issues (max 2 iterations) | Audit pass report |
| 6 | Run /sync | — | PR link |
