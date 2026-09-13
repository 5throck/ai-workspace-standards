---
schemaVersion: 1.0.0
spec-id: llm-work-routing
---

# LLM Work Routing Policy Design (ADR-0078)

## 1. Overview

Requires that substantive LLM-assisted development work in generated projects
(apps, web services, scripts, documents) flows through the project's internal
agent team — never through direct ad-hoc queries to an external LLM with
results pasted into the repository. Orchestration stays with the PM agent as
the single entry point, matching the existing PM Gateway architecture.
Encoded as **ADR-0078** and inherited by all newly scaffolded projects via
`templates/common/`.

## 2. Background

The PM Gateway (AGENTS.md §3, CONSTITUTION §5.5) already mandates that all
file modifications go through specialist agents dispatched by PM, with hard
gates (Design Gate ADR-0074, QA gate, pre-commit audit, `/sync` spec-check).
However, no explicit rule governs the bypass path: a user (or tool) querying
an external LLM directly (e.g. a web chat) and pasting results into the repo
skips every gate while producing the same kind of artifacts. Precedent exists
in-project: `Projects/co-newbiz/docs/adr/0128-runtime-pm-agent-orchestration.md`.

## 3. Policy (ADR-0078 decision summary)

1. **Routing rule**: substantive LLM-assisted development work — generation or
   modification of code, documents, designs, tests, or scripts — MUST be
   routed through the project's agent team: user → PM triage → Design Gate
   (unless exempt) → specialist dispatch → QA gate → `/sync` PR. Querying an
   external LLM directly and landing its output in the repository is a policy
   violation.
2. **Exemptions**: trivial assistance not landing in the repository (IDE
   inline completions, one-off Q&A) is exempt. For repository-landing work,
   the existing E1–E5 exemption codes (AGENTS.md §5.1.1) are reused — no
   ad-hoc exemptions.
3. **PM single entry point reaffirmed**: specialist agents refuse direct
   invocation; PM triages and dispatches only (Phases 3/4/6 remain
   specialist-autonomous per the existing workflow — no change).
4. **Runtime LLM integration**: an application calling LLM APIs at runtime is
   an architecture concern already covered by the Design Gate (ADR-0074);
   this ADR adds no additional ceremony for it.
5. **Rationale**: direct LLM use bypasses the Design Gate, QA gate, secret
   scanning, the English-only documentation rule, 3-tier cost control, and
   decision-record capture (ADR-0061).
6. **Enforcement**: no new detection mechanism. Structural enforcement comes
   from existing hard gates — a change that did not travel the pipeline cannot
   become a compliant PR (`/sync` spec-check blocks it).

## 4. Delivery (files)

| File | Change |
|------|--------|
| `docs/adr/0078-agent-mediated-llm-work-routing.md` | NEW — ADR body |
| `AGENTS.md` (L0) | New subsection §3.9 LLM Work Routing Policy |
| `templates/common/AGENTS.md` | Policy added inside the `COMMON-AGENTS` marker block — `create-l3-scaffold.ts` copies this block verbatim into new-project AGENTS.md, so inheritance requires **no script change** |
| `templates/common/agents/pm.md` | PM routing duty added to the WORKSPACE-MANAGED body — inherited via `extends:` by all variant/project PMs |
| `templates/common/docs/context.md` | "LLM Work Routing Policy" subsection added after the 3-Tier section — the shared reference all AI tools read (user-requested) |
| `docs/index.md` | ADR index entry for 0078 |

All content in English (workspace language policy).

## 5. Trade-offs

- **Alternative rejected — full ban**: prohibiting IDE completions is
  unverifiable in practice and would render the policy decorative.
- **Out of scope**: machine-checked policy-drift detection in `audit.ts`;
  backporting to already-created projects (`docs/context.md` is immutable
  after creation — each project needs individual porting); the unmarked
  3-tier block drift in `templates/co-develop/AGENTS.md` (found during
  exploration) — all recommended as follow-up tickets.
- **Docs-only change**: no runtime behavior, no scripts touched; propagation
  relies on the existing scaffold COMMON-AGENTS copy and pm.md `extends`
  chain (verified mechanisms).

## 6. Verification

- `bun scripts/audit.ts` exit 0 (spec-check satisfied by this registry entry)
- `templates/co-*/AGENTS.md` inheritance unchanged (COMMON-AGENTS block is
  scaffold-time copy; variants already carry their own copy — no forced
  regeneration required, drift handled by the existing sync pipeline)
- `docs/index.md` ADR range updated to 0001–0078
