---
name: platform-command-lifecycle-manager
status: active
version: 1.0.0
description: >
  Manages the creation, registration, and propagation of platform commands
  in .claude/commands/ and .gemini/commands/ directories. Use when: adding new commands,
  ensuring parity between Claude and Gemini command directories, or propagating commands to templates/common/.
owner: pm
last_reviewed: 2026-05-31
metadata:
  type: process
  triggers:
    - create platform command
    - new .claude command
    - new .gemini command
    - platform command lifecycle
    - command parity
    - propagate command
---

# Platform Command Lifecycle Manager

## When to Use

Use this skill when:
- Creating a new command in `.claude/commands/` or `.gemini/commands/`
- Verifying command parity between platforms
- Propagating a command to `templates/common/`

## Creation Checklist

1. **Determine gemini-parity**: Does this command apply to Gemini/Antigravity?
   - If yes: create in BOTH `.claude/commands/` AND `.gemini/commands/`
   - If Claude-only: add `gemini-parity: skip` to frontmatter

2. **Propagate to common**:
   - Always: copy to `templates/common/.claude/commands/`
   - If not `gemini-parity: skip`: also copy to `templates/common/.gemini/commands/`

3. **Register in common-contract.json**: Add entry to `common_commands` section

4. **Run verification**: `bun scripts/verify-platform-lifecycle.ts` must pass Check G

## Propagation Rule

```
.claude/commands/<name>.md                    ← Claude Code source
.gemini/commands/<name>.md                    ← Gemini/Antigravity (if not skip)
templates/common/.claude/commands/<name>.md   ← Template propagation (Claude)
templates/common/.gemini/commands/<name>.md   ← Template propagation (if not skip)
```

## Verification

```bash
bun scripts/verify-platform-lifecycle.ts
bun scripts/validate-templates.ts
```
