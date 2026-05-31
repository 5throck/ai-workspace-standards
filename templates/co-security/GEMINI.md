# GEMINI.md

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.**

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model)
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
| **Command Execution** | `run_command` | Execute PowerShell/Bash shell commands. Returns task process IDs. NEVER use `cd` commands. NEVER run `git commit --no-verify` or `git push --no-verify` — forbidden in this workspace. All commits must go through `bun scripts/dev-sync.ts` (sets `SYNC_ACTIVE=1`). Direct `git commit` calls are blocked by pre-commit hook. |

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
    | N-1 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | lifecycle-manager (workspace) / pm (variant) | Medium | [Model String] |
    | N | Final QA Audit (bun scripts/audit.ts) | auditor (workspace) / pm (variant) | Medium | [Model String] |

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

#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy (see [AGENTS.md - Superpowers Plugin](AGENTS.md#superpowers-plugin--cost-optimization-3-tier-strategy)):
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** → `gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** → `gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** → `gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.

---

### 4. Language Policy for Documentation

All `.md` files you create or modify MUST be in English, except when working in `ko/` or `locales/ko/` directories (Korean translation zones).

- README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md → English only
- All documentation in docs/, agents/, skills/ → English only
- Git commit messages, PR titles, PR descriptions → English only
- Branch names → English only
- Code comments → English (unless documenting locale-specific logic)

### 5. Agent Dispatch Rules

See [CONSTITUTION.md §5](docs/constitution/05-multi-agent-architecture.md) for the 4-level enforcement model and governance rules.

#### Mandatory Execution Plan Display
Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table in the user's active language prior to invoking the Agent tool:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task] | [agent] | High/Medium/Low | high/medium/low |

State parallel vs sequential order below the table. The Agent tool must not be called until this table is visible to the user.

#### Specialist Agent List
All agents below require PM dispatch:
- red-team-lead (Phase 1, 3)
- threat-modeler (Phase 2-3)
- pentester (Phase 3, 6)
- patch-engineer (Phase 4, 6)
- report-writer (Phase 5)
- security-expert (Phase 5 — pentest methodology QA)

#### Permission Denial Protocol

When a specialist agent's required tool is denied by the user, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

See [`agents/pm.md` — Permission Denial Protocol](agents/pm.md#permission-denial-protocol) for the full Type classification table and Escalation Template.

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

### 6. Lifecycle Management Rules

> ⚠️ If unsure whether a change requires lifecycle updates, run `bun scripts/audit.ts` before committing. Do NOT skip this step.

When modifying files, apply the following rules **before** running `/sync` or committing:

| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| `scripts/*.ts` | 1. Bump `@version` in file header  2. Update version in `scripts/SCRIPTS.md`  3. Copy file to `templates/common/scripts/` and update `templates/common/scripts/SCRIPTS.md` |
| `agents/*.md` | Update `AGENTS.md` roster table — run `bun run agent:verify` to check |
| `skills/*/SKILL.md` or `.claude/skills/*/SKILL.md` | Update `AGENTS.md § Skills` table — run `bun scripts/skill-lifecycle-audit.ts` to check |
| `templates/common/scripts/*.ts` | Update version entry in `templates/common/scripts/SCRIPTS.md` |
| `CLAUDE.md` or `GEMINI.md` | 1. Apply identical change to the counterpart file (Platform Documentation Parity — CONSTITUTION.md §10)  2. Manually propagate to all `templates/*/CLAUDE.md` and `templates/*/GEMINI.md`  3. Run `bun scripts/validate-templates.ts` — must pass P-01 platform parity check |

**Verification** (run after any of the above):
```bash
bun scripts/audit.ts                  # full workspace audit including lifecycle sync
bun scripts/lifecycle-sync-audit.ts   # layer sync check (scripts + SCRIPTS.md versions)
```

> Full rules: [§5.6 Agent Lifecycle](docs/constitution/05.6-agent-lifecycle.md) · [§6 Skill Lifecycle](docs/constitution/06-skill-lifecycle.md) · [§6.5 Script Lifecycle](docs/constitution/06.5-script-lifecycle.md)

---

## Git & PR Additions (Gemini)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Gemini-specific additions:

- **PostToolUse Limitation**: PostToolUse hooks are **disabled** in Gemini/Antigravity sessions. Manually execute `dev-sync` or audit scripts (`bun scripts/audit.ts` or `scripts/audit.ps1`) after local edits, and run commits at task boundaries.
- **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` calls are blocked by the pre-commit hook unless executed through `/sync`. The hook checks for `SYNC_ACTIVE=1` which only `dev-sync.ts` sets. If you see `[FAIL] Direct git commits are restricted`, run `/sync "type: description"` instead. **`--no-verify` is forbidden** — it bypasses secret scanning and all quality gates.
- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.
- **Windows: Git Bash required**: `.githooks/` hook files are Unix shell scripts. Windows users must have Git Bash installed. Run `git config core.hooksPath .githooks` to activate hooks. `.ps1` counterparts exist for `scripts/` Tier 1 scripts but not all hooks.

*Last Updated: 2026-05-31 — added §5 Skill Resolution Priority; added §6 CLAUDE.md/GEMINI.md lifecycle row; added lifecycle-manager and auditor sequence to boilerplate; removed obsolete physical pm approval hooks*


For private repos: skip the security gate entirely.

---

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->

---

## Security Engagement Rules

These rules are **enforced by the PM Role Declaration** and must be followed in every Antigravity session:

1. **Authorization first** — No Phase 1+ work (recon, exploitation, patching) may begin without the `verify-authorization` skill confirming a signed authorization document exists.
2. **Scope enforcement** — Any target not listed in `docs/scope.md` is out-of-scope. PM must update scope and re-run authorization before expanding.
3. **Secret hygiene** — Credentials, API keys, and passwords discovered during engagements must NEVER be committed. Store in `docs/findings/FIND-NNNN.md` with values redacted.
4. **Ansible dry-run first** — All patch automation must run with `--check` flag before live apply.
5. **Engagement log** — All agent actions are logged to `memory/engagement-YYYY-MM-DD.md`.
