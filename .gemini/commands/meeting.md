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

The dialogue flow when PM is present:

```
PM opens round → frames agenda, names which agent to speak first
Agent A responds → addresses PM's question, builds on prior turns
Agent B responds → reacts to Agent A, adds domain perspective
PM closes round → resolves provisional decisions, sets up next round
...
PM delivers synthesis → owns the action items table
```

The dialogue flow when PM is absent:

```
Claude (as Architect) speaks  →  output is now in conversation history
Claude (as Security-Expert) speaks  →  sees Architect's words naturally, reacts
Claude (as Automation-Engineer) speaks  →  sees Architect + Security-Expert, reacts
...
Claude (as Auditor) synthesizes  →  sees everything, closes the meeting
```

### Known limits

- **Long sessions**: persona consistency weakens past round 3-4 as context compresses. Keep meetings to 2 rounds for best quality.
- **Repeated meetings in one session**: prior meeting content bleeds into the new one. Start a fresh Claude session for unrelated meetings.

---

## Step 1 — Parse Arguments

Extract from `$ARGUMENTS`:
- **Topic**: The meeting agenda (required)
- **Participants**: e.g. `--agents architect,security-expert,auditor` (optional — if omitted, defaults to context-aware roles based on execution directory. Root defaults to `pm, architect, auditor`; sub-projects default to `pm, automation-engineer, docs-writer` or available variant agents)
- **Rounds**: e.g. `--rounds 2` (optional — default 2, max 3)
- **Language**: e.g. `--language en` (optional — defaults to Korean; `en` switches all dialogue to English)
- **Tasks**: e.g. `--tasks` flag (optional — if set, after the meeting automatically convert action items into a task plan)
- **Dialogue**: e.g. `--dialogue` flag (optional — prints every agent turn in real time so the user can watch the conversation unfold. High token cost; use when the reasoning process itself is valuable to observe.)

### Mode comparison

| Mode | Command | What you see | Token cost |
|------|---------|--------------|------------|
| **Silent** (default) | `/meeting "topic"` | Opening header → `[meeting in progress…]` → synthesis only | ~1,000 tokens |
| **Dialogue** | `/meeting "topic" --dialogue` | Full real-time conversation, every turn | ~5,000+ tokens |

Default is silent because most callers need the outcome, not the transcript. Pass `--dialogue` only when watching the agents reason together adds value.

---

## Step 2 — Detect Project Context

**Automatically detect available agents:**
1. Check if `agents/` directory exists in current working directory
2. List all `*.md` files in `agents/` (excluding README.md)
3. Extract agent names from filenames (e.g., `architect.md` → `architect`)

