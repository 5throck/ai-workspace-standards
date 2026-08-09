# Phase Definitions — co-develop

This document defines the workflow phases used by the `co-develop` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-develop's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination table in `AGENTS.md §3.5`.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Team Assembly & Environment Baseline | Orchestrator | PM, `stack-setup` (optional), `security-monitor` |
| 1 | Analysis & Stack Setup | Observer | `architect`, `stack-setup` (optional) |
| 2 | Design Review & Approval | Gate Keeper | PM + `architect` |
| 3 | UI/UX Design | Coordinator | `designer` (optional) |
| 4 | Implementation & QA Gate | Coordinator | `code-writer`, `test-runner` |
| 5 | Security Review & Lifecycle Finalization | Owner | `security-monitor`, PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Team Assembly & Environment Baseline
**PM opens the phase**: clarify the request, confirm scope, assemble the team.
- PM reviews the request and classifies it
- `stack-setup` (Tier: Low, optional) identifies the tech stack when it is unrecognized and produces a risk-assessed setup plan — only dispatched when no known project manifest exists
- `security-monitor` (Tier: Medium) runs a post-scaffold baseline scan to establish the initial `security/` findings state
- **Output**: confirmed scope, team assignment, environment baseline (if stack-setup engaged)

### Phase 1 — Analysis & Stack Setup
**PM observes**: specialists work autonomously.
- `architect` (Tier: High) analyzes requirements and acceptance criteria, begins design work
- `stack-setup` (Tier: Low, optional) continues environment bootstrap for unrecognized stacks, handing off to `architect` once the stack is confirmed
- PM intervenes only if quality standards are not met
- **Output**: requirements + acceptance criteria, confirmed dev environment
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit user approval.
- `architect` (Tier: High) produces the implementation plan (data model, API surface, file changes, trade-offs) and an ADR (`docs/adr/NNNN-slug.md`) for significant architectural decisions
- PM synthesizes the plan into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3/4
- **Output**: approved implementation plan + ADR

### Phase 3 — UI/UX Design
**PM coordinates**: design work proceeds when the approved plan includes a user-facing component.
- `designer` (Tier: Medium, optional) translates the approved plan into wireframes, component specs, interaction states, and design tokens; flags accessibility (WCAG AA) concerns before implementation
- Skipped entirely when no UI/UX component is in scope (per `variant.json → agent_manifest.optional`)
- Hands off directly to `code-writer`
- **Output**: design specification (when engaged), or pass-through to Phase 4 when out of scope

### Phase 4 — Implementation & QA Gate
**PM coordinates**: implementation and verification proceed per the approved plan.
- `code-writer` (Tier: Low) implements exactly what the approved plan specifies — no scope creep, no redesign; hands off to `test-runner`
- `test-runner` (Tier: Medium) runs the audit script and full test suite, verifies every acceptance criterion from the implementation plan, and reports a pass/fail QA verdict
- Loop up to 3 iterations between `code-writer` and `test-runner` on failures before escalating to PM
- **Output**: implemented change set, QA report (READY FOR PR or BLOCKED)

### Phase 5 — Security Review & Lifecycle Finalization
**PM owns**: security review clears the change and governance records are updated.
- `security-monitor` (Tier: Medium) runs a pre-PR advisory check (read-only) — reports any active CRITICAL/HIGH findings before the PR proceeds; required for any change touching auth, secrets, or infra (per `co-develop.context.md § Domain Rules`)
- PM updates governance documents for agent/skill/script changes
- PM logs decisions to `memory/YYYY-MM-DD.md`
- **Output**: security advisory report, governance records updated, drift report or "no drift" confirmation

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

Per each agent's frontmatter `phases:` field in `templates/co-develop/agents/*.md` (also mirrored in `AGENTS.md §2` and `§3.5`):

| Agent | Phases | Tier | Optional? |
|-------|--------|------|-----------|
| `stack-setup` | 0, 1 | Low | Yes — skip when the stack is already configured |
| `architect` | 1, 2 | High | No |
| `designer` | 3 | Medium | Yes — skip if no UI/UX component in scope |
| `code-writer` | 4 | Low | No |
| `test-runner` | 4 | Medium | No |
| `security-monitor` | 0, 5 | Medium | No |

`designer` and `stack-setup` are declared optional in `variant.json → agent_manifest.optional`, matching the "(optional)" annotations in `AGENTS.md` Agent Roster and Dispatch Trigger tables.

---

## Variant Customization Points

co-develop declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (code-writer)
phases: [4]
handoff_to: [test-runner]
handoff_from: [designer, architect]
required_skills: [code-review, refactoring]
```

The PM role and Phase 0/6 structure are consistent with the workspace-standard phase model. co-develop differs from the standard template by:
- Splitting security work into two touchpoints: a Phase 0 baseline scan and a Phase 5 pre-PR advisory check, both owned by `security-monitor`.
- Making `stack-setup` a Phase 0-1 specialist that only activates for unrecognized tech stacks, always requiring explicit user approval (via `CONFIRM HIGH RISK` for risky commands) before executing any setup step.
- Merging "Execution" and "QA Gate" into a single Phase 4, reflecting the tight `code-writer` → `test-runner` loop (max 3 iterations) defined in `co-develop.context.md § Subagent Pattern`.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Set objective, nominate team (incl. optional `stack-setup`) | Confirm environment baseline complete | Scope document + security baseline |
| 1 | Brief `architect`/`stack-setup` on requirements | Check quality of analysis | Requirements + acceptance criteria |
| 2 | Present implementation plan + ADR for approval | — | Decision + approved plan |
| 3 | Hand off approved plan to `designer` (if in scope) | Intervene if off-plan | Design specification or pass-through |
| 4 | Hand off approved plan to `code-writer` | Track `code-writer` ↔ `test-runner` loop (max 3x) | QA report (READY FOR PR / BLOCKED) |
| 5 | Request pre-PR advisory check from `security-monitor` | Verify lifecycle drift | Security report + drift report or "no drift" confirmation |
| 6 | Run audit + `/sync` | Fix issues (max 2 iterations) | Audit pass report + PR link |
