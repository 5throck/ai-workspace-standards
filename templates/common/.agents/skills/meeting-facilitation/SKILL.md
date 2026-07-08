---
name: meeting-facilitation
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings using the /meeting command for collaborative
  decision-making and problem resolution. Use when: running agent meetings, coordinating
  multi-agent discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.4.0
last_reviewed: 2026-06-05
prerequisites: []
metadata:
  type: process
  triggers:
    - meeting
    - agent discussion
    - collaborative decision
    - multi-agent coordination
    - facilitate meeting
---

## Context

This skill is a registration stub for the meeting-facilitation capability. The actual implementation resides in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`. This file exists to make the skill discoverable via `.agents/skills.json` at Priority 1.

## When to Use

Invoke this skill when the user requests:
- `/meeting "topic"` — structured multi-agent discussion
- Facilitating collaborative decision-making across specialist agents
- Coordinating agent discussions for design reviews, problem-solving, or planning

## Execution Steps

This skill delegates entirely to the platform-specific command files:
1. **Claude Code**: `.claude/commands/meeting.md` handles the full facilitation flow
2. **Gemini CLI**: `.gemini/commands/meeting.md` handles the full facilitation flow
3. Both implementations support: agenda setting, round-robin dialogue, outcome synthesis, and transcript logging to `memory/meeting-YYYY-MM-DD-[slug].md`

## Output Format

Meeting transcript written to `memory/meeting-YYYY-MM-DD-[slug].md` containing:
- Agenda and objectives
- Per-agent contributions (round-by-round)
- Synthesized outcomes and decisions
- Action items with owner assignments

## Related Skills

- `project-review` — uses meeting-facilitation for Gemini CLI parallel dispatch
- `team-builder` — may invoke meetings during team assembly (Phase 0)
