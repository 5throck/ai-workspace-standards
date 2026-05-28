# GEMINI.md

This file provides guidance to Gemini (including the Antigravity agentic engine and Gemini CLI) when working in this workspace.

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.**
>
> For tool-specific behaviors of Claude Code, see [`CLAUDE.md`](CLAUDE.md).

---

## Gemini-Specific & Antigravity Workflows

### 1. Active Antigravity Tool Suite Mapping & Safeguards
Antigravity utilizes the following specialized, fine-grained toolset for filesystem and system operations. Refer to this mapping and the mandatory operational safeguards below:

| Tool Category | Tool Name | Operational Guidance |
| :--- | :--- | :--- |
| **File Reading** | `view_file` | Read up to 800 lines at a time. Supports absolute paths. |
| **File Creation** | `write_to_file` | Create new files. Supports `IsArtifact` and structured `ArtifactMetadata` block. |
| **Surgical Edit** | `replace_file_content` | Replace a single contiguous block of code. Specify `StartLine`, `EndLine`, `TargetContent`, and `ReplacementContent` with 100% exact leading whitespace matching. |
| **Multi Edit** | `multi_replace_file_content` | Perform multiple non-contiguous edits within the same file simultaneously. Order chunks descendingly (bottom-to-top) to avoid line offsets. |
| **Search** | `grep_search` | Search codebases via Ripgrep. Keep `MatchPerLine: true` for line-by-line matches. Apply partitioning if matches exceed 50. |
| **Command Execution** | `run_command` | Execute PowerShell/Bash shell commands. Returns task process IDs. NEVER use `cd` commands. |

#### 🚨 Surgical Multi-Replace Offset Safeguard
When calling `multi_replace_file_content` with multiple `ReplacementChunks`, the line numbers of subsequent target blocks will shift if previous edits change the line count.
- **Rule**: You **MUST** sort and process the `ReplacementChunks` from the **bottom of the file to the top** (descending order of line numbers: largest `StartLine` first).
- This guarantees that edits made near the end of the file do not alter or corrupt the line numbers of target blocks located higher up in the file.

#### 🚨 Windows Terminal & Code Page Safeguard
When executing CLI commands via `run_command` on Windows (PowerShell/CMD), the default Windows code page (e.g., CP949) often causes Unicode decoding errors.
- **Rule:** Before running commands that output non-ASCII text, explicitly set the code page to UTF-8 by prepending `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` (PowerShell) or `chcp 65001` (CMD).

#### 🚨 Grep Search 50-Match Cap Safeguard
The `grep_search` tool silently truncates results at exactly **50 matches**.
- **Rule**: If a codebase-wide search yields 50 results, do **NOT** assume you have all occurrences.
- **Remediation**: Partition the search. Divide the search by targeting specific subdirectories (e.g., `C:\git\<project>\src`) or apply restrictive file glob filters using the `Includes` parameter (e.g., `["*.py"]` or `["*.ts"]`).

---

### 2. Planning Mode & Artifact Specifications
Enter Planning Mode when:
- The user requests a new feature or significant refactor.
- The change modifies more than 2 files.
- The correct approach is unclear or contains architectural trade-offs.

When entering Planning Mode, Gemini **MUST** leverage the following three precise Markdown artifacts. When creating or updating them, set `IsArtifact: true` and specify accurate metadata:

#### 1. `implementation_plan.md` (Path: `<appDataDir>\brain\<session-id>\implementation_plan.md` on Windows 쨌 `<appDataDir>/brain/<session-id>/implementation_plan.md` on macOS/Linux)
*   **Purpose**: Detailed technical design document presented to the user for feedback and approval.
*   **Metadata**: `ArtifactType: "implementation_plan"`, `RequestFeedback: true`, and a clear multi-line `Summary`.
*   **Governance**: Stop and wait for explicit user approval before modifying any application source code.

#### 2. `task.md` (Path: `<appDataDir>\brain\<session-id>\task.md` on Windows 쨌 `<appDataDir>/brain/<session-id>/task.md` on macOS/Linux)
*   **Purpose**: Running TODO list to track development progress dynamically.
*   **Metadata**: `ArtifactType: "task"`.
*   **Syntax**:
    *   `- [ ]` for uncompleted tasks.
    *   `- [/]` for tasks currently in progress.
    *   `- [x]` for completed tasks.

#### 3. `walkthrough.md` (Path: `<appDataDir>\brain\<session-id>\walkthrough.md` on Windows 쨌 `<appDataDir>/brain/<session-id>/walkthrough.md` on macOS/Linux)
*   **Purpose**: Post-implementation document summarizing changes, automated test logs, and manual validation details.
*   **Metadata**: `ArtifactType: "walkthrough"`.

---

### 3. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.
This is enforced at 4 levels - tool, system prompt, agent file, and QA gate.

#### Level 1: Tool-Level Enforcement (Primary - Hard Enforcement)
- Agent tool automatically rejects non-PM specialist calls
- Bypass: Impossible

