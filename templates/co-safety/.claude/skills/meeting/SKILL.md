---
name: meeting
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings using the /meeting command for collaborative
  decision-making and problem resolution. Use when: running agent meetings, coordinating
  multi-agent discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.5.0
last_reviewed: 2026-07-08
metadata:
  type: process
  triggers:
    - meeting
    - agent discussion
    - collaborative decision
    - multi-agent coordination
    - facilitate meeting
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

This is a shortcut alias for the `meeting-facilitation` skill. The actual implementation resides in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`.

## When to Use

Use `/meeting "topic"` to run a structured multi-agent meeting for collaborative decision-making and problem resolution.

## Usage

```
/meeting "Comprehensive project review" --agents [comma-separated agent list] --rounds 2 --dialogue
```

See `meeting-facilitation` skill for full documentation.
