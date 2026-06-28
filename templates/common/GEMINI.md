# GEMINI.md

> **Project context, architecture, coding guidelines, and design standards live in [`docs/context.md`](docs/context.md) - read it first.**

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model | platform)
2. Only then use `invoke_subagent` to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Note**: This Role Declaration and the Mandatory Execution Plan serve as the strict system-prompt-level enforcement for the PM Gateway.

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
| **Command Execution** | `run_command` | Execute PowerShell/Bash shell commands. Returns task process IDs. NEVER use `cd` commands. 🚫 **STRICT BAN**: NEVER run `git commit` or `git push` directly via this tool (e.g., using `$env:SYNC_ACTIVE=1; git commit` to bypass QA gates is FORBIDDEN). All commits must go through the approved `/sync` pipeline or `bun scripts/dev-sync.ts`. |

#### ⚠️ Surgical Multi-Replace Offset Safeguard
When calling `multi_replace_file_content` with multiple `ReplacementChunks`, the line numbers of subsequent target blocks will shift if previous edits change the line count.
- **Rule**: You **MUST** sort and process the `ReplacementChunks` from the **bottom of the file to the top** (descending order of line numbers: largest `StartLine` first).
- This guarantees that edits made near the end of the file do not alter or corrupt the line numbers of target blocks located higher up in the file.

#### ⚠️ Windows Terminal & Code Page Safeguard
When executing CLI commands via `run_command` on Windows (PowerShell/CMD), the default Windows code page (e.g., CP949) often causes Unicode decoding errors.
- **Rule:** Before running commands that output non-ASCII text, explicitly set the code page to UTF-8 by prepending `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` (PowerShell) or `chcp 65001` (CMD).

#### ⚠️ Grep Search 50-Match Cap Safeguard
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

#### 1. `implementation_plan.md` (Path: `<appDataDir>\brain\<session-id>\implementation_plan.md` on Windows / `<appDataDir>/brain/<session-id>/implementation_plan.md` on macOS/Linux)
*   **Purpose**: Detailed technical design document presented to the user for feedback and approval.
*   **Metadata**: `ArtifactType: "implementation_plan"`, `RequestFeedback: true`, and a clear multi-line `Summary`.
*   **Format Requirement**: MUST use the exact markdown template below for the document structure.
    ```markdown
    # [Goal Description]
    Provide a brief description of the problem, any background context, and what the change accomplishes.

    ## User Review Required
    Document anything that requires user review or feedback.

    ## Proposed Changes
    Group files by component and order logically.
    #### [MODIFY] [file basename](file:///absolute/path/to/modifiedfile)
    #### [NEW] [file basename](file:///absolute/path/to/newfile)

    ## Execution Task Plan (Agent Dispatch Rules)
    | Step | Task | Agent | Tier | Model |
    |:---:|---|:---:|:---:|---|
    | 1 | [Task Description] | [agent-name] | [High/Medium/Low] | [Model String] |
    | N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [Model String] |

    *Execution Order: [Parallel/Sequential]*
    ```
*   **Governance**: Stop and wait for explicit user approval before modifying any application source code.

#### 2. `task.md` (Path: `<appDataDir>\brain\<session-id>\task.md` on Windows / `<appDataDir>/brain/<session-id>/task.md` on macOS/Linux)
*   **Purpose**: Running TODO list to track development progress dynamically.
*   **Metadata**: `ArtifactType: "task"`.
*   **Syntax**:
    *   `- [ ]` for uncompleted tasks.
    *   `- [/]` for tasks currently in progress.
    *   `- [x]` for completed tasks.

#### 3. `walkthrough.md` (Path: `<appDataDir>\brain\<session-id>\walkthrough.md` on Windows / `<appDataDir>/brain/<session-id>/walkthrough.md` on macOS/Linux)
*   **Purpose**: Post-implementation document summarizing changes, automated test logs, and manual validation details.
*   **Metadata**: `ArtifactType: "walkthrough"`.

---

### 3. Subagent Instantiation & Async Orchestration
For parallel execution, quality reviews, or sandboxed research tasks, utilize the custom subagent orchestrator.

