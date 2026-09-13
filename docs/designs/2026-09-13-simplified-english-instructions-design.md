---
schemaVersion: 1.0.0
spec-id: simplified-english-instructions
---

# Simplified English for Development Instructions (ASD-STE100) Design

## 1. Overview

Adopts ASD-STE100 (Simplified Technical English) structural rules as the
workspace standard for development-facing instruction text: requirement
statements, task briefs, execution plans, agent dispatch prompts, design-doc
requirement sections, API endpoint documentation, and how-to documentation.
Applies to every development domain — web, app, API, scripts, documents.
Encoded as **ADR-0079**; delivered through the existing marker-inject
channels (COMMON-AGENTS zone for AGENTS.md, COMMON-CONTEXT zone for
`docs/<variant>.context.md`) so all templates and projects inherit it.

## 2. Background

The owner's working pattern: development (web / app / API services) is
delegated to the harness's multi-agent team (ADR-0078 routes LLM-assisted
work through the PM gateway). The quality of that delegation depends on the
clarity of the sentences the owner and agents exchange. ASD-STE100 is the
established controlled-language standard for safety-critical instructions
(aerospace); its structural rules map directly onto agent-team communication:
short sentences, active voice, imperative steps, one term = one meaning.

## 3. Standard (rules adopted)

ASD-STE100 structural rules are adopted in full; the STE dictionary
(≈900 approved words) is NOT adopted — technical vocabulary stays as-is.
The rules:

1. **One instruction per sentence.** Procedural sentences ≤ 20 words;
   descriptive sentences ≤ 25 words.
2. **Active voice.** Imperative mood for steps ("Run the audit"), not
   passive ("The audit should be run").
3. **Present tense** for procedures and current-state statements.
4. **One term = one meaning.** Use the same word for the same object
   throughout a document; use glossary/registry terms exactly as defined
   (agent names, script names, tier names).
5. **No idioms, slang, or culture-specific phrasing** in instructions.
6. **Prefer positive phrasing** ("Keep the branch current" over "Do not let
   the branch drift"); negatives only when prohibition is the point.
7. **Minimal pronouns** — repeat the noun when any ambiguity is possible.
8. **Lists for parallel items; tables for structured data** (matches the
   execution-plan convention in AGENTS.md §5).

## 4. Scope

**Applies to** (authoring-time standard): requirement statements, task
briefs, execution-plan task descriptions, agent dispatch prompts,
design-doc requirement/acceptance sections, API endpoint documentation,
README/user-guide how-to steps.

**Not applied to**: code comments, memory logs, CHANGELOG entries, meeting
transcripts (normal English; language policy still applies). Conversational
user/PM dialogue is unaffected — the standard governs authored artifacts,
and PM may rewrite a non-conforming request INTO the standard when turning
it into a task brief (flagging substantive rewrites to the owner).

**Domain note**: API development follows the identical agent-team routing as
web/app development (ADR-0078 covers code generically). API requirement
statements and endpoint docs are primary artifacts under this standard.

## 5. Enforcement

Advisory, human/agent-reviewed — no machine gate in this iteration:
- PM triage: conform task briefs and execution-plan rows at triage time.
- Architect: requirement sections of design docs checked at Design Gate
  review.
- docs-writer / specialists: author new docs in the standard; drift is a
  normal review finding, not a build failure.
A future audit extension (sentence-length lint on designated artifacts) is
explicitly out of scope here.

## 6. Delivery

| Layer | File | Mechanism |
|-------|------|-----------|
| L0 | `AGENTS.md` §3.10 + COMMON-AGENTS block section | authoritative text |
| L0 | `docs/adr/0079-…md`, this design doc | decision + spec record |
| L1 | `templates/common/AGENTS.md` | `--governance-l1` |
| L1 | `templates/common/docs/context.md` | new COMMON-CONTEXT section + footer 2.8 |
| L2 | 13 × `templates/co-*/AGENTS.md` | `--docs` COMMON-AGENTS injection |
| L2 | 13 × `templates/co-*/docs/<variant>.context.md` | `--docs` COMMON-CONTEXT injection (new section, heading-anchored) |
| L3 | projects | next routine upgrade (COMMON-AGENTS merge + TREE-SYNC footer bump for docs/context.md) |

Safety note carried into implementation: the bare-zone fallback added in
2.15.0 is gated to single-section domains (2.15.1) before COMMON-CONTEXT
grows a second section.

## 7. Verification

- `--apply --docs` double run: all COMMON-AGENTS + COMMON-CONTEXT pairs in
  sync, no duplicate zones
- `validate-templates.ts` 0 errors; `audit.ts` all-pass; `bun test` green
- L0↔L1 COMMON-AGENTS zone diff = the 4 expected CONSTITUTION→context scrub
  lines only
