# CLAUDE.md

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.**
<!-- L0-ONLY: This instruction targets the workspace root (L0). L1/L2 projects must NOT reference CONSTITUTION.md — see CONSTITUTION.md §7.5 CONSTITUTION.md Non-Propagation. merge-frontmatter.ts strips CONSTITUTION.md lines from L2 output. -->

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model | platform)
2. Only then invoke the `Agent` tool to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Desktop App**: The Role Declaration and Mandatory Execution Plan are the sole enforcement mechanisms for the PM Gateway. Treat them as strictly binding.

---

## Claude Code-Specific Behaviors

### 1. Automated Hooks (`.claude/settings.json`)
The workspace `.claude/settings.json` currently has **two active hook types**:

- **SessionStart** — runs `git config core.hooksPath .githooks` (async) to ensure git hooks are configured at the start of each session.
- **PostToolUse** is **enabled** — fires `bun scripts/audit.ts` (async) after every Write/Edit on the CLI.

To disable the PostToolUse hook, remove the following block from `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bun scripts/audit.ts"
          }
        ]
      }
    ]
  }
}
```

> ⚠️ **Desktop App limitation**: `PostToolUse` hooks do **not** fire in the Claude Code Desktop App even when configured. After any Write or Edit in the Desktop App, run `bun scripts/audit.ts` manually before committing.

| Hook | Environment | Active? | Notes |
|------|-------------|:-------:|-------|
| SessionStart (git hooks) | Claude Code CLI | ✅ | runs `git config core.hooksPath .githooks` |
| SessionStart (git hooks) | Claude Code Desktop App | ✅ | hooks don't fire; run manually |
| PostToolUse (audit) | Claude Code CLI | ✅ | Runs `bun scripts/audit.ts` async after every Write/Edit |
| PostToolUse (audit) | Claude Code Desktop App | ✅ | Hooks don't fire; run `bun scripts/audit.ts` manually |
| TeammateIdle (lifecycle) | Claude Code CLI | ✅ | Runs `bun scripts/hooks/post-write-lifecycle-check.ts` async when teammate becomes idle |
| TeammateIdle (lifecycle) | Claude Code Desktop App | ✅ | Hooks don't fire; run manually |
| TaskCompleted (QA gate) | Claude Code CLI | ✅ | Runs `bun scripts/audit.ts` async when a task is marked complete |
| TaskCompleted (QA gate) | Claude Code Desktop App | ✅ | Hooks don't fire; run manually |

**Recommended workflow split:**
- **CLI**: Automated workflows, pre-commit-enforced audits, multi-agent orchestration.
- **Desktop App**: PR monitoring, visual diff reviews, parallel sessions.

#### Agent Teams (Experimental)