**Context-Aware Defaulting (if `--agents` is NOT specified):**
- **Workspace Root Execution**: Default to `pm, architect, auditor`. This focuses the meeting on high-level architecture, standards, and cross-project consistency.
- **Variant/Sub-project Execution**: Default to `pm, automation-engineer, docs-writer, security-expert` (or the specific agents present in that variant's local `agents/` folder). This focuses the meeting on execution, implementation, and variant-specific details.
- *Note: Only load agents that actually exist in the detected `agents/` directories.*

**If `--agents` IS specified:**
- Filter the available agents to exactly match those provided in the list.

If no agents are found in the final list or `agents/` doesn't exist, error with a clear message. Read each target agent file now to hold all personas in context before the meeting starts.

**PM presence check:**
After resolving the final participant list, check whether `pm` (or any agent whose file name is `pm.md`) is included. Store this as `PM_PRESENT = true/false`. This flag controls the orchestration mode for all subsequent steps.

---

## Step 3 — Open the Meeting

Determine dialogue language from `--language` flag (default: Korean).
Determine output mode: **silent by default**; `--dialogue` flag switches to full output.

Print the meeting header regardless of mode:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️  MEETING STARTED
Topic   : [TOPIC]
Present : [comma-separated agent names]
Rounds  : [N]
Mode    : [Silent | Dialogue]
Orchestrator: [PM | Facilitator]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If `PM_PRESENT = true` and `--dialogue`:**
PM (in character) delivers the opening statement — introduces the topic, breaks it into agenda items for the rounds, and names which agent will speak first.

```
**PM**: (Opening)

[Opening statement in the chosen language. PM MUST:
 1. Welcome participants by name
 2. State the meeting objective in one sentence
 3. Break the topic into N agenda items — one per round
 4. Name the first agent to speak and pose a specific question to them]

---
```

**If `PM_PRESENT = false` and `--dialogue`:**
Claude (as abstract Facilitator) delivers the opening statement.

```
[Facilitator]: [Opening statement in the chosen language, setting the agenda and asking participants to respond directly to each other by name.]

---
```

**If silent (default):** Print `[회의 진행 중… 완료 시 결과를 출력합니다]` (or English equivalent) and proceed internally without any further per-turn output until Step 5.

---

## Step 4 — Run Dialogue Rounds

### When `PM_PRESENT = true` (PM Orchestrator Mode)

For each round (1 to N):

**4a. PM opens the round** — PM speaks first, always:
- States the agenda item for this round (from the breakdown made in Step 3)
- Poses a specific, targeted question to a named agent
- If round > 1: briefly acknowledges the prior round's outcome in one sentence

**4b. Specialist agents respond** — in order, excluding PM:
- Each agent directly addresses PM's question
- Each agent must reference at least one prior speaker by name
- Each agent adds the domain perspective only they hold
- Each agent may redirect a question to a named colleague

**4c. PM closes the round** — PM speaks last in every round:
- Synthesizes what was heard from each agent this round
- Resolves any provisional decision (or names it as an open question)
- States what the next round will focus on (or "this concludes discussion" if final round)
- Assigns any emerging action item to a named agent

**If `--dialogue`**: print each PM and agent turn as it is generated:

```
**PM**: (Round N — Open)
[PM's opening for the round]
---

**[AgentName]**: (Round N)
[Agent's contribution]
---

**PM**: (Round N — Close)
[PM's synthesis and close]
---
```

**If silent**: hold all turns in context only — they still shape reasoning.

---

### When `PM_PRESENT = false` (Facilitator Mode)

For each round (1 to N), iterate through each participant in order.

For each participant's turn, Claude fully inhabits the agent's persona:

1. **Fully inhabit that agent's persona** — you are now that character, not Claude
2. **Everything said so far is already in your context** — use it naturally
3. **Generate their contribution** covering:
   - Name at least one prior speaker and reference their specific point
   - Add domain perspective only this agent holds
   - Agree, build on, or respectfully challenge — like a real conversation
   - End with a concrete proposal or a direct question to a named colleague

**If `--dialogue`**: print each turn as it is generated:

```
**[AgentName]**: (Round N)

[2–4 paragraphs]

---
```

**If silent**: do NOT print the turn. Hold it in context only.

---

**Critical rules (both modes):**
- Stay fully in character — the agent's constraints, tone, and knowledge domain apply
- Reference specific things previous speakers said (quote or paraphrase with their name)
- Never break character to explain what you're doing
- No meta-commentary like "As the architect agent, I will now..."
- Maximum 3 rounds — stop and synthesize if the discussion converges earlier

---

## Step 5 — Synthesis (Final Turn)

### When `PM_PRESENT = true`

PM delivers the final synthesis — always printed regardless of mode:

```
**PM**: (Synthesis)

[PM MUST include:
1. One-sentence outcome statement — what did this meeting decide?
2. Points of agreement reached (specific, attributed to agents by name)
3. Open questions remaining (if any)
4. Concrete action items table — owner + deliverable, max 5 items]

---
```

### When `PM_PRESENT = false`

The most cross-domain agent (Auditor, Test-Runner, or closest equivalent) speaks last as synthesizer — always printed regardless of mode:

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

Write the full transcript to `memory/meeting-YYYY-MM-DD-[slug].md` where slug is a 2-3 word kebab-case summary of the topic.

> **Language rule**: The saved transcript file MUST always be written in **English**, regardless of the dialogue language used during the meeting. If the meeting was conducted in Korean, translate all dialogue, action items, and acceptance criteria to English before saving. This follows the workspace documentation standard (CONSTITUTION.md §2).

```markdown
# Meeting Transcript
**Date**: YYYY-MM-DD
**Topic**: [TOPIC in English]
**Participants**: [list]
**Rounds**: [N]
**Orchestrator**: [PM | Facilitator]
**Language**: [Korean | English] (transcript always saved in English)
**Status**: Complete

---

## Transcript

[Full dialogue in English — each turn in order]

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

After saving the transcript (regardless of `--tasks`), register the meeting in MEMORY.md — detect OS and run the appropriate script:

- **Bash (Git Bash / WSL / macOS / Linux):**
  ```bash
  bash scripts/sync-md.sh "YYYY-MM-DD" "[TOPIC]" --meeting
  ```
- **Windows (PowerShell native):**
  ```powershell
  .\scripts\sync-md.ps1 -Date "YYYY-MM-DD" -Summary "[TOPIC]" -Meeting
  ```

---

## What NOT to Do

- ❌ Do not use the `Agent` tool — no sub-agent spawning
- ❌ Do not summarize what an agent "would say" — actually say it, in their voice
- ❌ Do not add "(as Claude)" or meta-narration between turns
- ❌ Do not rush turns — each agent deserves a full, substantive contribution
- ❌ Do not let agents all agree immediately — real expertise produces real friction
- ❌ Do not run more than 3 rounds — persona consistency degrades after that
- ❌ **When PM_PRESENT = true**: do not let other agents open or close rounds — PM exclusively owns round open/close
- ❌ **When PM_PRESENT = true**: do not let PM skip the round-close turn — PM must synthesize every round before moving to the next
