# CLAUDE.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Claude Code behaviors → [`../CLAUDE.md`](../CLAUDE.md)

## Project-Specific Claude Code Settings

### Session Start

At the start of every Claude Code session, run this checklist:

```
0. git config core.hooksPath .githooks   # activate hooks (run once per clone; verify it stuck)
1. Read docs/context.md                  # project knowledge — coding guidelines, agents, workflow
2. Read AGENTS.md                        # agent roster (auto-loaded by Claude Code)
3. Read memory/MEMORY.md                 # recent changes and session history
4. Load skills listed in docs/context.md ## Session Start Skills
```

<!-- Add entries below ONLY for Claude Code-exclusive session steps not covered above. -->

### Slash Commands (`.claude/commands/`)

These commands are available as both `/slash-commands` and via the `Skill` tool:

| Command | Purpose |
|---------|---------|
| `/changelog "description"` | Add entry to `CHANGELOG.md [Unreleased]` |
| `/sync "feat: ..."` | Full pipeline — memlog → changelog → audit → commit → PR |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only |
| `/new-task "task name"` | Create task tracking block in today's memory log |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill in Claude Code. Add new commands by creating files here.

### MCP Servers
<!-- Document project-specific .mcp.json entries here, if any.             -->
<!-- General MCP guidance: workspace ../CLAUDE.md §3                        -->

### Hooks Override
<!-- Hooks are disabled by default (.claude/settings.json = {}).           -->
<!-- Audit is enforced via pre-commit hook and scripts/dev-sync.sh only.   -->
<!-- To enable PostToolUse audit on every Write/Edit, add to settings.json: -->
<!--   { "hooks": { "PostToolUse": [{ "matcher": "Write|Edit",             -->
<!--     "hooks": [{ "type": "command", "command": "bash scripts/audit.sh" }] }] } } -->

### Model Selection Override
<!-- agents/*.md use `model: inherit` — inheriting from workspace ../CLAUDE.md defaults: -->
<!--   - Default (inherit)    : claude-sonnet-4-6                          -->
<!--   - Heavy reasoning      : claude-opus-4-7                            -->
<!--   - Fast lookups         : claude-haiku-4-5-20251001                  -->
<!-- Uncomment below to override workspace defaults for this project only. -->
<!-- model: claude-opus-4-7                                                -->
