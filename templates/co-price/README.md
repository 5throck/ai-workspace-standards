---
sync_version: 1
content_hash: 5295220d95c6241077c89938b1bec14d7c5d9fdefe7261a7e8c7a6728d9a30dd
---

# co-price

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v4.1.0
> Pricing management & consulting simulator variant. Multi-product, multi-channel pricing with double-entry P&L projection, benchmark diagnostics, market research analytics (Van Westendorp / Gabor-Granger), cost-shock sensitivity, and distribution trade-line management.

## Overview

Welcome to the **Co-Price** workspace — your dedicated AI pricing management and consulting simulator. Optimized for collaborative work with Claude and Gemini AI assistants, this template provides a full team of 16 specialized agents covering financial strategy, cost engineering, P&L audit, pricing diagnostics, market intelligence, and engagement delivery.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations. For task-oriented guidance — which agent or skill to use for a given pricing question, the Harness Engineering workflow, and the Commercial Operating Cycle — see [`docs/co-price.context.md`](docs/co-price.context.md).

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** To provide a comprehensive, multi-agent pricing management and consulting partnership.

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full pricing team. Our goal is to handle P&L modeling, pricing strategy, market research, and deliverable creation while you guide the vision.

## Meet the AI Team

Your partners consist of 16 specialized agents across five groups. The **Project Manager (PM)** is your single point of entry — they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **pm** | Pricing Consulting Orchestrator — dual-lifecycle orchestration, sole dispatcher | medium | inherit |
| **finance-strategy-lead** | Multi-industry pricing/P&L LaTeX spec authorship, revenue engine, waterfall | high | inherit |
| **cost-asset-mgmt** | OPEX/CAPEX, depreciation, BOM cost roll-ups, labor scaling, shock bands | high | inherit |
| **cpa-auditor** | Double-entry integrity, `[Ref:]`-tagged Vitest harness, Harness Pass Certificates | high | inherit |
| **pricing-strategist** | Diagnostics/elasticity to F/T/S recommendations, discount ladders, corridors | high | inherit |
| **market-intelligence-analyst** | Benchmarks, VW/GG survey analytics, competitor prices, provenance | high | inherit |
| **engagement-director** | Diagnose → Design → Validate → Deliver orchestration, deliverable gates | high | inherit |
| **lead-architect** | Prisma modeling, v10.1 batch schema design, AI-infrastructure contracts | high | inherit |
| **core-engine-dev** | Drift-free TypeScript engine modules, on-rails AI transport | high | inherit |
| **security-auditor** | Zod guardrails, API boundary audits, PRICE_* env schema | high | inherit |
| **ux-specialist** | Onyx 2.0 components, copilot panel, bilingual user guides | high | inherit |
| **qa-tester** | Component mounting, browser assertions, streaming-state checks | high | inherit |
| **devops-admin** | Bun toolchain, Docker stages, git hooks, deploy standards | high | inherit |
| **l10n-auditor** | 16-locale parity, glossary adherence, RTL safety | medium | inherit |
| **security-monitor** | Vuln/advisory scans, gitleaks, findings register, dependency policy | medium | inherit |
| **i18n-specialist** | Locale configuration, locale-specific formatting, text layout guidance | medium | inherit |

## Skills

- **harness-verification**: 5-gate engine certification — spec → tests → code → CPA audit → certificate.
- **double-entry-reconciliation**: Double-entry bookkeeping integrity verification (A = L + E).
- **i18n-audit**: 16-locale translation parity and glossary adherence.
- **excel-export**: Structured Excel workbook generation from engine data.
- **pdf-export**: PDF report generation for client-facing deliverables.
- **financial-statement-prep**: Financial statement preparation and formatting.
- **math-function-plotter**: Mathematical function visualization for pricing curves.
- **sheet-model**: Spreadsheet-style data modeling and scenario analysis.
- **prisma-7**: Prisma 7 ORM schema management and migration.
- **ui-component-design**: Onyx 2.0 component design patterns.
- **van-westendorp-psm**: Van Westendorp Price Sensitivity Meter survey analysis.
- **gabor-granger**: Gabor-Granger direct pricing research methodology.
- **competitive-intelligence**: Systematic market and competitive analysis.
- **scenario-comparison**: Multi-scenario pricing comparison and evaluation.
- **insight-synthesis**: Integrates multiple specialist analyses into unified strategic insight.
- **executive-presentation**: C-level presentation and decision deck design.
- **trade-promotion-roi**: Trade promotion ROI evaluation with netROI(8w) gate.
- **pricing-playbook**: Standardized pricing methodology and process guide.
- **price-waterfall-analysis**: Pocket margin analysis and price waterfall diagnostics.
- **pricing-governance**: Pricing governance framework, corridor management, and authority matrix.
- **map-channel-enforcement**: MAP policy enforcement and channel conflict resolution.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions.

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Triage & Strategy:** The PM and **Finance Strategy Lead** + **Cost & Asset Management** analyze in parallel.
2. **Technical Design:** The **Lead Architect** designs the approach (DB/core changes need user approval).
3. **Implementation:** **Core Engine Developer** (serial), then **UX Specialist** (serial).
4. **Verification:** CPA audit → security audit → L10N audit → QA testing.
5. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.

## Variant Type

**Type**: consulting