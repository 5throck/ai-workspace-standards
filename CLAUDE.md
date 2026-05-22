# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this workspace.

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) — read it first.**
>
> For tool-specific behaviors of Gemini/Antigravity, see [`GEMINI.md`](GEMINI.md).

---

## Claude Code-Specific Behaviors

### 1. Automated Hooks (`.claude/settings.json`)
The workspace `.claude/settings.json` is currently `{}` — **PostToolUse hooks are disabled**. Audit is enforced exclusively via the pre-commit hook and the `dev-sync.sh` pipeline.

To re-enable the PostToolUse hook (fires `audit.sh` after every Write/Edit), add the following to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/audit.sh"
          }
        ]
      }
    ]
  }
}
```

> ⚠️ **Desktop App limitation**: `PostToolUse` hooks do **not** fire in the Claude Code Desktop App even when configured. After any Write or Edit in the Desktop App, run `bash scripts/audit.sh` manually before committing.

| Environment | Hook active by default? | Manual fallback |
|-------------|:-----------------------:|-----------------|
| Claude Code CLI | ❌ (disabled) | `bash scripts/audit.sh` |
| Claude Code Desktop App | ❌ (always) | `bash scripts/audit.sh` |

**Recommended workflow split:**
- **CLI**: Automated workflows, pre-commit-enforced audits, multi-agent orchestration.
- **Desktop App**: PR monitoring, visual diff reviews, parallel sessions.

### 2. Native Slash Commands
Custom slash commands in `.claude/commands/` are natively recognized by Claude Code. The following commands are available at session start:

| Command | Purpose | Underlying Trigger |
|---------|---------|--------------------|
| `/sync "feat: ..."` | Full pipeline — memlog → changelog → audit → commit → PR | `scripts/dev-sync.sh` |
| `/changelog "..."` | Add entry to `CHANGELOG.md [Unreleased]` | Pre-sync user-facing changelog entry |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only | Without triggering full sync |
| `/new-task "name"` | Create task block in today's memory log | In-session task tracking |
| `/new-project "name"` | Scaffold a new project | `bash scripts/new-project.sh "$ARGUMENTS"` |

> **How commands become Skills**: each `.claude/commands/<name>.md` file is automatically
> registered as a `<name>` Skill. All 5 commands above have corresponding files in `.claude/commands/`.

### 3. MCP Configurations & Absolute Resolving
Config file: `.mcp.json` (project root) — auto-loaded by both the CLI and the Desktop App.
* **Path Resolving**: relative paths (e.g., `./server` or `python scripts/mcp.py`) are automatically resolved by Claude Code relative to the individual project's root folder. When defining commands inside `.mcp.json`, always keep command executable paths relative to the project directory for portable cross-platform runs.

### 4. Native Sub-agents (`Agent` Tool)
Use the native `Agent` tool to spawn sub-agents for parallel or isolated tasks. Sub-agents load their role-based configurations from `agents/<name>.md`.

**Agent Dispatch** — use the `Agent` tool (not a bash CLI command):
```
Agent(
  description   = "Implement pricing logic",
  prompt        = "You are a code writer. [paste agents/code-writer.md content here]\n\nTask: Implement pricing logic matching spec in src/pricing.py.",
  subagent_type = "claude"   // platform agent type; embed the agents/<name>.md role definition in the prompt
)
```

Each implementation task follows a **3-role review cycle**:
1. **Implementation sub-agent** executes the task.
2. **Spec-compliance review sub-agent** checks the result against context design.
3. **Code-quality review sub-agent** checks for bugs and styling.

> Loop and correct if review errors are flagged — maximum **3 iterations** before escalating to the user.

**Model Selection Overrides** (overridden per agent invocation when appropriate):
- Complex analysis, architectural refactoring, or multi-file reasoning ➔ `claude-opus-4-7`
- Standard implementation and surgical file writes (Default) ➔ `claude-sonnet-4-6`
- Simple transformations, fast lookups, or file globbing ➔ `claude-haiku-4-5-20251001`

### 5. Native Plan Mode (`EnterPlanMode`)
Enter native plan mode using the `EnterPlanMode` tool when:
- The user requests a new feature or significant refactor.
- The change modifies more than 2 files.
- The correct approach is unclear or requires clarifying assumptions.

Once in plan mode:
1. Draft the implementation plan and present it for user review.
2. Obtain explicit user approval before modifying any code.
3. Track progress using the native `TaskCreate` / `TaskUpdate` toolset.
4. After completion, summarize outcomes in the active `memory/YYYY-MM-DD.md` daily log.

### 6. Task Tracking (`TaskCreate` / `TaskUpdate`)
When working in a plan-mode session:
- Call `TaskCreate` before starting any multi-step execution.
- Set status `in_progress` prior to beginning each atomic step.
- Update status to `completed` immediately upon verification of the step.
- Never leave tasks `in_progress` at the end of a session.

### 7. Custom Command Error Recovery
If a custom slash command or background script returns a non-zero exit code:
* **Don't bypass hooks**: Never attempt to run git commands with `--no-verify` to bypass the hook system unless under explicit, written user instruction.
* **Diagnostic Audit**: Immediately read the failure stdout log. Common errors include:
  * Missing staged `CHANGELOG.md` edits (caught by `pre-commit`). Fix by running `/changelog` and staging the file.
  * Direct push attempt to `main` (caught by `pre-push`). Fix by executing the `/sync` pipeline script which handles target branch generation and PR staging automatically.

---

## Git & PR Additions (Claude Code)

All shared Git/PR rules are in [CONSTITUTION.md §3](CONSTITUTION.md#3-github-pr-workflow). Claude Code-specific addition:

- **AI Commit Signatures**: Always append `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` to the end of all AI-generated git commit messages.

*Last Updated: 2026-05-22*
