---
sync_version: 1
content_hash: 7bbe7039fbcd19b54968443b4542854f63dc846f6841c01052fecf00ffb0e1be
---

# co-export

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Import/export trade consulting variant

## Overview

Structured trade-consulting engagement methodology with 4-phase delivery: (1) Regulatory intelligence gathering and HS/FTA classification, (2) Compliance cross-check with export-control and foreign-regulatory screening, (3) Market-entry strategy refinement and trade-documentation preparation, (4) Logistics coordination and post-shipment drawback filing. Each phase includes a client sign-off gate before proceeding to execution.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Import/export trade consulting variant

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **customs-duty-drawback-specialist** | Duty drawback specialist for co-export | high | inherit |
| **export-control-compliance-specialist** | Strategic items export control and sanctions screening specialist | high | inherit |
| **foreign-regulatory-intelligence-analyst** | Monitors US/China/EU import regulation, tariff, and trade-defense changes | medium | inherit |
| **fta-origin-analyst** | FTA rules-of-origin analysis and origin certification specialist | high | inherit |
| **halal-certification-specialist** | Halal certification requirement analysis and certification process specialist | medium | inherit |
| **hs-classification-specialist** | HS code classification, customs valuation, and tariff rate specialist | high | inherit |
| **logistics-coordinator** | Incoterms selection, freight/forwarding, and bonded warehouse logistics | low | inherit |
| **market-entry-strategist** | Overseas market entry strategy, buyer discovery, and market research | medium | inherit |
| **trade-documentation-specialist** | Trade documentation and customs clearance paperwork specialist | medium | inherit |

## Skills

- **customs-duty-drawback-workflow**: Guides the Customs Duty Drawback Specialist through refund-eligible raw material determination, individual refund vs. simplified fixed-rate refund method selection, usage-rate calculation support, and refund-application deadline tracking under the Act on Special Cases Concerning the Refund of Customs Duties Levied on Raw Materials for Export. Keeps drawback claims clearly separated from ordinary Customs Act erroneous-payment refunds.
- **export-control-screening**: Guides the Export Control & Sanctions Screening Specialist through strategic-item classification, catch-all end-use/end-user assessment, and denied-party/sanctions screening. The highest-consequence workflow on the team — escalation discipline is mandatory.
- **foreign-regulation-monitoring**: Guides the Foreign Regulatory Intelligence Analyst through tracking US/China/EU import regulation, tariff, and trade-defense changes, with strict source attribution and staleness disclosure so downstream compliance work isn't built on outdated destination-market context.
- **fta-origin-determination**: Guides the FTA/Origin Analyst through determining whether goods qualify for preferential tariff treatment under a specific Free Trade Agreement — origin criterion selection, non-originating material assessment, and origin certification method identification.
- **halal-certification-workflow**: Guides the Halal Certification Specialist through determining whether halal certification is required for a destination market and product category, identifying the recognized certifying body (JAKIM, BPJPH/MUI, ESMA, GSO), and mapping the certification/audit process and renewal cycle.
- **hs-classification-workflow**: Guides the HS Classification Specialist through GRI-ordered Harmonized System classification, customs valuation basis determination, and tariff rate lookup. Ensures classification reasoning is reproducible and defensible under a customs post-clearance audit.
- **logistics-coordination**: Guides the Logistics Coordinator through Incoterms term selection (2020 default, with 2000/2010 version recognition for legacy contracts), freight mode/forwarder comparison, and bonded-warehouse/customs clearance logistics planning, ending in final engagement delivery handoff.
- **market-entry-strategy**: Guides the Market Entry Strategist through destination-market demand assessment, competitive landscape analysis, entry channel comparison, and buyer/distributor discovery — synthesized with compliance findings into a single go-to-market recommendation.
- **trade-documentation-checklist**: Guides the Trade Documentation Specialist through assembling a complete, internally consistent trade document package (invoice, packing list, B/L, certificate of origin) and reviewing letter-of-credit terms against UCP 600 for discrepancy risk.

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

**Type**: consulting

This variant focuses on AI-assisted trade and regulatory compliance consulting engagements.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-15*
