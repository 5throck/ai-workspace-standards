---
sync_version: 1
content_hash: b4544c21a73694d38bf8db048d2ace3e1acf314cfef6b174864f7e2d0030ccce
---

# co-work

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> General work and task execution workflow variant for research, documentation, and project coordination. Includes specialized collaboration agents covering analysis, content writing, technical writing, project coordination, and MS365 integration.

## Overview

Welcome to the **Co-Work** workspace—your dedicated AI general collaboration and documentation agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** To provide a comprehensive, multi-agent collaboration and documentation partnership.

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the research, drafting, and cross-functional coordination while you guide the vision.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **analyst** | Research analyst — investigation, data synthesis, and evidence gathering | medium | inherit |
| **content-writer** | Content writer — research-to-documentation transformation and communications | medium | inherit |
| **ms365-expert** | Microsoft 365 expert — guidance on Outlook, Word, Excel, PowerPoint, Teams | low | inherit |
| **project-coordinator** | Project coordinator — schedules, stakeholder communication, delivery logistics | low | inherit |
| **storyteller** | Organizational storyteller — culture, change narratives, institutional knowledge | medium | inherit |
| **technical-writer** | Technical writer — API documentation, technical guides, developer resources | medium | inherit |

## Skills

- **api-documentation**: Creates comprehensive API documentation including endpoints, parameters, authentication, request/response schemas, and code examples. Use when: documenting REST APIs, GraphQL interfaces, SDKs, or developer-facing technical specifications.
- **documentation-writing**: Creates clear, accessible documentation and communications for diverse audiences. Use when: writing guides, creating documentation, drafting communications, or synthesizing complex information for technical and non-technical audiences.
- **research-analysis**: Conducts systematic research, data synthesis, and evidence-based analysis to support decision-making and documentation. Use when: analyzing topics, synthesizing research, gathering evidence, or investigating questions for documentation or strategy.
- **standup-synthesizer**: Automated daily standup digest synthesizer aggregating git commit logs, issue status updates, pull request reviews, and ticket queue events over a 24-hour window.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Planning & Coordination:** The PM and **Project Coordinator** organize the workload.
2. **Research & Analysis:** The **Analyst** gathers data and synthesizes information.
3. **Drafting:** The **Content Writer** and **Technical Writer** create the documentation.
4. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: collaboration

This variant focuses on general work, research, documentation, and project coordination with specialized agents for analysis, content writing, technical writing, and MS365 integration.

---

*Last Updated: 2026-08-09*
