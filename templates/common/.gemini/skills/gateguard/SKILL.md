---
name: gateguard
description: >
  Pre-edit fact-forcing quality gate. Ensures agents investigate a file's
  importers, schemas, and scope constraints before making changes.
  Part of the 3-layer enforcement model (Hook → Prompt → Skill).
version: 1.0.0
last_reviewed: 2026-08-01
status: active
scope: common
l2_propagate: true
owner: pm
prerequisites: Bun runtime
metadata:
  type: process
  triggers:
    - gateguard
    - /gateguard
    - investigate file
    - check before edit
    - pre-edit check
---

# Skill: gateguard

## Context

GateGuard is a pre-edit quality gate that forces agents to investigate a file before making changes. It ensures agents understand:
- Which files import or depend on the target file
- What data schemas, interfaces, and type definitions the file exports
- Whether the user's instructions impose scope constraints

This is the **manual/skill layer** of the 3-layer enforcement model. The hook layer (PreToolUse/BeforeTool) provides automatic enforcement on Claude CLI and Gemini CLI. This skill covers manual invocation and Antigravity (where hooks don't fire).

## Enforcement Coverage

| Platform | Hook | Prompt | Skill |
|----------|:----:|:------:|:-----:|
| Claude Code CLI | ✅ PreToolUse | ✅ | ✅ |
| Claude Desktop App | ✅* (bundled CLI) | ✅ | ✅ |
| Gemini CLI | ✅ BeforeTool | ✅ | ✅ |
| Antigravity | ❌ | ✅ | ✅ |

\* Claude Desktop App: documented by Anthropic but workspace testing (2026-05) observed intermittent behavior.

## When to Use

- Before editing any TypeScript, JSON, or configuration file that may be imported by other files
- When a user request involves modifying shared utilities, type definitions, or script infrastructure
- When the agent is unsure whether a change is safe to make without investigating dependencies
- As a pre-check before any architectural modification to workspace scripts, helpers, or registries

## Output Format

```
[GATEGUARD] Pre-edit investigation complete
  Target: <file-path>
  Importers: <list of importing files, or "none">
  Exported schemas: <list of interfaces/types/classes, or "none">
  Scope constraints: <user-imposed constraints, or "none">
  Risk level: low | medium | high
  Recommendation: proceed | proceed with caution | escalate to architect
```

## Execution Steps

When invoked (via `/gateguard <file-path>` or trigger match):

1. **Receive target file path** from arguments or user input
2. **Search for importers**: Run `grep` for import patterns referencing the target file's basename
   ```bash
   grep -r "from ['\"].*<basename>['\"]" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v ".git"
   ```
3. **Extract schemas**: Scan the target file for `interface`, `type`, `enum`, `class` exports
4. **Summarize findings** (1-3 sentences):
   - List importers (if any) and their relationship to the target
   - Note any exported schemas that downstream consumers depend on
   - Flag any scope constraints from user instructions
5. **Present to agent**: Output summary as `[GATEGUARD] Pre-edit investigation complete` with findings

## Agent Behavior After Investigation

After completing the GateGuard investigation, the agent may proceed with the edit. If importers were found, the agent should verify that changes won't break downstream consumers.

## Related Skills

- context.md §11.2 — GateGuard specification
- `scripts/hooks/gateguard-fact-force.ts` — Hook layer implementation
- ADR-0021 — Platform Settings Parity Policy
