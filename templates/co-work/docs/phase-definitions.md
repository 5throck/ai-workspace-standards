# Phase Definitions — co-work

This document defines the workflow phases used by the `co-work` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-work's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination Checklist in `AGENTS.md §3.5`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation | Orchestrator | PM + variant setup |
| 1 | Research & Analysis | Observer | `analyst`, `storyteller` |
| 2 | Design Review & Approval | Gate Keeper | PM + `storyteller` |
| 3 | Content Creation | Coordinator | `content-writer`, `technical-writer` |
| 4 | Coordination & Delivery | Coordinator | `ms365-expert`, `project-coordinator` |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Project Initiation
**PM opens the phase**: clarify objective, confirm scope, assemble the team.
- PM reviews the request and classifies it
- PM identifies which specialist agents are needed (including whether the optional `ms365-expert` or `storyteller` agents are in scope)
- **Output**: confirmed scope, team assignment

### Phase 1 — Research & Analysis
**PM observes**: specialists work autonomously.
- `analyst` (Tier: Medium) conducts systematic investigation, data synthesis, and evidence gathering; hands off findings to `content-writer` or `technical-writer`
- `storyteller` (Tier: Medium, optional) provides organizational culture and change-narrative context where relevant; can lead or support Phase 1
- PM intervenes only if quality standards are not met
- **Output**: research findings report, cultural/narrative context (if `storyteller` engaged)
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit user approval.
- `storyteller` (Tier: Medium, optional) can also support Phase 2 for cultural alignment review of the proposed approach
- PM synthesizes findings into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3
- **Output**: approved content/communication plan

### Phase 3 — Content Creation
**PM coordinates**: specialists implement per the approved plan.
- `content-writer` (Tier: Medium) transforms research findings into audience-appropriate documentation and communications; hands off to `ms365-expert`
- `technical-writer` (Tier: Medium) produces API documentation, technical guides, and developer resources
- Agents may hand off directly to each other without PM intervention
- **Output**: primary content deliverables (guides, reports, API docs, communications)

### Phase 4 — Coordination & Delivery
**PM coordinates**: delivery and logistics agents finalize output.
- `ms365-expert` (Tier: Low, optional) integrates deliverables with Microsoft 365 tooling (Word, Excel, PowerPoint, Teams, SharePoint) when that tooling is required
- `project-coordinator` (Tier: Low, optional) manages schedules, stakeholder communication, review cycles, and delivery logistics
- **Output**: delivered and integrated work product, stakeholder communications sent

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

Per each agent's frontmatter `phases:` field in `templates/co-work/agents/*.md`:

| Agent | Phases | Tier | Optional? |
|-------|--------|------|-----------|
| `analyst` | 1 | Medium | No |
| `storyteller` | 1, 2 | Medium | Yes |
| `content-writer` | 3 | Medium | No |
| `technical-writer` | 3 | Medium | No |
| `ms365-expert` | 4 | Low | Yes |
| `project-coordinator` | 4 | Low | Yes |

`ms365-expert` and `storyteller` are declared optional in `variant.json → agent_manifest.optional` (see `AGENTS.md` Agent Roster and Dispatch Trigger tables for inline "(optional)" annotations).

---

## Variant Customization Points

co-work declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (content-writer)
phases: [3]
handoff_to: [ms365-expert]
handoff_from: [analyst]
required_skills: [documentation-writing]
```

The PM role and Phase 0/5/6 structure are identical to the workspace-standard phase model. co-work differs from the standard template in phases 1-4: it combines "Research / Analysis" with organizational-narrative context (`storyteller`) in Phases 1-2, and splits "Execution" and "Delivery / Integration" into a dedicated Content Creation phase (3) and Coordination & Delivery phase (4).

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Set objective, nominate team (incl. optional agents) | Confirm setup complete | Scope document |
| 1 | Brief `analyst`/`storyteller` on research goal | Check quality of findings | Key findings summary |
| 2 | Present findings for approval | — | Decision + approved plan |
| 3 | Hand off approved plan to `content-writer`/`technical-writer` | Intervene if off-plan | Quality review |
| 4 | Confirm delivery targets with `project-coordinator`/`ms365-expert` | Track completion | Delivery confirmation |
| 5 | Update governance records | Verify lifecycle drift | Drift report or "no drift" confirmation |
| 6 | Run audit + `/sync` | Fix issues (max 2 iterations) | Audit pass report + PR link |
