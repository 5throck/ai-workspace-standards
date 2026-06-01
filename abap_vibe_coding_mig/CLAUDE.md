# CLAUDE.md

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](../../CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model)
2. Only then invoke the `Agent` tool to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Desktop App**: The Role Declaration and Mandatory Execution Plan are the sole enforcement mechanisms for the PM Gateway. Treat them as strictly binding.

---

## Session Start

At the start of every Claude Code session, run this checklist:

```
0. git config core.hooksPath .githooks         # Activate hooks (run once per clone)
1. Read CONSTITUTION.md (workspace root)      # Workspace governance rules
2. Read docs/context.md                        # Immutable project identity
3. Read docs/abap.context.md                   # ABAP-specific customization
4. Read AGENTS.md                              # Canonical agent roster
5. Read memory/MEMORY.md                       # Recent session history (skip if absent)
6. Read skills/abap-dev/SKILL.md               # SAP development workflows
7. Read skills/post-write-chain/SKILL.md       # Mandatory QA chain after any write
```

> **Variant read order**: CONSTITUTION.md → context.md → abap.context.md → AGENTS.md → memory → skills

---

## Claude Code: CLI vs Desktop App

Both the CLI and the Desktop App share the same configuration files and MCP server setup. Key differences, especially regarding hook behavior and UI features, are detailed in [docs/tooling-matrix.md](docs/tooling-matrix.md).

> **Hook limitation**: `PostToolUse` hooks configured in `.claude/settings.json` do **not** fire in the Desktop App. After any `WriteSource` / `EditSource`, run the Post-Write Mandatory Chain manually (see [skills/post-write-chain/SKILL.md](skills/post-write-chain/SKILL.md)) and sync via `scripts/vsp-sync.sh` or `scripts/vsp-sync.ps1`.

> **Linux developers**: Use CLI only — the Desktop App is not available on Linux.

> **Recommended split**: Use CLI for automated ABAP workflows (hook-driven, multi-agent orchestration). Use Desktop App for visual diff review, PR monitoring, and parallel sessions.

---

## Claude Code Settings

- `.claude/settings.json` — Shared team permissions (committed to repo; note that `.claude/` is a hidden dot-folder)
- `.claude/settings.local.json` — Personal write permissions + git operations (gitignored)
- `.claude/commands/` — Slash commands (`/sync`, `/memlog`, `/new-task`, `/triage`, `/transport`, `/post-write`)

Both files are loaded automatically. `enableAllProjectMcpServers: true` is set in the local file to activate the abap MCP server.

---

## Hooks

A `PostToolUse` hook fires after every `Write` or `Edit` tool call and runs `scripts/sync-md.sh` (cross-platform wrapper). This hook is defined in `.claude/settings.json`.

| Environment | Hook fires? | Notes |
|-------------|:-----------:|-------|
| Claude Code CLI | ✓ Automatic on every WriteSource/EditSource |
| Claude Code Desktop App | ✗ Known issue — run Post-Write chain manually |
| Gemini CLI | ✗ Automated hooks disabled — run Post-Write chain manually |
| Antigravity | ✗ No hook support in VS Code extension |

`sync-md.sh` detects the platform (Windows vs Unix) and delegates to `audit.ps1` or `audit.sh` to perform an immediate documentation and path audit after every edit. This ensures cross-platform integrity is maintained in real-time.

---

## Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

See [CONSTITUTION.md §5](../../CONSTITUTION.md#5-multi-agent-architecture) for the 4-level enforcement model and governance rules.

### Mandatory Execution Plan Display

Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table in the user's active language:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task] | [agent] | High/Medium/Low | opus/sonnet/haiku |
| N-1 | Lifecycle Update (Version, Timestamp) | pm (variant) | Medium | [Model] |
| N | Final QA Audit | pm (variant) | Medium | [Model] |

State parallel vs sequential order below the table. The Agent tool must not be called until this table is visible to the user.

*Rule: You MUST always include the Lifecycle Update followed by the Final QA Audit as the final two steps of the plan.*

### Specialist Agent List

All agents below require PM dispatch:
- **architect** (Phase 1-2) - Technical design and architecture decisions
- **automation-engineer** (Phase 4) - Script implementation and DevOps automation
- **docs-writer** (Phase 4) - Documentation standardization and updates
- **scaffolding-expert** (Phase 0) - Project scaffolding and template instantiation
- **security-expert** (Phase 6) - Security audits and vulnerability assessments

### Permission Denial Protocol

When a specialist agent's required tool is denied by the user, PM must **not substitute** for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

See [`agents/pm.md`](agents/pm.md) for the full Type classification table and Escalation Template.

---

## Native Sub-agents (`Agent` Tool)

Use the native `Agent` tool to spawn sub-agents for parallel or isolated tasks. Sub-agents load their role-based configurations from `agents/<name>.md`.

> **Agent Architecture**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](../../CONSTITUTION.md#5-multi-agent-architecture) for governance rules.
> 
> **Agent Roster**: See [AGENTS.md](AGENTS.md) for the canonical index of all available agents.

**Agent Dispatch** - use the `Agent` tool (not a bash CLI command):
```
Agent(
  description   = "Implement automation script",
  prompt        = "You are an automation engineer. [paste agents/automation-engineer.md content here]\n\nTask: Implement the script per the approved plan.",
  subagent_type = "claude"
)
```

Each implementation task follows the **Phase 4 execution loop** (see [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster)):
1. **Specialist agent** implements the changes
2. **PM** verifies against acceptance criteria
3. **Quality gate** validation compliance

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

---

*Last Updated: 2026-06-01 - Updated to variant structure (CONSTITUTION.md reference, PM Gateway enforcement)*
