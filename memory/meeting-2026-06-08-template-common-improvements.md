# Meeting Transcript

**Date**: 2026-06-08
**Topic**: Templates/common Template Improvement Plan
**Participants**: pm, automation-engineer
**Rounds**: 2
**Language**: Korean (Transcript in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Automation Engineer]**:

Let me start by summarizing the issues we've identified:

**First, regarding `_CLAUDE.md.template` and `_GEMINI.md.template` files**: The current scaffolding script (`create-l2-scaffold.ts`) copies these `.template` files as-is to create `CLAUDE.md`/`GEMINI.md`. The problem is that the content is minimal - just a source comment and Role Declaration. This requires additional work after scaffolding. It would be more rational to directly copy the complete `templates/common/CLAUDE.md` and `GEMINI.md` files.

**Second, the lifecycle-manager agent issue**: Although `templates/common/AGENTS.md` explicitly states "Workspace root only", this file is included in the L1 template and continues to propagate to L2 variants. Workspace root-only agents should be excluded from the L1 template.

PM colleague, what are your thoughts on these two issues?

**[PM]**:

Both points raised by Automation Engineer are valid.

**Regarding the `.template` file issue**: When I checked the scaffolding logic:
1. It reads `_CLAUDE.md.template` and copies it to `CLAUDE.md`
2. The generated file only contains a "Customize it for your variant's specific behaviors" instruction
3. Users will expect a complete `CLAUDE.md`/`GEMINI.md` from the start

Therefore, we should remove the `.template` files and modify `create-l2-scaffold.ts` to directly copy `templates/common/CLAUDE.md` and `GEMINI.md`.

**Regarding the lifecycle-manager issue**: This relates to the core L1-L2 Fork Model principle. Workspace root-only elements (L0-only) should not be included in L1 templates. We need to remove the Lifecycle Manager entry from `templates/common/AGENTS.md`.

However, there's also a **memory folder issue**. Currently, `memory/MEMORY.md` is being generated, but new projects should start with an empty folder. Automation Engineer, could you also review implementing this change?

### Round 2

**[Automation Engineer]**:

I've reviewed the memory folder issue that PM mentioned. Currently, the `generateStubs` function calls `writeFile(path.join(projectDir, "memory", "MEMORY.md"), memoryMd)`. We should remove this and instead only call `ensureDir(path.join(projectDir, "memory"))` to create an empty folder.

**To summarize the three modifications:**

1. **Remove `.template` files and update scaffolding logic**
   - Delete `_CLAUDE.md.template`, `_GEMINI.md.template`
   - Change `create-l2-scaffold.ts` to directly copy `templates/common/CLAUDE.md`, `GEMINI.md`

2. **Remove lifecycle-manager**
   - Remove Lifecycle Manager entry from `templates/common/AGENTS.md`
   - As a workspace root-only agent, it should not be in L1 templates

3. **Create empty memory folder**
   - Remove code that generates `memory/MEMORY.md`
   - Create only an empty folder

Additionally, there's a **docs/ folder related issue**. Currently, the scaffolding script does not copy docs/. However, existing variants (`templates/co-*/docs/`) contain `PROMOTION_CHECKLIST-template.md`, `QUALITY_GATES-template.md`, etc. These were manually added in PR #224. To prevent these files from being generated during future scaffolding, we should maintain the current logic (don't copy docs/).

PM colleague, do you agree with this modification plan? Are there any additional considerations?

**[PM]**:

I fully agree with Automation Engineer's modification plan. It's clear.

**Final summary:**

1. **Remove `.template` files and update scaffolding logic** — Agreed. This is necessary for simplification and usability improvement.

2. **Remove lifecycle-manager** — Agreed. According to L0-only principles, workspace root-only agents should be excluded from L1 templates.

3. **Create empty memory folder** — Agreed. New projects should start with an empty state.

4. **Regarding docs/ folder** — Maintain current logic. Since scaffolding doesn't copy docs/, unnecessary files won't be included in new projects.

**Additionally, I'd like to propose** that after these modifications are applied to the L1 template (`templates/common/`), existing L2 variants (`templates/co-*/`) should also be consistently updated for consistency. Specifically:
- Remove lifecycle-manager entries from `templates/co-*/AGENTS.md`
- Consider removing unnecessary template files (`PROMOTION_CHECKLIST-template.md`, `QUALITY_GATES-template.md`) from `templates/co-*/docs/`

Automation Engineer, can you implement the modifications including this consistency application?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Delete `_CLAUDE.md.template`, `_GEMINI.md.template` files | Both | 4 |
| A-02 | automation-engineer | Low | Modify `create-l2-scaffold.ts` - implement direct copy logic for CLAUDE.md/GEMINI.md | Both | 4 |
| A-03 | docs-writer | Medium | Remove lifecycle-manager entry from `templates/common/AGENTS.md` | Both | 4 |
| A-04 | automation-engineer | Low | Modify `create-l2-scaffold.ts` - remove memory/MEMORY.md generation code | Both | 4 |
| A-05 | docs-writer | Medium | Apply consistency to `templates/co-*/AGENTS.md` - remove lifecycle-manager entries | Both | 4 |
| A-06 | docs-writer | Medium | Review removal of unnecessary template files from `templates/co-*/docs/` | Both | 4 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | `.template` files no longer exist in `templates/common/` | `ls templates/common/*.template` returns empty |
| A-02 | New scaffolded projects have complete CLAUDE.md/GEMINI.md | Test scaffold and verify file content |
| A-03 | `templates/common/AGENTS.md` does not contain lifecycle-manager | `grep -i lifecycle-manager templates/common/AGENTS.md` returns empty |
| A-04 | New scaffolded projects have empty memory folder | Test scaffold and verify `memory/` contains no files |
| A-05 | All `templates/co-*/AGENTS.md` files are consistent | Run validation script |
| A-06 | Unnecessary template files are removed from variants | Manual review of `templates/co-*/docs/` |
