---
sync_version: 1
content_hash: PLACEHOLDER
---

# co-hr

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> HR & Labor Relations Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting

## Overview

HR & Labor Relations Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** HR & Labor Relations Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **career-succession-consultant** | Career and succession consultant - designs career pathing, leadership pipelines, | medium | inherit |
| **change-management-partner** | Change management partner - manages change for org restructuring or new HR syste | medium | inherit |
| **compensation-benefits-analyst** | Compensation and benefits analyst - designs wage structures, incentive schemes,  | medium | inherit |
| **data-analyst** | HR data analyst - analyzes workforce statistics, turnover, hiring conversion, an | medium | inherit |
| **labor-compliance-analyst** | Labor compliance analyst - reviews compliance with Korean labor law (`근로기준법` and | medium | inherit |
| **labor-relations-specialist** | Labor relations specialist - supports responses to `노동위원회` proceedings (unfair d | medium | inherit |
| **learning-development-specialist** | Learning and development specialist - designs training systems, competency model | medium | inherit |
| **org-design-consultant** | Org design consultant - designs organizational structure, job architecture, work | medium | inherit |
| **performance-management-consultant** | Performance management consultant - designs performance evaluation systems, KPI/ | medium | inherit |
| **safety-health-officer** | Safety and health officer - reviews compliance with `산업안전보건법` and `중대재해처벌법`, and | medium | inherit |
| **talent-acquisition-specialist** | Talent acquisition specialist - designs recruiting strategy, sourcing channels,  | medium | inherit |

## Skills

- **career-path-succession-planning**: 
- **compensation-benchmarking**: 
- **consulting-report-writing**: 
- **hr-metrics-analysis**: 
- **learning-curriculum-design**: 
- **org-design-framework**: 
- **org-readiness-assessment**: 
- **performance-system-design**: 
- **stakeholder-alignment**: 
- **talent-acquisition-strategy**: 

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

This variant focuses on Strategy consulting for AI-assisted business consulting engagements.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-22*
