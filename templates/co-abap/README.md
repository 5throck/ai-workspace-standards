---
sync_version: 1
content_hash: 2004d1d0f82c1ae1a66737d2e615fe3e2a539ab551ac50267716adad27e6d6eb
---

# co-abap

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> AI-assisted SAP ABAP development harness using the vsp MCP server. PM-led, multi-agent orchestration with specialized SAP module analysts (SD, MM, FI, CO, PP, LE), technical execution agents, and automated QA chains.

## Overview

Welcome to the **co-abap** workspace — your dedicated AI SAP ABAP development agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your SAP development projects from day one. Following a 6-step harness lifecycle (Triage → Business Analysis → Governance → Tech Design → Implementation → Finalization), six SAP module analysts and technical agents collaborate to deliver high-quality ABAP solutions.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

1. Clone/scaffold this variant template
2. Place `vsp.exe` in the project root
3. Configure SAP credentials in `.env`
4. Activate git hooks: `git config core.hooksPath .githooks`
5. Start with `/triage <request>`

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** To provide a comprehensive, multi-agent SAP ABAP development partnership.

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full ABAP development team. Our goal is to handle business requirement analysis, technical design, code implementation, and quality verification — from SAP module experts to technical execution agents — delivering enterprise-grade ABAP solutions.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry — they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates, lifecycle management | high | inherit |
| **sd-analyst** | Sales & Distribution module analysis — activates on SD trigger keywords | medium | inherit |
| **mm-analyst** | Materials Management module analysis — activates on MM trigger keywords | medium | inherit |
| **fi-analyst** | Financial Accounting module analysis — activates on FI trigger keywords | medium | inherit |
| **co-analyst** | Controlling module analysis — activates on CO trigger keywords | medium | inherit |
| **pp-analyst** | Production Planning module analysis — activates on PP trigger keywords | medium | inherit |
| **le-analyst** | Logistics Execution module analysis — activates on LE trigger keywords | medium | inherit |
| **architect** | Technical Execution Lead — pattern selection, execution sequencing, DBA coordination | high | inherit |
| **code-writer** | ABAP implementation via WriteSource/EditSource, syntax check | low | inherit |
| **test-runner** | QA verification — unit tests, code coverage, ATC check | low | inherit |
| **dba** | Table/CDS/index design, SQL performance tuning, ERD normalization | medium | inherit |
| **devops-admin** | Transport management, infrastructure install, system audit | low | inherit |
| **sap-investigator** | Codebase pattern scan, historical design extraction (read-only) | medium | inherit |
| **read-only-analyst** | Business data queries, AS-IS analysis with draft AC (read-only) | medium | inherit |
| **schema-inspector** | Table/CDS structure inspection, dependency maps (read-only) | medium | inherit |
| **interface-expert** | OData/RFC/IDoc interface design and connectivity validation | medium | inherit |
| **fiori-developer** | UI5/Fiori screen design and implementation | medium | inherit |
| **form-expert** | SAP Script, Smart Forms, Adobe Forms design and print programs | medium | inherit |
| **security-monitor** | Security policies enforcement and safe dependency audit | low | inherit |
| **gui-scripter** | BDC / VBS automation — LAST RESORT when no BAPI/OData/RFC alternative exists | low | inherit |

## Skills

- **abap-dev**: Specialized SAP ABAP development workflows — BAPI exploration, transport management, unit testing, performance analysis, impact architecture analysis, and documentation audits.
- **dump-monitor**: Standardized SAP system health check using ListDumps/GetDump to detect ABAP short dumps and route new findings into /triage.
- **performance-tuning**: Diagnose slow ABAP programs and expensive SQL statements using TraceExecution, ListSQLTraces, and GetCallGraph workflows.
- **post-write-chain**: Mandatory quality gate enforced after every WriteSource/EditSource/Activate: SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck.
- **sap-co**: CO module process flows, table relationships, query patterns for cost centers, internal orders, CO-PA profitability analysis, and cost allocation.
- **sap-fi**: FI module process flows, table relationships, standard BAPIs for journal entries, account determination, G/L, accounts payable/receivable, and financial reporting.
- **sap-le**: LE module process flows, table relationships, query patterns for shipping, transport, warehouse management, delivery processing, and handling units.
- **sap-mm**: MM module process flows, table relationships, standard BAPIs for purchasing, goods receipt, material master, inventory, and procure-to-pay.
- **sap-pp**: PP module process flows, table relationships, query patterns for BOM, routing, production orders, MRP, and work center management.
- **sap-sd**: SD module process flows, table relationships, standard BAPIs for sales orders, deliveries, billing, pricing, and order-to-cash.
- **desktop-app-fallback**: Manual Post-Write QA chain for Claude Code Desktop App (hooks don't fire).
- **source-command-celebrate**: Celebrate the successful completion of a task to boost team morale.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Triage & Research:** The PM classifies the request and dispatches immediate parallel research (sap-investigator + read-only-analyst + schema-inspector).
2. **Business Analysis:** Module analysts (SD, MM, FI, CO, PP, LE) define business requirements and Acceptance Criteria (AC).
3. **Governance & Approval:** PM reviews the PRD/AC and confirms scope. User approval required for high-risk changes.
4. **Tech Design & Implementation:** Architect selects the pattern and creates an execution plan, then code-writer implements the ABAP code.
5. **Verification:** test-runner executes the mandatory QA chain (SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck).
6. **Review & Sync:** Use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.
- `/triage <request>` — Auto-classify a request and create the task file.

## Variant Type

**Type**: abap-development

This variant focuses on AI-assisted SAP ABAP development using the vsp MCP server, with PM-led multi-agent orchestration, six SAP module analysts (SD, MM, FI, CO, PP, LE), technical execution agents, and automated QA chains.

---

*Last Updated: 2026-08-15*
