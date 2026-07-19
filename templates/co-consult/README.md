---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

> **Status**: ✅ Stable — v1.0.0

Welcome to the **Co-Consult** workspace—your dedicated AI strategy consulting and analysis agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## 1. Team Mission

**Mission:** To provide a comprehensive, multi-agent strategy consulting partnership. 

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the market research, solution architecture, and deliverable creation while you guide the vision.

## 2. Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role & Capabilities |
|-------|---------------------|
| **Engagement Leader (PM)** | Orchestrates engagement phases, manages client interface |
| **Strategy Analyst** | Market analysis, competitive research, financial modeling |
| **Industry Expert** | Industry-specific insights, regulatory landscape |
| **Change Management Partner** | Organizational transformation, stakeholder alignment |
| **Communications Lead** | Client-facing communications, strategic narratives |
| **Solutions Architect** | Technical solution design, implementation roadmaps |
| **Subject Matter Expert (SME)** | Functional expertise (HR, Finance, Ops), solution design |
| **Workstream Lead** | Workstream management, team coordination |
| **Delivery Manager** | Project delivery, operations coordination |
| **Technology Specialist** | Digital transformation support |
| **Data Analyst** | Statistical analysis, data modeling, business insights, Korean DART financial analysis |

## 3. Key Skills

Beyond the core consulting frameworks (`competitive-intelligence`, `financial-modeling`, `solution-design`, `executive-presentation`, `stakeholder-alignment`, `org-readiness-assessment`, and others — 13 skills in total), the team includes two Korean-market research capabilities:

- **`k-dart`** — queries the Korean Financial Supervisory Service (FSS) DART OpenAPI for corporate disclosures, company profiles, financial statements, and major event reports.
- **`company-intelligence`** — comprehensive company/corporate-group intelligence gathering; dispatches 5 parallel research agents (overview, financials, products/markets, analyst coverage, leadership/governance) into one consolidated report.
- **`financial-statement-analysis`** — a full Korean financial statement analysis pipeline: DART collection → validation → normalization → KPI extraction → ROIC value driver tree → Markdown report. Run via `bun scripts/co-consult/financial-pipeline.ts`. See [`docs/user-guide.md`](docs/user-guide.md) for a step-by-step walkthrough.

## 4. How to Collaborate with This Team

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

### D. Practical Guide

For task-oriented guidance (which agent/skill to use for a given consulting question, the financial-statement-analysis pipeline walkthrough, engagement phases, and deliverable locations), see [`docs/user-guide.md`](docs/user-guide.md).

Let's build something great together!
