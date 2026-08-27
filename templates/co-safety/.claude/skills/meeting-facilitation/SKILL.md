---
name: meeting-facilitation
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

This is a registration stub. The full implementation resides in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`.

## When to Use

Use `/meeting "topic"` to run a structured multi-agent meeting for collaborative decision-making and problem resolution.

## Usage

```
/meeting "Comprehensive project review" --agents [comma-separated agent list] --rounds 2 --dialogue
```

## Pipeline

1. Define meeting parameters (topic, agents, rounds, mode)
2. Detect available agents from `agents/` directory
3. Open meeting structure
4. Conduct discussion rounds (inline role-play)
5. Synthesize discussion with platform parity check
6. Archive transcript to `memory/meeting-YYYY-MM-DD-[slug].md` (MANDATORY)
7. Close meeting
8. Optional: Convert action items to tasks with `--tasks` flag
