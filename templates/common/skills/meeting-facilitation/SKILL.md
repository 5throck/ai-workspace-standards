---
name: meeting-facilitation
description: >
  Facilitates structured multi-agent meetings using the /meeting command for collaborative
  decision-making and problem resolution. Use when: running agent meetings, coordinating
  multi-agent discussions, or facilitating collaborative problem-solving sessions.
version: 1.0.0
metadata:
  type: process
  triggers:
    - meeting
    - agent discussion
    - collaborative decision
    - multi-agent coordination
    - facilitate meeting
---

## Overview

This skill provides the framework for running structured multi-agent meetings where agents discuss topics, share perspectives, and reach decisions through dialogue. The /meeting command enables real-time agent role-playing with visible conversation flow.

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
/meeting "meeting topic here" --agents agent1,agent2 --rounds 2 --language ko --dialogue
```

**Mode Selection**:
- **Silent** (default): Shows opening header → [meeting in progress] → synthesis only
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
3. Extract agent names from filenames (e.g., `architect.md` → `architect`)
4. If `--agents` list specified, filter to only those agents
5. Load each agent file to understand persona and role

**Variant-Specific Agents**:
- **Workspace root**: architect, auditor, pm, security-expert, etc.
- **co-design variant**: design-lead, ux-researcher, visual-designer, etc.
- **co-work variant**: analyst, content-writer, technical-writer, etc.

**Validation**:
- At least one agent must be available
- Specified agents must exist in current directory
- Agent files must be readable and properly formatted

---

## Step 3: Open Meeting Structure

**Purpose**: Set meeting context and begin discussion.

**Meeting Header** (always displayed):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️  MEETING STARTED
Topic   : [meeting topic]
Present : [agent names]
Rounds  : [N]
Mode    : [Silent | Dialogue]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Facilitator Opening** (Dialogue mode only):
- Set agenda and objectives
- Ask participants to respond directly to each other by name
- Establish discussion norms

**Silent Mode**:
- Display: `[회의 진행 중… 완료 시 결과를 출력합니다]`
- Proceed internally without per-turn output until synthesis

---

## Step 4: Conduct Discussion Rounds

**Purpose**: Facilitate structured agent dialogue.

**For Each Round (1 to N)**:
- Iterate through each participant in order
- Each agent fully inhabits their persona and contributes:
  - **Name** prior speaker and reference their specific point
  - **Add domain perspective** only this agent holds
  - **Agree, build on, or respectfully challenge** — like real conversation
  - **End with concrete proposal** or direct question to named colleague

**Dialogue Mode**: Display each turn as generated:
```
**[AgentName]**: (Round N)

[2–4 paragraphs of in-character contribution]

---
```

**Silent Mode**: Hold contributions in context only, don't display

**Critical Rules**:
- Stay fully in character — agent constraints and tone apply
- Reference specific things previous speakers said
- Never break character with meta-commentary
- Maximum 3 rounds — stop early if discussion converges
- Language follows `--language` setting (speaker labels always English)

---

## Step 5: Synthesize Discussion

**Purpose**: Cross-domain agent synthesizes full discussion.

**Synthesizer Selection**:
- Most cross-domain agent speaks last
- Typical choices: Auditor, Test-Runner, or closest equivalent
- Must see entire discussion context

**Synthesis Requirements**:
1. **Points of Agreement** (specific)
2. **Open Disagreements or Unresolved Questions**
3. **Concrete Next Action Items** (max 5) — owner + deliverable

**Always Displayed** (regardless of mode):
```
**[Synthesizer]**: (Synthesis)

[Full discussion summary]

---
```

---

## Step 6: Close and Archive Meeting

**Purpose**: Finalize meeting and create permanent record.

**Closing Header**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  MEETING CLOSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Archive Transcript**:
- File: `memory/meeting-YYYY-MM-DD-[slug].md`
- Slug: 2-3 word kebab-case summary of topic
- Format: Markdown with full dialogue and action items

**Transcript Structure**:
```markdown
# Meeting Transcript
**Date**: YYYY-MM-DD
**Topic**: [meeting topic]
**Participants**: [agent list]
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

## Step 7: Task Conversion (Optional)

**Purpose**: Convert action items into tracked tasks if `--tasks` flag set.

**If --tasks Flag Present**:
1. Extract each action item from synthesis
2. Call `TaskCreate` for each item:
   - `title`: "[Owner] — [Deliverable]"
   - `description`: Full acceptance criterion or deliverable detail
   - `status`: "pending"
3. Display summary:
```
📋 [N] tasks created from meeting action items.
Run /sync to commit the transcript, or dispatch agents to begin execution.
```

**If --tasks Flag Not Set**:
```
트랜스크립트 저장: memory/meeting-YYYY-MM-DD-[slug].md
액션 아이템을 태스크로 변환하려면 /meeting ... --tasks 옵션을 사용하세요.
```

---

## Expected Outputs

**Successful Meeting**:
- Structured dialogue across specified rounds
- Synthesis with agreements, disagreements, and action items
- Archived transcript in memory/
- Optional task creation for action items

**Quality Indicators**:
- Agents stay in character throughout
- Each agent references prior speakers by name
- Discussion converges or identifies clear blockers
- Action items have specific owners and deliverables

---

## Best Practices

**Meeting Setup**:
✅ **Do**:
- Use clear, specific meeting topics
- Limit to 2-3 rounds for best quality
- Choose dialogue mode for training or transparency
- Include relevant specialists in participant list

❌ **Don't**:
- Run more than 3 rounds (persona consistency degrades)
- Mix unrelated topics in single meeting
- Include unnecessary agents (keep focused)
- Use dialogue mode for routine decisions (token cost)

**Facilitation**:
✅ **Do**:
- Let agents challenge each other respectfully
- Allow expertise to create real friction
- Stop early if consensus reached
- Document all action items clearly

❌ **Don't**:
- Force agreement when expertise disagrees
- Rush through complex discussions
- Let agents all agree immediately
- Skip synthesis or action items

---

## Common Issues and Solutions

**Issue**: Agents don't reference prior speakers
**Solution**: Ensure proper context is maintained; each turn should quote or paraphrase specific prior points

**Issue**: Discussion doesn't converge
**Solution**: Stop after round 2, let synthesizer identify open questions for follow-up

**Issue**: Action items lack specificity
**Solution**: Request synthesizer to specify owner, deliverable, and acceptance criteria

**Issue**: Wrong agents participating
**Solution**: Check current directory has correct `agents/` for desired variant

---

## Related Skills

- **skill-lifecycle-manager**: For creating and managing other skills
- **task-tracking**: For managing action items from meetings
- **documentation-writing**: For documenting meeting outcomes
