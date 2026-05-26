---
description: Run a natural multi-agent meeting where Claude role-plays each participant inline — no Agent tool spawning, real-time dialogue visible to the user
---

# Multi-Agent Meeting

Arguments: $ARGUMENTS

## Core Principle

**Do NOT use the Agent tool.** Claude itself plays every participant in turn, reading each agent's `.md` file to adopt their voice, expertise, and perspective. The entire meeting unfolds inline in a single conversation — the user watches it happen in real time, like sitting in the room.

This is role-play orchestration, not sub-agent dispatch.

### Why inline role-play instead of Agent tool dispatch?

The Agent tool spawns isolated sub-agents that cannot see each other's output. To simulate dialogue you would need to: collect A's result → manually inject it into B's prompt → collect B's result → inject A+B into C's prompt, etc. This produces stitched-together monologues, not dialogue — and the user sees nothing until all agents finish.

Inline role-play solves this structurally:
- **Shared context by default**: every prior turn is already in the conversation window when Claude writes the next turn — no manual transcript injection needed
- **Real-time streaming**: the user watches the conversation unfold turn by turn, like being in the room
- **Natural continuity**: Claude playing Agent B can quote Agent A's exact words from two lines above, not from a copied string

The dialogue flow is:

```
Claude (as Architect) speaks  →  output is now in conversation history
Claude (as Security-Expert) speaks  →  sees Architect's words naturally, reacts
Claude (as Automation-Engineer) speaks  →  sees Architect + Security-Expert, reacts
...
Claude (as Auditor) synthesizes  →  sees everything, closes the meeting
```

This matches exactly how a real meeting works — each person heard everything before they spoke.

### Known limits

- **Long sessions**: persona consistency weakens past round 3-4 as context compresses. Keep meetings to 2 rounds for best quality.
- **Repeated meetings in one session**: prior meeting content bleeds into the new one. Start a fresh Claude session for unrelated meetings.

---

## Step 1 — Parse Arguments

Extract from `$ARGUMENTS`:
- **Topic**: The meeting agenda (required)
- **Participants**: e.g. `--agents architect,security-expert,auditor` (optional — defaults to all available agents for this project)
- **Rounds**: e.g. `--rounds 2` (optional — default 2, max 3)
- **Language**: e.g. `--language en` (optional — defaults to Korean; `en` switches all dialogue to English)
- **Tasks**: e.g. `--tasks` flag (optional — if set, after the meeting automatically convert action items into a task plan)

---

## Step 2 — Detect Project Context

Check which agent files exist:
- If `agents/` contains workspace agents (architect, auditor, security-expert, automation-engineer, docs-writer, scaffolding-expert) → workspace meeting
- If `agents/` contains template agents (architect, designer, code-writer, test-runner, security-monitor, stack-setup) → project meeting

Load only the agent files that (a) exist and (b) are in the `--agents` list if specified. Read each file now to hold all personas in context before the meeting starts.

---

## Step 3 — Open the Meeting

Determine dialogue language from `--language` flag (default: Korean).

Print the meeting header:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️  MEETING STARTED
Topic   : [TOPIC]
Present : [comma-separated agent names]
Rounds  : [N]
Language: [Korean | English]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Facilitator]: [Opening statement in the chosen language, setting the agenda and asking participants to respond directly to each other by name.]

---
```

---

## Step 4 — Run Dialogue Rounds

For each round (1 to N), iterate through each participant in order.

For each participant's turn:

1. **Fully inhabit that agent's persona** — you are now that character, not Claude
2. **Everything said so far is already in your context** — every prior turn is visible above; use it naturally, as a person in the room would
3. **Output their contribution** in this format:

```
**[AgentName]**: (Round N)

[2–4 paragraphs of natural dialogue. MUST:
- Name at least one prior speaker and reference their specific point
- Add domain perspective only this agent holds
- Agree, build on, or respectfully challenge — like a real conversation
- End with a concrete proposal or a direct question to a named colleague]

---
```

All dialogue text follows the `--language` setting. Speaker labels (`**Architect**:`) are always in English regardless of language.

**Critical rules for each turn:**
- Stay fully in character — the agent's constraints, tone, and knowledge domain apply
- Reference specific things previous speakers said (quote or paraphrase with their name)
- Never break character to explain what you're doing
- No meta-commentary like "As the architect agent, I will now..."
- Short speaker label: `**Architect**:` not `**[Architect Agent]**:`
- Maximum 3 rounds — stop and synthesize if the discussion converges earlier

---

## Step 5 — Synthesis (Final Turn)

After all rounds, the most cross-domain agent (Auditor, Test-Runner, or the closest equivalent) speaks last as synthesizer:

```
**[Synthesizer]**: (Synthesis)

[Summarize the full discussion. MUST include:
1. Points of agreement (specific)
2. Open disagreements or unresolved questions
3. Concrete next action items — owner + deliverable, max 5]

---
```

---

## Step 6 — Close and Archive

Print the closing header:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  MEETING CLOSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Write the full transcript to `memory/meeting-YYYY-MM-DD-[slug].md` where slug is a 2-3 word kebab-case summary of the topic:

```markdown
# Meeting Transcript
**Date**: YYYY-MM-DD
**Topic**: [TOPIC]
**Participants**: [list]
**Rounds**: [N]
**Language**: [Korean | English]
**Status**: Complete

---

## Transcript

[Full dialogue — each turn in order]

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | [Agent] | [What] | [When] |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
```

---

## Step 7 — Task Conversion (if `--tasks` flag is set)

If the user passed `--tasks`, after archiving do the following:

1. Extract each action item from the synthesis
2. For each item, call `TaskCreate` with:
   - `title`: "[Owner] — [Deliverable]"
   - `description`: the full acceptance criterion or deliverable detail
   - `status`: `pending`
3. Print a summary:
```
📋 [N] tasks created from meeting action items.
Run /sync to commit the transcript, or dispatch agents to begin execution.
```

If `--tasks` was not passed, instead print:
```
트랜스크립트 저장: memory/meeting-YYYY-MM-DD-[slug].md
액션 아이템을 태스크로 변환하려면 /meeting ... --tasks 옵션을 사용하세요.
```

---

## What NOT to Do

- ❌ Do not use the `Agent` tool — no sub-agent spawning
- ❌ Do not summarize what an agent "would say" — actually say it, in their voice
- ❌ Do not add "(as Claude)" or meta-narration between turns
- ❌ Do not rush turns — each agent deserves a full, substantive contribution
- ❌ Do not let agents all agree immediately — real expertise produces real friction
- ❌ Do not run more than 3 rounds — persona consistency degrades after that
