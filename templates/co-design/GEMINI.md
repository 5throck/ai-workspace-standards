# GEMINI.md

> **Doc intent:** This file contains Gemini CLI / Antigravity-specific overrides only.
> Workspace-level Gemini behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md)

## Role Declaration

You ARE the PM agent for this project session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Never directly use the following tools for state-changing operations without PM approval (`.pm-approved` flag):**
- `write_to_file`, `replace_file_content`, `multi_replace_file_content` — file modification
- `run_command` — unless strictly read-only: `grep_search`, `git log/status/diff`, `ls`

**For ALL multi-step tasks (2+ files or 2+ sequential steps):**
1. Display execution plan table first (task | agent | tier | model)
2. Only then use `invoke_subagent` to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Note**: `PreToolUse` hooks enforce this rule at the tool level in CLI environments. This Role Declaration serves as the system-prompt-level enforcement (Level 2).

---

## Session Start — Context Loading Order

At the start of every session, read these files **in order**:

1. **[`docs/context.md`](docs/context.md)** — Immutable project identity (architecture, key files, documentation standards). Do NOT modify.
2. **[`docs/co-design.context.md`](docs/co-design.context.md)** — Design stack, agents, skills, scripts, workflow. All project-specific changes go here.
3. **[`AGENTS.md`](AGENTS.md)** — Canonical agent index and dispatch protocols.

> The two-file split is intentional: `context.md` never changes after project creation;
> `co-design.context.md` evolves with the project (agents, skills, design stack, workflow).

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

#### ⚠️ Surgical Multi-Replace Offset Safeguard
When calling `multi_replace_file_content` with multiple `ReplacementChunks`, the line numbers of subsequent target blocks will shift if previous edits change the line count.
- **Rule**: Sort and process `ReplacementChunks` from the **bottom of the file to the top** (descending order of line numbers: largest `StartLine` first).

#### 🚨 Windows Terminal & Code Page Safeguard
When executing CLI commands via `run_command` on Windows (PowerShell/CMD), the default Windows code page (e.g., CP949) often causes Unicode decoding errors.
- **Rule:** Before running commands that output non-ASCII text, explicitly set the code page to UTF-8 by prepending `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` (PowerShell) or `chcp 65001` (CMD).

#### 🚨 Grep Search 50-Match Cap Safeguard
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
- **Syntax**: `- [ ]` uncompleted · `- [/]` in progress · `- [x]` completed.

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
**Reactive Wakeup**: Do not poll in a loop - simply yield execution and the platform wakes you automatically when an agent replies or a background task completes.

### Behavioral Rules & Multi-Agent Workflow

All behavioral rules (Multi-Agent Workflow, Response Language, Plan Mode, Task Tracking, Subagent Pattern) have been consolidated into the project-level context file to avoid duplication.

#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy:
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** → `gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** → `gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** → `gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.

> **Full guidelines:** See [docs/context.md § Coding Guidelines](docs/context.md#coding-guidelines) and [docs/context.md § Multi-Agent Workflow](docs/context.md#multi-agent-workflow)

### Optimal Interaction Guidelines
- **Context Management**: Leverage your massive context window by cross-referencing multiple files simultaneously (e.g., when debugging, review log files along with related code).
- **Tool Usage**: Actively use tools like `search_web` for real-time package version verification or resolving external dependencies.

### Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location |
|----------|--------|----------|
| **1 (highest)** | Local project skills | `skills/<name>/SKILL.md` in the current working directory |
| **2** | Platform config skills | `.gemini/skills/` in the project root |
| **3 (lowest)** | Global plugin skills | e.g., `superpowers/brainstorming`, `superpowers/writing-plans` |

**Rule**: If a local skill's `metadata.triggers` matches the user request, use it — do **not** fall through to a global plugin with overlapping intent.

**Canonical conflict — meeting vs. brainstorming**:

| User says | Correct skill | Priority |
|-----------|--------------|----------|
| "meeting", "회의", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the local skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

---

### Security & Hook Configuration

<!-- WORKSPACE-MANAGED -->
Security defaults are enforced at project creation and verified during upgrades.

| Control | Configuration | Verification |
|---------|---------------|--------------|
| Secret scanning | `.gitleaks.toml` (project root) | Pre-commit hook runs gitleaks |
| Pre-commit hook | `.githooks/pre-commit` | `git hook run pre-commit` |
| Pre-push hook | `.githooks/pre-push` | Blocks direct push to `main` |
| Encoding safety | `.gitattributes` (`eol=lf`, `encoding=utf-8`) | Prevents CRLF corruption |
| Secrets exclusion | `.gitignore` (`.env`, `*.key`, `*.pem`) | Audit script checks patterns |
| Hook path | `git config core.hooksPath .githooks` | Run once per clone |

**Activating hooks** (run once per clone):
```bash
git config core.hooksPath .githooks
```

**Security Bootstrap Verification**: This section defines the security gate that Antigravity enforces when creating or upgrading projects. Both the Antigravity engine and the `.githooks/` directory must pass the same 5-point Security Bootstrap Check.
<!-- /WORKSPACE-MANAGED -->

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

---

### Executing Project Commands

To execute project commands, run the corresponding script directly:

| Equivalent to | Run instead |
|---------------|------------|
| `/sync "feat: ..."` | `bash scripts/dev-sync.sh "feat: ..."` |
| `/memlog "summary"` | Manually append `## Session - summary` to `memory/YYYY-MM-DD.md` |
| `/changelog "..."` | Manually add entry to `CHANGELOG.md [Unreleased]` |
| `/new-task "name"` | Manually append task block to `memory/YYYY-MM-DD.md` |
| `/new-project "name"` | `bash scripts/new-project.sh "<name>"` (macOS/Linux) · `.\scripts\new-project.ps1 "<name>"` (Windows) |
| `/post-write` | `bash scripts/audit.sh` (macOS/Linux) · `.\scripts\audit.ps1` (Windows) |
| `/security-check` | Run Workflow 2 of `agents/security-monitor.md` (Pre-PR Advisory Check) |

---

### Pre-PR Security Gate (public repos only)

Before pushing and creating a PR, check if the repo is public:

```bash
gh repo view --json isPrivate -q '.isPrivate' 2>/dev/null
```

If the result is `false` (public repo): run `/security-check` (Workflow 2 of `agents/security-monitor.md` - read-only, no scan).

- If CRITICAL advisories are found: show the warning and **pause** - let the user decide whether to proceed or stop.
- If no CRITICAL advisories: continue with the push and PR creation.

For private repos: skip the security gate entirely.

---

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->
