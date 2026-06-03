---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

> **Status**: Beta — v0.2.0

Welcome to the **Co-Security** workspace—your dedicated AI red team and threat modeling agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one.

## 1. Team Mission

**Mission:** To provide a comprehensive, multi-agent security engagement partnership. 

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the scoping, threat modeling, exploitation, and patching while you guide the vision.

## 2. Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role & Capabilities |
|-------|---------------------|
| **PM (Security PM)** | Orchestrates engagements, enforces authorization gates |
| **Red Team Lead** | Defines offensive strategy, oversees exploitation |
| **Pentester** | Hands-on exploitation, PoC development |
| **Threat Modeler** | STRIDE/PASTA analysis, attack tree construction |
| **Patch Engineer** | Remediation script development, Ansible playbook authoring |
| **Report Writer** | Technical and executive report authoring, CVSS scoring |

## 3. How to Collaborate with This Team

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway
Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases
1. **Authorization Gate:** The PM enforces the `verify-authorization` skill before any activity.
2. **Threat Modeling:** The **Threat Modeler** maps the attack surface.
3. **Exploitation:** The **Red Team Lead** and **Pentester** perform authorized testing.
4. **Remediation & Reporting:** The **Patch Engineer** deploys fixes and the **Report Writer** documents findings.
5. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands
Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):
- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

Let's build something great together!
