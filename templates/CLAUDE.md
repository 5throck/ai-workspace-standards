# CLAUDE.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Claude Code behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md)

> **Doc intent:** This file is Claude Code-specific behavioral configuration for **individual projects** (not the workspace root).
> Shared project context (architecture, tech stack, coding guidelines) lives in [`docs/context.md`](docs/context.md).
> Agent roles live in [`agents/*.md`](agents/) and [`AGENTS.md`](AGENTS.md).

---

## Project-Specific Claude Code Settings

### Session Start

At the start of every Claude Code session, run this checklist:

```
0. git config core.hooksPath .githooks   # activate hooks (run once per clone; verify it stuck)
1. Read https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md               # workspace design standard
2. Read docs/context.md                  # project knowledge — coding guidelines, agents, workflow
3. Read AGENTS.md                        # agent roster (auto-loaded by Claude Code)
4. Read memory/MEMORY.md                 # recent changes and session history
5. Load skills listed in docs/context.md ## Session Start Skills
```

---

### CLI vs Desktop App

Both the CLI and the Desktop App share the same `.claude/settings.json` and slash commands.

| Environment | PostToolUse hook fires? | Action if not |
|-------------|:-----------------------:|---------------|
| Claude Code CLI | ✅ Automatic | — |
| Claude Code Desktop App | ❌ Never | Run `bash scripts/audit.sh` manually before committing |

> **Recommended split:**
> - **CLI** — automated workflows, hook-driven audit, multi-agent orchestration.
> - **Desktop App** — PR monitoring, visual diff review, parallel sessions.

---

### Claude Code Settings

- `.claude/settings.json` — shared team config (committed to repo)
- `.claude/settings.local.json` — personal write permissions + git/gh access (gitignored)
- `.claude/commands/` — slash commands auto-registered as Skills

Both files are loaded automatically by Claude Code.

---

### Slash Commands (`.claude/commands/`)

These commands are available as both `/slash-commands` and via the `Skill` tool:

| Command | Purpose |
|---------|---------|
| `/changelog "description"` | Add entry to `CHANGELOG.md [Unreleased]` |
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only |
| `/new-task "task name"` | Create task tracking block in today's memory log |
| `/security-check` | Run security advisory scan (daily or `--pr` pre-PR mode) |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill in Claude Code. Add new commands by creating files here.

---

### Hooks

```json
// .claude/settings.json — enable PostToolUse audit after every Write/Edit:
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

#### Multi-Agent Workflow

This project uses a **PM-first multi-agent architecture**. All development work flows through the PM orchestrator.

**Single Entry Point:** The PM agent (`agents/pm.md`) is the ONLY interface for ALL requests. Direct invocation of specialist agents is forbidden.

> **Full guide:** See [`docs/context.md § Multi-Agent Workflow`](docs/context.md#multi-agent-workflow)

**Quick start:** Submit your request to PM: "PM, I need to [describe task]"

#### Response Language
- All **conversational** replies → **Korean (한국어)** by default.
- All code, config, commit messages, PR titles, PR bodies, branch names → **English only**.

#### Plan Mode
Enter plan mode (`EnterPlanMode`) when:
- User requests a new feature or significant refactor
- The change touches more than 2 files
- The correct approach is unclear or requires clarifying assumptions

#### Task Tracking
- Call `TaskCreate` before starting any multi-step work
- Set status `in_progress` before beginning each atomic step
- Set status `completed` immediately after verification
- Never leave tasks `in_progress` at end of session

#### Subagent Pattern
Each implementation task follows the Phase 4 execution loop:
1. **code-writer** implements the changes
2. **test-runner** verifies against acceptance criteria and runs tests
3. **Quality gate (audit script)** validates compliance

Fix and re-review if issues found — maximum **3 iterations** before escalating to the user.

---

### Custom Command Error Recovery

If a slash command or background script returns a non-zero exit code:
- **Never bypass hooks** with `--no-verify` unless under explicit written user instruction.
- **Diagnose first**: read the failure log. Common causes:
  - `CHANGELOG.md` not staged — run `/changelog` and stage the file, then retry.
  - Direct push to `main` blocked by pre-push hook — use `/sync` to create a PR branch automatically.

---

### Git

Follow conventions in [`docs/context.md § Git Conventions`](docs/context.md).
Always append to AI-generated commit messages:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

- **PR Language**: Governed by [CONSTITUTION.md §3 — Mandatory English Git & PR Artifacts](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English — no exceptions.

---

### MCP Servers

Document project-specific `.mcp.json` entries here. General MCP guidance: [workspace CLAUDE.md §3](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md).

```json
// .mcp.json — example structure (add to project root; gitignored env vars go in .mcp.local.json)
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

> Use relative paths for `command` — Claude Code resolves them against the project root.

---

### Model Selection Override
<!-- agents/*.md use `model: inherit` — inheriting from workspace CLAUDE.md defaults:  -->
<!--   - Default (inherit)    : claude-sonnet-4-6                                       -->
<!--   - Heavy reasoning      : claude-opus-4-7                                         -->
<!--   - Fast lookups         : claude-haiku-4-5                                        -->
<!-- Uncomment below to override workspace defaults for this project only.              -->
<!-- model: claude-opus-4-7                                                             -->
