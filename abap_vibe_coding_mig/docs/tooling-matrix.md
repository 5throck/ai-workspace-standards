# Tooling Matrix

Cross-tool capability reference for the vsp/SAP ABAP Harness Engineering project.

> For agent roles and orchestration, see [AGENTS.md](../AGENTS.md).
> For shared engineering rules, see [context.md](context.md).
> For tool-specific setup, see [CLAUDE.md](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md) or [GEMINI.md](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md).

---

## Tool Selection Rule

Agents must choose the appropriate tool for each task type. All tools share the same `abap` MCP server but differ in capability and platform support.

| Task type | Claude Code CLI | Claude Code App | Antigravity | Gemini CLI |
|-----------|:--------------:|:--------------:|:-----------:|:----------:|
| PM multi-agent dispatch | —Plan mode + subagents | —Plan mode + subagents | —| —Native sub-task delegation |
| Serial write chain (SyntaxCheck —RunUnitTests —RunATCCheck) | —Hook fires automatically | 🚨 Hook does NOT fire —run manually | 🚨 Hook unverified | —Supported |
| ATC code quality check (RunATCCheck) | —| —| —| —Identical result |
| ABAP object browse / edit | 🚨 Terminal only | —Visual diff + inline review | —File explorer + diff view | 🚨 Terminal only |
| MCP read/query (GetSource, RunQuery, GrepObjects) | —| —Identical result | —Identical result | —Identical result |
| Git commit / PR | —`commit-commands` skills | —PR monitoring + CI status | 🚨 Extension terminal only | —Bash tools |
| Web research | —| —| —| —Native capability |
| Parallel sessions (visual worktrees) | —| —Automatic | —| —|
| Computer use (GUI automation) | —| —Win/macOS | —| —|
| Linux support | —| —| —| —|
| Quick lookup / search | —| —| —Native search preferred | —|

**Default rule**: Use Claude Code CLI or App for orchestration. Prefer CLI on Linux or when hook automation is required. Use Desktop App for visual diff review, PR monitoring, and parallel sessions. Use Antigravity for file-centric editing. Use Gemini CLI when web research or background research delegation is needed.

---

## Hook Behavior by Environment

| Environment | PostToolUse hook fires? | Notes |
|-------------|:-----------------------:|-------|
| Claude Code CLI | —| Automatic on every Write/Edit |
| Claude Code Desktop App | —| Known issue —run Post-Write chain manually |
| Gemini CLI | —| Disabled —run Post-Write chain manually |
| Antigravity | —| No hook support in VS Code extension |
| Codex | —| Via `.codex/hooks.json` |

---

*Last Updated: 2026-06-01*


