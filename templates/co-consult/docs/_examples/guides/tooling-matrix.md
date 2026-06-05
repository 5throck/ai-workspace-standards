# Tooling Matrix

Cross-tool capability reference for the project.

> For agent roles and orchestration, see [AGENTS.md](../AGENTS.md).
> For shared engineering rules, see [context.md](context.md).

---

## Tool Selection Rule

Agents must choose the appropriate tool for each task type.

| Task type | Claude Code CLI | Claude Code App | VS Code | Gemini CLI |
|-----------|:--------------:|:---------------:|:-------:|:----------:|
| PM multi-agent dispatch | ✅ Plan mode + subagents | ✅ Plan mode + subagents | ❌ | ✅ Native sub-task |
| Automated hooks (post-write) | ✅ Fires automatically | ❌ Run manually | ❌ | ✅ Supported |
| Code quality check (lint) | ✅ | ✅ | ✅ Extension | ✅ Identical |
| Code browse / edit | ✅ Terminal only | ✅ Visual diff + inline | ✅ File explorer | ✅ Terminal only |
| MCP read/query | ✅ | ✅ Identical result | ✅ Via extension | ✅ Identical |
| Git commit / PR | ✅ Built-in | ✅ PR monitoring | ✅ Extension | ✅ Via tools |
| Web research | ❌ | ❌ | ❌ | ✅ Native |
| Parallel sessions | ❌ | ✅ Automatic | ❌ | ❌ |
| Computer use (GUI) | ✅ (Win/macOS) | ✅ (Win/macOS) | ❌ | ❌ |
| Linux support | ✅ | ❌ | ✅ | ✅ |
| Quick lookup / search | ✅ | ✅ | ✅ Native search | ✅ |

---

## Hook Behavior by Environment

| Environment | PostToolUse hook fires? | Notes |
|-------------|:-----------------------:|-------|
| Claude Code CLI | ✅ | Automatic on every Write/Edit |
| Claude Code Desktop App | ❌ | Known issue —run chains manually |
| Gemini CLI | ⚠️ | Configurable via settings |
| VS Code Extensions | ❌ | No hook support |

---

## Default Rule

Use **Claude Code CLI** for automated workflows and hook-driven development.
Use **Claude Code Desktop App** for visual diff review and PR monitoring.
Use **VS Code** for file-centric editing with extensions.
Use **Gemini CLI** when web research or background delegation is needed.

---
*Last Updated: 2026-06-05*
