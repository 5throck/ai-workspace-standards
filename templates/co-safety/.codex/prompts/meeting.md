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

# meeting

Use this skill when the user asks to run `/meeting`.

## Overview

This skill provides the framework for running structured multi-agent meetings where agents discuss topics, share perspectives, and reach decisions through dialogue.

**Execution Mode**:
- **Inline Role-Play (Default for all engines)**: The PM acts as a facilitator and adopts multiple agent personas inline to generate a real-time role-played meeting. This guarantees fast execution, avoids file I/O bottlenecks, and maintains context atomicity. No subagents or tools are spawned unless explicitly requested.
- **Deep Work Mode (Optional)**: If complex parallel tool usage is required, the user can explicitly trigger native subagent relay mode.

## When to Use This Skill

**Collaborative Decision Making:**
- Trigger: "Need input from multiple agents on X" or "Facilitate meeting about Y"
- Use Case: Complex decisions requiring input from multiple specialist perspectives

**Problem Resolution:**
- Trigger: "Investigate issue with team input" or "Get agent consensus on problem"
- Use Case: Technical or design problems that benefit from multi-agent analysis

**Design Validation:**
- Trigger: "Review design with all specialists" or "Validate approach with team"
- Use Case: Design reviews, architecture decisions, or technical trade-off analysis

---

## Step 1: Define Meeting Parameters

**Purpose**: Set up meeting structure and participant list.

**Required Parameters**:
- **Topic**: Clear meeting agenda (required)
- **Participants**: Agent names or leave empty for all available agents (optional)
- **Rounds**: Number of discussion rounds, default 2, max 3 (optional)
- **Language**: Discussion language - default Korean, `en` for English (optional)
- **Mode**: Silent (default) or Dialogue for full transparency (optional)

**Command Format**:
```bash
/meeting "meeting topic here" --agents agent1,agent2 --rounds 2 --language ko --dialogue [--spec]
```

**Mode Selection**:
- **Silent** (default): Shows opening header - [meeting in progress] - synthesis only
  - Use for: Quick decisions, outcome-focused meetings
  - Token cost: ~1,000 tokens
- **Dialogue**: Shows full real-time conversation, every turn
  - Use for: Watching reasoning process, training, transparency
  - Token cost: ~5,000+ tokens

---

## Step 2: Detect Available Agents

**Purpose**: Identify which agents can participate in the meeting.

**Agent Detection Logic**:
1. Check if `agents/` directory exists in current working directory
2. List all `*.md` files in `agents/` (excluding README.md)
3. Extract agent names from filenames (e.g., `safety-governance-manager.md` -> `safety-governance-manager`)
4. If `--agents` list specified, filter to only those agents
5. Load each agent file to understand persona and role

**Safety OS Agents**:
- **Core**: pm, safety-governance-manager, safety-workflow-manager, docs-writer
- **Compliance & Risk**: compliance-agent, legal-agent, risk-assessment-agent
- **Functional**: training-agent, psm-agent, asset-integrity-agent, contractor-safety-agent, occupational-health-agent, msds-agent
- **Emergency**: emergency-agent, disaster-response-agent, incident-investigation-agent
- **Audit**: audit-agent, reporting-agent

**Validation**:
- At least one agent must be available
- Specified agents must exist in current directory
- Agent files must be readable and properly formatted

---

## Step 3: Open Meeting Structure

**Purpose**: Set meeting context and begin discussion.

**Meeting Header** (always displayed):
```
---------------------------------------- MEETING STARTED
Topic   : [meeting topic]
Present : [agent names]
Rounds  : [N]
Mode    : [Silent | Dialogue]
----------------------------------------
```

**Facilitator Opening** (Dialogue mode only):
- Set agenda and objectives
- Ask participants to respond directly to each other by name
- Establish discussion norms
- **Facilitator Exception**: The PM acts solely as a facilitator and does NOT contribute opinions.

**Silent Mode**:
- Display: `[Meeting in progress... Results will be displayed upon completion]`
- Proceed internally without per-turn output until synthesis

---

## Step 4: Conduct Discussion Rounds

**Purpose**: Facilitate structured agent dialogue.

**Meeting Execution (Inline Role-Play):**
- The PM agent generates the entire meeting transcript in its response by adopting the persona of each participating agent in sequence.
- Iterate through each participant in order for the specified number of rounds.
- Each agent fully inhabits their persona and contributes:
  - **Name** prior speaker and reference their specific point
  - **Add domain perspective** only this agent holds
  - **Agree, build on, or respectfully challenge** – like real conversation
  - **End with concrete proposal** or direct question to named colleague
- **Facilitator Exception**: The PM acts solely as the orchestrator and does NOT inject personal opinions into the discussion rounds. The PM only listens and facilitates.

**Dialogue Mode Output**:
```
**[AgentName]**: (Round N)

[2-3 paragraphs of in-character contribution]

---
```

**Silent Mode**: Hold contributions in context only, don't display