> **Agent Architecture**: See [docs/context.md](docs/context.md) for governance rules.
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
Spawn parallel instances to execute dedicated work concurrently. PM MUST explicitly use `"Workspace": "share"` for execution agents to ensure safe parallel file writing.
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

> ⚠️ **Subagent commit rule**: Subagents must NOT issue `git commit` or `git push` directly. All commits must be initiated by PM via `/sync` command only. Direct commits are blocked by the pre-commit `SYNC_ACTIVE` gate.

#### Communication (`send_message`)
Interact and exchange contracts with spawned agents via their unique `conversationID`.
The platform supports **Reactive Wakeup**: you do not need to poll or query tasks in a loop. Simply yield execution, and the platform will wake you up automatically as soon as an agent replies or a background task completes.

#### Phase 4 Execution Loop
See [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster) for the complete agent list:
1.  **automation-engineer** implements the changes.
2.  **PM** verifies against acceptance criteria by running `bun scripts/audit.ts` directly.
3.  **Quality gate (audit script)** validates compliance.

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

#### Cost Optimization (3-Tier Model Strategy)
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** — `gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** — `gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** — `gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.

---

<!-- COMMON-GEMINI:START -->
### 4. Language Policy for Documentation

All `.md` files you create or modify MUST be in English, except in `ko/` or `locales/ko/` directories (Korean translation zones) or when explicitly declared as a Korean legal/regulatory content exception.

- README.md, CLAUDE.md, GEMINI.md, AGENTS.md, context.md, CHANGELOG.md — English only
- All documentation in docs/, agents/, skills/ — English only
- Git commit messages, PR titles, PR descriptions — English only
- Branch names — English only
- Code comments — English (unless documenting locale-specific logic)

#### Language Policy Exception
For files where Korean is legally or academically mandatory, add to the frontmatter:
```yaml
lang: ko
lang_reason: legal # legal | source-material | proper-noun
```
*(Not available for: agents/*.md, skills/*.md, context.md, CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md)*
<!-- COMMON-GEMINI:END -->

### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

For the **4-level enforcement model**, **mandatory criteria**, **execution plan format**, and **phase determination**, see [AGENTS.md §3 and §5](AGENTS.md).

#### Antigravity-Specific Dispatch

Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table prior to invoking the agent orchestration tool.

<!-- COMMON-GEMINI:START -->
## Execution Plan Boilerplate

For execution plan format, mandatory criteria, and templates, see **[AGENTS.md §3 and §5](AGENTS.md)**.

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

Every execution plan MUST start with Row 0 (Design Gate — architect creates/updates design doc) and end with `/sync`. Between Row 0 and `/sync`, list implementation tasks.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Exempt tasks** (E1–E5): Replace Row 0 with `── EXEMPT: <category> ──`. See [AGENTS.md §5.1.1](AGENTS.md#511-design-gate-exemptions).

**Antigravity execution**: Use `invoke_subagent` for specialist dispatch. See §3 (Subagent Instantiation & Async Orchestration) in this file.
<!-- COMMON-GEMINI:END -->

#### Skill Resolution Priority

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
| "meeting", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the local skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

> **Antigravity Command Intercept Rule**: `/meeting` is not a native Antigravity UI slash command. If the user input begins with `/meeting`, you (the Agent) MUST immediately intercept this text pattern and seamlessly execute the `.gemini/commands/meeting.md` process using the provided arguments, exactly as if the user had explicitly requested the skill by name.

---

### 6. Project Boundary Policy

- **Strict Scope**: Work only within the current project directory.
- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.

> For lifecycle management rules, see [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management).
<!-- COMMON-GEMINI:END -->

---

<!-- COMMON-GEMINI:START -->
## Git & PR Additions (Gemini)

All shared Git/PR rules are in [docs/context.md](docs/context.md). Gemini-specific additions:

- **PostToolUse Limitation**: PostToolUse hooks are **disabled** in Gemini/Antigravity sessions. Manually execute `dev-sync` or audit scripts (`bun scripts/audit.ts`) after local edits, and run commits at task boundaries.
- **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` or `git push` calls via `run_command` are **FORBIDDEN**. The pre-commit hook blocks direct commits unless executed through `/sync`. Never manipulate environment variables (e.g., `$env:SYNC_ACTIVE=1; git commit`) to bypass QA gates. If you see `[FAIL] Direct git commits are restricted`, run `/sync \"type: description\"` instead. **`--no-verify` is forbidden** — it bypasses secret scanning and all quality gates.
- **PR Language**: Governed by [docs/context.md](docs/context.md). All PR titles, bodies, and review comments must be written in English - no exceptions.
- **Windows: Git Bash required**: `.githooks/` hook files are Unix shell scripts. Windows users must have Git Bash installed. Run `git config core.hooksPath .githooks` to activate hooks. All `scripts/` operational scripts are TypeScript (`.ts`) — run via `bun scripts/<name>.ts`. No `.sh/.ps1` counterparts (ADR-0036).
<!-- COMMON-GEMINI:END -->

