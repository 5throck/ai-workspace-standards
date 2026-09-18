---
status: Accepted
date: 2026-09-18
author: PM
---

# ADR-0080: PM Team-Management Authority — Agent Hiring/Firing and Skill Requests

## Context

The agent roster was static in practice. Creating or retiring a specialist
required a user-initiated request routed through the heavyweight
`team-builder` skill (whole-team benchmarking and rebuild) or the manual
steps of `agent-lifecycle-manager` — neither designed for a single-agent
decision made mid-workflow. Two capability gaps compounded this:

1. **No PM authority for team composition.** `agents/pm.md` defined PM as
   dispatcher and gate-keeper but said nothing about deciding team
   membership. Signals that a roster change was needed (the same work type
   recurring with no matching specialist, one agent absorbing unrelated
   domains, an agent never dispatched) were observed but had no sanctioned
   path to act on.
2. **No bottom-up skill path.** `skill-lifecycle-manager` covered skill
   creation and validation only — it had no deprecation or removal
   procedure at all, and no mechanism for a specialist agent to request a
   skill change for itself. Skill-to-agent bindings (`owner:` fields) could
   only drift.

Requirement (user, 2026-09-18): make agent hiring/firing a PM-decided
authority, make skill addition/removal an agent-initiated, PM-approved
flow, and keep both inside the existing governance machinery.

## Decision

1. **Hiring/firing is PM-decided (top-down).** PM judges the timing and
   target autonomously from workflow signals — recurring unmatched work
   types, role overload, absorbed roles, and the quarterly roster review
   (AGENTS.md §10 cadence; the Q4 deprecation sweep extends to agents).
   No blocking user approval: PM emits a gate-moment decision record
   (ADR-0061) at `docs/decisions/DEC-YYYYMMDD-NN.md` **before dispatch
   continues** and logs the entry to the active memory log. A direct user
   request ("hire an agent for X") remains a valid hiring signal, never a
   bypass of the procedure.
2. **Default exit is deprecation; delete is user-gated.** A fired agent
   becomes `status: deprecated` with governance records preserved. Hard
   delete (`agent-delete.ts --force` plus full roster cleanup) executes
   only on an explicit user request.
3. **Skill requests are agent-initiated and PM-approved (bottom-up).** An
   agent that judges a skill necessary or unnecessary files a structured
   request block (`{requester, type: create|attach|remove, target_skill,
   justification+evidence, impact}`) in its task report and the active
   memory log. PM triages pending requests at the next orchestration cycle
   or Phase 5 finalization; only approved requests are dispatched for
   execution (with an ADR-0061 decision record), rejections are logged
   with rationale. Agents never create, attach, or remove skills
   unilaterally.
4. **Initial skill package is part of the hiring decision.** On hire, PM
   attaches existing skills via the skill `owner:` field or files a
   `create` request through the skill-request flow. On fire, the skill
   disposition plan (transfer owners / route to removal) is part of the
   firing decision — the fired agent cannot request anything.
5. **Execution stays dispatch-based.** PM never edits agent or skill files
   directly: automation-engineer (or the project's implementation
   specialist) executes file edits; lifecycle-manager updates governance
   records and publishes L0→L1. Structural drift is caught by the existing
   audits (`agent-lifecycle-audit.ts`, `lifecycle-sync-audit.ts`).
6. **Distribution**: the authority text ships in `agents/pm.md` (L0) and
   `templates/common/agents/pm.md` (WORKSPACE-MANAGED block; variants
   inherit via the `extends:` chain), in AGENTS.md §3.11 (L0 and
   `templates/common/AGENTS.md`, condensed copy inside the COMMON-AGENTS
   marker block), in `templates/common/docs/context.md` (COMMON-CONTEXT
   marker block, following the ADR-0078/ADR-0079 policy-distribution
   pattern), and in the procedures of `skills/agent-lifecycle-manager`
   (1.2.0: Hiring/Firing Workflows, Skill Attach/Detach Rules) and
   `skills/skill-lifecycle-manager` (1.4.0: Skill Request Workflow R1–R3,
   Deprecation & Removal).

## Consequences

- **Positive**: roster evolution no longer waits for a user to notice a
  gap; skill bindings gain a sanctioned change path and a removal
  procedure; every composition change leaves a decision-record trail
  consistent with ADR-0061.
- **Cost**: PM gains judgment duties beyond dispatch — the quality of
  hire/fire decisions depends on memory-log evidence, which is only as
  good as session logging discipline. Deprecation (not delete) is the
  default, so `agents/` accumulates deprecated files until a removal
  review.
- **Neutral**: existing heavyweight paths are unchanged — `team-builder`
  remains the tool for whole-team restructuring; the per-agent workflows
  are the lightweight complement, not a replacement.

## References

- Design: `docs/designs/2026-09-18-pm-team-management-authority-design.md`
- ADR-0061 (gate-moment decision records), ADR-0074 (Universal Design
  Gate), ADR-0078 (agent-mediated LLM work routing — §3.9 distribution
  pattern reused here)
- AGENTS.md §3.11 (PM Team-Management Authority), §10 (Periodic Skill
  Review Schedule); CONSTITUTION §5.5 (PM Gateway Workflow)
- Procedures: `skills/agent-lifecycle-manager/SKILL.md` (Hiring H1–H6,
  Firing F1–F5), `skills/skill-lifecycle-manager/SKILL.md` (Requests R1–R3,
  Deprecation & Removal)
