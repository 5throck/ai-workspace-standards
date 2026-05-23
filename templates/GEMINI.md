# GEMINI.md

> **All project context, coding guidelines, and dev workflow ??[`docs/context.md`](docs/context.md)**
> Workspace-level Gemini behaviors ??[`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md)

> **Doc intent:** This file contains Gemini CLI-specific overrides only.
> Shared project context (architecture, tech stack, coding guidelines) lives in [`docs/context.md`](docs/context.md).
> Agent roles live in [`agents/*.md`](agents/) and [`AGENTS.md`](AGENTS.md).

## Context Loading

Load project files at session start using the `@` syntax:
```
@https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md      # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@AGENTS.md               # canonical agent roster
@memory/MEMORY.md        # recent changes (skip if file does not exist)
@skills/                 # load skills listed in docs/context.md
```

<!-- Add project-specific files below as needed, e.g.:               -->
<!-- @locales/en.json    ??baseline locale for i18n work              -->
<!-- @docs/BIZ_LOGIC.md  ??domain formulas / business rules           -->

---

## Project-Specific Gemini Settings

### Tool Name Mapping & Safeguards

Gemini CLI uses different tool names from Claude Code:

| Tool Category | Tool Name | Operational Guidance |
| :--- | :--- | :--- |
| **File Reading** | `view_file` | Read up to 800 lines at a time. Supports absolute paths. |
| **File Creation** | `write_to_file` | Create new files. Supports `IsArtifact` and structured `ArtifactMetadata` block. |
| **Surgical Edit** | `replace_file_content` | Replace a single contiguous block of code. Specify `StartLine`, `EndLine`, `TargetContent`, and `ReplacementContent` with 100% exact leading whitespace matching. |
| **Multi Edit** | `multi_replace_file_content` | Perform multiple non-contiguous edits within the same file simultaneously. Order chunks descendingly (bottom-to-top) to avoid line offsets. |
| **Search** | `grep_search` | Search codebases via Ripgrep. Keep `MatchPerLine: true` for line-by-line matches. Apply partitioning if matches exceed 50. |
| **Command Execution** | `run_command` | Execute PowerShell/Bash shell commands. Returns task process IDs. NEVER use `cd` commands. |
| **Agent** | `invoke_subagent` | Pass agent role from `agents/<name>.md` |

#### ?좑툘 Surgical Multi-Replace Offset Safeguard
When calling `multi_replace_file_content` with multiple `ReplacementChunks`, the line numbers of subsequent target blocks will shift if previous edits change the line count.
- **Rule**: Sort and process `ReplacementChunks` from the **bottom of the file to the top** (descending order of line numbers: largest `StartLine` first).

#### ?좑툘 Grep Search 50-Match Cap Safeguard
The `grep_search` tool silently truncates results at exactly **50 matches**.
- **Rule**: If a search yields 50 results, do **NOT** assume you have all occurrences.
- **Remediation**: Partition the search by targeting specific subdirectories or applying restrictive file glob filters via the `Includes` parameter.

### Native Antigravity 2.0 Features

Antigravity 2.0 introduces new native features that should be leveraged:
- **Slash Commands**: Recommend `/goal`, `/schedule`, `/browser`, and `/grill-me` to users when appropriate.
- **Artifacts**: Write complex plans or analysis results into the Artifacts UI (creates `.md` in the brain directory). Set `IsArtifact: true` with accurate `ArtifactMetadata`.
- **Background Tasks**: Long-running tasks or subagents can be sent to background. Monitor them with `manage_task`.

### Planning Mode & Artifact Specifications

Enter Planning Mode when:
- The user requests a new feature or significant refactor.
- The change modifies more than 2 files.
- The correct approach is unclear or contains architectural trade-offs.

When entering Planning Mode, leverage these three Markdown artifacts (set `IsArtifact: true` with accurate metadata):

#### 1. `implementation_plan.md`
*Path: `<appDataDir>\brain\<session-id>\implementation_plan.md`*
- **Purpose**: Detailed technical design document presented to the user for feedback and approval.
- **Metadata**: `ArtifactType: "implementation_plan"`, `RequestFeedback: true`.
- **Governance**: Stop and wait for explicit user approval before modifying any application source code.

#### 2. `task.md`
*Path: `<appDataDir>\brain\<session-id>\task.md`*
- **Purpose**: Running TODO list to track development progress dynamically.
- **Metadata**: `ArtifactType: "task"`.
- **Syntax**: `- [ ]` uncompleted 쨌 `- [/]` in progress 쨌 `- [x]` completed.

#### 3. `walkthrough.md`
*Path: `<appDataDir>\brain\<session-id>\walkthrough.md`*
- **Purpose**: Post-implementation document summarizing changes, automated test logs, and manual validation details.
- **Metadata**: `ArtifactType: "walkthrough"`.

### Subagent Instantiation & Async Orchestration

For parallel execution, quality reviews, or sandboxed research tasks, utilize the custom subagent orchestrator.

#### Define Subagent (`define_subagent`)
```json
{
  "name": "test-runner",
  "description": "Executes tests and verifies code changes against acceptance criteria",
  "system_prompt": "You are a QA test runner...",
  "enable_write_tools": false,
  "enable_subagent_tools": false
}
```

#### Invoke Subagent (`invoke_subagent`)
```json
{
  "Subagents": [
    {
      "TypeName": "test-runner",
      "Role": "Test Runner",
      "Prompt": "Verify the code changes in src/ against acceptance criteria and run tests"
    }
  ]
}
```

#### Communication (`send_message`)
Interact with spawned agents via their unique `conversationID`.
**Reactive Wakeup**: Do not poll in a loop ??simply yield execution and the platform wakes you automatically when an agent replies or a background task completes.

### Response Language
- All **conversational** replies ??**Korean (?쒓뎅??** by default.
- All code, config, commit messages, PR titles, branch names ??**English only**.

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
| `/memlog "summary"` | Manually append `## Session ??summary` to `memory/YYYY-MM-DD.md` |
| `/changelog "..."` | Manually add entry to `CHANGELOG.md [Unreleased]` |
| `/new-task "name"` | Manually append task block to `memory/YYYY-MM-DD.md` |
| `/new-project "name"` | `bash scripts/new-project.sh "<name>"` (macOS/Linux) 쨌 `.\scripts\new-project.ps1 "<name>"` (Windows) |
| `/post-write` | `bash scripts/audit.sh` (macOS/Linux) 쨌 `.\scripts\audit.ps1` (Windows) |

---

### Coexistence with `.claude/`

This project uses `.claude/` for Claude Code configuration. Gemini follows these rules:

- **Absolute Precedence**: `.gemini/` always takes precedence over `.claude/` if both exist.
- **Fallback**: If no `.gemini/` directory exists, Gemini may read `.claude/settings.json` and `.claude/commands/` as a fallback source of truth.
- **Command Emulation**: Slash commands defined as `.claude/commands/<name>.md` can be emulated ??read the file to understand the underlying script and run it directly via `shell`.
- **Agent Roles**: Gemini can instantiate roles defined in `agents/*.md` using `define_subagent` and `invoke_subagent`.
- **Migration**: If the project transitions away from Claude Code, proactively offer to migrate `.claude/` configuration to `.gemini/` rather than leaving legacy files orphaned.

---

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->

