---
name: meeting-facilitation
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings for collaborative decision-making and
  problem resolution. Use when: running agent meetings, coordinating multi-agent
  discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.5.0
last_reviewed: 2026-09-30
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

This skill is the single source of truth for multi-agent meeting facilitation. It is
invoked explicitly — the legacy `/meeting` slash command was retired on 2026-09-26
(AGENTS.md §6) and its command files were removed on 2026-09-30 (T-20260926-027).

## When to Use

Invoke this skill when the user requests a meeting, for example:
- `meeting-facilitation "topic" --agents a,b --rounds N --dialogue` — structured multi-agent discussion
- Facilitating collaborative decision-making across specialist agents
- Coordinating agent discussions for design reviews, problem-solving, or planning

## Execution Steps

1. **Agenda**: state the meeting objective and the decision to be explored.
2. **Round-robin dialogue**: each dispatched agent contributes per round (`--agents` selects
   participants, `--rounds` bounds the exchange, `--dialogue` enables free-form cross-talk).
3. **Outcome synthesis**: one cross-domain agent synthesizes agreements and open points.
4. **Transcript**: write the full record to `memory/meeting-YYYY-MM-DD-[slug].md`.

## Output Format

Meeting transcript written to `memory/meeting-YYYY-MM-DD-[slug].md` containing:
- Agenda and objectives
- Per-agent contributions (round-by-round)
- Synthesized outcomes and decisions
- Action items with owner assignments

## Governance Rules

All meetings facilitated through this skill MUST uphold three invariants:
1. **Dissent seat**: at least one participant is designated as a red-team / dissenting role whose duty is to challenge the emerging consensus.
2. **PROPOSAL, never decision**: the synthesized outcome is a proposal for the user's approval — the meeting itself does not decide.
3. **Dissent preserved verbatim**: recorded disagreements are transcribed as stated — never summarized away or averaged into consensus.

## Related Skills

- `project-review` — uses meeting-facilitation for Gemini CLI parallel dispatch
- `team-builder` — may invoke meetings during team assembly (Phase 0)