Agent Teams allow multiple Claude Code instances to work in parallel with a shared task list and direct inter-agent messaging. Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`.

**Key settings** (already configured in `.claude/settings.json`):

| Setting | Value | Description |
|---------|-------|-------------|
| `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` | Enables the feature (experimental, requires v2.1.32+) |
| `teammateMode` | `"auto"` | Uses tmux split-pane if inside tmux, in-process otherwise |

**New hooks** (fires during agent team sessions):

| Hook | Trigger | Action |
|------|---------|--------|
| `TeammateIdle` | Teammate finishes work | Runs `post-write-lifecycle-check.ts` — validates lifecycle state |
| `TaskCompleted` | Task marked complete | Runs `audit.ts` — full QA gate |

**Desktop App limitations** — Agent Teams in the Desktop App have significant restrictions:

| Capability | CLI | Desktop App |
|-----------|-----|-------------|
| Feature activation (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) | ✅ | ✅ (settings.json loaded) |
| in-process mode | ✅ | ⚠️ Functional but `Shift+Down` navigation unavailable |
| tmux split-pane mode | ✅ | ❌ Not supported |
| `TeammateIdle` / `TaskCompleted` hooks fire | ✅ | ❌ Hooks do not fire (same as PostToolUse) |

> **Desktop App recommendation**: Use `teammateMode: "in-process"` explicitly. Hooks will not fire — run `bun scripts/audit.ts` manually after each teammate completes work.

**PM workflow integration**: When using Agent Teams, the PM Gateway still applies. Dispatch specialist agents as teammates using their `agents/<name>.md` definitions:

```text
Spawn a teammate using the automation-engineer agent type to implement the script per the approved plan.
```

> ⚠️ **Platform support summary**:
> - **Claude Code CLI** ✅ Full support
> - **Claude Code Desktop App** ⚠️ Partial — in-process only, no hooks, no tmux
> - **Antigravity CLI** ❌ Not supported — use Agent Manager (UI-based) instead. See GEMINI.md §Agent Manager.

<!-- COMMON-CLAUDE:START -->
#### teammateMode (Claude Code Agent Teams execution mode)

**teammateMode** specifies the parallel execution mode when Agent Teams is enabled in Claude Code.

**Values**:
- `in-process` — Parallel execution within the same process (applies to both Claude Code CLI and Desktop App)
- `tmux` — Parallel execution using tmux split-pane (Claude Code CLI only, not supported in Desktop App)
- `null` — Default value (auto-selects based on environment)

**Configuration location**: `.claude/settings.json` → `teammateMode`

**Note**: Antigravity does not have an equivalent to Agent Teams, so teammateMode is a Claude Code-specific setting. Antigravity 2.0+ uses Agent Manager to manage multiple workspace shards.

**Relationship to execution plan table**: teammateMode controls parallel execution mode. The execution plan table defines the multi-agent task dispatch.
<!-- COMMON-CLAUDE:END -->

### 2. Native Slash Commands
Custom slash commands in `.claude/commands/` are natively recognized by Claude Code. The following commands are available at session start:

| Command | Purpose | Underlying Trigger |
|---------|---------|--------------------|
| `/sync "feat: ..."` | Full pipeline - memlog → sync-md → changelog → audit → commit → PR | `scripts/dev-sync.ts` |
| `/changelog "..."` | Add entry to `CHANGELOG.md [Unreleased]` | Pre-sync user-facing changelog entry |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only | Without triggering full sync |
| `/new-task "name"` | Create task block in today's memory log | In-session task tracking |
| `/new-project "name"` | Scaffold a new project | `bun scripts/new-project.ts "$ARGUMENTS"` |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill. All 5 commands above have corresponding files in `.claude/commands/`.

> **Platform parity**: every command file in `.claude/commands/` must have a matching file in `.gemini/commands/`. Intentional Claude-only exceptions use `gemini-parity: skip` in frontmatter. See [CONSTITUTION.md §6 — Cross-Platform Deployment Rule](docs/constitution/06-skill-lifecycle.md#cross-platform-deployment-rule).

> **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` or `git push` calls via bash/powershell/run_command are **FORBIDDEN**. The pre-commit hook blocks direct commits unless executed through `/sync`. Never manipulate environment variables (e.g., `$env:SYNC_ACTIVE=1; git commit`) to bypass QA gates. All commits MUST go through the approved `/sync` pipeline or `dev-sync.ts`. **`--no-verify` is also forbidden**.

> **Sequential Branch Dependency Rule**: Before running `/sync` to open a new PR while a prior PR from the same session is still open and unmerged, merge the prior PR first (or explicitly justify parallel branching in a plan/design doc). `dev-sync.ts` touches shared pipeline files (CHANGELOG.md, memory logs, VERSION_MANIFEST.md, generated READMEs) on every commit, so unmerged parallel branches conflict by default, not by exception. Full rule: CONSTITUTION.md §3.3.

### 3. MCP Configurations & Absolute Resolving
Config file: `.mcp.json` (project root) - auto-loaded by both the CLI and the Desktop App.
* **Path Resolving**: relative paths (e.g., `./server` or `python scripts/mcp.py`) are automatically resolved by Claude Code relative to the individual project's root folder. When defining commands inside `.mcp.json`, always keep command executable paths relative to the project directory for portable cross-platform runs.

<!-- COMMON-CLAUDE:START -->
### 4. Language Policy for Documentation

All `.md` files you create or modify MUST be in English, except in `ko/` or `locales/ko/` directories (Korean translation zones) or when explicitly declared as a Korean legal/regulatory content exception.

