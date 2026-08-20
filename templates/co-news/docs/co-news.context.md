# co-news Context

> Auto-generated scaffold stub — update after Phase A.

## Overview

Korean business/finance journalism variant for economics reporters covering listed companies. Grounded in DART financial disclosures and Korean Commercial Act research, it produces fact-checked, naturally human-written articles — Korean by default, with multi-language support.

## Agents

See [AGENTS.md](../AGENTS.md) for the full 7-agent roster.

## Skills

- `source-verification-ledger` — builds and enforces the citation ledger (2+ independent sources per material claim)
- `financial-narrative-brief` — turns k-dart financial data into an article-ready narrative brief
- `financial-journalism-style` — Korean financial-journalism house style (Sedaily / TheBell register conventions)
- `ai-tell-reduction` — rewrites AI-sounding prose into naturally human-written Korean (or target language)
- `financial-infographic-svg` — generates inline SVG financial infographics from the narrative brief

Also uses the L1 common skills k-dart (DART financial disclosures) and k-law (Korean statutes/precedents) — see templates/common/skills/.

## Domain Configuration

| Phase | Name | Owning agent(s) |
|-------|------|------------------|
| 0 | Assignment scoping | pm |
| 1 | Data & legal research | financial-analyst, legal-researcher (parallel) |
| 2 | Fact verification | fact-checker |
| 3 | Drafting | reporter |
| 4 | Style pass | style-editor |
| 5 | Visualization | visual-editor |
| 6 | Final QA / publish gate | pm |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Newsroom Guidelines

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Fact-Verified** | No claim ships without 2+ independent sources in the citation ledger |
| **Disclosure-Grounded** | Financial figures trace to a specific DART filing (receipt number logged), never estimated |
| **Naturally Human-Written** | Every draft passes the AI-tell reduction gate before publish |
| **House-Style Conformant** | Register (Sedaily general-economic vs TheBell IB/PE) matches the assignment's target audience |
| **Publish-Gated** | An article is not publish-ready until both fact-checker and style-editor sign off |

### Rules

1. Every assignment starts with financial-analyst and/or legal-researcher briefs — never draft from an unbriefed premise.
2. The citation ledger must show 0 UNVERIFIED claims before the reporter drafts.
3. The style-editor re-verifies every figure against the ledger after rewriting, to catch drift introduced during the AI-tell pass.
4. DART-sourced figures carry the disclaimer "Based on FSS DART (Financial Supervisory Service electronic disclosure system) filing data"; k-law-sourced legal context carries "Based on National Law Information Center shared data / not legal advice".
5. All PR titles, bodies, and branch names must be in **English**; article output defaults to Korean per the assignment's target language.

<!-- END VARIANT-INJECT -->

---

## Variant-Specific PM Configuration

### Governance Workflow

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

Co-News replaces the generic PM governance workflow with an **Editor-in-Chief** newsroom model. The PM acts as the editorial gatekeeper — no article ships without both fact-checker and style-editor sign-off.

### Source Verification Gate

Before any drafting begins, the `fact-checker` must produce a citation ledger with **0 `UNVERIFIED` claims**. The PM enforces this as a hard gate — a reporter dispatched against an incomplete ledger will be rejected.

### Editorial Review Gate

After drafting and style editing, the PM runs a final editorial review (Phase 6) confirming:
1. `fact-checker` citation ledger: all claims verified (0 UNVERIFIED)
2. `style-editor` AI-tell reduction pass: complete
3. `style-editor` house-style conformance pass: complete
4. All figures trace to a specific DART filing receipt number

If any condition fails, the article is routed back to the responsible agent — never published with open items.

### Routing Rules

| Question type | Routed to |
|---------------|-----------|
| Financial / disclosure | `financial-analyst` |
| Legal / regulatory | `legal-researcher` |
| Fact verification | `fact-checker` |
| Prose quality / register | `style-editor` |
| Infographics / visuals | `visual-editor` |

### Article Output Language

Default output language is **Korean**. During Phase 0 assignment scoping, the PM confirms the target language with the user. All git artifacts (commit messages, PR titles, branch names) remain in English regardless of article language.
<!-- END VARIANT-SECTION -->

### Git / PR Workflow

See `docs/context.md` § Git / PR Workflow for the full `/sync` pipeline (memlog → MEMORY.md
index update → CHANGELOG.md → audit → branch → commit/push → PR). No content override —
`co-news`'s only variant-specific rule is ordering: `/sync` runs only after the Editorial
Review Gate (above) passes — a draft is never committed with open fact-check or style-editor
items.

### Agent Roster

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

Co-News uses a 7-agent newsroom roster (1 orchestrator + 6 specialists):

| Agent | File | Role | Phase(s) |
|-------|------|------|----------|
| **pm** (Editor-in-Chief) | `agents/pm.md` | Orchestrates newsroom workflow; enforces fact-check and editorial gates before publish | 0, 6 |
| **financial-analyst** | `agents/financial-analyst.md` | Queries DART disclosures via k-dart; produces financial-narrative-brief for the reporter | 1 |
| **legal-researcher** | `agents/legal-researcher.md` | Researches Korean Commercial Act, statutes, and precedents via k-law; provides legal context brief | 1 |
| **fact-checker** | `agents/fact-checker.md` | Builds and maintains the source-verification-ledger; enforces 2+ independent sources per material claim | 2 |
| **reporter** | `agents/reporter.md` | Drafts the article from verified briefs; follows financial-journalism-style house conventions | 3 |
| **style-editor** | `agents/style-editor.md` | Runs AI-tell reduction pass and house-style conformance pass; re-verifies figures against the citation ledger | 4 |
| **visual-editor** | `agents/visual-editor.md` | Generates financial-infographic-svg visualizations from the narrative brief data | 5 |
<!-- END VARIANT-SECTION -->


### Dispatch Protocol

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

Co-News follows a **newsroom pipeline** dispatch model: Tip -> Research -> Draft -> Fact-Check -> Editorial -> Publish.

### Phase Map

| Phase | Name | Agent(s) | Dispatch Type |
|-------|------|----------|---------------|
| 0 | Assignment scoping | pm | — |
| 1 | Data & legal research | financial-analyst, legal-researcher | **Parallel** |
| 2 | Fact verification | fact-checker | Sequential (after Phase 1) |
| 3 | Drafting | reporter | Sequential (after Phase 2 gate) |
| 4 | Style pass | style-editor | Sequential (after Phase 3) |
| 5 | Visualization | visual-editor | Sequential (after Phase 4) |
| 6 | Final QA / publish gate | pm | — |
<!-- END VARIANT-SECTION -->