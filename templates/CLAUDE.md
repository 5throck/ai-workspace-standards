# CLAUDE.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Claude Code behaviors → [`../CLAUDE.md`](../CLAUDE.md)

## Project-Specific Claude Code Settings

### Session Start

At the start of every Claude Code session, run this checklist:

```
0. git config core.hooksPath .githooks   # verify hooks are active
1. Read docs/context.md                  # project knowledge — coding guidelines, agents, workflow
2. Read AGENTS.md                        # agent roster (auto-loaded by Claude Code)
3. Read memory/MEMORY.md                 # recent changes and session history
4. Load skills listed in docs/context.md ## Session Start Skills
```

<!-- Add entries below ONLY for Claude Code-exclusive session steps not covered above. -->

### MCP Servers
<!-- Document project-specific .mcp.json entries here, if any.             -->
<!-- General MCP guidance: workspace ../CLAUDE.md §3                        -->

### Hooks Override
<!-- Override hook behavior for this project only, if needed.              -->
<!-- Default (.claude/settings.json) runs scripts/audit.sh on Write/Edit.  -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.       -->
<!-- - Heavy reasoning  : claude-opus-4-7                                  -->
<!-- - Default          : claude-sonnet-4-6                                -->
<!-- - Fast lookups     : claude-haiku-4-5-20251001                        -->
