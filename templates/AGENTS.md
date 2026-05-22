# AGENTS.md

> **Canonical agent index** — auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context → `docs/context.md`.

## Available Agents

| Group | Agent | File | Role |
|-------|-------|------|------|
| Orchestration | PM Orchestrator | `agents/pm.md` | Owns the full workflow; dispatches parallel tasks |
| Design | Architect | `agents/architect.md` | Produces implementation plans and ADRs; never writes code |
| Design | Designer | `agents/designer.md` | Produces UI/UX specs, wireframes, and component definitions |
| Execution | Code Writer | `agents/code-writer.md` | Implements approved plans; surgical changes only |
| Execution | Test Runner | `agents/test-runner.md` | Runs tests and verifies acceptance criteria |

*(Add Analysis agents as needed — see `../templates/_examples/agents/analyst-example.md` in the workspace root for the scaffold template.)*

## Agent Dispatch

- **Claude Code**: use the `Agent` tool — embed the target `agents/<name>.md` content in the prompt field.
- **Gemini CLI**: use `invoke_subagent` with the agent role definition from `agents/<name>.md`.

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the table above.
2. Update the `## Agents` table in `docs/context.md` to match.
