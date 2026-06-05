# CLAUDE.md

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.**

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
| `/new-project "name"` | Scaffold a new project | `.\scripts\new-project.ps1 "$ARGUMENTS"` |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill. All 5 commands above have corresponding files in `.claude/commands/`.

> **Platform parity**: every command file in `.claude/commands/` must have a matching file in `.gemini/commands/`. Intentional Claude-only exceptions use `gemini-parity: skip` in frontmatter. See [CONSTITUTION.md §6 — Cross-Platform Deployment Rule](docs/constitution/06-skill-lifecycle.md#cross-platform-deployment-rule).

> **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` or `git push` calls via bash/powershell/run_command are **FORBIDDEN**. The pre-commit hook blocks direct commits unless executed through `/sync`. Never manipulate environment variables (e.g., `$env:SYNC_ACTIVE=1; git commit`) to bypass QA gates. All commits MUST go through the approved `/sync` pipeline or `dev-sync.ts`. **`--no-verify` is also forbidden**.

### 3. MCP Configurations & Absolute Resolving
Config file: `.mcp.json` (project root) - auto-loaded by both the CLI and the Desktop App.
* **Path Resolving**: relative paths (e.g., `./server` or `python scripts/mcp.py`) are automatically resolved by Claude Code relative to the individual project's root folder. When defining commands inside `.mcp.json`, always keep command executable paths relative to the project directory for portable cross-platform runs.

<!-- COMMON-CLAUDE:START -->
### 4. Language Policy for Documentation

All `.md` files you create or modify MUST be in English, except when working in `ko/` or `locales/ko/` directories (Korean translation zones).

- README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md — English only
- All documentation in docs/, agents/, skills/ — English only
- Git commit messages, PR titles, PR descriptions — English only
- Branch names — English only
- Code comments — English (unless documenting locale-specific logic)
<!-- COMMON-CLAUDE:END -->

### Skill Resolution Priority

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

See [CONSTITUTION.md §5](docs/constitution/05-multi-agent-architecture.md) for the 4-level enforcement model and governance rules.

#### Mandatory Execution Plan Display

Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table in the user's active language prior to invoking the Agent tool.

**Mandatory Criteria** (Boilerplate always required when ANY applies):

1. **Multi-agent Dispatch**: 2 or more specialists involved
2. **Breaking Changes**: Modifications that break existing functionality
3. **Platform Parity Changes**: Changes to CLAUDE.md/GEMINI.md sync
4. **Lifecycle-Related Items** (NEW):
   - agents/*.md modifications → Requires AGENTS.md update
   - skills/*/SKILL.md modifications → Requires AGENTS.md update
   - scripts/*.ts modifications → Requires SCRIPTS.md update
   - docs/adr/*.md modifications → Requires ADR index update
5. **Root Configuration Changes** (NEW):
   - CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md
   - README.md, CHANGELOG.md

**Boilerplate Format**:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task] | [agent] | High/Medium/Low | opus/sonnet/haiku |
| N-1 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | lifecycle-manager (workspace) / pm (variant) | Medium | [Model String] |
| N | Final QA Audit (bun scripts/audit.ts) | auditor (workspace) / pm (variant) | Medium | [Model String] |

State parallel vs sequential order below the table. The Agent tool must not be called until this table is visible to the user.
*Rule: You MUST always include the Lifecycle Update followed by the Final QA Audit as the final two steps of the plan.*
*Context rule: At **workspace root**, dispatch `lifecycle-manager` for N-1 and `auditor` for N. In **variant projects**, PM handles both directly. Always declare context above the execution plan table: "**Context**: workspace root — specialist dispatch" or "**Context**: variant project — pm direct".*

**Platform Column Description**: Note: The execution plan table format has been simplified to remove the `Platform` column. PM will still internally manage the L0-only task classification.

<!-- COMMON-CLAUDE:START -->
## Execution Plan Boilerplate

Before dispatching 2+ agents, copy this exact format:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update agents/pm.md | docs-writer | Medium | claude-sonnet-4-6 |
| 2 | Update scripts/audit.ts | automation-engineer | Low | claude-haiku-4-5 |
| 3 | Update CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 4 | Update GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 5 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | lifecycle-manager | Medium | claude-sonnet-4-6 |
| 6 | Final QA Audit (bun scripts/audit.ts) | auditor | Medium | claude-sonnet-4-6 |

**Execution Order**: Sequential (platform parity requires CLAUDE.md and GEMINI.md updates together)

**Key points**:
- Tier column is MANDATORY (High/Medium/Low)
- Always include Lifecycle Update (N-1) and Final QA Audit (N) as final two steps
- State parallel vs sequential order below the table

#### Execution Plan Table Format Guidelines

**WRONG** (Do NOT use):
| # | Task | Agent |
| 1 | Update agents/pm.md | pm (direct) |

**CORRECT** (Use this format):
| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update agents/pm.md | docs-writer | Medium | gemini-3.5-flash |
| N-1 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | lifecycle-manager | Medium | gemini-3.5-flash |
| N | Final QA Audit (bun scripts/audit.ts) | auditor | Medium | gemini-3.5-flash |

**Key points**:
- "pm (direct)" is FORBIDDEN - PM never executes directly
- Always include Lifecycle Update (N-1) and Final QA Audit (N) as final two steps

#### Antigravity Security Configuration

For automated execution in Antigravity, configure `.gemini/settings.json`:

\`\`\`json
{
  "terminal.executionPolicy": "Auto",
  "artifact.reviewPolicy": "Request Review",
  "mcp.toolApproval": "Manual",
  "terminal.denyList": [
    "rm -rf",
    "rm -r /",
    "chmod -R 777",
    "git push --force",
    "git reset --hard",
    "reboot",
    "shutdown",
    "format",
    "fdisk",
    "mkfs"
  ]
}
\`\`\`

**Field Descriptions**:
- \`terminal.executionPolicy: "Auto"\` - Auto-approve agent spawns and safe commands
- \`artifact.reviewPolicy: "Request Review"\` - **Require review for file edits (recommended security setting)**
- \`mcp.toolApproval: "Manual"\` - Manual approval for MCP tools (security)
- \`terminal.denyList\` - Dangerous commands that must never auto-execute

**Security Rationale for "Request Review"**:
- ✅ **Prevents silent code corruption** - All file edits require explicit user approval before applying
- ✅ **Mitigates prompt injection attacks** - Human review layer blocks automated malicious edits
- ✅ **Maintains audit trail** - User acknowledges each change, creating clear accountability
- ✅ **Balances automation with oversight** - Agent spawning still automated, but file modifications supervised

**Security Notes**:
- ✅ Agent Spawn auto-approved (productivity)
- ✅ File edits require manual review (security)
- ✅ MCP Tools remain manual (external MCP server security)
- ⚠️ Terminal Auto mode still vulnerable to prompt injection (mitigated by denyList + artifact review)
- ⚠️ Recommend periodic Git commits (rollback capability)

**Trade-off**: Productivity vs Security
- **"Auto-Accept"** (not recommended): Full automation but vulnerable to silent code corruption
- **"Request Review"** (recommended): Balanced approach — automated agent orchestration with human supervision for file changes
- MCP tool auto-approval poses significant security risk → manual approval maintained regardless of artifact policy

> **Claude Code Note**: For Claude Code, the native Agent tool provides equivalent automated specialist dispatch functionality without requiring Auto-Mode infrastructure.
<!-- COMMON-CLAUDE:END -->


#### Phase Determination Checklist

Before writing the execution plan table, PM MUST classify each task's deliverable type:

| Deliverable Type | → Phase | → Required Agent | → Tier |
|-----------------|---------|-----------------|--------|
| New file design / schema / ADR | Phase 1-2 | architect | High |
| New directory or template layout | Phase 1-2 | architect | High |
| Cross-platform convention / naming standard | Phase 1-2 | architect | High |
| Script or code implementation (plan approved) | Phase 4 | automation-engineer | Low |
| Documentation update | Phase 4 | docs-writer | Medium |
| Security configuration | Phase 6 | security-expert | Medium |
| Project scaffolding | Phase 0 | scaffolding-expert | Low |

**Tier ceiling**: An agent's tier may NOT be elevated beyond its defined tier. `automation-engineer` is always Low — assigning it High is a critical governance violation.

**Platform Note**: PM will internally manage the L0-only task classification, though it is no longer required in the table.

#### PM Gateway Enforcement Summary

Pre-dispatch validation (run mentally before every execution plan):
1. ✅ Is each deliverable type correctly mapped to a Phase?
2. ✅ Does each task have the correct tier agent (no tier ceiling violations)?
3. ✅ Are Claude-only items paired with Antigravity equivalents, or marked `Claude` with justification?
4. ✅ Does the plan end with Lifecycle Update (N-1) and QA Audit (N)?

#### Specialist Agent List
All agents below require PM dispatch:
- architect (Phase 1-2)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- scaffolding-expert (Phase 0)
- security-expert (Phase 6)

#### Permission Denial Protocol

When a specialist agent's required tool is denied by the user, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

See [`agents/pm.md` — Permission Denial Protocol](agents/pm.md#permission-denial-protocol) for the full Type classification table and Escalation Template.

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
  subagent_type = "claude"   // platform agent type; embed the agents/<name>.md role definition in the prompt
)
```

Each implementation task follows the **Phase 4 execution loop** (see [AGENTS.md - Subagent Roster](AGENTS.md#subagent-roster)):
1. **automation-engineer** implements the changes (or code-writer for project-specific agents).
2. **PM** verifies against acceptance criteria by running `bun scripts/audit.ts` directly.
3. **Quality gate (audit script)** validates compliance.

> Loop and correct if review errors are flagged - maximum **3 iterations** before escalating to the user.

#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy (see [AGENTS.md - Superpowers Plugin](AGENTS.md#superpowers-plugin--cost-optimization-3-tier-strategy)):
**Model Selection Overrides** (overridden per agent invocation when appropriate):
- **High-tier (Design/Planning)** — `claude-opus-4-7`: Complex analysis, architectural refactoring, or PM orchestration.
- **Medium-tier (Review/QA)** — `claude-sonnet-4.6`: Code review, testing, standard implementation logic, and quality gates. Supervises the Low-tier.
- **Low-tier (Execution/Coding)** — `claude-haiku-4-5`: Simple transformations, boilerplate generation, or strictly scoped sub-agent tasks.

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

### L1-L2 Fork Model

After a variant (L2) is scaffolded from `templates/common` (L1) via `create-l2-scaffold.ts`, the L1→L2 relationship **ends**. L2 evolves independently.

**5 Fork Model Principles** (see [ADR-0031](docs/adr/0031-l1-l2-fork-model.md)):
1. L1 delivers common infrastructure to L2 at scaffold time — relationship ends after that.
2. L1 changes do **not** auto-propagate to L2 after fork.
3. To reflect L2 changes as an official template, run `l2-to-variant-pipeline.ts` explicitly.
4. L0→L1 publish runs automatically via `dev-sync.ts` (continuous pipeline).
5. L1 vs L2 drift can be reported with `publish-to-template.ts --check-drift` (read-only).

**`--docs` flag**: `bun scripts/publish-to-template.ts --docs` is an **explicit opt-in** tool that injects `COMMON-*` marked sections from L0 governance docs into L2 variants. It does not violate Fork Model independence because it requires deliberate invocation.

| Action | Command | Auto? |
|--------|---------|-------|
| L0→L1 publish | `bun scripts/publish-to-template.ts` | ✅ via dev-sync |
| L1→L2 scaffold (1×) | `bun scripts/create-l2-scaffold.ts` | Manual |
| L2→template promote | `bun scripts/l2-to-variant-pipeline.ts` | Manual |
| L1 vs L2 drift report | `bun scripts/publish-to-template.ts --check-drift` | Manual |
| L0 governance inject | `bun scripts/publish-to-template.ts --docs` | Manual (opt-in) |
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 10. Lifecycle Management Rules

> ⚠️ If unsure whether a change requires lifecycle updates, run `bun scripts/audit.ts` before committing. Do NOT skip this step.

When modifying files, apply the following rules **before** running `/sync` or committing:

| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| `scripts/*.ts` | 1. Bump `@version` in file header  2. Update version in `scripts/SCRIPTS.md`  3. Copy file to `templates/common/scripts/` and update `templates/common/scripts/SCRIPTS.md` |
| `templates/` (any file) | Run `bun scripts/tag-template.ts` to publish a new `template-v{VERSION}` git tag — only after all template changes are committed and verified via `bun scripts/audit.ts` |
| `agents/*.md` | Update `AGENTS.md` roster table — run `bun run agent:verify` to check |
| `templates/common/agents/*.md` | Sync identical file to ALL `templates/co-*/agents/` variants — run `bun run agent:verify` to confirm |
| `AGENTS.md` | Update `templates/co-*/AGENTS.md` if variant contains `pm` agent entry — run `bun run agent:verify` to check |
| `skills/*/SKILL.md` or `.claude/skills/*/SKILL.md` | Update `AGENTS.md § Skills` table — run `bun scripts/skill-lifecycle-audit.ts` to check |
| `templates/common/scripts/*.ts` | Update version entry in `templates/common/scripts/SCRIPTS.md` |
| `CLAUDE.md` or `GEMINI.md` | 1. Apply identical change to the counterpart file (Platform Documentation Parity — CONSTITUTION.md §10)  2. Manually propagate to all `templates/*/CLAUDE.md` and `templates/*/GEMINI.md`  3. Run `bun scripts/validate-templates.ts` — must pass P-01 platform parity check |
| `.claude/settings.json` | 1. Apply **shared** tier changes (mcpServers, hooks.SessionStart, hooks.PostToolUse) to `.gemini/settings.json`  2. **claude_only** tier changes (permissions, env, teammateMode, hooks.TeammateIdle/TaskCreated/TaskCompleted) do NOT require `.gemini/settings.json` update  3. Propagate to `templates/common/.claude/settings.json`  4. Propagate to all 4 variant `templates/<variant>/.claude/settings.json`  5. See `docs/templates/common-contract.json § platform_settings` for tier classification |
| `.gemini/settings.json` | 1. Apply **shared** tier changes to `.claude/settings.json`  2. **gemini_only** tier changes do NOT require `.claude/settings.json` update  3. Propagate to all 4 variant `templates/<variant>/.gemini/settings.json` |
| `.claude/commands/*.md` | 1. Add identical file to `templates/common/.claude/commands/`  2. If not `gemini-parity: skip`, also add to `.gemini/commands/` and `templates/common/.gemini/commands/` |
| `.claude/skills/*/SKILL.md` | 1. Add identical file to `templates/common/.claude/skills/`  2. If not `gemini-parity: skip`, also add to `.gemini/skills/` and `templates/common/.gemini/skills/` |
| `.gemini/commands/*.md` | Add identical file to `templates/common/.gemini/commands/` |
| `.gemini/skills/*/SKILL.md` | Add identical file to `templates/common/.gemini/skills/` |

**Verification** (run after any of the above):
```bash
bun scripts/audit.ts                  # full workspace audit including lifecycle sync
bun scripts/lifecycle-sync-audit.ts   # layer sync check (scripts + SCRIPTS.md versions)
```

> Full rules: [§5.6 Agent Lifecycle](docs/constitution/05.6-agent-lifecycle.md) → [§6 Skill Lifecycle](docs/constitution/06-skill-lifecycle.md) → [§6.5 Script Lifecycle](docs/constitution/06.5-script-lifecycle.md)
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 11. Custom Command Error Recovery
If a custom slash command or background script returns a non-zero exit code:
* **Don't bypass hooks**: Never attempt to run git commands with `--no-verify` to bypass the hook system unless under explicit, written user instruction.
* **Code Page / UTF-8 Issues (Windows)**: If broken Korean characters or Unicode errors appear in CLI output, the Windows terminal code page (CP949) is likely the cause. Ensure `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` or `chcp 65001` is prepended to scripts.
* **Diagnostic Audit**: Immediately read the failure stdout log. Common errors include:
  * Missing staged `CHANGELOG.md` edits (caught by `pre-commit`). Fix by running `/changelog` and staging the file.
  * Direct push attempt to `main` (caught by `pre-push`). Fix by executing the `/sync` pipeline script which handles target branch generation and PR staging automatically.
<!-- COMMON-CLAUDE:END -->

<!-- COMMON-CLAUDE:START -->
### 12. Windows Platform Requirement

**Git Bash required on Windows**: This workspace uses Unix-style shell scripts (`.sh`) for `.githooks/` hook files. Windows users must have Git Bash installed and configured as the default shell for git hooks.

- Git Bash ships with [Git for Windows](https://gitforwindows.org/) — install if not present.
- Verify: `git config core.hooksPath` should point to `.githooks/`
- `.ps1` counterparts are provided for `scripts/` Tier 1 scripts but **not** for all `.githooks/` hooks.
- If a hook fails on Windows with "command not found", run it via Git Bash: `"C:\Program Files\Git\bin\bash.exe" .githooks/pre-commit`
<!-- COMMON-CLAUDE:END -->

---

<!-- COMMON-CLAUDE:START -->
## Git & PR Additions (Claude Code)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Claude Code-specific additions:

- **PR Language**: Governed by [CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts](CONSTITUTION.md#3-github-pr-workflow). All PR titles, bodies, and review comments must be written in English - no exceptions.

*Last Updated: 2026-06-05 — added §5 Skill Resolution Priority; added §6 CLAUDE.md/GEMINI.md lifecycle row; added lifecycle-manager and auditor sequence to boilerplate; removed obsolete physical pm approval hooks*
<!-- COMMON-CLAUDE:END -->


