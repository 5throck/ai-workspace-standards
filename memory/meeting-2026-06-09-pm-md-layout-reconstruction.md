# Meeting Transcript
**Date**: 2026-06-09
**Topic**: PM.md Layout Reconstruction Issue Analysis and Resolution Plan
**Participants**: PM, architect, automation-engineer, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**PM**:
Meeting started. Current issues identified:
1. ROLE duplication: variant-specific + workspace root `## Role` declared twice
2. Character corruption: "?좑훰/좑°" instead of proper formatting
3. Agent Roster duplication: variant-specific + workspace root tables exist twice
4. L0 agent leakage: workspace root agents referenced in variants
5. L0 content duplication: Phase Determination tables show L0 workflow
6. Language inconsistency: Korean examples mixed in English documentation
7. Spurious "??" characters: unnecessary "??" characters throughout documents <!-- encoding-check-ignore -->
8. Typo: "emplate" → "Template" correction needed

**architect**:
The problem stems from **failed Layout Reconstruction process**. The design document `pm-md-variant-specific-content-injection-design.md` defines Complete Layout Reconstruction strategy for v1.5.0+, but it's not implemented.

The root cause is the trigger condition in `merge-frontmatter.ts`:
```typescript
if (isPMFile && hasVariantOverrides && variantLevel === 'L2') {
  return reconstructPMLayout(yaml, baseContent, variantLevel);
}
```

This condition doesn't work properly, causing L0 content duplication instead of complete reconstruction during L2 template generation. **Layout Reconstruction enhancement** is needed.

**automation-engineer**:
Agreed. I confirmed that `scripts/helpers/merge-frontmatter.ts` lines 882-1632 contain Layout Reconstruction functions, but they're not being called:
- `generateAgentRosterTable()` - implemented
- `extractAgentTypes()` - implemented  
- `generatePhaseDeterminationTable()` - implemented
- `removeL0OnlyContent()` - implemented

However, `reconstructPMLayout()` orchestration function is never called, making all these functions useless. **Trigger condition modification** is urgently needed.

**auditor**:
Verified three project pm.md files:
- `co-work/agents/pm.md`: 401 lines (L0 duplication)
- `co-design/agents/pm.md`: 465 lines (L0 duplication)
- `co-consult/agents/pm.md`: 491 lines (L0 duplication)

Meanwhile, normal templates:
- `templates/co-work/agents/pm.md`: YAML frontmatter only (~70 lines)
- `templates/co-design/agents/pm.md`: YAML frontmatter only (~70 lines)

This means **Layout Reconstruction is not working during project scaffolding** (create-l2-scaffold.ts, new-project.ps1/sh). **Scaffolding script modification** is needed.

---

### Round 2

**architect**:
Building on auditor's point, we need to verify the **second trigger point: project scaffolding**. We need to check how `scripts/new-project.sh` and `scripts/new-project.ps1` call `merge-frontmatter.ts`.

Also, **design document updates** are needed. Current design docs only cover L0, not adequately addressing generated project issues.

**automation-engineer**:
As architect mentioned, I'll propose modifying the trigger condition in `merge-frontmatter.ts`:

```typescript
// Current (problematic)
const isPMFile = filePath.toLowerCase().endsWith('agents/pm.md');
const hasVariantOverrides = !!yaml.variant_overrides;

if (isPMFile && hasVariantOverrides && variantLevel === 'L2') {
  return reconstructPMLayout(yaml, baseContent, variantLevel);
}

// Proposed fix
const isPMFile = filePath.toLowerCase().endsWith('agents/pm.md');
const hasVariantOverrides = !!yaml.variant_overrides;

// During project scaffolding, always treat as L2
// For L2 projects with variant_overrides, always reconstruct
if (isPMFile && hasVariantOverrides) {
  return reconstructPMLayout(yaml, baseContent, 'L2');
}
```

**auditor**:
Let me verify automation-engineer's proposed fix. But more importantly, we need to address **fixing existing generated projects**.

Three projects were already generated incorrectly:
- co-work, co-design, co-consult

For these, we need:
1. **Correction work**: Remove L0 content, keep only variant-specific content
2. **Regeneration**: Regenerate with correct Layout Reconstruction

Which approach is more appropriate?

---

### Round 3 (Final Consensus)

**architect**:
Regarding auditor's question, I propose **correction work + regeneration** approach.

Rationale:
1. **Preserve existing projects**: Users may already be working in these
2. **Faster resolution**: Fix Layout Reconstruction, then regenerate
3. **Consistency**: All projects follow same standards

Sequence:
1. Fix `merge-frontmatter.ts` trigger condition
2. Update design documents
3. Regenerate 3 projects
4. QA verification

**automation-engineer**:
Agreed with architect's proposal. I'll propose concrete task sequence:

1. **merge-frontmatter.ts modification**: Simplify trigger condition
2. **Design document update**: Reflect generated project issues
3. **3 projects regeneration**: Regenerate using new-project scripts
4. **QA verification**: Verify with audit.ts

Estimated time:
- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 15 minutes (5 minutes each)
- Phase 4: 30 minutes
**Total 2 hours 15 minutes**

**auditor**:
Agreed. But we must follow **PM Gateway workflow**. This is a multi-step task, so execution plan table must be displayed first and approved.

**PM**:
Understood. I'll formulate the execution plan based on the meeting discussion.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|---------|-------|
| 1 | automation-engineer | Low | merge-frontmatter.ts trigger condition fix | Both | Implementation |
| 2 | docs-writer | Medium | Design document update (reflect generated project issues) | Both | Documentation |
| 3 | pm | High | co-work project regeneration | Both | Execution |
| 4 | pm | High | co-design project regeneration | Both | Execution |
| 5 | pm | High | co-consult project regeneration | Both | Execution |
| 6 | auditor | Medium | Final QA verification | Both | Validation |

**Execution Order**: Sequential (1→2→3→4→5→6)

## Acceptance Criteria

1. **After merge-frontmatter.ts fix**: Verify trigger condition is simplified
2. **After design document update**: Confirm generated project issues are clearly documented
3. **After project regeneration**: Verify 3 projects' pm.md files are under 150 lines
4. **After final QA**: Verify audit.ts passes all checks

## Additional Recommendations

- **Check other variants**: Verify if co-develop, co-security projects have similar issues
- **Preventive measures**: Add guidelines to prevent recurrence in future project generation