# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Enforcing Agent Dispatch Rules in Planning Mode
**Participants**: pm, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has pointed out that while PM has strict Agent Dispatch Rules (e.g., providing an Execution Task Plan table with Tier/Model before dispatching), this rule is frequently omitted when PM generates the `implementation_plan.md`. The user suggested amending `GEMINI.md` and `CLAUDE.md` under "2. Planning Mode & Artifact Specifications -> #### 1. implementation_plan.md" to explicitly mandate the inclusion of this table. Docs-Writer and Auditor, what is your assessment of this proposal and its propagation to templates?

**[docs-writer]**: (Round 1)
The user's suggestion is incredibly practical. Currently, the PM prompt mentions the "Execution plan table", but because the Planning Mode artifact specification in `GEMINI.md`/`CLAUDE.md` only requests "Goal Description", "Proposed Changes", and "Verification Plan", the PM agent gets confused between the two conflicting formats and often drops the table.
If we add an explicit requirement for the "Execution Task Plan (Agent Dispatch Rules)" directly inside the `implementation_plan.md` specification in both `GEMINI.md` and `CLAUDE.md`, it perfectly bridges the gap. Furthermore, as the user noted, this must be synchronized across all 4 templates (`co-design`, `co-develop`, `co-security`, `co-work`) to ensure all future projects inherit this strict dispatch governance.

**[auditor]**: (Round 1)
I strongly agree. However, I want to add one complement (supplement). The `implementation_plan.md` format is technically a workspace-level architectural standard. Thus, we should not only update `GEMINI.md` and `CLAUDE.md` but also ensure that the overarching `CONSTITUTION.md` or any artifact template documentation reflects this requirement if it exists. But primarily, `CLAUDE.md` and `GEMINI.md` are the system prompt injectors, so they are the most critical targets.
Also, we must ensure exact parity between `CLAUDE.md` and `GEMINI.md` for our `validate-templates.ts` parity check to pass.

**[pm]**: (Round 2)
Excellent analysis. So we will update the `#### 1. implementation_plan.md` section in the root `GEMINI.md` and `CLAUDE.md`, and then propagate these exact changes to the corresponding files in all four templates. Are there any other omissions we need to address?

**[docs-writer]**: (Round 2)
We should explicitly define the table schema in the instruction so the AI engine knows exactly what to generate. 
We will append this rule: 
"*   **Format Requirement**: MUST include an `Execution Task Plan` table detailing `[Step, Task, Agent, Tier, Model]` to explicitly declare Agent Dispatch Rules before execution."

**[auditor]**: (Synthesis)
The consensus is clear. The user's proposal perfectly addresses the root cause of the missing dispatch rules.
1. **Agreements**:
   - Update `#### 1. implementation_plan.md` in root `GEMINI.md` and `CLAUDE.md`.
   - Add a strict requirement to include the Agent Dispatch Execution Table.
   - Synchronize this update across all 4 template directories (`co-design`, `co-develop`, `co-security`, `co-work`).
2. **Next Actions**: PM will draft the Implementation Plan for the user's approval.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Create Implementation Plan for Planning Mode specification update | Planning |
| A-02 | docs-writer | Medium | Update root `GEMINI.md` and `CLAUDE.md` | Execution |
| A-03 | automation-engineer | Low | Propagate changes to all template `.md` files | Execution |
| A-04 | auditor | Medium | Run `audit.ts` to verify platform section parity | Execution |
