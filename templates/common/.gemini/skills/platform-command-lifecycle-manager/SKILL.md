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

1. **Determine gemini-parity** and create in appropriate platform directories
2. **Propagate to common**: copy to `templates/common/.claude/commands/` (and `.gemini/` if not skip)
3. **Register in common-contract.json**: Add entry to `common_commands` section
4. **Run verification**: `bun scripts/verify-platform-lifecycle.ts` must pass Check G

## Verification

```bash
bun scripts/verify-platform-lifecycle.ts
bun scripts/validate-templates.ts
```
