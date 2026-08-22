---
sync_version: 1
content_hash: a2151e62e8161b32aad5ff7e87b566b6e2011714ef452fd6d87a8e398195957d
---

# co-consult

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> Strategy consulting variant for AI-assisted business consulting engagements. Includes specialized consulting agents covering research, strategy, change management, communications, solutions design, and delivery.

## Overview

Welcome to the **Co-Consult** workspace—your dedicated AI strategy consulting and analysis agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations. For task-oriented guidance — which agent or skill to use for a given consulting question, the financial-statement-analysis pipeline walkthrough, engagement phases, and deliverable locations — see [`docs/user-guide.md`](docs/user-guide.md).

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** To provide a comprehensive, multi-agent strategy consulting partnership.

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the market research, solution architecture, and deliverable creation while you guide the vision.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **change-management-partner** | Leads organizational transformation, culture change, and stakeholder alignment | medium | inherit |
| **communications-lead** | Crafts client-facing communications, presentations, and strategic narratives | medium | inherit |
| **data-analyst** | Provides data analysis, statistical modeling, and visualization support | low | inherit |
| **delivery-manager** | Oversees project delivery, operations coordination, and execution quality | low | inherit |
| **industry-expert** | Provides industry-specific insights and competitive dynamics analysis | high | inherit |
| **sme** | Provides functional expertise across HR, Finance, Operations, and more | medium | inherit |
| **solutions-architect** | Designs technical solutions, system architectures, and implementation roadmaps | medium | inherit |
| **strategy-analyst** | Leads market analysis, competitive research, and strategic assessment | medium | inherit |
| **technology-specialist** | Leads collaboration platform implementation and digital workflow automation | low | inherit |
| **workstream-lead** | Manages project workstreams, team coordination, and delivery quality | medium | inherit |

## Skills

- **change-impact-assessment**: Maps how a proposed change affects organizational layers, processes, roles, and individuals.
- **competitive-intelligence**: Systematic market and competitive analysis for consulting engagements, with a market entry module.
- **consulting-report-writing**: McKinsey/BCG-style consulting reports — issue trees, MECE, slide logic, and recommendation framing.
- **executive-presentation**: C-level strategy presentation and decision deck design using the Pyramid Principle.
- **financial-modeling**: Full business case building — ROI, NPV/IRR/Payback, scenario sensitivity, and change management costs.
- **insight-synthesis**: Integrates multiple specialist analyses into one unified strategic insight with cultural filtering.
- **narrative-framework**: Constructs persuasive narrative structures that convert analytical findings into compelling stories.
- **org-readiness-assessment**: Diagnoses an organization's capacity to absorb and sustain change; produces readiness scores.
- **project-delivery**: Plans and manages engagement delivery — milestones, issue logs, risk registers, and status reporting.
- **solution-design**: Converts business requirements into a full technical solution design with a dependency map.
- **stakeholder-alignment**: Systematic stakeholder mapping, resistance analysis, and influence-interest prioritization.
- **stakeholder-review-management**: Manages stakeholder review cycles — reviewer selection, feedback, conflict resolution, and change tracking.
- **technical-feasibility**: Evaluates whether a proposed solution is technically implementable; produces complexity grades and risks.
- **company-intelligence**: Comprehensive company/corporate-group intelligence; dispatches 5 parallel research agents into one report.
- **financial-statement-analysis**: Full financial statement analysis pipeline on the active country profile's disclosure system (KR: DART) — collection → validate → normalize → KPI → ROIC tree → report.
- **mece-logic-auditor**: MECE issue tree auditing and strategic reasoning evaluation for consulting problem-solving frameworks.
- **k-law**: Queries the Korean Ministry of Government Legislation's National Law Information Center Open API for statutes, precedents, administrative rules, municipal ordinances, and legal interpretation cases.
- **hwp-document-processing**: Handles Korean office formats HWP 5.0 (read/validate only) and HWPX (full read/write/generate/validate) — used when a deliverable must be produced in or reference a Korean government/institutional document format.
- **sample-driven-report-writing**: Analyzes a deliverable sample (HWP/PDF/DOCX) to extract its structure and mandatory table/chart requirements per section, then drafts report content matching the sample's exact format.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Strategy & Planning:** The PM and **Engagement Leader** define the consulting scope.
2. **Research & Architecture:** The **Strategy Analyst** and **Solutions Architect** design the approach.
3. **Execution:** Subject Matter Experts (**SME**, **Industry Expert**) provide deep insights.
4. **Delivery:** The **Communications Lead** and **Delivery Manager** finalize the client presentations.
5. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: consulting

This variant focuses on strategy consulting for AI-assisted business consulting engagements.

---

*Last Updated: 2026-08-22*
