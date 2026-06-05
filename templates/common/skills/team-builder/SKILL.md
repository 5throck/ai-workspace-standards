---
name: team-builder
description: >
  Guides the Engagement Leader through building a new AI agent team for any consulting domain.
  Covers requirements interview, web benchmarking, current team diagnosis, proposal generation,
  and user approval gate. Outputs an approved proposal JSON for scripts/team-builder.ts to execute.
  Triggered by: "새 팀 구성", "에이전트팀 변경", "신규 도메인 팀 빌딩", "build new agent team".
version: 1.1.0
status: active
scope: common
owner: pm
prerequisites: none
---

## Overview

Two-layer architecture:
- **Skill Layer (Steps 1–5)**: AI-driven. Requirements interview, benchmarking, current team diagnosis, proposal generation, user approval gate.
- **Script Layer (Steps 6–14)**: Executed by `scripts/team-builder.ts` after user approves the proposal JSON.

Never proceed to script execution without explicit user approval at Step 5.

---

## Step 1: Requirements Interview

Conduct a structured interview with the user. Collect all of the following before proceeding:

| Question | Purpose |
|----------|---------|
| What is the primary domain/purpose of the new team? | Scope benchmarking |
| What types of projects will this team handle? | Team structure reference |
| Expected team scale (number of agents)? | Budget/tier planning |
| Required expertise areas? | Specialist identification |
| Are there existing agents to retain, convert, or delete? | Change scope |
| What quality/delivery standards must the team meet? | Workflow design criteria |

Do not proceed to Step 2 until all six questions are answered. Summarize requirements back to the user for confirmation before moving on.

---

## Step 2: Benchmarking

Use web search tools to research industry-standard team structures matching the user's requirements.

**Benchmarking quality criteria:**
- Use at least 2 authoritative sources (McKinsey, BCG, Gartner, Forrester, industry associations, or peer-reviewed research)
- For each reference team structure, document: team name/source, roles and responsibilities, hierarchy, typical project types, known strengths/weaknesses
- Evaluate fit against user requirements using a scoring matrix (1–5 per criterion)

**Source validation checklist (verify each before citing):**
1. Publication date within 5 years of current date
2. Official organizational domain (e.g., mckinsey.com, gartner.com) or peer-reviewed journal with DOI
3. Primary source preferred — if only a secondary citation is available, note the original source explicitly

**Benchmarking deliverable format:**
```
Reference Team A — [Source]
  Roles: [list]
  Hierarchy: [structure]
  Fit score: [X/5 per criterion]
  Typical skills required: [list]

Reference Team B — [Source]
  ...
```

Select the best-fit reference (highest total score) and document the rationale.

---

## Step 3: Current Team State Diagnosis

Before proposing any changes, map the current team state by reading existing agent and skill files.

1. **Agent inventory**: List all `agents/*.md` files — name, formal_name, tier, phases, required_skills, status
2. **Skill inventory**: List all `skills/*/SKILL.md` files — name, owner, status, prerequisites
3. **Dependency map**: For each agent to be deleted or converted, identify:
   - Skills it owns
   - Agents it hands off to / receives from
   - Phases it participates in
4. **Proactive skill transfer plan**: Before any deletion, assign each skill to a valid remaining or new agent

---

## Step 4: Proposal Generation

Generate a structured proposal document covering all planned changes.

**Proposal must include:**

### 4a. Team Comparison Table
| | Current | Proposed | Change Type |
|--|---------|----------|-------------|
| Agent Name | existing role | new role | Create / Convert / Delete / Keep |

### 4b. Agent Change Details
For each change:
- **Create**: name, formal_name, tier, phases, required_skills, rationale (linked to benchmarking)
- **Convert**: current file → new file name, role changes, skills retained vs. replaced
- **Delete**: agent name, skills to be transferred (with new owner), rationale

### 4c. Skill Change Plan
- Existing skills to reuse (unchanged)
- Existing skills to modify (what changes and why)
- New skills to create (name, owner, rationale)
- Skill owner reassignments (from deleted/converted agents)

