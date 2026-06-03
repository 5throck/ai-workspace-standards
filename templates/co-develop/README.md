---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

Welcome to the **Co-Develop** workspace—your dedicated AI software development team. Optimized for collaborative coding with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to build, test, and document your software from day one.

## 1. Team Mission

**Mission:** To provide a comprehensive, multi-agent software development partnership. 

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or tech lead collaborating with a full product team. Our goal is to handle the scaffolding, architecture, implementation, documentation, and quality assurance while you guide the vision.

## 2. Meet the AI Team

Your development partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role & Capabilities |
|-------|---------------------|
| **PM (Project Manager)** | Your main point of contact. Orchestrates team assembly, design validation, enforces quality gates, and dispatches specialist agents. |
| **Architect** | The system design expert. Produces implementation plans, folder hierarchies, and architectural decisions (ADRs). |
| **Automation Engineer** | The coding and scripting specialist. Implements approved plans, writes code, and ensures robust automation. |
| **Docs Writer** | The documentation expert. Writes and maintains READMEs, CHANGELOGs, and technical documentation with consistent terminology. |
| **Scaffolding Expert** | The project setup specialist. Handles new project creation, validates template logic, and prevents structural drift. |
| **Auditor** | The quality assurance inspector. Runs workspace cross-domain consistency checks and detects structural inconsistencies. |
| **Lifecycle Manager** | The governance record keeper. Monitors state changes, syncs governance documents, and runs as a final step in executions. |
| **Security Expert** | The threat modeler. Enforces Git Hooks, manages credentials, and ensures secure dependency handling. |

## 3. How to Collaborate with This Team

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway
Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases
1. **Design & Planning:** The PM will bring in the **Architect** to write an implementation plan and propose a design.
2. **Review:** You review the proposed plan. Once you approve, the PM dispatches the execution team.
3. **Execution:** The **Automation Engineer** writes the code, while the **Docs Writer** updates the documentation. (Agents run serially for write tasks to avoid conflicts).
4. **Quality Assurance:** The **Auditor** or **Security Expert** runs checks (like `bun scripts/audit.ts`) to ensure nothing is broken.
5. **Finalization:** The **Lifecycle Manager** updates any necessary governance records.
6. **Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands
Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):
- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

Let's build something great together!
