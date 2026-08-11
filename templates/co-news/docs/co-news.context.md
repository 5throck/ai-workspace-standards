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

TODO: Add Co-News-specific governance workflow overrides here.

This section replaces the workspace PM's governance workflow with variant-specific logic.
<!-- END VARIANT-SECTION -->


### Agent Roster

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

TODO: Add Co-News-specific agent roster here.

This section replaces the workspace PM's agent roster with variant-specific agents.
<!-- END VARIANT-SECTION -->


### Dispatch Protocol

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

TODO: Add Co-News-specific dispatch protocol here.

This section replaces the workspace PM's dispatch protocol with variant-specific logic.
<!-- END VARIANT-SECTION -->