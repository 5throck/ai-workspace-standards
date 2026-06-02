# Meeting Transcript
**Date**: 2026-06-02
**Topic**: co-work agents workflow improvement — agents defined but workflow not reflected
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### PM (Facilitator Opening)

The meeting objective: the co-work template defines 7 specialist agents, but there is no workflow document specifying when, in what order, and via what handoff mechanism they operate.

Three problems identified:
1. `pm.md` Agent Roster table references workspace-root agents (architect, automation-engineer, etc.) — not replaced with co-work agents
2. `AGENTS.md` Phase Summary table lists workspace-root agents (scaffolding-expert, automation-engineer, auditor) instead of co-work agents
3. co-work's 6 specialist agents (analyst, storyteller, content-writer, technical-writer, project-coordinator, ms365-expert) have no defined Phase entry points or handoff contracts

---

### Architect (Round 1)

Agreed with PM's diagnosis. Root cause: co-work template copied workspace-root structure, replaced agent files, but did not update Phase definitions or handoff contracts.

Evidence: AGENTS.md Phase Summary maps workspace-root agents exclusively. Only analyst appears in Phase 3, and only in a comment-level note. The remaining 5 co-work agents are absent from the Phase table entirely.

**Proposed co-work 7-Phase mapping:**

| Phase | Name | PM Role | Responsible Agents |
|-------|------|---------|-------------------|
| 0 | Request Classification & Team Assembly | Orchestrator | PM only (triage) |
| 1 | Research & Data Gathering | Observer | analyst (primary), storyteller (context) |
| 2 | Design Review & User Approval | Gate Keeper | PM + storyteller (narrative review) |
| 3 | Content Creation | Coordinator | content-writer, technical-writer |
| 4 | Platform Deployment & Delivery | Coordinator | ms365-expert, project-coordinator |
| 5 | QA & Lifecycle Finalization | Owner | PM (variant: PM runs QA directly) |
| 6 | PR & Handoff | Owner | PM |

Once this mapping is confirmed, `pm.md` Agent Roster and `AGENTS.md` Phase Summary must be updated simultaneously. Desynchronized files will reproduce the same problem.

Question to Auditor: what is the scope of discrepancy across the two files?

---

### Auditor (Round 1)

Agreed with Architect's diagnosis. Discrepancy scope: **4 files, 3 layers**.

**Layer 1 — Agent definitions (agents/*.md)**
- `pm.md` "Agent Roster" section: lists 5 workspace-root agents (architect, automation-engineer, docs-writer, security-expert, scaffolding-expert) — none exist in co-work
- co-work's 6 specialist agent files exist but contain no `phases` field indicating their Phase entry points

**Layer 2 — Index (AGENTS.md)**
- Phase Summary table: 5 erroneous workspace-root agent references
- co-work agents partially mentioned in Phase 3 comment only (non-structural)
- `docs/phase-definitions.md` referenced but the file does not exist at template stage → broken link

**Layer 3 — Platform config (CLAUDE.md)**
- Specialist Agent List correctly lists co-work agents (the only internally consistent file)
- However, Phase numbering conflicts with AGENTS.md

**Key risk**: A user creating a co-work project today could trigger PM to dispatch a non-existent `architect` agent in Phase 1-2. This is a silent failure — workflow halts without a clear error message.

**Proposed addition**: Add `phases`, `handoff_to`, `handoff_from` fields to each agent frontmatter:

```yaml
---
name: analyst
phases: [1]
handoff_to: [content-writer, technical-writer]
handoff_from: [pm]
---
```

This enables `bun scripts/audit.ts` to automatically validate Phase mapping consistency and prevent governance drift from recurring.

Question to Architect: does the frontmatter extension align with your implementation priorities?

---

### Architect (Round 2)

Fully agreed on the frontmatter `phases` field. Without it, the same drift will recur.

**Implementation priority — three stages:**

**P0 — Immediate (today, 1-2 files)**
Replace `pm.md` Agent Roster with co-work-specific agents. This is the most critical fix. Incorrect agent names loaded into PM's context cause silent failures at execution time.

Correct roster for pm.md:
| Phase | Agent | Responsibility |
|-------|-------|----------------|
| 1 | analyst | Research, data gathering, evidence synthesis |
| 1-2 | storyteller | Context analysis, change management narrative |
| 3 | content-writer | Transform research into documentation and communications |
| 3 | technical-writer | Technical docs, API guides |
| 4 | ms365-expert | M365 platform deployment and integration |
| 4 | project-coordinator | Schedule management, stakeholder communication |

**P1 — This week (AGENTS.md rewrite)**
Replace Phase Summary table with co-work mapping. Add `docs/phase-definitions.md` as a static template file to eliminate the broken link.

**P2 — This week (frontmatter extension + audit script)**
Add `phases`, `handoff_to`, `handoff_from` to each agent file. Add Phase consistency validation to `bun scripts/audit.ts`.

Question to Auditor: does fixing P0 alone eliminate the silent failure risk, or is P1 also required immediately?

---

### Auditor (Round 2 / Synthesis)

**P0 alone blocks ~80% of silent failure risk.** Correcting pm.md Agent Roster eliminates the worst case where PM dispatches a non-existent agent. The remaining 20% risk stems from AGENTS.md Phase Summary still referencing wrong agents — resolved by P1.

**Points of Agreement:**
1. Root cause: workspace-root structure copied into co-work template with only agent files replaced; Phase definitions and handoff contracts not updated
2. The only internally consistent file is `CLAUDE.md`'s Specialist Agent List — use this as SSOT to align all other files
3. Architect's 7-Phase mapping adopted as the design reference for this improvement
4. Auditor's frontmatter extension (`phases`, `handoff_to`, `handoff_from`) adopted as the automated verification anchor

**Open Questions:**
- Should `docs/phase-definitions.md` be included as a static file in the template, or generated by a scaffolding script at project creation time? (Decision required in P1)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | PM | High | Replace `pm.md` Agent Roster table with co-work-specific 6 agents | P0 (immediate) |
| A-02 | docs-writer | Medium | Rewrite `AGENTS.md` Phase Summary table with co-work 7-Phase mapping | P1 |
| A-03 | docs-writer | Medium | Add `docs/phase-definitions.md` as static template file (eliminate broken link) | P1 |
| A-04 | automation-engineer | Low | Add `phases`, `handoff_to`, `handoff_from` frontmatter fields to each agent file | P2 |
| A-05 | automation-engineer | Low | Add co-work Phase consistency validation logic to `bun scripts/audit.ts` | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `pm.md` Agent Roster contains only co-work agents with correct Phase assignments | Manual review |
| C-02 | `AGENTS.md` Phase Summary references no workspace-root agents | `bun scripts/audit.ts` |
| C-03 | `docs/phase-definitions.md` exists in the template and all links resolve | `bun scripts/validate-docs-links.ts` |
| C-04 | All 6 specialist agent files have `phases`, `handoff_to`, `handoff_from` frontmatter | `bun scripts/audit.ts` Phase check |
| C-05 | `bun scripts/audit.ts` detects Phase mapping mismatches and reports them | Script test run |
