# Phase Definitions — co-design

This document defines the workflow phases used by the `co-design` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-design's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination Checklist in `AGENTS.md §3.5`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation | Orchestrator | PM + variant setup |
| 1 | User Research & Narrative Foundation | Observer | `ux-researcher`, `storyteller` |
| 2 | Design Direction & Approval | Gate Keeper | PM + `design-lead`, `storyteller` |
| 3 | Design System & Execution | Coordinator | `design-lead`, `visual-designer`, `service-designer`, `typography-expert` |
| 4 | Prototyping & Handoff | Coordinator | `prototype-engineer` |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Project Initiation
**PM opens the phase**: clarify the design objective, confirm scope, assemble the team.
- PM reviews the request and classifies the deliverable type (design system foundation, single-screen execution, service journey, prototype, etc.)
- PM identifies which specialist agents are in scope, including optional narrative work from `storyteller`
- **Output**: confirmed scope, team assignment

### Phase 1 — User Research & Narrative Foundation
**PM observes**: specialists work autonomously.
- `ux-researcher` (Tier: Medium) conducts user interviews, usability studies, and research synthesis; produces personas, journey inputs, and validated user needs
- `storyteller` (Tier: Medium) articulates the design philosophy, brand narrative, and first principles that will ground later design decisions — this is a **prerequisite for coherent Phase 2 direction**, not an afterthought
- PM intervenes only if research quality or narrative grounding is insufficient
- **Output**: research findings, personas, design philosophy statement
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Design Direction & Approval
**PM enforces the gate**: no execution without explicit user approval.
- `design-lead` (Tier: High) synthesizes research and narrative inputs into design direction: token architecture, component philosophy, and system-level decisions
- `storyteller` (Tier: Medium) reviews the proposed direction against the design principles document and flags any decisions that violate a stated principle
- PM synthesizes findings into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3
- **Output**: approved design direction brief, design token architecture

### Phase 3 — Design System & Execution
**PM coordinates**: specialists implement per the approved direction.
- `design-lead` (Tier: High) governs the design token system and reviews all outputs for system consistency; may continue leading into this phase for gating
- `visual-designer` (Tier: Medium) executes high-fidelity screen designs, mockups, and component specifications within the approved system
- `service-designer` (Tier: Medium) maps end-to-end customer journeys and produces service blueprints when the deliverable spans beyond a single interface
- `typography-expert` (Tier: Medium) defines the type system and typographic hierarchy feeding into `visual-designer`'s execution
- Agents may hand off directly to each other without PM intervention (e.g. `design-lead` → `visual-designer` → `typography-expert`)
- **Output**: high-fidelity screen designs, design specifications, service blueprints, type system documentation

### Phase 4 — Prototyping & Handoff
**PM coordinates**: prototyping and developer/stakeholder handoff.
- `prototype-engineer` (Tier: Medium) builds interactive prototypes from the approved visual designs, simulates user flows, and validates technical feasibility of interactions
- Prototypes feed back into `ux-researcher`-led usability testing when validation is required before final handoff
- **Output**: interactive prototypes, interaction specifications, developer handoff documentation

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

Per each agent's frontmatter `phases:` field in `templates/co-design/agents/*.md`:

| Agent | Phases | Tier | Optional? |
|-------|--------|------|-----------|
| `ux-researcher` | 1 | Medium | No |
| `storyteller` | 1, 2 | Medium | No |
| `design-lead` | 2, 3 | High | No |
| `visual-designer` | 3 | Medium | No |
| `service-designer` | 3 | Medium | No |
| `typography-expert` | 3 | Medium | No |
| `prototype-engineer` | 4 | Medium | No |

---

## Variant Customization Points

co-design declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (visual-designer)
phases: [3]
handoff_to: [prototype-engineer]
handoff_from: [design-lead]
required_skills: [ui-ux-design-intelligence]
```

The PM role and Phase 0/5/6 structure are identical to the workspace-standard phase model. co-design differs from the standard template in phases 1-4: it pairs empirical user research (`ux-researcher`) with philosophical/narrative grounding (`storyteller`) in Phase 1, gates on design *direction* rather than a generic plan in Phase 2 (owned by `design-lead`), fans out into parallel system-execution work (`design-lead`, `visual-designer`, `service-designer`, `typography-expert`) in Phase 3, and isolates interactive prototyping and technical-feasibility validation into a dedicated Phase 4 owned by `prototype-engineer`.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Set design objective, nominate team | Confirm setup complete | Scope document |
| 1 | Brief `ux-researcher`/`storyteller` on research and narrative goals | Check research rigor and narrative grounding | Findings summary + philosophy statement |
| 2 | Present design direction for approval | — | Decision + approved direction brief |
| 3 | Hand off approved direction to `design-lead`/`visual-designer`/`service-designer`/`typography-expert` | Intervene if off-system | Design system + execution review |
| 4 | Confirm prototyping scope with `prototype-engineer` | Track feasibility flags | Prototype + handoff confirmation |
| 5 | Update governance records | Verify lifecycle drift | Drift report or "no drift" confirmation |
| 6 | Run audit + `/sync` | Fix issues (max 2 iterations) | Audit pass report + PR link |
