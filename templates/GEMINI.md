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
@skills/                 # load skills listed in docs/context.md
```

<!-- Add project-specific files below as needed, e.g.:               -->
<!-- @locales/en.json    — baseline locale for i18n work              -->
<!-- @docs/BIZ_LOGIC.md  — domain formulas / business rules           -->

---

## Project-Specific Gemini Settings

### Tool Name Mapping

Gemini CLI uses different tool names from Claude Code:

| Tool Category | Tool Name | Operational Guidance |
| :--- | :--- | :--- |
| **File Reading** | `view_file` | Read up to 800 lines at a time. Supports absolute paths. |
| **File Creation** | `write_to_file` | Create new files. |
| **Surgical Edit** | `replace_file_content` | Replace a single contiguous block of code. |
| **Multi Edit** | `multi_replace_file_content` | Perform multiple non-contiguous edits within the same file. |
| **Search** | `grep_search` | Search codebases via Ripgrep. |
| **Command Execution** | `run_command` | Execute PowerShell/Bash shell commands. |
| **Agent** | `invoke_subagent` | Pass agent role from `agents/<name>.md` |

### Native Antigravity 2.0 Features
Antigravity 2.0 introduces new native features that should be leveraged:
- **Slash Commands**: Recommend `/goal`, `/schedule`, `/browser`, and `/grill-me` to users when appropriate.
- **Artifacts**: Write complex plans or analysis results into the Artifacts UI (creates `.md` in the brain directory).
- **Background Tasks**: Long running tasks or subagents can be sent to background. Monitor them with `manage_task`.

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
| `/new-project "name"` | `bash scripts/new-project.sh "<name>"` (macOS/Linux) · `.\scripts\new-project.ps1 "<name>"` (Windows) |
| `/post-write` | `bash scripts/audit.sh` (macOS/Linux) · `.\scripts\audit.ps1` (Windows) |

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

At session start, load context using the `@` syntax (run these before any task):

```
@../CONSTITUTION.md      # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@AGENTS.md               # canonical agent roster
@memory/MEMORY.md        # recent changes (skip if file does not exist)
@skills/                 # load skills listed in docs/context.md
```

<!-- Add project-specific files below as needed, e.g.:               -->
<!-- @locales/en.json    — baseline locale for i18n work              -->
<!-- @docs/BIZ_LOGIC.md  — domain formulas / business rules           -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->