**Critical Rules**:
- Stay fully in character - agent constraints and tone apply
- Reference specific things previous speakers said
- Never break character with meta-commentary
- Maximum 3 rounds - stop early if discussion converges
- Language follows `--language` setting (speaker labels always English)

---

## Step 5: Synthesize Discussion

**Purpose**: Cross-domain agent synthesizes full discussion.

**Synthesizer Selection**:
- Most cross-domain agent speaks last
- Typical choices: compliance-agent, audit-agent, or closest equivalent
- Must see entire discussion context
- **Facilitator Exception**: The PM must NEVER summarize mid-meeting or at the end; synthesis is always performed by a cross-domain agent.

**Synthesis Requirements**:
1. **Points of Agreement** (specific)
2. **Open Disagreements or Unresolved Questions**
3. **Concrete Next Action Items** (max 5) - owner + deliverable + agent tier (High/Medium/Low)

**⚠️ Platform Parity Check (MANDATORY before writing Action Items)**:
Before finalizing Action Items, the Synthesizer MUST answer:
- Does any Action Item affect `AGENTS.md`, `GEMINI.md`, `agents/*.md`, `.claude/`, or `.gemini/` files?
- If YES: every such item MUST have a paired counterpart for the other platform, OR explicitly state `Platform: Claude-only` / `Platform: Antigravity-only` with a written justification.
- An Action Item affecting one platform with no platform declaration is a **governance violation**.

Action Item table MUST include a `Platform` column:
| # | Owner | Tier | Deliverable | Platform | Phase |
Where Platform = `Claude` / `Antigravity` / `Both` / `L0-only`

**Always Displayed** (regardless of mode):
```
**[Synthesizer]**: (Synthesis)

[Full discussion summary]

---
```

---

## Step 6: Archive Transcript - MANDATORY

> **MANDATORY**: Execute this step BEFORE printing the closing header. Do NOT proceed to Step 7 without completing this step. This rule applies regardless of platform, mode, or flags.

**Purpose**: Create a permanent record of the meeting in memory/.

**Language Rule**: Regardless of the discussion language, the archived transcript file MUST be written in English.

**File**: `memory/meeting-YYYY-MM-DD-[slug].md`
- Slug: 2-3 word kebab-case summary of topic

**Transcript Structure**:
```markdown
# Meeting Transcript
**Date**: YYYY-MM-DD
**Topic**: [meeting topic in English]
**Participants**: [agent list]
**Rounds**: [N]
**Language**: [Korean | English] (transcript always saved in English)
**Status**: Complete

---

## Transcript

[Full dialogue - each turn in order, translated to English if meeting was in Korean]

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
|  A-01 | [Agent] | [High/Med/Low] | [What] | [When] |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
```

**After writing the file**, run the sync command:
```bash
bun scripts/sync-md.ts "YYYY-MM-DD" "[TOPIC]" 2>/dev/null || true
```

If the sync command fails or is unavailable, continue - file archiving is the critical step.

---

## Step 7: Close Meeting

> Only execute this step AFTER Step 6 (archive) is complete.

**Purpose**: Signal meeting end to the user.

**Closing Header**:
```
---------------------------------------- MEETING CLOSED
----------------------------------------
```

Print the transcript file path so the user can verify:
```
Transcript path: memory/meeting-YYYY-MM-DD-[slug].md
```

---

## Step 8: Task Conversion (Optional)

**Purpose**: Convert action items into tracked tasks if `--tasks` flag set.

**If --tasks Flag Present**:
1. Extract each action item from synthesis
2. Create task entries in the session task list
3. Display summary:
```
[N] tasks created from meeting action items.
Run /sync to commit the transcript, or dispatch agents to begin execution.
```

**If --tasks Flag Not Set**:
```
Transcript path: memory/meeting-YYYY-MM-DD-[slug].md
To convert action items into tasks, use the --tasks option with /meeting
```

---

## Expected Outputs

**Successful Meeting**:
- Structured dialogue across specified rounds
- Synthesis with agreements, disagreements, and action items
- Archived transcript in memory/ (Step 6, mandatory - always before closing)
- Optional task creation for action items

**Quality Indicators**:
- Agents stay in character throughout
- Each agent references prior speakers by name
- Discussion converges or identifies clear blockers
- Action items have specific owners and deliverables

---

## Best Practices

**Meeting Setup**:
**Do**:
- Use clear, specific meeting topics
- Limit to 2-3 rounds for best quality
- Choose dialogue mode for training or transparency
- Include relevant specialists in participant list

**Don't**:
- Run more than 3 rounds (persona consistency degrades)
- Mix unrelated topics in single meeting
- Include unnecessary agents (keep focused)
- Use dialogue mode for routine decisions (token cost)

**Facilitation**:
**Do**:
- Let agents challenge each other respectfully
- Allow expertise to create real friction
- Stop early if consensus reached
- Document all action items clearly

**Don't**:
- Force agreement when expertise disagrees
- Rush through complex discussions
- Let agents all agree immediately
- Skip synthesis or action items
