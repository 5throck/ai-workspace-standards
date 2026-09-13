---
status: Accepted
date: 2026-09-13
author: PM
---

# ADR-0078: Agent-Mediated LLM Work Routing

## Context

The workspace's multi-agent harness (PM Gateway, AGENTS.md §3; CONSTITUTION
§5.5) routes all file modifications through specialist agents dispatched by
the PM agent, protected by hard gates: the Design Gate (ADR-0074), the QA
gate, pre-commit audit hooks, and the `/sync` spec-check. Nothing yet makes
explicit the obvious corollary for generated projects: when a project's
development involves using an LLM (building an app or web service, writing
scripts or documents), the LLM interaction itself must flow through the
project's internal agent team — not through direct ad-hoc queries to an
external LLM whose output is then pasted into the repository. The direct path
produces the same class of artifacts while skipping every gate: design
validation, QA, secret scanning, the English-only documentation rule, 3-tier
model cost control, and decision-record capture (ADR-0061).

Requirement (user, 2026-09-13): make agent-team-mediated LLM work the
mandated path in ADR and governance documents, with PM as the orchestration
entry point, so that newly created projects follow it from birth.

## Decision

1. **Routing rule**: substantive LLM-assisted development work — the
   generation or modification of code, documents, designs, tests, or scripts
   — MUST be routed through the project's agent team:
   `user → PM triage → Design Gate (unless exempt) → specialist dispatch →
   QA gate → /sync PR`. Querying an external LLM directly (e.g. a web chat)
   and landing its output in the repository is a policy violation.
2. **Exemptions**: trivial assistance that does not land in the repository
   (IDE inline completions, one-off Q&A) is exempt. For repository-landing
   work, the existing E1–E5 exemption codes (AGENTS.md §5.1.1) apply
   unchanged; ad-hoc exemptions are forbidden.
3. **PM single entry point reaffirmed**: specialist agents refuse direct
   user invocation, and PM triages and dispatches without executing. Phases
   3/4/6 remain specialist-autonomous — this ADR changes no existing phase
   ownership.
4. **Runtime LLM integration**: an application calling LLM APIs at runtime is
   an architecture concern already covered by the Design Gate (ADR-0074);
   this ADR imposes no additional ceremony for it.
5. **Enforcement**: structural, via the existing hard gates. No new
   detection mechanism: a change that did not travel the pipeline cannot
   become a compliant PR, because the `/sync` spec-check blocks commits
   without design/spec activity (ADR-0074).
6. **Distribution**: the policy text ships in `templates/common/AGENTS.md`
   (inside the COMMON-AGENTS marker block that `create-l3-scaffold.ts` copies
   verbatim into new-project AGENTS.md), in `templates/common/agents/pm.md`
   (inherited by all variant/project PMs via `extends:`), and in
   `templates/common/docs/context.md`. Newly scaffolded projects inherit it
   with no script changes; the L0 AGENTS.md gains §3.9.

## Consequences

- **Positive**: closes the last ungated authoring path; newly created
  projects carry the policy from scaffold time; consistent with existing
  governance (no new mechanism, no script changes).
- **Cost**: existing projects do not inherit it automatically
  (`docs/context.md` is immutable after creation) — per-project backporting
  is deferred to follow-up tickets. Policy adherence remains
  self-enforced/structurally-enforced, not machine-detected.
- **Neutral**: developer experience for trivial assistance (completions,
  scratch Q&A) is unchanged by design; a full ban was rejected as
  unverifiable.

## References

- Design: `docs/designs/2026-09-13-llm-work-routing-design.md`
- ADR-0074 (Universal Design Gate — runtime LLM integration + spec-check
  enforcement), ADR-0061 (gate-moment decision records), ADR-0055
  (spec-exempt machine gating)
- AGENTS.md §3 (PM Gateway), §5.1.1 (E1–E5 exemptions); CONSTITUTION §5.5
- Precedent: `Projects/co-newbiz/docs/adr/0128-runtime-pm-agent-orchestration.md`