- README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md — English only
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
*(Not available for: agents/*.md, skills/*.md, CONSTITUTION.md, CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md)*
<!-- COMMON-CLAUDE:END -->

### 4.5 Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location |
|----------|--------|----------|
| **1 (highest)** | Local project skills | `skills/<name>/SKILL.md` in the current working directory |
| **2** | Platform config skills | `.gemini/skills/` or `.claude/skills/` in the project root |
| **3 (lowest)** | Global plugin skills | e.g., `superpowers/brainstorming`, `superpowers/writing-plans` |

**Rule**: If a local skill's `metadata.triggers` matches the user request, use it — do **not** fall through to a global plugin with overlapping intent.

**Canonical conflict — meeting vs. brainstorming**:

| User says | Correct skill | Priority |
|-----------|--------------|----------|
| "meeting", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the local skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

For the **4-level enforcement model**, **mandatory criteria**, **execution plan format**, and **phase determination**, see [AGENTS.md §3 and §5](AGENTS.md).

#### Claude Code-Specific Dispatch

Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table prior to invoking the `Agent` tool.

<!-- COMMON-CLAUDE:START -->
## Execution Plan Boilerplate

The execution plan table format, the Design Gate (Row 0) rule, exemption categories, and the `/sync`-as-final-step rule are the Single Source of Truth in **[AGENTS.md §5.1 Standard Execution Plan Template](AGENTS.md#51-standard-execution-plan-template)** and **[§5.1.1 Design Gate Exemptions](AGENTS.md#511-design-gate-exemptions)** — do not restate them here.

> **Note (Claude Code-specific)**: The `Model` column shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-4-6`). See §6 (Native Sub-agents) below for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent note).
<!-- Note: `fable` is a forward-looking alias not yet registered in docs/workspace-schema.json; do not use until added to the schema -->

**Claude Code execution**: Use the native `Agent` tool for specialist dispatch. See §6 (Native Sub-agents) and §7 (Native Plan Mode) in this file.
<!-- COMMON-CLAUDE:END -->

### 6. Native Sub-agents (`Agent` Tool)
Use the native `Agent` tool to spawn sub-agents for parallel or isolated tasks. Sub-agents load their role-based configurations from `agents/<name>.md`.

> **Agent Architecture**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](CONSTITUTION.md#5-multi-agent-architecture) for governance rules.
> **Agent Roster**: See [AGENTS.md](AGENTS.md) for the canonical index of all available agents.
> **docs-writer tier**: Medium (claude-sonnet-4-6) — upgraded from Low per 2026-05-28 team restructuring.

**Agent Dispatch** - use the `Agent` tool (not a bash CLI command):
```
Agent(
  description   = "Implement automation script",
  prompt        = "You are an automation engineer. [paste agents/automation-engineer.md content here]\n\nTask: Implement the script per the approved plan.",
  subagent_type = "claude",  // platform agent type; embed the agents/<name>.md role definition in the prompt
  model         = "haiku"    // automation-engineer is Low-tier (registry: claude-haiku-4-5) — see registry→model mapping below
)
```

> **Registry name → `model` parameter mapping**: `docs/workspace-schema.json` and the tables above name models by full registry ID (e.g. `claude-opus-4-7`) for cross-platform documentation. The native `Agent` tool's `model` parameter only accepts the short aliases `sonnet | opus | haiku | fable`. <!-- Note: `fable` is a forward-looking alias not yet registered in workspace-schema.json --> When dispatching, translate the agent's tier to its registry model, then to the matching alias: High → `claude-opus-4-7` → `model = "opus"`; Medium → `claude-sonnet-4-6` → `model = "sonnet"`; Low → `claude-haiku-4-5` → `model = "haiku"`. Omitting `model` lets the subagent fall back to its frontmatter (`model: inherit`), which inherits the parent session's model instead of the tier-appropriate one — always set `model` explicitly to actually get the cost-tier benefit.

Each implementation task follows the **Phase 4 execution loop** (see [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster)):
1. **automation-engineer** implements the changes (or code-writer for project-specific agents).
2. **PM** verifies against acceptance criteria by running `bun scripts/audit.ts` directly.
3. **Quality gate (audit script)** validates compliance.

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

#### Cost Optimization (3-Tier Model Strategy)
The High/Medium/Low tier concept and its usage rules are the Single Source of Truth in [AGENTS.md §3.6 3-Tier Strategy](AGENTS.md#36-3-tier-strategy). Claude Code's model-ID mapping (overridden per agent invocation when appropriate):
- **High-tier** → `claude-opus-4-7`
- **Medium-tier** → `claude-sonnet-4-6`
- **Low-tier** → `claude-haiku-4-5`

<!-- COMMON-CLAUDE:START -->
### 7. Native Plan Mode (`EnterPlanMode`)
Enter native plan mode using the `EnterPlanMode` tool when:
- The user requests a new feature or significant refactor.
- The change modifies more than 2 files.
- The correct approach is unclear or requires clarifying assumptions.

Once in plan mode:
1. Draft the implementation plan and present it for user review.
2. Obtain explicit user approval before modifying any code.
3. Track progress using the native `TaskCreate` / `TaskUpdate` toolset.
4. After completion, summarize outcomes in the active `memory/YYYY-MM-DD.md` daily log.
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 8. Task Tracking (`TaskCreate` / `TaskUpdate`)
When working in a plan-mode session:
- Call `TaskCreate` before starting any multi-step execution.
- Set status `in_progress` prior to beginning each atomic step.
- Update status to `completed` immediately upon verification of the step.
- Never leave tasks `in_progress` at the end of a session.
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 9. Workspace & Template Boundary Policy

- **Strict CWD Isolation**: When modifying templates (in `templates/`), you MUST strictly limit your working directory (CWD) to the specific template folder.
- **No Cross-Modification**: Modifying workspace root files and template files in a single task or session is forbidden. Keep workspace root changes and template changes completely isolated.

> For L1-L2 Fork Model and lifecycle management rules, see [CONSTITUTION.md §9](docs/constitution/09-operations-workflow.md) and [CONSTITUTION.md §10](CONSTITUTION.md#10-terminology--canonical-definitions).
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 10. Custom Command Error Recovery
If a custom slash command or background script returns a non-zero exit code:
* **Don't bypass hooks**: Never attempt to run git commands with `--no-verify` to bypass the hook system unless under explicit, written user instruction.
* **Code Page / UTF-8 Issues (Windows)**: If broken Korean characters or Unicode errors appear in CLI output, the Windows terminal code page (CP949) is likely the cause. Ensure `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` or `chcp 65001` is prepended to scripts.
* **Diagnostic Audit**: Immediately read the failure stdout log. Common errors include:
  * Missing staged `CHANGELOG.md` edits (caught by `pre-commit`). Fix by running `/changelog` and staging the file.
  * Direct push attempt to `main` (caught by `pre-push`). Fix by executing the `/sync` pipeline script which handles target branch generation and PR staging automatically.
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 11. Windows Platform Requirement

**Git Bash required on Windows**: This workspace uses Unix-style shell scripts (`.sh`) for `.githooks/` hook files. Windows users must have Git Bash installed and configured as the default shell for git hooks.

- Git Bash ships with [Git for Windows](https://gitforwindows.org/) — install if not present.
- Verify: `git config core.hooksPath` should point to `.githooks/`
- All `scripts/` operational scripts are TypeScript (`.ts`) — run via `bun scripts/<name>.ts`. No `.sh/.ps1` counterparts (ADR-0036).
- If a hook fails on Windows with "command not found", run it via Git Bash: `"C:\Program Files\Git\bin\bash.exe" .githooks/pre-commit`
<!-- COMMON-CLAUDE:END -->

---

<!-- COMMON-CLAUDE:START -->
## Git & PR Additions (Claude Code)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Claude Code-specific additions:

- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.

*Last Updated: 2026-07-11 — removed redundant N-1/N boilerplate rows; /sync already covers lifecycle + audit + commit + push + PR; previous: 2026-06-21 inlined N-1/N rows*
<!-- COMMON-CLAUDE:END -->


