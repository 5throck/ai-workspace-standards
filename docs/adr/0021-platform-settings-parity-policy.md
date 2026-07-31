---
status: Accepted
date: 2026-06-02
author: PM + Architect + Auditor
---

# ADR 0021: Platform Settings Parity Policy — 3-Tier Classification

## Context

The workspace maintains two platform-specific settings files:
- `.claude/settings.json` — Claude Code configuration
- `.gemini/settings.json` — Antigravity CLI configuration

When Agent Teams support was added (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, `teammateMode`, `TeammateIdle`/`TaskCompleted` hooks), an attempt was made to apply the same `.md` document parity rule (CLAUDE.md ↔ GEMINI.md must stay in sync) to settings files. This caused lifecycle violations: variant `.claude/settings.json` files were not updated, and Claude-only settings were incorrectly considered "missing" from `.gemini/settings.json`.

The root cause was a category error: document parity (same intent, same words) was confused with settings parity (same behavior across different platforms). Claude Code and Antigravity have fundamentally different capability sets — for example, `permissions`, `teammateMode`, and `TeammateIdle` hooks are Claude Code-only concepts with no Antigravity equivalent.

## Decision

Adopt a **3-tier classification** for platform settings, declared in `docs/templates/common-contract.json` under `platform_settings`:

| Tier | Definition | Parity requirement |
|------|-----------|-------------------|
| `shared` | Both platforms support the same capability | Required in both `.claude/settings.json` AND `.gemini/settings.json` |
| `claude_only` | Exclusive to Claude Code; Antigravity does not support | Absence from `.gemini/settings.json` is **correct** — not a violation |
| `gemini_only` | Exclusive to Antigravity; Claude Code does not support | Absence from `.claude/settings.json` is **correct** — not a violation |

**Current classification:**

| Shared | Claude Code | Gemini CLI | Classification |
|---------|-------------|------------|---------------|
| Session Init | `hooks.SessionStart` | `hooks.SessionStart` | **shared** |
| Pre-Tool Gate | `hooks.PreToolUse` | `hooks.BeforeTool` | claude_only / gemini_only |
| Post-Tool Audit | `hooks.PostToolUse` | `hooks.AfterTool` | claude_only / gemini_only |
| Pre-Compress | `hooks.PreCompact` | `hooks.PreCompress` | claude_only / gemini_only |

**Shared:** `mcpServers`, `hooks.SessionStart`

**Claude-only:** `permissions`, `env` (including `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), `teammateMode`, `hooks.PreToolUse`, `hooks.PostToolUse`, `hooks.PreCompact`, `hooks.TeammateIdle`, `hooks.TaskCreated`, `hooks.TaskCompleted`, `hooks.WorktreeCreate`

**Gemini-only:** `hooks.BeforeTool`, `hooks.AfterTool`, `hooks.PreCompress`

> **Platform Hook Advisories:**
> - **Claude Desktop App**: Uses bundled CLI. Hooks configured in `.claude/settings.json` should fire per Anthropic documentation. However, workspace testing (2026-05) observed that some hooks did not fire. Treat Desktop App hook support as "verified by Anthropic, conditionally supported in practice."
> - **Antigravity (VS Code extension)**: Does NOT fire hooks. Shares `.gemini/settings.json` with Gemini CLI, but hooks are not executed in the Antigravity runtime.
> - **Gemini CLI**: Supports BeforeTool, AfterTool, and PreCompress hooks with stdin(JSON) → stdout(JSON) protocol.

The governing principle is **Functional Equivalence** — each platform implements equivalent *intent* using its own capabilities, not identical file content.

`validate-templates.ts` Check VA-04 enforces this policy automatically: it reads `platform_settings.shared` from `common-contract.json` and warns when a shared key is missing from either settings file. Claude-only keys absent from `.gemini/settings.json` do not trigger a warning. Gemini-only keys absent from `.claude/settings.json` also do not trigger a warning.

The lifecycle table in `CLAUDE.md §10` was updated to document four propagation rules for `.claude/settings.json` changes: (1) shared items propagate to `.gemini/settings.json`; (2) claude_only items do not; (3) propagate to `templates/common/.claude/settings.json`; (4) propagate to all 4 variant `.claude/settings.json` files.

## Consequences

- Eliminates false lifecycle violations caused by treating Claude-only settings as "missing" from Antigravity
- `common-contract.json` becomes the single source of truth for platform capability boundaries
- New settings additions require explicit tier classification before implementation
- VA-04 provides automated enforcement — settings parity is no longer enforced by human memory
- The `gemini_only` tier contains Gemini CLI hook events (`BeforeTool`, `AfterTool`, `PreCompress`) that have no Claude Code equivalent. Note: Antigravity (VS Code extension) shares `.gemini/settings.json` but does NOT fire hooks.
