# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Systemic Enforcement of Agent Dispatch Rules
**Participants**: pm, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has highlighted a recurring critical failure: despite updating `GEMINI.md` with formatting rules, I still failed to output the exact `[Step, Task, Agent, Tier, Model]` table columns when creating an `implementation_plan.md`. The user has asked us to brainstorm a systemic improvement to guarantee this information is never omitted. Architect, how can we strictly enforce this?

**[architect]**: (Round 1)
The root cause of this failure is "instruction drift." When the PM is generating an `implementation_plan.md`, it relies on free-text generation based on a bulleted list of rules. To solve this systemically, we must eliminate the AI's creative freedom regarding the document structure.
I propose we introduce a **Markdown Boilerplate/Template** directly into `GEMINI.md` and `CLAUDE.md`. Instead of just saying "MUST include a table," we provide the exact markdown code block of the entire `implementation_plan.md` structure. 
We can update the "Planning Mode & Artifact Specifications" section to include an exact Markdown template:
```markdown
## Execution Task Plan (Agent Dispatch Rules)
| Step | Task | Agent | Tier | Model |
|:---:|---|:---:|:---:|---|
| 1 | ... | ... | ... | ... |
```
By providing the literal markdown code block in the system prompt, the AI will pattern-match and copy-paste the boilerplate, dramatically reducing the chance of omitting columns or the table itself.

**[auditor]**: (Round 1)
Architect's solution is solid, but we can go one step further to guarantee compliance. The PM agent itself (`agents/pm.md`) has a section called `## Constraints` that currently says:
`Before dispatching 2 or more agents in parallel or sequence, output an execution plan table in the user's active language.`
This constraint is weakly worded and only triggers *before dispatching*. We need to update `agents/pm.md` to explicitly state:
"When generating an `implementation_plan.md` artifact, you MUST copy the exact Execution Task Plan template from the workspace guidelines. Failure to include the `[Step, Task, Agent, Tier, Model]` columns is a critical violation of PM governance."
By linking the `pm.md` behavioral constraint directly to the `implementation_plan.md` artifact generation, we create a double-lock mechanism (Platform Prompt + Agent Prompt).

**[pm]**: (Round 2)
So the two-pronged approach is:
1. **Platform Level (`GEMINI.md` / `CLAUDE.md`)**: Inject a literal Markdown code block showing the exact expected structure of `implementation_plan.md`, specifically hardcoding the `| Step | Task | Agent | Tier | Model |` table headers.
2. **Agent Level (`agents/pm.md`)**: Strengthen the constraint to explicitly mandate that the PM must copy-paste this boilerplate whenever creating an implementation plan.

**[architect]**: (Round 2)
Exactly. And we should ensure that this boilerplate also includes the `## User Review Required` and `## Proposed Changes` sections so the AI doesn't forget those either. A fully structured template is much easier for an LLM to follow than a list of abstract rules. Since the user noticed this affects all platforms, we should apply the boilerplate to both `GEMINI.md` and `CLAUDE.md`.

**[auditor]**: (Synthesis)
We have a consensus on the systemic improvement plan.
1. **Agreements**:
   - Update `GEMINI.md` and `CLAUDE.md` to replace abstract rules with a concrete Markdown template for `implementation_plan.md`.
   - Update `agents/pm.md` to explicitly reference this template and treat the omission of the table as a critical governance violation.
   - Synchronize these changes to all template variants (`co-design`, `co-develop`, `co-security`, `co-work`).
2. **Next Actions**: PM will present this "Double-Lock Formatting Plan" to the user for approval.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Create Implementation Plan for the Double-Lock Formatting strategy | Planning |
| A-02 | docs-writer | Medium | Inject Markdown template into root `GEMINI.md` & `CLAUDE.md` | Execution |
| A-03 | docs-writer | Medium | Update `agents/pm.md` constraints | Execution |
| A-04 | automation-engineer | Low | Propagate changes to templates | Execution |
| A-05 | auditor | Medium | Run `audit.ts` to verify parity and compliance | Execution |
