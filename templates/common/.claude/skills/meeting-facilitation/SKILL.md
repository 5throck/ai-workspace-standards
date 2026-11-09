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
last_reviewed: 2026-11-10
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
1. **Agenda setting**: state the topic, objectives, participants, and round count. The
   round count is a meeting parameter fixed here — never reduced silently mid-meeting.
2. **Opening round (round 1)**: each participating agent states its position and
   supporting evidence on the topic.
3. **Facilitator agenda pass**: after round 1, the facilitator (or PM) distills the
   contributions into 2-5 named agenda issues reflecting where positions spread
   (criteria and recommendations), and states the issue list before round 2.
4. **Deliberation rounds (round 2+)**: run the remaining rounds issue by issue. For
   each agenda issue, every participating agent MUST:
   - address at least two named peers with an explicit agree / rebut / ask;
   - answer every question another participant addressed to it in the previous round;
   - state an explicit stance line: `changed: <from> → <to>` or `no change: <position>`;
   - stay on the agenda issue — new topics go to the facilitator for the issue list.
   The PM facilitates and keeps contributions on-agenda.
5. **Outcome synthesis**: a cross-domain agent (or the PM) synthesizes agreements,
   open points, and a proposed recommendation per issue.
6. **Transcript logging**: write the transcript to `memory/meeting-YYYY-MM-DD-[slug].md`.

## Output Format

Meeting transcript written to `memory/meeting-YYYY-MM-DD-[slug].md` containing, in order:
- Agenda, objectives, participants, and the issue list from the facilitator agenda pass
- Discussion by issue: attributed exchanges (who said what to whom), round by round
- Agreements reached per issue
- Preserved dissent: recorded disagreements transcribed VERBATIM — never summarized,
  never averaged into consensus (Governance Rule 3)
- Open questions carried forward
- Action items with owner assignments
- Proposed recommendation per issue, explicitly labelled a PROPOSAL for the user's
  approval — never a decision or PASS stamp (Governance Rule 2)

## Governance Rules

All meetings facilitated through this skill MUST uphold three invariants:
1. **Dissent seat**: at least one participant is designated as a red-team / dissenting role whose duty is to challenge the emerging consensus.
2. **PROPOSAL, never decision**: the synthesized outcome is a proposal for the user's approval — the meeting itself does not decide.
3. **Dissent preserved verbatim**: recorded disagreements are transcribed as stated — never summarized away or averaged into consensus.

## Related Skills

- `project-review` — uses meeting-facilitation for Gemini CLI parallel dispatch
- `team-builder` — may invoke meetings during team assembly (Phase 0)