#### Level 2: System Prompt-Level Enforcement (Secondary)
- This section is enforced via system prompt priority
- GEMINI.md Agent Dispatch Rules are loaded first

#### Level 3: Agent File-Level Enforcement (Tertiary)
- All specialist agents have "⚠️ PM-ONLY INVOCATION" section
- Agents refuse direct requests and redirect to PM

#### Level 4: QA Gate-Level Enforcement (Quarternary)
- Auditor detects PM bypass in Phase 5 QA
- Post-hoc detection - prevents commits but not execution

#### Forbidden Direct Calls
❌ DO NOT: Direct specialist invocation via Gemini CLI
❌ DO NOT: "Specialist, perform task" without PM triage
❌ DO NOT: Bypass PM dispatch workflow

#### Correct Workflow
1. Submit request to PM: "PM, need specialist for X"
2. PM triages → dispatches specialist → synthesizes results
3. PM enforces QA gate → approves completion

#### Specialist Agent List
All agents below require PM dispatch:
- architect (Phase 1-2)
- auditor (Phase 5)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- scaffolding-expert (Phase 0)
- security-expert (Phase 5)
- lifecycle-manager (Phase 6)

---

### 4. Subagent Instantiation & Async Orchestration
For parallel execution, quality reviews, or sandboxed research tasks, utilize the custom subagent orchestrator.

> **Agent Architecture**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](CONSTITUTION.md#5-multi-agent-architecture) for governance rules.
> **Agent Roster**: See [AGENTS.md](AGENTS.md) for the canonical index of all available agents.

#### Define Subagent (`define_subagent`)
Instantiate a new reusable subagent type with a unique name, specialized role prompt, and permissions:
```json
{
  "name": "auditor",
  "description": "Cross-validates documentation and ensures rules are not contradicted",
  "system_prompt": "You are a consistency auditor...",
  "enable_write_tools": false,
  "enable_subagent_tools": false
}
```

#### Invoke Subagent (`invoke_subagent`)
Spawn parallel instances to execute dedicated work concurrently.
```json
{
  "Subagents": [
    {
      "TypeName": "auditor",
      "Role": "Consistency Auditor",
      "Prompt": "Cross-validate the documentation changes and check for contradictions"
    }
  ]
}
```

#### Communication (`send_message`)
Interact and exchange contracts with spawned agents via their unique `conversationID`.
The platform supports **Reactive Wakeup**: you do not need to poll or query tasks in a loop. Simply yield execution, and the platform will wake you up automatically as soon as an agent replies or a background task completes.

#### Phase 4 Execution Loop
See [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster) for the complete agent list:
1.  **automation-engineer** implements the changes.
2.  **auditor** verifies against acceptance criteria and consistency.
3.  **Quality gate (audit script)** validates compliance.

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy (see [AGENTS.md - Superpowers Plugin](AGENTS.md#superpowers-plugin--cost-optimization-3-tier-strategy)):
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** → `gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** → `gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** → `gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.

---

### 6. Slash Command Emulation Guide
Gemini does not natively run slash commands. Emulate custom slash commands using platform terminal utilities based on the current host OS:

| Command | macOS / Linux (Bash) | Windows (PowerShell) |
| :--- | :--- | :--- |
| `/sync "feat: ..."` | `bash scripts/dev-sync.sh "feat: ..."` | `.\scripts\dev-sync.ps1 "feat: ..."` |
| `/memlog` | Append to `memory/YYYY-MM-DD.md` manually (no script) | Append to `memory/YYYY-MM-DD.md` manually (no script) |
| `/changelog "..."` | Append entry to `CHANGELOG.md` under `[Unreleased]` | Append entry to `CHANGELOG.md` under `[Unreleased]` |
| `/new-task "..."` | Manually create `memory/YYYY-MM-DD.md` task entry | Manually create `memory/YYYY-MM-DD.md` task entry |
| `/new-project` | `bash scripts/new-project.sh "<project-name>"` | `.\scripts\new-project.ps1 "<project-name>"` |
| `/post-write` | `bash scripts/audit.sh` (Run manually) | `.\scripts\audit.ps1` (Run manually) |

---

### 7. Coexistence, Precedence & Migration of .claude
Many active repositories under the workspace root possess `.claude/` directories rather than `.gemini/`.
*   **`.gemini/` exists**: Rely on `.gemini/` settings only. Ignore `.claude/` configurations entirely.
*   **`.claude/` exists, `.gemini/` absent**: Read `.claude/settings.json` and `.claude/commands/` as fallbacks. Emulate custom commands by executing their target scripts.
*   **Migration**: Offer the user a migration of `.claude/` -`.gemini/` (copying and adapting configurations) when fully transitioning a project away from Claude Code.

---

## Git & PR Additions (Gemini)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Gemini-specific additions:

- **PostToolUse Limitation**: PostToolUse hooks are **disabled** in Gemini/Antigravity sessions. Manually execute `dev-sync` or audit scripts (`scripts/audit.sh` or `scripts/audit.ps1`) after local edits, and run commits at task boundaries.
- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.

*Last Updated: 2026-05-27*


