# Phase Definitions — co-learning

This document defines the workflow phases used by the `co-learning` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-learning's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination table in `AGENTS.md §3.5`.

> **Roster note (T-20261006-001)**: the variant roster is three agents — `pm` (orchestration), `exam-bank-steward` (question-bank content and exam operations), `i18n-specialist` (locale documentation). Dev-slot work (design/implementation/docs) is dispatched by PM to generic specialists per the §3.5 Deliverable-Type Gate; there is no named architect/code-writer/test-runner/designer/stack-setup/security-monitor roster in this variant.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Team Assembly & Environment Baseline | Orchestrator | PM |
| 1 | Analysis | Observer | PM-dispatched design specialist (§3.5) |
| 2 | Design Review & Approval | Gate Keeper | PM + design specialist |
| 3 | Content Production | Coordinator | `exam-bank-steward`; `i18n-specialist` on demand |
| 4 | Implementation & QA Gate | Coordinator | PM-dispatched implementation specialist; PM verifies |
| 5 | Security Review & Lifecycle Finalization | Owner | PM (runs `security-scan` in the QA gate, updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Team Assembly & Environment Baseline
**PM opens the phase**: clarify the request, confirm scope, assemble the team.
- PM reviews the request and classifies it per the §3.5 Deliverable-Type Gate
- PM runs the post-scaffold baseline scan (the `security-scan` skill) to establish the initial findings state
- **Output**: confirmed scope, dispatch plan, environment baseline

### Phase 1 — Analysis
**PM observes**: specialists work autonomously.
- The design specialist (§3.5, High tier) analyzes requirements and acceptance criteria, begins design work
- PM intervenes only if quality standards are not met
- **Output**: requirements + acceptance criteria
- **Gate**: none — phase ends when the specialist signals completion

### Phase 2 — Design Review & Approval
**PM enforces the gate**: no execution without explicit user approval.
- The design specialist produces the implementation plan (data model, API surface, file changes, trade-offs) and an ADR (`docs/adr/NNNN-slug.md`) for significant architectural decisions
- PM synthesizes the plan into a decision recommendation
- **USER APPROVAL REQUIRED** before proceeding to Phase 3/4
- **Output**: approved implementation plan + ADR

### Phase 3 — Content Production
**PM coordinates**: content work proceeds when the approved plan includes question-bank or locale deliverables.
- `exam-bank-steward` (Tier: Medium) authors/reviews question-bank content, runs bias remediation through the remediation ledger, and performs exam operations — every rewrite is human-reviewed
- `i18n-specialist` (Tier: Medium, on demand) covers locale documentation and translation-zone work for the produced content
- Skipped entirely when no question-bank/locale deliverable is in scope
- **Output**: reviewed content set (when engaged), or pass-through to Phase 4

### Phase 4 — Implementation & QA Gate
**PM coordinates**: implementation and verification proceed per the approved plan.
- The implementation specialist (§3.5) implements exactly what the approved plan specifies — no scope creep, no redesign
- PM runs the audit script and full test suite, verifies every acceptance criterion from the implementation plan, and reports a pass/fail QA verdict (the `security-scan` skill covers the security check for auth/secrets/infra changes)
- Loop up to 3 QA iterations on failures before escalating to the user
- **Output**: implemented change set, QA report (READY FOR PR or BLOCKED)

### Phase 5 — Security Review & Lifecycle Finalization
**PM owns**: the security check clears the change and governance records are updated.
- PM runs the pre-PR advisory check (`security-scan`) — any CRITICAL/HIGH finding blocks the PR; required for any change touching auth, secrets, or infra
- PM updates governance documents for agent/skill/script changes
- PM logs decisions to `memory/YYYY-MM-DD.md`
- **Output**: security advisory report, governance records updated, drift report or "no drift" confirmation

### Phase 6 — Quality Assurance & Finalization
**PM owns**: finalizes the session.
- PM runs `project-review` skill (use `baseline-only` mode for docs/link validation)
- Maximum 2 fix iterations before escalating to user
- PM runs `/sync` pipeline
- PR opened with English title and description
- Memory log updated
- **Output**: passing audit report, merged PR or open PR link

---

## Agent-to-Phase Mapping (Source of Truth)

Per each agent's frontmatter `phases:` field in `templates/co-learning/agents/*.md` (also mirrored in `AGENTS.md §2` and `§3.5`):

| Agent | Phases | Tier | Notes |
|-------|--------|------|-------|
| `pm` | 0-6 | — | Orchestration, QA gate, security-scan runs, `/sync` |
| `exam-bank-steward` | 4, 5 | Medium | Question-bank authoring/review, bias remediation, exam operations; human-reviewed via the remediation ledger |
| `i18n-specialist` | 5 | Medium | Locale documentation and translation zones (common extends-stub; engaged on demand for locale deliverables) |
| design / implementation / docs specialists | per §3.5 row | High / Low-Medium / Medium | Generic PM-dispatched specialists — no agent file in this variant; the §3.5 Deliverable-Type Gate names the slot and tier |

The `designer`/`stack-setup` optionality annotations once described in this document belonged to a generic-pipeline roster this variant never shipped; `variant.json` carries no `pipeline` field and `agents/` contains exactly the three roster agents above.

---

## Variant Customization Points

co-learning declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (exam-bank-steward)
phases: [4, 5]
```

The PM role and Phase 0/6 structure are consistent with the workspace-standard phase model. co-learning differs from the standard template by:
- Making question-bank content a first-class phase (Phase 3) owned by `exam-bank-steward`, with every rewrite human-reviewed via the remediation ledger.
- Keeping the security check inside the QA gate (Phase 5) via the PM-run `security-scan` skill rather than a dedicated agent.
- Merging "Execution" and "QA Gate" into a single Phase 4 (max 3 iterations) defined in `co-learning.context.md § Subagent Pattern`.
