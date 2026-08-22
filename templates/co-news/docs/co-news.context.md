# co-news Context

> Auto-generated scaffold stub — update after Phase A.

## Overview

Business/finance journalism variant for economics reporters covering listed companies. Grounded in regulator financial disclosures (KR: DART) and commercial-law research (KR: Korean Commercial Act), it produces fact-checked, naturally human-written articles — output language per the active country profile (KR defaults to ko) and project i18n settings.

## Tech Stack

| Component | Role |
|-----------|------|
| **DART OpenAPI** (via the `k-dart` L1 skill, KR profile) | Financial disclosures: company overview, financial statements, major-report search. Every figure traces to a DART receipt number |
| **Law sources of the target jurisdiction** (via the `k-law` L1 skill, KR profile) | Statutes, precedents, and regulatory context for legal claims |
| **Inline SVG** | Financial infographics generated from the narrative brief (no binary image assets) |
| **Bun + TypeScript** | Operational scripts (`scripts/`) inherited from the common template |

No runtime application stack — co-news produces article deliverables, not software. Research sources are reached over HTTP (DART OpenAPI, National Law Information Center); no game engine, browser runtime, or SAP connection is involved.

## Agents

See [AGENTS.md](../AGENTS.md) for the full 7-agent roster.

## Skills

- `source-verification-ledger` — builds and enforces the citation ledger (2+ independent sources per material claim)
- `financial-narrative-brief` — turns k-dart financial data into an article-ready narrative brief
- `financial-journalism-style` — financial-journalism house style in the variant's source register (KR: Sedaily / TheBell conventions)
- `ai-tell-reduction` — rewrites AI-sounding prose into naturally human-written prose in the target language (KR profile default: Korean)
- `financial-infographic-svg` — generates inline SVG financial infographics from the narrative brief

Also uses the L1 common skills k-dart (DART financial disclosures, KR) and k-law (KR statutes/precedents) — see templates/common/skills/.

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

## Development Workflow

The newsroom pipeline is strictly sequential after Phase 1 — each phase's output is the next phase's input, and two gates are hard:

1. **Source Verification Gate** (end of Phase 2) — reporter is never dispatched while the citation ledger shows any `UNVERIFIED` claim.
2. **Editorial Review Gate** (Phase 6) — the article is publish-ready only when fact-checker AND style-editor sign off; failures route back to the responsible agent, never forward.

Phase 1 is the only parallel stage (`financial-analyst` + `legal-researcher` run concurrently). `/sync` runs only after the Editorial Review Gate passes — a draft is never committed with open fact-check or style items (see Git / PR Workflow below). Full dispatch details: Dispatch Protocol at the end of this file.

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Newsroom Guidelines

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Fact-Verified** | No claim ships without 2+ independent sources in the citation ledger |
| **Disclosure-Grounded** | Financial figures trace to a specific regulator filing (KR: DART, receipt number logged), never estimated |
| **Naturally Human-Written** | Every draft passes the AI-tell reduction gate before publish |
| **House-Style Conformant** | Register (Sedaily general-economic vs TheBell IB/PE) matches the assignment's target audience |
| **Publish-Gated** | An article is not publish-ready until both fact-checker and style-editor sign off |

### Rules

1. Every assignment starts with financial-analyst and/or legal-researcher briefs — never draft from an unbriefed premise.
2. The citation ledger must show 0 UNVERIFIED claims before the reporter drafts.
3. The style-editor re-verifies every figure against the ledger after rewriting, to catch drift introduced during the AI-tell pass.
4. DART-sourced figures (KR profile) carry the disclaimer "Based on FSS DART (Financial Supervisory Service electronic disclosure system) filing data"; k-law-sourced legal context carries "Based on National Law Information Center shared data / not legal advice".
5. All PR titles, bodies, and branch names must be in **English**; article output follows the assignment's target language (KR profile default: Korean).

<!-- END VARIANT-INJECT -->

## File Organization Policy

Article deliverables live under `deliverables/`, one directory per assignment:

```
deliverables/drafts/<article>/
├── brief/            # Phase 1 outputs: financial-narrative-brief, legal context brief
├── ledger.md         # Phase 2: source-verification citation ledger
├── draft.md          # Phase 3: reporter's draft
├── final.md          # Post-Phase 6: publish-ready article
└── figures/          # Phase 5: one SVG per figure + manifest.md
```

Rules:

- One article = one `<article>` directory; never mix two assignments' files.
- Figure SVGs are never inlined into markdown until `final.md` — drafts reference them by path so the style-editor's rewrite can't silently drop one.
- Governance files (`CHANGELOG.md`, `memory/`, `variant.json`) follow the common template's layout — no newsroom-specific overrides.

## Domain Rules

The five Core Principles under Newsroom Guidelines above are the binding rules (fact-verified, disclosure-grounded, naturally human-written, house-style conformant, publish-gated). Two operational additions:

1. **Language split** — article content follows the assignment's target language (KR profile default: Korean); ALL git artifacts (commits, PR titles, branches) are English-only, always.
2. **Figure formatting locale** — Korean numeral-grouping units (jo/eok/man) appear only in Korean-language articles; never mix grouping conventions within a single figure.

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

Default output language follows the active country profile (KR profile: **Korean**); confirm at Phase 0. During Phase 0 assignment scoping, the PM confirms the target language with the user. All git artifacts (commit messages, PR titles, branch names) remain in English regardless of article language.
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
| **financial-analyst** | `agents/financial-analyst.md` | Queries DART disclosures via k-dart (KR profile); produces financial-narrative-brief for the reporter | 1 |
| **legal-researcher** | `agents/legal-researcher.md` | Researches the target jurisdiction's commercial law, statutes, and precedents via k-law (KR profile); provides legal context brief | 1 |
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