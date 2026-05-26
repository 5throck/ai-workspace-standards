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

## Creating New Agents

### Method 1: CLI (Recommended)

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create data-analyst --role "Data Analyst" --group Technical
bun run agent-create ui-reviewer --group Design
```

### Method 2: Manual

1. Copy the template from `_examples/agents/analyst-example.md`
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
1. Add/remove the agent from the Agent Roster table
2. Add/remove the agent from the Subagent Roster table
3. Update `docs/context.md § Agents` to match

## Agent Groups

- **Orchestration/Audit** - PM, Security Monitor
- **Design** - Architect, Designer
- **Execution** - Code Writer, Test Runner
- **Security/Setup** - Stack Setup

See `AGENTS.md` for the full workflow and dispatch protocol.\n\n## Handoff Specification\n\nSee [`handoff-spec.md`](handoff-spec.md) for JSON-based handoff format between agents.\n\n## Handoff Rules\n\n- Always include `handoff_version`, `task_id`, `from_agent`, `to_agent`\n- Use ISO-8601 timestamps\n- Update status at each handoff\n- Escalate after 3 failed retry attempts

---

*Project template - customize as needed*
