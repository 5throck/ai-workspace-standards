---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

> **Status**: ✅ Stable — v1.0.0

Welcome to the **Co-Design** workspace—your dedicated AI specialized UI/UX design agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## 1. Team Mission

**Mission:** To provide a comprehensive, multi-agent UI/UX design partnership. 

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the research, prototyping, and visual design while you guide the vision.

## 2. Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role & Capabilities |
|-------|---------------------|
| **PM (Project Manager)** | Orchestrates design phases, writes briefs, manages task sequencing |
| **Design Lead** | Creative direction, design system oversight, phase gate sign-off |
| **UX Researcher** | User research, usability testing, insight synthesis |
| **Visual Designer** | Visual design, component creation, accessibility review |
| **Prototype Engineer** | Interactive prototype development and handoff preparation |
| **Service Designer** | End-to-end journey mapping, service blueprints |
| **Storyteller** | Narrative construction, presentation structure |
| **Typography Expert** | Typeface selection, hierarchy, readibility tuning |

## 3. How to Collaborate with This Team

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway
Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases
1. **Discovery & Research:** The PM will bring in the **UX Researcher** to gather insights.
2. **Design Strategy:** The **Design Lead** will define the creative direction and design system.
3. **Creation:** The **Visual Designer** and **Service Designer** will build out components and journeys.
4. **Prototyping:** The **Prototype Engineer** creates interactive handoff materials.
5. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands
Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):
- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

Let's build something great together!
