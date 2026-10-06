# Agents Directory

This directory contains agent definition files used by the multi-agent workflow.

## Agent Files

Each agent is defined as a markdown file (`<name>.md`) with:

- **Role description** - What the agent does
- **Responsibilities** - Key tasks the agent handles
- **Constraints** - Limits on what the agent can do
- **Output format** - Expected output structure
- **Handoff rules** - Which agents it receives from/hands off to

## Available Agents

| Agent | File | Role |
|-------|------|------|
| PM Orchestrator | `pm.md` | Owns the workflow; dispatches parallel tasks |
| Architect | `architect.md` | Produces implementation plans and ADRs |
| Designer | `designer.md` | Produces UI/UX specs and wireframes |
| Code Writer | `code-writer.md` | Implements approved plans |
| Test Runner | `test-runner.md` | Verifies acceptance criteria |
| Security Monitor | `security-monitor.md` | Enforces security policies |
| Stack Setup | `stack-setup.md` | Identifies and sets up unknown stacks |
| I18N Specialist | `i18n-specialist.md` | Locale documentation and translation-sync for locale mirrors (common extends-stub; engaged on demand) |

## Creating New Agents

### Method 1: CLI (Recommended)

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create data-analyst --role "Data Analyst" --group Technical
bun run agent:create ui-reviewer --role "UI Reviewer" --group Design
```

### Method 2: Manual

1. Copy the template from `docs/_examples/agents/analyst-example.md` (delivered from `templates/common` at project creation)
2. Create `<name>.md` in this directory
3. Fill in the agent definition following the template structure

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Technical
bun run agent:list --verbose
```

## Deleting Agents

```bash
bun run agent:delete <name>
bun run agent:delete <name> --force  # Skip confirmation
```

## After Creating/Deleting Agents

Update `AGENTS.md` to:
1. Add/remove the agent from the Agent Roster table (§1)
2. Add/remove the agent's detail block in §2 and its Phase Gate row in §3.5 as applicable
3. Update `docs/co-learning.context.md § Agents` to match

## Agent Groups

- **Orchestration/Audit** - PM, Security Monitor
- **Design** - Architect, Designer
- **Execution** - Code Writer, Test Runner
- **Security/Setup** - Stack Setup
- **Localization** - I18N Specialist

See `AGENTS.md` for the full workflow and dispatch protocol.

## Handoff Specification

See [`handoff-spec.md`](../docs/handoff-spec.md) for JSON-based handoff format between agents.

## Handoff Rules

- Always include `handoff_version`, `task_id`, `from_agent`, `to_agent`
- Use ISO-8601 timestamps
- Update status at each handoff
- Escalate after 3 failed retry attempts

---

*Project template - customize as needed*
