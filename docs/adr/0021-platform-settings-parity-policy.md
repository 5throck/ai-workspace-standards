---
status: Accepted (Amended 2026-08-01)
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

## Amendment 1 (2026-08-01) — ECC Phase 2 Hardening

### A1.1 AfterTool Lifecycle Hook Activation

`post-write-lifecycle-check.ts` (v1.1.0) now supports `--platform gemini` for Gemini CLI AfterTool events. Previously this hook was Claude-only (PostToolUse). The `.gemini/settings.json` `AfterTool` hook block has been added, mirroring Claude's `PostToolUse` block.

**Classification unchanged** — `AfterTool` remains `gemini_only`. This amendment activates an existing classification, not a new one.

### A1.2 GateGuard Configurable Mode

`gateguard-fact-force.ts` (v1.1.0) adds a `--mode ask|deny` CLI flag:

| Mode | Claude Behavior | Gemini Behavior |
|------|----------------|-----------------|
| `ask` (default) | `{"decision":"ask"}`, exit 0 | Ignored — always deny |
| `deny` | `{"decision":"deny"}`, exit 2 | `{"decision":"deny"}`, exit 2 |

The default `ask` mode preserves backward compatibility. Users may opt into `deny` mode for stricter enforcement. Classification of `PreToolUse`/`BeforeTool` remains unchanged.

### A1.3 GateGuard Importer Regex Fix

Fixed importer search regex to handle `.ts`/`.js`/`.tsx`/`.jsx` extensions in import paths (e.g., `from './lib/ssrf.ts'`). Previous regex only matched bare module names, causing false negatives.

### A1.4 Claude Desktop App Hook Status — Unchanged

2026-05 observation of intermittent hook non-firing remains on record. No new evidence to change classification. Re-verification recommended with next Claude Code release.

### A1.5 Command Frontmatter JSON Schema

New `schemas/command.schema.json` (lenient, all optional) validates command frontmatter when present. No classification impact on ADR-0021.
