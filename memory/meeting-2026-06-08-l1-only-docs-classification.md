# Meeting Transcript

**Date**: 2026-06-08
**Topic**: Templates/common L1-only Docs File Classification and Copy Policy
**Participants**: pm, automation-engineer
**Rounds**: 2
**Language**: Korean (Transcript in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Automation Engineer]**:

Good. We need to reach clear agreement on the classification of files in templates/common/docs/.

**Classifying files currently in templates/common/docs/:**

**Files that should be copied (needed for L2):**
- context.md — Project context definition
- phase-definitions.md — 7-phase workflow definition
- README.md, README_ko.md — Project description
- security.md — Security policy

**L1-only files (workspace root only, should not be copied):**
- PROMOTION_CHECKLIST-template.md — Promotion checklist template
- QUALITY_GATES-template.md — Quality gates template
- variant-creation-workflow.md — Variant creation workflow
- variant-execution-plan-template.md — Variant execution plan template
- variant-pm-spec.md — Variant PM spec

Currently, the scaffolding script (`create-l2-scaffold.ts`) doesn't copy the entire docs/ folder, only creates subdirectories. This means essential files like context.md are not being copied.

PM colleague, do you agree with this classification? And what are your thoughts on the scaffolding logic modification approach?

**[PM]**:

I generally agree with Automation Engineer's classification, but there are some parts that need clarification.

**Regarding the need to copy context.md**, I agree. As the user clearly stated, this file should be copied when creating new projects.

**But we need to clarify the classification criteria:**

1. **Common infrastructure files (copy needed):**
   - context.md — Yes
   - phase-definitions.md — Yes (all variants use the same 7-phase workflow)
   - security.md — Yes (basic security policy)
   - README.md, README_ko.md — Yes (project structure description)

2. **L1-only template files (copy not needed):**
   - PROMOTION_CHECKLIST-template.md — L1-only
   - QUALITY_GATES-template.md — L1-only
   - variant-*.md files — L1-only (variant management documents)

**Scaffolding logic modification approach:**
1. Instead of copying the entire docs/
2. Decide copy status on a per-file basis
3. Alternatively, create a subdirectory like docs/_common/ to manage common files

Automation Engineer, what do you think about the actual implementation method?

### Round 2

**[Automation Engineer]**:

As PM colleague suggested, **deciding copy status on a per-file basis** is practical.

**Implementation proposal:**

1. **Modify scaffolding script (`create-l2-scaffold.ts`):**
   - Create docs/_common/ directory to store common files
   - Move these files to docs/_common/:
     - context.md
     - phase-definitions.md
     - security.md
     - README.md, README_ko.md
   - Create docs/_templates/ directory to store L1-only templates
   - Move these files to docs/_templates/:
     - PROMOTION_CHECKLIST-template.md
     - QUALITY_GATES-template.md
     - variant-*.md files
   - During scaffolding, only copy docs/_common/

2. **Advantages:**
   - Directory structure clearly distinguishes L1-only files
   - Scaffolding logic becomes simple (only copy docs/_common/)
   - Clear classification criteria when adding files in the future

PM colleague, do you agree with this structure? Shall I proceed with implementation?

**[PM]**:

I agree with Automation Engineer's proposal. It's logical to clearly distinguish using directory structure.

**Final agreement:**

1. **docs/_common/** — Common files copied to L2
   - context.md
   - phase-definitions.md
   - security.md
   - README.md, README_ko.md

2. **docs/_templates/** — L1-only template files
   - PROMOTION_CHECKLIST-template.md
   - QUALITY_GATES-template.md
   - variant-creation-workflow.md
   - variant-execution-plan-template.md
   - variant-pm-spec.md

3. **docs/_examples/** — Example files (maintain existing)
   - adr/, agents/, guides/, workflows/, etc.

**Scaffolding logic modification:**
- Only copy docs/_common/
- Do not copy docs/_templates/, docs/_examples/
- docs/_examples/ are example files

Now let's proceed with implementation. Automation Engineer, can you create the docs/_common/ and docs/_templates/ directory structure and move the files?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Create templates/common/docs/_common/ directory and move files | Both | 4 |
| A-02 | automation-engineer | Low | Create templates/common/docs/_templates/ directory and move files | Both | 4 |
| A-03 | automation-engineer | Low | Modify create-l2-scaffold.ts - only copy docs/_common/ | Both | 4 |
| A-04 | docs-writer | Medium | Apply consistency to existing variant templates/co-*/docs/ | Both | 4 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | docs/_common/ contains: context.md, phase-definitions.md, security.md, README.md, README_ko.md | Check directory contents |
| A-02 | docs/_templates/ contains: PROMOTION_CHECKLIST-template.md, QUALITY_GATES-template.md, variant-*.md files | Check directory contents |
| A-03 | New scaffolded projects have docs/_common/ files but not docs/_templates/ | Test scaffolding |
| A-04 | Existing variant docs/ are consistent with new structure | Run validation script |
