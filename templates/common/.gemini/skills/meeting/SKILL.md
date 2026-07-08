---
name: meeting
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings using the /meeting command for collaborative
  decision-making and problem resolution. Use when: running agent meetings, coordinating
  multi-agent discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.4.0
last_reviewed: 2026-07-05
metadata:
  type: process
  triggers:
    - meeting
    - agent discussion
    - collaborative decision
    - multi-agent coordination
    - facilitate meeting
---

This is a shortcut alias for the `meeting-facilitation` skill. The actual implementation resides in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`.

## When to Use

Use `/meeting "topic"` to run a structured multi-agent meeting for collaborative decision-making and problem resolution.

## Usage

```
/meeting "Comprehensive project review" --agents [comma-separated agent list] --rounds 2 --dialogue
```

See `meeting-facilitation` skill for full documentation.
