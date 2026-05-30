# CLAUDE.md

> **Doc intent:** This file is Claude Code-specific behavioral configuration for the **workspace root** (`C:\git\`).
> Shared workspace standards, project structure, and design philosophy live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.
> For Gemini/Antigravity-specific behaviors, see [`GEMINI.md`](GEMINI.md).

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Never directly use the following tools for state-changing operations without PM approval (`.pm-approved` flag):**
- `Write`, `Edit` — file creation or modification
- `Bash` — unless strictly read-only: `git log/status/diff`, `ls`, `grep`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`

**For ALL multi-step tasks (2+ files or 2+ sequential steps):**
1. Display execution plan table first (task | agent | tier | model)
2. Only then invoke the `Agent` tool to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Desktop App**: `PreToolUse` hooks are inactive. This Role Declaration is the sole enforcement mechanism. Treat it as binding.

---

## Claude Code-Specific Behaviors

### 1. Automated Hooks (`.claude/settings.json`)
The workspace `.claude/settings.json` currently has **three active hook types**:

- **PreToolUse** (`Write|Edit|Bash`) → runs `bun scripts/check-pm-approval.ts` before any state-changing tool call, enforcing the PM-approval gate (`.pm-approved` flag).
- **SessionStart** → runs `bun scripts/clear-pm-approval.ts` at the start of each session to reset approval state. Also runs `git config core.hooksPath .githooks` (async) to ensure git hooks are configured.
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

> ⚠️ **Desktop App limitation**: `PreToolUse` and `PostToolUse` hooks do **not** fire in the Claude Code Desktop App even when configured. After any Write or Edit in the Desktop App, run `bun scripts/audit.ts` manually before committing. The Role Declaration in this file is the sole PM-approval enforcement mechanism in the Desktop App.

| Hook | Environment | Active? | Notes |
|------|-------------|:-------:|-------|
| PreToolUse (PM-approval gate) | Claude Code CLI | ✅ | Blocks Write/Edit/Bash without `.pm-approved` |
| PreToolUse (PM-approval gate) | Claude Code Desktop App | ❌ | Role Declaration enforces instead |
| SessionStart (state clear) | Claude Code CLI | ✅ | Clears `.pm-approved`; also runs `git config core.hooksPath .githooks` |
| SessionStart (state clear) | Claude Code Desktop App | ❌ | No automatic clear |
| PostToolUse (audit) | Claude Code CLI | ✅ | Runs `bun scripts/audit.ts` async after every Write/Edit |
| PostToolUse (audit) | Claude Code Desktop App | ❌ | Hooks don't fire; run `bun scripts/audit.ts` manually |

**Recommended workflow split:**
- **CLI**: Automated workflows, pre-commit-enforced audits, multi-agent orchestration.
- **Desktop App**: PR monitoring, visual diff reviews, parallel sessions.

### 2. Native Slash Commands
Custom slash commands in `.claude/commands/` are natively recognized by Claude Code. The following commands are available at session start:

| Command | Purpose | Underlying Trigger |
|---------|---------|--------------------|
| `/sync "feat: ..."` | Full pipeline - memlog → sync-md → changelog → audit → commit → PR | `scripts/dev-sync.ts` |
| `/changelog "..."` | Add entry to `CHANGELOG.md [Unreleased]` | Pre-sync user-facing changelog entry |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only | Without triggering full sync |
| `/new-task "name"` | Create task block in today's memory log | In-session task tracking |
| `/new-project "name"` | Scaffold a new project | `.\scripts\new-project.ps1 "$ARGUMENTS"` |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill. All 5 commands above have corresponding files in `.claude/commands/`.

> **Platform parity**: every command file in `.claude/commands/` must have a matching file in `.gemini/commands/`. Intentional Claude-only exceptions use `gemini-parity: skip` in frontmatter. See [CONSTITUTION.md §6 — Cross-Platform Deployment Rule](docs/constitution/06-skill-lifecycle.md#cross-platform-deployment-rule).

### 3. MCP Configurations & Absolute Resolving
Config file: `.mcp.json` (project root) - auto-loaded by both the CLI and the Desktop App.
* **Path Resolving**: relative paths (e.g., `./server` or `python scripts/mcp.py`) are automatically resolved by Claude Code relative to the individual project's root folder. When defining commands inside `.mcp.json`, always keep command executable paths relative to the project directory for portable cross-platform runs.

### 4. Language Policy for Documentation

All `.md` files you create or modify MUST be in English, except when working in `ko/` or `locales/ko/` directories (Korean translation zones).

- README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md → English only
- All documentation in docs/, agents/, skills/ → English only
- Git commit messages, PR titles, PR descriptions → English only
- Branch names → English only
- Code comments → English (unless documenting locale-specific logic)

### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.
This is enforced at 4 levels - tool, system prompt, agent file, and QA gate.

#### Level 1: Tool-Level Enforcement (Primary - Hard Enforcement)
- Agent tool automatically rejects non-PM specialist calls
- Bypass: Impossible

#### Level 2: System Prompt-Level Enforcement (Secondary)
- This section is enforced via system prompt priority
- CLAUDE.md Agent Dispatch Rules are loaded first

#### Level 3: Agent File-Level Enforcement (Tertiary)
- All specialist agents have "⚠️ PM-ONLY INVOCATION" section
- Agents refuse direct requests and redirect to PM

#### Level 4: QA Gate-Level Enforcement (Quarternary)
- Auditor detects PM bypass in Phase 5 QA
- Post-hoc detection - prevents commits but not execution

#### Forbidden Direct Calls
❌ DO NOT: `Agent(tool, subagent_type="architect")`
❌ DO NOT: "Architect, design X"
❌ DO NOT: Direct specialist invocation without PM triage

#### Correct Workflow
1. Submit request to PM: "PM, design X architecture"
2. PM triages → dispatches specialist → synthesizes results
3. PM enforces QA gate → approves completion

#### Mandatory Execution Plan Display
Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table in the user's active language prior to invoking the Agent tool:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task] | [agent] | High/Medium/Low | opus/sonnet/haiku |

State parallel vs sequential order below the table. The Agent tool must not be called until this table is visible to the user.

#### Specialist Agent List
All agents below require PM dispatch:
- architect (Phase 1-2)
- auditor (Phase 5)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- scaffolding-expert (Phase 0)
- security-expert (Phase 5)
- lifecycle-manager (Phase 6)

### 5. Native Sub-agents (`Agent` Tool)
Use the native `Agent` tool to spawn sub-agents for parallel or isolated tasks. Sub-agents load their role-based configurations from `agents/<name>.md`.

> **Agent Architecture**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](CONSTITUTION.md#5-multi-agent-architecture) for governance rules.
> **Agent Roster**: See [AGENTS.md](AGENTS.md) for the canonical index of all available agents.
> **docs-writer tier**: Medium (claude-sonnet-4-6) — upgraded from Low per 2026-05-28 team restructuring.

**Agent Dispatch** - use the `Agent` tool (not a bash CLI command):
```
Agent(
  description   = "Implement automation script",
  prompt        = "You are an automation engineer. [paste agents/automation-engineer.md content here]\n\nTask: Implement the script per the approved plan.",
  subagent_type = "claude"   // platform agent type; embed the agents/<name>.md role definition in the prompt
)
```

Each implementation task follows the **Phase 4 execution loop** (see [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster)):
1. **automation-engineer** implements the changes (or code-writer for project-specific agents).
2. **auditor** verifies against acceptance criteria and consistency.
3. **Quality gate (audit script)** validates compliance.

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy (see [AGENTS.md - Superpowers Plugin](AGENTS.md#superpowers-plugin--cost-optimization-3-tier-strategy)):
**Model Selection Overrides** (overridden per agent invocation when appropriate):
- **High-tier (Design/Planning)** ➔ `claude-opus-4-7`: Complex analysis, architectural refactoring, or PM orchestration.
- **Medium-tier (Review/QA)** ➔ `claude-sonnet-4.6`: Code review, testing, standard implementation logic, and quality gates. Supervises the Low-tier.
- **Low-tier (Execution/Coding)** ➔ `claude-haiku-4-5`: Simple transformations, boilerplate generation, or strictly scoped sub-agent tasks.

### 6. Native Plan Mode (`EnterPlanMode`)
Enter native plan mode using the `EnterPlanMode` tool when:
- The user requests a new feature or significant refactor.
- The change modifies more than 2 files.
- The correct approach is unclear or requires clarifying assumptions.

Once in plan mode:
1. Draft the implementation plan and present it for user review.
2. Obtain explicit user approval before modifying any code.
3. Track progress using the native `TaskCreate` / `TaskUpdate` toolset.
4. After completion, summarize outcomes in the active `memory/YYYY-MM-DD.md` daily log.

### 7. Task Tracking (`TaskCreate` / `TaskUpdate`)
When working in a plan-mode session:
- Call `TaskCreate` before starting any multi-step execution.
- Set status `in_progress` prior to beginning each atomic step.
- Update status to `completed` immediately upon verification of the step.
- Never leave tasks `in_progress` at the end of a session.

### 8. Lifecycle Management Rules

> ⚠️ If unsure whether a change requires lifecycle updates, run `bun scripts/audit.ts` before committing. Do NOT skip this step.

When modifying files, apply the following rules **before** running `/sync` or committing:

| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| `scripts/*.ts` | 1. Bump `@version` in file header  2. Update version in `scripts/SCRIPTS.md`  3. Copy file to `templates/common/scripts/` and update `templates/common/scripts/SCRIPTS.md` |
| `agents/*.md` | Update `AGENTS.md` roster table — run `bun run agent:verify` to check |
| `skills/*/SKILL.md` or `.claude/skills/*/SKILL.md` | Update `AGENTS.md § Skills` table — run `bun scripts/skill-lifecycle-audit.ts` to check |
| `templates/common/scripts/*.ts` | Update version entry in `templates/common/scripts/SCRIPTS.md` |

**Verification** (run after any of the above):
```bash
bun scripts/audit.ts                  # full workspace audit including lifecycle sync
bun scripts/lifecycle-sync-audit.ts   # layer sync check (scripts + SCRIPTS.md versions)
```

> Full rules: [§5.6 Agent Lifecycle](docs/constitution/05.6-agent-lifecycle.md) · [§6 Skill Lifecycle](docs/constitution/06-skill-lifecycle.md) · [§6.5 Script Lifecycle](docs/constitution/06.5-script-lifecycle.md)

### 9. Custom Command Error Recovery
If a custom slash command or background script returns a non-zero exit code:
* **Don't bypass hooks**: Never attempt to run git commands with `--no-verify` to bypass the hook system unless under explicit, written user instruction.
* **Code Page / UTF-8 Issues (Windows)**: If broken Korean characters or Unicode errors appear in CLI output, the Windows terminal code page (CP949) is likely the cause. Ensure `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` or `chcp 65001` is prepended to scripts.
* **Diagnostic Audit**: Immediately read the failure stdout log. Common errors include:
  * Missing staged `CHANGELOG.md` edits (caught by `pre-commit`). Fix by running `/changelog` and staging the file.
  * Direct push attempt to `main` (caught by `pre-push`). Fix by executing the `/sync` pipeline script which handles target branch generation and PR staging automatically.

### 10. Windows Platform Requirement

**Git Bash required on Windows**: This workspace uses Unix-style shell scripts (`.sh`) for `.githooks/` hook files. Windows users must have Git Bash installed and configured as the default shell for git hooks.

- Git Bash ships with [Git for Windows](https://gitforwindows.org/) — install if not present.
- Verify: `git config core.hooksPath` should point to `.githooks/`
- `.ps1` counterparts are provided for `scripts/` Tier 1 scripts but **not** for all `.githooks/` hooks.
- If a hook fails on Windows with "command not found", run it via Git Bash: `"C:\Program Files\Git\bin\bash.exe" .githooks/pre-commit`

---

## Git & PR Additions (Claude Code)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Claude Code-specific additions:

- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.

*Last Updated: 2026-05-30*
