---
name: meeting-facilitation
description: >
  Runs a structured multi-agent meeting where Claude role-plays each participant inline.
  No Agent tool spawning — the entire meeting unfolds as real-time dialogue visible to the user.
version: 1.0.0
status: active
owner: pm
prerequisites: agents/*.md files must exist for all named participants
---

# 🗣️ Skill: meeting-facilitation

## Context

Use this skill when the PM needs to facilitate a structured discussion between security agents
(e.g., red-team-lead and threat-modeler aligning on attack paths, or a post-engagement retrospective).

## Execution Steps

See workspace skill `meeting-facilitation` (`.claude/plugins/.../meeting-facilitation`) for full execution instructions.

This entry registers the skill in the co-security context and triggers it via the `/meeting` command.

## Invocation

```
/meeting "topic" --agents red-team-lead,threat-modeler --rounds 2
```

## Notes

- PM opens and closes every meeting but does not contribute opinions during dialogue
- All offensive discussions in meetings remain bound by authorization constraints
- **M-04 Requirement (1st review meeting)**: Security meetings specifically require PM to run `verify-authorization` before any offensive TTPs are discussed
- Meeting transcripts are saved to `memory/meeting-YYYY-MM-DD-<slug>.md`
