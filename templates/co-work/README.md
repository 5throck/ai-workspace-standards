---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

**Language**: **English** · [한국어](README_ko.md)

> **Status**: ✅ Stable — v1.0.0

Welcome to the **Co-Work** workspace—your dedicated AI general collaboration and documentation agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## 1. Team Mission

**Mission:** To provide a comprehensive, multi-agent collaboration and documentation partnership. 

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the research, drafting, and cross-functional coordination while you guide the vision.

## 2. Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role & Capabilities |
|-------|---------------------|
| **PM (Project Manager)** | Orchestrates work phases, manages stakeholder coordination |
| **Analyst** | Research synthesis, data analysis, insight documentation |
| **Content Writer** | Long-form writing, report drafting, editorial review |
| **Technical Writer** | Process documentation, reference guides, structured knowledge |
| **Project Coordinator** | Cross-functional task tracking, meeting facilitation |
| **Storyteller** | Narrative construction, presentation structure |
| **MS365 Expert** | Microsoft 365 platforms, workflow automation, template management |

### Key Skills

Variant-specific skills available to the team (see `skills/SKILLS.md` for the full registry):

| Skill | Purpose |
|-------|---------|
| **api-documentation** | Endpoints, parameters, authentication, request/response schemas, and code examples for REST/GraphQL/SDK docs |
| **documentation-writing** | Clear, accessible documentation and communications for technical and non-technical audiences |
| **research-analysis** | Systematic research, data synthesis, and evidence-based analysis to support decisions and documentation |

Additional platform-neutral skills are inherited from `templates/common/skills/`.

## 3. How to Collaborate with This Team

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

Let's build something great together!
