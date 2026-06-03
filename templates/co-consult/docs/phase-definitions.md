# Phase Definitions

This document defines the standard workflow phases for co-consult engagements. The Engagement Leader orchestrates the overall flow while specialist agents own their respective phases.

---

## Phase Overview

| Phase | Name | Engagement Leader Role | Who Acts |
|-------|------|----------------------|----------|
| 0 | Engagement Initiation | Orchestrator | Engagement Leader only |
| 1 | Research & Data Gathering | Observer | Strategy Analyst, Change Management Partner |
| 2 | Design Review & Approval | Gate Keeper | Engagement Leader + Change Management Partner |
| 3 | Deliverable Creation | Coordinator | Communications Lead, Solutions Architect |
| 4 | Implementation & Delivery | Coordinator | Delivery Manager, Technology Specialist |
| 5 | Quality Assurance | Owner | Engagement Leader (runs audit scripts) |
| 6 | PR & Handoff | Owner | Engagement Leader (runs /sync, creates PR) |

---

## Phase Details

### Phase 0 — Engagement Initiation
**Engagement Leader opens the phase**: clarify client objective, confirm scope, assemble the team.
- Engagement Leader reviews the request and classifies it
- Engagement Leader identifies which specialist agents are needed based on scope
- Team composition confirmed against scenario guide (`docs/team-configuration-guide.md`)
- **Output**: confirmed scope, team assignment, engagement charter

### Phase 1 — Research & Data Gathering
**Engagement Leader observes**: specialists work autonomously.
- Strategy Analyst gathers market data, competitive intelligence, and financial analysis
- Change Management Partner assesses organizational readiness, culture, and stakeholder landscape
- Industry Expert / SME / Data Analyst contribute when engaged
- Engagement Leader intervenes only if quality standards are not met
- **Output**: research findings report, organizational assessment
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Design Review & Approval
**Engagement Leader enforces the gate**: no execution without explicit user/client approval.
- Change Management Partner presents organizational transformation approach
- Strategy Analyst presents strategic recommendations
- Engagement Leader synthesizes findings into a decision recommendation
- **USER/CLIENT APPROVAL REQUIRED** before proceeding to Phase 3
- **Output**: approved engagement plan and solution direction

### Phase 3 — Deliverable Creation
**Engagement Leader coordinates**: specialists create deliverables per the approved plan.
- Communications Lead crafts client-facing documents, presentations, and strategic narratives
- Solutions Architect designs technical solutions, architecture blueprints, and implementation roadmaps
- Both agents may run in parallel; hand off directly to each other without Engagement Leader intervention
- Workstream Lead coordinates if 3+ parallel streams are active
- Engagement Leader reviews output quality at phase end
- **Output**: primary client deliverables (reports, presentations, technical specifications)

### Phase 4 — Implementation & Delivery
**Engagement Leader coordinates**: delivery agents finalize and distribute output.
- Delivery Manager coordinates stakeholder review cycles, collects feedback, tracks resolution
- Technology Specialist implements M365 workflows, sets up collaboration platforms, automates distribution
- **Output**: delivered and integrated work product, stakeholder sign-off

### Phase 5 — Quality Assurance
**Engagement Leader owns**: runs audit scripts directly.
- Engagement Leader runs `bun scripts/audit.ts`
- Validates all deliverables against acceptance criteria
- Maximum 2 fix iterations before escalating to user
- **Output**: passing audit report

### Phase 6 — PR & Handoff
**Engagement Leader owns**: finalizes the engagement session.
- Engagement Leader runs `/sync` pipeline
- PR opened with English title and description
- Memory log updated
- Final deliverables handed off to client
- **Output**: merged PR or open PR link, client delivery confirmation

---

## Specialist Agent Phase Ownership

| Agent | Phases | Role |
|-------|--------|------|
| Engagement Leader | 0, 2, 5, 6 | Orchestrator, Gate Keeper, QA Owner |
| Strategy Analyst | 1 (support: 3, 5) | Research lead |
| Change Management Partner | 1, 2 (support: 3, 4, 5, 6) | Culture & transformation lead |
| Communications Lead | 3 (support: 5) | Client deliverables lead |
| Solutions Architect | 3 (support: 5) | Technical design lead |
| Workstream Lead | 3, 4 | Cross-stream coordination |
| Delivery Manager | 4 (support: 6) | Delivery & logistics lead |
| Technology Specialist | 4 (support: 3, 5) | Platform implementation lead |
| Industry Expert | 1 (on demand) | Industry insight specialist |
| Subject Matter Expert | 1 (on demand) | Functional depth specialist |
| Data Analyst | 1, 3 (on demand) | Quantitative analysis specialist |

---

## Engagement Leader Facilitation per Phase

| Phase | Opening | Monitoring | Synthesis |
|-------|---------|-----------|----------|
| 0 | Set objective, nominate team, confirm scope | Confirm setup complete | Engagement charter |
| 1 | Brief analysts on research goals | Check quality of findings | Key findings summary |
| 2 | Present findings for approval | — | Decision + approved plan |
| 3 | Hand off approved plan to content teams | Intervene if off-plan | Quality review |
| 4 | Confirm delivery targets and stakeholder list | Track completion | Delivery confirmation |
| 5 | Run audit scripts | Fix issues (max 2 iterations) | Audit pass report |
| 6 | Run /sync | — | PR link + client delivery |

---

## Variant Customization

Agent participation per phase is declared in each agent's frontmatter:

```yaml
phases: [1, 3]
handoff_to: [communications-lead]
handoff_from: [engagement-leader]
required_skills: [research-analysis]
```

The Engagement Leader role and Phase 0/5/6 structure are fixed for co-consult. Phases 1–4 scale based on the engagement scenario (see `docs/team-configuration-guide.md`).
