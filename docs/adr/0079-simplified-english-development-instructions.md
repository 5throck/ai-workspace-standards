---
status: Accepted
date: 2026-09-13
author: PM
---

# ADR-0079: Simplified English for Development Instructions (ASD-STE100)

## Context

Development in this workspace is delegated to a multi-agent team: owners hand
requirements to the PM, which routes them through design and specialist
dispatch (ADR-0078). The quality of that delegation depends directly on the
clarity of the sentences in requirements, task briefs, execution plans,
dispatch prompts, and API/design documentation. Ambiguous, long, or idiomatic
prose is the main source of rework in agent-team development, and this
workspace is additionally bilingual (ko/en), which punishes informal phrasing.

ASD-STE100 (Simplified Technical English) is the established controlled-language
standard for safety-critical instructions. Its structural rules — short
sentences, active voice, imperative steps, one term = one meaning — map
directly onto agent-team communication.

Requirement (owner, 2026-09-13): adopt ASD-STE100 principles for sentence
composition in development work (API development alongside web/app), across
the workspace and all templates.

## Decision

1. **Standard adopted**: ASD-STE100 structural rules govern development-facing
   instruction text — requirement statements, task briefs, execution-plan task
   descriptions, agent dispatch prompts, design-doc requirement/acceptance
   sections, API endpoint documentation, and how-to steps. The rules: one
   instruction per sentence (≤ 20 words procedural / ≤ 25 descriptive);
   active voice with imperative steps; present tense; one term = one meaning
   (glossary/registry terms used exactly); no idioms or culture-specific
   phrasing; positive phrasing preferred; minimal pronouns; lists/tables for
   parallel or structured content.
2. **STE dictionary NOT adopted** — technical vocabulary remains as-is; only
   the structural rules are mandated. This keeps the standard adoptable
   without a dictionary gate.
3. **Scope boundary**: the standard governs authored artifacts, not
   conversational dialogue, code comments, memory logs, or CHANGELOG entries.
   It applies to every development domain — web, app, API, scripts,
   documents. API development follows the identical agent-team routing as
   web/app development (ADR-0078); API requirement statements and endpoint
   docs are primary artifacts under this standard.
4. **Enforcement is advisory** at authoring/review time: PM conforms task
   briefs and execution-plan rows at triage (flagging substantive rewrites to
   the owner); architect checks requirement sections at Design Gate review;
   specialists author new docs in the standard. No machine gate in this
   iteration; a sentence-length lint is a possible future extension.
5. **Distribution**: authoritative text lives in AGENTS.md (§3.10 + the
   COMMON-AGENTS marker block) and is propagated by the existing channels —
   `--governance-l1` to templates/common, `--docs` COMMON-AGENTS injection to
   all 13 variant AGENTS.md, upgrade-project DOCS_MERGE to project AGENTS.md;
   a summary section ships in `templates/common/docs/context.md`'s
   COMMON-CONTEXT zone to the variant context files.

## Consequences

- **Positive**: clearer delegation across the ko/en bilingual fleet; fewer
  requirement misunderstandings before they reach specialists; API docs and
  requirement statements become consistently parseable by every AI tool.
- **Cost**: advisory enforcement relies on PM/architect discipline; a small
  authoring overhead on instruction text. Full STE dictionary compliance was
  rejected as impractical overhead.
- **Neutral**: existing documents are not retro-edited; the standard applies
  to newly authored/edited instruction text.

## References

- Design: `docs/designs/2026-09-13-simplified-english-instructions-design.md`
- ADR-0078 (agent-mediated LLM work routing — API/web/app development all
  route through the agent team), ADR-0074 (Design Gate — requirement review
  point)
- AGENTS.md §3.10 (policy text), §5 (execution-plan conventions)
- ASD-STE100 (ASD Simplified Technical English, Issues 7/8)