## Agent Teams vs. Antigravity Agent Manager

Claude Code has an **Agent Teams** feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) that runs multiple Claude instances in-process with a shared task list and direct messaging. Antigravity 2.0 has a **different** but conceptually similar capability.

### Antigravity Agent Manager

Antigravity 2.0 replaces the single-agent model with an **Agent Manager** — a higher-level UI that orchestrates multiple agents across separate workspaces.

| Aspect | Claude Code Agent Teams | Antigravity Agent Manager |
|--------|------------------------|--------------------------|
| Activation | `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings | UI-based — enter Agent Manager view |
| Architecture | In-process or tmux, single session | Separate workspaces per agent |
| Shared task list | ✅ Programmatic, shared `~/.claude/tasks/` | ❌ Per-workspace, no shared task list |
| Direct messaging | ✅ `SendMessage` tool between teammates | ❌ No inter-agent messaging |
| Lifecycle hooks | `TeammateIdle`, `TaskCreated`, `TaskCompleted` | Not available (Antigravity hooks use different events) |
| Config setting | `teammateMode: "auto"/"in-process"/"tmux"` | No equivalent setting |

### Antigravity Parallel Agent Workflow

Since Antigravity lacks in-process agent teams, use the **multi-workspace approach**:

1. Open Agent Manager (separate from the editor view)
2. Add multiple workspaces — one per specialist agent
3. Assign tasks via natural language in each workspace
4. Monitor progress via the Inbox
5. Approve or redirect pending actions

> **PM Gateway note**: In Antigravity sessions, the PM Gateway workflow runs within a single workspace session. For parallel work, use the Gemini CLI subagent dispatch (`invoke_subagent`) rather than Agent Teams.

### GEMINI.md Equivalent Settings

Antigravity does not have `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` or `teammateMode` equivalents. The following settings.json keys from CLAUDE.md are **Claude Code–only**:
- `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
- `teammateMode`
- Hook events: `TeammateIdle`, `TaskCreated`, `TaskCompleted`

#### teammateMode (Claude Code Agent Teams execution mode)

**teammateMode** specifies the parallel execution mode when Agent Teams is enabled in Claude Code.

**Values**:
- `in-process` — Parallel execution within the same process (applies to both Claude Code CLI and Desktop App)
- `tmux` — Parallel execution using tmux split-pane (Claude Code CLI only, not supported in Desktop App)
- `null` — Default value (auto-selects based on environment)

**Configuration location**: `.claude/settings.json` → `teammateMode`

**Note**: Antigravity does not have an equivalent to Agent Teams, so teammateMode is a Claude Code-specific setting. Antigravity 2.0+ uses Agent Manager to manage multiple workspace shards.

**Relationship to execution plan table**: teammateMode controls parallel execution mode. The execution plan table defines the multi-agent task dispatch.

---

*Last Updated: 2026-06-28 — added §5 Skill Resolution Priority; added §6 CLAUDE.md/GEMINI.md lifecycle row; added lifecycle-manager and auditor sequence to boilerplate; removed obsolete physical pm approval hooks*




