---
name: meeting-facilitation
status: active
scope: common
description: >
  Facilitates structured multi-agent meetings for collaborative decision-making and
  problem resolution. Use when: running agent meetings, coordinating multi-agent
  discussions, or facilitating collaborative problem-solving sessions.
owner: pm
version: 1.6.0
last_reviewed: 2026-11-21
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

The skill runs the facilitation flow directly, as a turn-based dialogue meeting:

1. **Agenda setting**: state the topic, objectives, and the participant roster, then
   distill 2-5 named agenda issues and state the issue list before any discussion.
   New topics raised mid-meeting go to the facilitator, who may append an issue with
   its own participant selection.
2. **Per-issue participant selection**: for each agenda issue, the facilitator selects
   3-5 relevant participants and records a one-line reason for each. The dissent seat
   (Governance Rule 1) is ALWAYS selected, for every issue. Agents not selected are
   recorded as "not participating in this issue" — their silence is never counted as
   agreement. A non-participant whose domain has a material stake in the issue may
   raise one floor request; the facilitator accepts or declines, and the decision is
   recorded.
3. **Turn-based discussion**: the facilitator opens each issue and hands the floor to
   the first selected participant. Speakers alternate in turns; each turn is ONE move:
   - `propose` — state a position or recommendation;
   - `ask` — a direct question addressed to a named peer;
   - `answer` — respond to a question addressed to you (its target speaks next);
   - `rebut` — challenge a named peer's statement with reasoning;
   - `concede` — accept a peer's point;
   - `amend` — refine the standing proposal (at most ONE amend per participant per
     issue, unless it answers a question addressed to that participant);
   - `pass` — decline the floor.
   Every turn addresses at least one peer by display name — never by agent key or
   role placeholder. Speaker order: the target of a pending `ask` speaks next;
   otherwise pending asks and rebutts take priority over new amendments; otherwise
   round-robin over the issue's participants. Turns are bounded: a per-issue budget
   of 3 turns per selected participant (cap 12 per issue) applies; a caller-supplied
   round count (the `--rounds N` invocation convention) maps to a budget of N turns
   per participant per issue.
4. **Progress reporting**: at every speaker change the facilitator emits one line:
   `issue i/n · speaker <display name> · turns used t/<budget>`.
5. **Per-issue consensus**: when the budget is reached or no new ask or rebut
   remains, the facilitator, as chair, proposes a consensus statement and names the
   positions it rests on. Only the issue's participants vote: `accept`, or `reserve`
   with a one-line reason. The chair never votes. The issue closes as `agreed`,
   `narrowed` (reservations recorded verbatim), or `unresolved`. These outcomes
   describe the agent exchange only — every consensus statement is a PROPOSAL for
   the user's approval, never a decision (Governance Rule 2).
6. **Minutes logging**: write the minutes to `memory/meeting-YYYY-MM-DD-[slug].md`
   in the Output Format below.

## Output Format

Meeting minutes written to `memory/meeting-YYYY-MM-DD-[slug].md`, in order:
- Overview: date, facilitator, participant roster, and per-issue participants, with
  non-participants marked "not participating in this issue"; when the meeting was
  resumed after an interruption, the overview states the number of sittings
- Per issue: the outcome label (`agreed` / `narrowed` / `unresolved`), the consensus
  statement labelled a PROPOSAL for the user's approval — never a decision or PASS
  stamp (Governance Rule 2) — and the KEY EXCHANGES quoted verbatim as
  `display name: utterance`, never summarized into agreement
- Preserved dissent: recorded disagreements transcribed VERBATIM — never summarized,
  never averaged into consensus (Governance Rule 3)
- Open questions carried forward
- Action items with owner assignments
- Appendix A — full turn transcript: every turn in order as `display name: move —
  utterance`, including floor requests, the consensus proposal, and the votes
- Appendix B — interrupted attempts (only when the meeting was resumed): the turns
  of the interrupted sitting(s), kept verbatim and excluded from the body's
  consensus citations

## Governance Rules

All meetings facilitated through this skill MUST uphold three invariants:
1. **Dissent seat**: at least one participant is designated as a red-team / dissenting role whose duty is to challenge the emerging consensus.
2. **PROPOSAL, never decision**: the synthesized outcome is a proposal for the user's approval — the meeting itself does not decide.
3. **Dissent preserved verbatim**: recorded disagreements are transcribed as stated — never summarized away or averaged into consensus.

## Related Skills

- `project-review` — uses meeting-facilitation for Gemini CLI parallel dispatch
- `team-builder` — may invoke meetings during team assembly (Phase 0)
