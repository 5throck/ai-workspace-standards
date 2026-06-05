# Meeting Transcript
**Date**: 2026-06-05
**Topic**: Revision of Execution Task Plan Boilerplate (Removing Coordinator and Platform, Ensuring Tier)
**Participants**: architect, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
Everyone, two issues have been raised regarding the Execution Task Plan boilerplate in the PM Gateway. First, the `Implementer | Coordinator | Platform` format drops the essential `Tier` information, and the `Coordinator` column is unnecessary. Second, showing `Platform` values like `L0-only` to L2 variant users causes severe confusion. Please discuss the approach to remove the `Coordinator` and `Platform` columns, strictly enforce the `Tier` column, update the L0 documents (`CLAUDE.md`, `GEMINI.md`, `agents/pm.md`, etc.), and propagate these changes to L1 (common). `architect`, please start.

**[architect]**: (Round 1)
Yes, architect here. The user's feedback is highly valid. Since `Coordinator` is always PM, listing it adds no value and structurally caused the critical `Tier` and `Model` info to be omitted. Furthermore, `Platform` concepts like `L0-only` or `Both` are metadata for template maintenance (L0/L1); exposing them to general L2 variant users is a serious UX anti-pattern. Therefore, I propose an architectural change to simplify and standardize the boilerplate format to: `| # | Task | Agent | Tier | Model |`. `docs-writer`, what is the exact scope of documents that need to be updated for this change?

**[docs-writer]**: (Round 1)
I strongly agree with architect's simplification proposal. The `| # | Task | Agent | Tier | Model |` format is the most intuitive and contains only the necessary info for cost and quality management.
To reflect this, we need to update three main areas in L0. First, the Execution Plan Boilerplate examples and guidelines in `CLAUDE.md` and `GEMINI.md`. Second, the examples and descriptions in `agents/pm.md`. Third, the hardcoded error message in `scripts/check-pm-approval.ts` which explains the table structure. After modifying these in L0, we must copy them to the L1 template (`templates/common/`) so that future L2 variants do not see these confusing columns. `auditor`, are there any validation points we should be careful about during this extensive boilerplate revision?

**[auditor]**: (Round 1)
I've heard both of your points. The architectural simplification and documentation scope are accurate.
From a validation perspective, I want to add that since `CLAUDE.md` and `GEMINI.md` are the core governance documents for both platforms, we must strictly maintain Platform Parity and update their formats identically. Also, since `scripts/check-pm-approval.ts` is being modified, we must bump its `@version` and update `SCRIPTS.md` for proper lifecycle management. Finally, after the work is done, we must use `bun scripts/publish-to-template.ts` or `propagate-to-templates.ts` to ensure the L0 modifications are fully propagated to `templates/common`, verifying through an L0/L1 Drift check. architect, how do you plan to manage the L0-only task classification that was previously controlled via the `Platform` column?

**[architect]**: (Round 2)
Thank you for the sharp question, auditor. Even if the `Platform` column is removed from the table, the internal logic where PM categorizes whether a task is "L0-only (workspace root)" or "requires L1/L2 propagation" must be maintained. That is, we will hide it from the table, but keep the governance rules in the PM's system prompt instructing them to "always check template propagation when modifying workspace common documents." This way, we provide a clean table to L2 users while maintaining the L0-level management structure. docs-writer, can you refine the guidelines in the documents to reflect this?

**[docs-writer]**: (Round 2)
Yes, I will follow your directions, architect. In the boilerplate examples of `CLAUDE.md` and `GEMINI.md`, I will remove `Platform` and `Coordinator`, and update the text descriptions below the table to maintain the management guide stating that "PM will internally determine L0-only status and perform appropriate propagation steps." I will also consistently update the text in `agents/pm.md` and `check-pm-approval.ts` to align with the new `| # | Task | Agent | Tier | Model |` format. Once the updates are complete, I will request verification from auditor.

**[auditor]**: (Round 2)
Perfect. The plans from docs-writer and architect satisfy both system consistency and user experience. After the L0 documents and scripts are updated, I will run `bun scripts/audit.ts` across the workspace to verify there are no rule conflicts or parity violations. I will also take the role of confirming that the file propagation to `templates/common` was executed without omission. Since the discussion is clearly resolved, I will write the Synthesis.

**[auditor]**: (Synthesis)
I will summarize the meeting.
**Points of Agreement:**
1. Simplify and standardize the Execution Task Plan boilerplate format to `| # | Task | Agent | Tier | Model |`. Completely remove the unnecessary `Coordinator` and confusing `Platform` columns from the table.
2. Simultaneously update the table examples and descriptive texts in `CLAUDE.md`, `GEMINI.md`, and `agents/pm.md` to match the new format. (However, the internal management guide for Platform classification will be retained as text).
3. Update the table column description in the rejection message of `scripts/check-pm-approval.ts`, and bump its version.
4. Once L0 changes are complete, propagate them to `templates/common` so that L2 variants use the new boilerplate.

**Open Disagreements or Unresolved Questions:**
None

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Finalize boilerplate simplification architecture and guide document updates | L0-only | Phase 2 |
| A-02 | docs-writer | Medium | Update boilerplate table format and descriptions in CLAUDE.md, GEMINI.md, agents/pm.md | L0-only | Phase 4 |
| A-03 | automation-engineer | Low | Update error message in check-pm-approval.ts, bump version, and sync SCRIPTS.md | L0-only | Phase 4 |
| A-04 | pm | High | Propagate modified L0 files to templates/common | L0-only | Phase 5 |
| A-05 | auditor | Medium | Final parity and template integrity verification via bun scripts/audit.ts | L0-only | Phase 6 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | CLAUDE.md and GEMINI.md only show `| # | Task | Agent | Tier | Model |` | File inspection |
| 2 | check-pm-approval.ts error message reflects the new format and version bumped | File inspection |
| 3 | L0 changes successfully propagated to templates/common | `publish-to-template.ts` or manual |
| 4 | Workspace audit passes with 0 errors | `bun scripts/audit.ts` |
