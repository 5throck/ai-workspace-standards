# ADR-0052: co-news Variant Creation

**Status**: Accepted
**Date**: 2026-08-10
**Deciders**: pm, architect

## Context

Newsrooms and economics desks covering Korean listed companies need a specialized AI-assisted workflow for synthesizing DART (Financial Supervisory Service electronic disclosure system) financial disclosures and Korean commercial-law research into fact-checked, naturally human-written articles. Existing workspace variants (co-design, co-develop, co-security, co-consult, co-abap) do not address journalism or newsroom-specific concerns such as source verification ledgers, AI-tell reduction passes, and financial infographic generation.

The co-news variant fills this gap by providing a Korean business/finance journalism template with domain-specific agents and skills targeting economics reporters, listed-company IR staff, CFOs, and PE/VC/bank finance professionals.

## Decision

Create the `co-news` variant as a new beta template (v0.1.0) under `templates/co-news/`, following the variant creation procedure defined in ADR-0026.

### Agent Roster (7 agents)

| Agent | Role |
|-------|------|
| **pm** | Editor-in-Chief orchestrator — gates every article on fact-checker sign-off and style-editor sign-off before publish |
| **fact-checker** | Citation gatekeeper — verifies all claims against source verification ledger |
| **financial-analyst** | Runs the k-dart skill against DART filings to produce narrative briefs |
| **legal-researcher** | Runs the k-law skill against the National Law Information Center for regulatory context |
| **reporter** | Drafts article headline, lead, and body strictly from fact-checked sources |
| **style-editor** | Runs AI-tell reduction pass and house-style conformance pass |
| **visual-editor** | Turns financial-analyst narrative briefs into inline SVG financial infographics |

### Skills (5 variant-specific)

| Skill | Purpose |
|-------|---------|
| **source-verification-ledger** | Tracks citation provenance; 0 UNVERIFIED claims required before publish |
| **financial-narrative-brief** | Structures DART disclosure data into analyst-ready narrative |
| **financial-journalism-style** | Enforces house-style conformance for business/finance articles |
| **ai-tell-reduction** | Reduces AI-detectable language patterns in generated text |
| **financial-infographic-svg** | Generates inline SVG infographics from financial data |

### Differences from Existing Variants

- **PM override**: The PM agent is overridden with an Editor-in-Chief role that enforces a dual sign-off gate (fact-checker + style-editor) before any article can be published — a workflow pattern not present in other variants.
- **Korean-first output**: Articles default to Korean (with other languages supported), requiring the language policy exception mechanism for Korean content.
- **External integrations**: Relies on k-dart (DART OpenAPI) and k-law (National Law Information Center) workspace-level skills for data sourcing.

## Consequences

**Positive:**

- Fills a gap in the variant ecosystem for journalism/newsroom workflows.
- Establishes a reusable pattern for dual sign-off gates that other quality-critical variants may adopt.
- Beta status allows iterative refinement with real newsroom usage before stable promotion.

**Negative / Trade-offs:**

- Beta variant — not yet production-ready; requires real-world testing and feedback before stable promotion.
- Korean-first output creates tension with the English-only documentation policy; Korean content exceptions must be carefully managed.
- External dependency on DART and National Law Information Center APIs means the variant is only fully functional when those services are accessible.

**Promotion criteria (from ADR-0026):**

- Minimum 2 beta engagements completed
- Minimum 2 months beta duration
- No outstanding critical bugs
- Pass `validate-templates.ts` on every merge

**References:**

- ADR-0026: Variant creation procedure and template version policy
- ADR-0041: Skill resolution priority
