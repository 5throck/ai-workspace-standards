---
sync_version: 1
content_hash: b508b04091bbdd20f1147de073c5c8538bdbf2ec6c4a9a612d5a738f7b0ab387
---

# co-price

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v4.1.0
> Pricing management & consulting simulator variant. Multi-product, multi-channel pricing with double-entry P&L projection, benchmark diagnostics, market research analytics (Van Westendorp / Gabor-Granger), cost-shock sensitivity, and distribution trade-line management.

## Overview

Welcome to the **Co-Price** workspace — your dedicated AI pricing management and consulting simulator. Optimized for collaborative work with Claude and Gemini AI assistants, this template provides a full team of 15 specialized agents covering financial strategy, cost engineering, P&L audit, pricing diagnostics, market intelligence, and engagement delivery.

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

Your partners consist of 15 specialized agents across five groups. The **Project Manager (PM)** is your single point of entry — they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Pricing Consulting Orchestrator — dual-lifecycle orchestration, sole dispatcher | high | inherit |
| **Finance Strategy & Channel Lead** | Multi-industry pricing/P&L LaTeX spec authorship, revenue engine, waterfall | high | inherit |
| **Cost & Asset Management** | OPEX/CAPEX, depreciation, BOM cost roll-ups, labor scaling, shock bands | high | inherit |
| **P&L Engine Auditor (CPA)** | Double-entry integrity, `[Ref:]`-tagged Vitest harness, Harness Pass Certificates | high | inherit |
| **Pricing Strategist** | Diagnostics/elasticity to F/T/S recommendations, discount ladders, corridors | high | inherit |
| **Market Intelligence Analyst** | Benchmarks, VW/GG survey analytics, competitor prices, provenance | high | inherit |
| **Engagement Director** | Diagnose → Design → Validate → Deliver orchestration, deliverable gates | high | inherit |
| **Lead Architect & Data Guard** | Prisma modeling, v10.1 batch schema design, AI-infrastructure contracts | high | inherit |
| **Core Engine Developer** | Drift-free TypeScript engine modules, on-rails AI transport | high | inherit |
| **Security Auditor** | Zod guardrails, API boundary audits, PRICE_* env schema | high | inherit |
| **UX & Visual Specialist** | Onyx 2.0 components, copilot panel, bilingual user guides | high | inherit |
| **End-to-End QA Engineer** | Component mounting, browser assertions, streaming-state checks | high | inherit |
| **DevOps & CI/CD Admin** | Bun toolchain, Docker stages, git hooks, deploy standards | high | inherit |
| **Global Strategy & L10N Auditor** | 16-locale parity, glossary adherence, RTL safety | medium | inherit |
| **Security Monitor** | Vuln/advisory scans, gitleaks, findings register, dependency policy | medium | inherit |

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