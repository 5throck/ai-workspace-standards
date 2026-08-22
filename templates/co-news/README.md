---
sync_version: 1
content_hash: e0b5b9ede505da17fdc38000d1630a7476fdcfb25baf549cdbaa991a44eee456
---

# co-news

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.

## Overview

Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **fact-checker** | Fact-checker - the newsroom's citation gatekeeper | medium | inherit |
| **financial-analyst** | Financial analyst - runs the k-dart skill against DART filings (KR country profile) to produce articl | medium | inherit |
| **legal-researcher** | Legal researcher - runs the k-law skill against the National Law Information Cen | medium | inherit |
| **reporter** | Reporter - drafts the article headline, lead, and body strictly from the fact-ch | medium | inherit |
| **style-editor** | Style editor - runs the AI-tell reduction pass and house-style conformance pass  | medium | inherit |
| **visual-editor** | Visual editor - turns the financial-analyst's narrative brief into inline SVG fi | medium | inherit |

## Skills

- **ai-tell-reduction**: 
- **financial-infographic-svg**: 
- **financial-journalism-style**: 
- **financial-narrative-brief**: 
- **source-verification-ledger**: 

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Team Assembly:** The PM creates specialized agents/skills if required.
2. **Triage:** The PM classifies the request; dispatches read-only agents in parallel.
3. **Analysis:** The PM synthesizes findings into requirements + acceptance criteria.
4. **Design:** An architect produces an implementation plan + ADR.
5. **Implementation:** Specialists implement; the PM loops up to 3× on failures.
6. **Finalization:** The PM logs decisions; runs `/sync`; opens a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: collaboration

This variant focuses on General work, research, documentation, and project coordination.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-22*
