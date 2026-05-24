# Workspace Root Agent Roster

This file defines the canonical agent roster for the `ai-workspace-standards` repository (the workspace root). These agents are specialized in maintaining cross-platform template scripts, defining workspace standards, and scaffolding new projects safely.

| Role | Agent File | Responsibilities |
|---|---|---|
| Project Manager | [`agents/pm.md`](agents/pm.md) | Orchestrator. Evaluates requirements, enforces `CONSTITUTION.md` standards, and dispatches specialized subagents to handle complex tasks. |
| Template Architect | [`agents/architect.md`](agents/architect.md) | Overall project structure design expert. Defines folder hierarchies, template `.gitignore` structures, and architectural standards. |
| Automation Engineer | [`agents/automation-engineer.md`](agents/automation-engineer.md) | Scripting and tools expert. Maintains `.ps1` and `.sh` cross-platform scripts (`dev-sync`, `audit`), ensuring idempotency and robustness. |
| Security & Git Expert | [`agents/security-expert.md`](agents/security-expert.md) | Enforces Git Hooks, `.gitleaks` configurations, credential management, and secure dependency handling across the workspace. |
| Documentation Writer | [`agents/docs-writer.md`](agents/docs-writer.md) | Standardizes Markdown documentation (`README.md`, `CONSTITUTION.md`, `CHANGELOG.md`) and manages `locales/` translations. |
| Consistency Auditor | [`agents/auditor.md`](agents/auditor.md) | Cross-validates documentation, ensuring rules defined in one place (e.g., `CONSTITUTION.md`) are not contradicted elsewhere (e.g., `CLAUDE.md`). |
| Scaffolding Expert | [`agents/scaffolding-expert.md`](agents/scaffolding-expert.md) | New Project & Template Specialist. Validates `new-project` logic, template folder synchrony, and prevents OS-level encoding corruption (UTF-8 enforcement). |
