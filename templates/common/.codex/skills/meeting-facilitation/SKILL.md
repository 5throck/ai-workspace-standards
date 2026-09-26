---
name: meeting-facilitation
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings for collaborative decision-making and
  problem resolution. Use when: running agent meetings, coordinating multi-agent
  discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.4.4
last_reviewed: 2026-09-26
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

This skill defines the multi-agent meeting facilitation flow. It is self-contained: the
skill body below is the specification the PM follows when orchestrating a meeting. The
legacy `/meeting` slash command was retired on 2026-09-26 — invoke this skill directly
by name.

## When to Use

Invoke this skill when the user requests:
- A structured multi-agent discussion on a named topic
- Facilitating collaborative decision-making across specialist agents
- Coordinating agent discussions for design reviews, problem-solving, or planning

## Execution Steps

The skill runs the facilitation flow directly:
1. **Agenda setting**: state the topic, objectives, participants, and round count.
2. **Round-robin dialogue**: each participating agent contributes per round; the PM
   facilitates and keeps contributions on-agenda.
3. **Outcome synthesis**: a cross-domain agent (or the PM) synthesizes agreements,
   open points, and proposed decisions.
4. **Transcript logging**: write the transcript to `memory/meeting-YYYY-MM-DD-[slug].md`.

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