### 4d. Workflow Design
- Phase definitions for the new team
- Agent dispatch order
- Handoff chain (handoff_to / handoff_from per agent)

### 4e. Benchmarking Evidence
- Source(s) used, fit score, key rationale for team structure choices

### 4f. Change History Entry
- One-paragraph summary for `memory/YYYY-MM-DD.md`

---

## Step 5: User Approval Gate ⛔ MANDATORY STOP

Present the full proposal to the user. Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAM BUILDER — PROPOSAL READY FOR REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Display full proposal from Step 4]

Agents to CREATE : N
Agents to CONVERT: N
Agents to DELETE : N
Skills to CREATE : N
Skills to REASSIGN: N

To execute: reply "승인" or "approve"
To revise:  reply with specific change requests
To cancel:  reply "취소" or "cancel"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**DO NOT proceed to script execution until the user explicitly approves.**

On approval:
1. Save proposal as `memory/team-builder-proposal-YYYY-MM-DD.json` (JSON format matching the TeamBuilderProposal schema in scripts/team-builder.ts)
2. Instruct the user to run: `bun scripts/team-builder.ts memory/team-builder-proposal-YYYY-MM-DD.json`
3. Do NOT run the script directly. Always wait for the user to execute the command above explicitly.

---

## Proposal JSON Schema

The saved JSON must conform to this structure:

```json
{
  "version": "1.0.0",
  "timestamp": "YYYY-MM-DDTHH:mm:ssZ",
  "teamName": "string",
  "benchmarkSources": ["url or citation"],
  "changes": {
    "agentsToCreate": [
      {
        "name": "kebab-case-name",
        "formalName": "Display Name",
        "tier": { "claude": "high|medium|low" },
        "color": "color-name",
        "description": "one-line description",
        "phases": ["1", "2"],
        "handoffTo": ["agent-name"],
        "handoffFrom": ["agent-name"],
        "requiredSkills": ["skill-name"],
        "rationale": "why this agent"
      }
    ],
    "agentsToConvert": [
      {
        "currentFile": "current-name.md",
        "newFile": "new-name.md",
        "newFormalName": "New Display Name",
        "roleChanges": "description of what changes",
        "skillsRetained": ["skill-name"],
        "skillsReplaced": ["old-skill -> new-skill"]
      }
    ],
    "agentsToDelete": [
      {
        "name": "agent-name",
        "skillsToTransfer": [{ "skill": "skill-name", "newOwner": "agent-name" }],
        "rationale": "why deleting"
      }
    ],
    "skillsToCreate": [
      {
        "name": "skill-name",
        "owner": "agent-name",
        "description": "description",
        "prerequisites": ["skill-name"]
      }
    ],
    "skillsToModify": [
      {
        "name": "skill-name",
        "changes": "what to change"
      }
    ],
    "skillsToReassign": [
      {
        "skill": "skill-name",
        "fromOwner": "old-agent",
        "toOwner": "new-agent"
      }
    ],
    "workflowPhases": [
      {
        "phase": 0,
        "name": "Phase Name",
        "lead": "agent-name",
        "supporting": ["agent-name"]
      }
    ]
  },
  "changeHistoryEntry": "one-paragraph summary",
  "approvedBy": "user",
  "approvedAt": "YYYY-MM-DDTHH:mm:ssZ"
}
```

---

## Output Format

- **Step 1**: Requirements summary table (confirmed by user)
- **Step 2**: Benchmarking report with fit matrix
- **Step 3**: Current team inventory + dependency map + proactive skill transfer plan
- **Step 4**: Full proposal document (human-readable)
- **Step 5**: Approval prompt + proposal JSON saved to `memory/`

---

## Related Skills

- `agent-lifecycle-manager` — for individual agent lifecycle operations
- `skill-lifecycle-manager` — for individual skill lifecycle operations
- `insight-synthesis` — for synthesizing benchmarking findings
- `org-readiness-assessment` — if organizational readiness context is needed
