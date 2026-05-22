# GEMINI.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Gemini behaviors → [`../GEMINI.md`](../GEMINI.md)

> **Doc intent:** This file contains Gemini CLI-specific overrides only.
> Shared project context (architecture, tech stack, coding guidelines) lives in [`docs/context.md`](docs/context.md).
> Agent roles live in [`agents/*.md`](agents/) and [`AGENTS.md`](AGENTS.md).

## Context Loading

Load project files at session start using the `@` syntax:
```
@../CONSTITUTION.md      # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@AGENTS.md               # canonical agent roster
@memory/MEMORY.md        # recent changes (skip if file does not exist)
```

<!-- Add project-specific files below as needed, e.g.:               -->
<!-- @locales/en.json    — baseline locale for i18n work              -->
<!-- @docs/BIZ_LOGIC.md  — domain formulas / business rules           -->

---

## Project-Specific Gemini Settings

### Tool Name Mapping

Gemini CLI uses different tool names from Claude Code:

| Claude Code | Gemini CLI | Notes |
|-------------|-----------|-------|
| `Read` | `read_file` | |
| `Edit` | `edit` | Always `read_file` before editing |
| `Write` | `write_file` | For new files only |
| `Bash` | `shell` | |
| `Grep` | `grep` | |
| `Glob` | `find_files` | |
| `Agent` | `invoke_subagent` | Pass agent role from `agents/<name>.md` |

### Response Language
- All **conversational** replies → **Korean (한국어)** by default.
- All code, config, commit messages, PR titles, branch names → **English only**.

### Optimal Interaction Guidelines
- **Context Management**: Leverage your massive context window by cross-referencing multiple files simultaneously (e.g., when debugging, review log files along with related code).
- **Tool Usage**: Actively use tools like `search_web` for real-time package version verification or resolving external dependencies.

---

### Git Commit Policy

**Auto-commits and PostToolUse hooks are disabled in Gemini CLI.**

After completing a task, manually run the sync pipeline:

```bash
# bash (macOS/Linux)
bash scripts/dev-sync.sh "feat: description"

# PowerShell (Windows)
.\scripts\dev-sync.ps1 "feat: description"
```

Always append to AI-generated commit messages:
```
Co-Authored-By: Gemini <noreply@google.com>
```

---

### Executing Project Commands

Gemini CLI does not natively register `.claude/commands/` slash commands as Skills.
Instead, emulate them by reading the `.md` file and executing the described script via `shell`:

| Equivalent to | Run instead |
|---------------|------------|
| `/sync "feat: ..."` | `bash scripts/dev-sync.sh "feat: ..."` |
| `/memlog "summary"` | Manually append `## Session — summary` to `memory/YYYY-MM-DD.md` |
| `/changelog "..."` | Manually add entry to `CHANGELOG.md [Unreleased]` |
| `/new-task "name"` | Manually append task block to `memory/YYYY-MM-DD.md` |

---

### Coexistence with `.claude/`

This project uses `.claude/` for Claude Code configuration. Gemini follows these rules:

- **Absolute Precedence**: `.gemini/` always takes precedence over `.claude/` if both exist.
- **Fallback**: If no `.gemini/` directory exists, Gemini may read `.claude/settings.json` and `.claude/commands/` as a fallback source of truth.
- **Command Emulation**: Slash commands defined as `.claude/commands/<name>.md` can be emulated — read the file to understand the underlying script and run it directly via `shell`.
- **Agent Roles**: Gemini can instantiate roles defined in `agents/*.md` using `define_subagent` and `invoke_subagent`.
- **Migration**: If the project transitions away from Claude Code, proactively offer to migrate `.claude/` configuration to `.gemini/` rather than leaving legacy files orphaned.

---

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills.          -->
<!-- Add entries here ONLY for Gemini-exclusive skills not in context.md.     -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->
