# CLAUDE.md

> **Doc intent:** This file is Claude Code-specific behavioral configuration for **individual projects** (not the workspace root).
> Workspace-level Claude Code behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md)

## Role Declaration

You ARE the PM agent for this project session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Never directly use the following tools for state-changing operations without PM approval (`.pm-approved` flag):**
- `Write`, `Edit` — file creation or modification
- `Bash` — unless strictly read-only: `git log/status/diff`, `ls`, `grep`, `bun scripts/audit.ts`

**For ALL multi-step tasks (2+ files or 2+ sequential steps):**
1. Display execution plan table first (task | agent | tier | model)
2. Only then invoke the `Agent` tool to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Desktop App**: `PreToolUse` hooks are inactive. This Role Declaration is the sole enforcement mechanism. Treat it as binding.

---

## Session Start — Context Loading Order

At the start of every session, read these files **in order**:

1. **[`docs/context.md`](templates/common/docs/context.md)** — Immutable project identity (architecture, key files, documentation standards). Do NOT modify.
2. **[`docs/co-work.context.md`](docs/co-work.context.md)** — Tool stack, agents, skills, scripts, workflow. All project-specific changes go here.
3. **[`AGENTS.md`](AGENTS.md)** — Canonical agent index and dispatch protocols.

> The two-file split is intentional: `context.md` never changes after project creation;
> `co-work.context.md` evolves with the project (agents, skills, tool stack, workflow).

---

## Project-Specific Claude Code Settings

### CLI vs Desktop App

Both the CLI and the Desktop App share the same `.claude/settings.json` and slash commands.

| Environment | PostToolUse hook fires? | Action if not |
|-------------|:-----------------------:|---------------|
| Claude Code CLI | ✅ Automatic | - |
| Claude Code Desktop App | ❌ Never | Run `bash scripts/audit.sh` manually before committing |

> **Recommended split:**
> - **CLI** - automated workflows, hook-driven audit, multi-agent orchestration.
> - **Desktop App** - PR monitoring, visual diff review, parallel sessions.

---

### Claude Code Settings

- `.claude/settings.json` - shared team config (committed to repo)
- `.claude/settings.local.json` - personal write permissions + git/gh access (gitignored)
- `.claude/commands/` - slash commands auto-registered as Skills

Both files are loaded automatically by Claude Code.

---

### Slash Commands (`.claude/commands/`)

These commands are available as both `/slash-commands` and via the `Skill` tool:

| Command | Purpose |
|---------|---------|
| `/changelog "description"` | Add entry to `CHANGELOG.md [Unreleased]` |
| `/sync "feat: ..."` | Full pipeline - memlog → sync-md → changelog → audit → commit → PR |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only |
| `/new-task "task name"` | Create task tracking block in today's memory log |
| `/security-check` | Run security advisory scan (daily or `--pr` pre-PR mode) |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill in Claude Code. Add new commands by creating files here.

---

### Hooks

```json
// .claude/settings.json - enable PostToolUse audit after every Write/Edit:
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "bash scripts/audit.sh" }]
      }
    ]
  }
}
```

> **Note:** PostToolUse hooks are **disabled by default** (`.claude/settings.json = {}`).
> Audit is enforced via the `.githooks/pre-commit` hook and `scripts/dev-sync.sh` pipeline.
> Enable the above only if you want real-time audit on every Write/Edit in the CLI.

---

### Git Hooks

Install project hooks once per clone (run from the project root):

```bash
git config core.hooksPath .githooks
```

| Hook | Trigger | Action |
|------|---------|--------|
| `.githooks/pre-commit` | Every commit | Auto-logs memory + CHANGELOG; blocks .env files; runs audit + secret scan |
| `.githooks/pre-push` | Every push | Runs `audit.sh`; aborts on failure |

---

### Behavioral Rules

All behavioral rules (Multi-Agent Workflow, Response Language, Plan Mode, Task Tracking, Subagent Pattern) have been consolidated into the project-level context file to avoid duplication.

#### Superpowers & Cost Optimization (3-Tier Strategy)
The PM agent MUST utilize the `superpowers` plugin to perform harness engineering using a 3-tier model architecture:
- **High-tier (PM / Architect)**: Runs on `claude-opus-4-7` to handle complex planning, reasoning, and prompt engineering.
- **Medium-tier (Reviewer / QA)**: Runs on `claude-sonnet-4.6` to rigorously verify and review the code produced by the low-tier.
- **Low-tier (Code Writer)**: Dispatched on `claude-haiku-4-5` for scoped, simple, or boilerplate coding tasks.

> **Full guidelines:** See [docs/context.md § Coding Guidelines](docs/context.md#coding-guidelines) and [docs/context.md § Multi-Agent Workflow](docs/context.md#multi-agent-workflow)

---

### Custom Command Error Recovery

If a slash command or background script returns a non-zero exit code:
- **Never bypass hooks** with `--no-verify` unless under explicit written user instruction.
- **Code Page / UTF-8 Issues (Windows)**: If broken Korean characters or Unicode errors appear in CLI output, the Windows terminal code page (CP949) is likely the cause. Ensure `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` or `chcp 65001` is prepended to scripts.
- **Diagnose first**: read the failure log. Common causes:
  - `CHANGELOG.md` not staged - run `/changelog` and stage the file, then retry.
  - Direct push to `main` blocked by pre-push hook - use `/sync` to create a PR branch automatically.

---

### Git

Follow conventions in [`docs/context.md § Git Conventions`](docs/context.md).

- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](../CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.

---

### MCP Servers

Document project-specific `.mcp.json` entries here. General MCP guidance: [workspace CLAUDE.md §3](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md).

```json
// .mcp.json - example structure (add to project root; gitignored env vars go in .mcp.local.json)
// {
//   "mcpServers": {
//     "<server-name>": {
//       "command": "./path/to/binary",
//       "args": ["--flag", "value"],
//       "env": {
//         "ENV_VAR": "value"
//       }
//     }
//   }
// }
```

> Use relative paths for `command` - Claude Code resolves them against the project root.

---

### Model Selection Override
<!-- agents/*.md use `model: inherit` - inheriting from workspace CLAUDE.md defaults:  -->
<!--   - Default (inherit)    : claude-sonnet-4-6                                       -->
<!--   - Heavy reasoning      : claude-opus-4-7                                         -->
<!--   - Fast lookups         : claude-haiku-4-5                                        -->
<!-- Uncomment below to override workspace defaults for this project only.              -->
<!-- model: claude-opus-4-7                                                             -->
