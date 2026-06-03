# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-test variant cleanup strategy
**Participants**: pm, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Round 1)

Opening the meeting. Today's agenda is "co-test variant cleanup strategy." co-test is a beta variant created for L2-to-Variant pipeline validation. Now that the pipeline is complete, we need to discuss how to properly clean up this test variant.

lifecycle-manager, I'd like your perspective first. co-test is currently in beta status (v0.1.0) with 112 files in templates/co-test/. How should we handle this from a lifecycle perspective?

---

**[lifecycle-manager]**: (Round 1)

PM, good point. Let me analyze from lifecycle perspective.

Current co-test status:
1. **Purpose**: Pipeline validation (temporary purpose)
2. **Lifecycle State**: beta (v0.1.0), created 2026-06-03
3. **Dependencies**: inherits templates/common only (no variant-specific dependencies)
4. **Integration Status**: Not registered in VERSION_REGISTRY, new-project.ps1 (Phase 7 incomplete)

I propose:

**Option A: Complete Removal**
- Delete templates/co-test/ directory
- Pros: Clean workspace, prevents confusion
- Cons: Loss of pipeline validation record

**Option B: Archive then Remove**
- Move to docs/examples/co-test/ then delete original
- Pros: Preserves pipeline example for future reference
- Cons: Requires examples folder cleanup

From lifecycle perspective, I recommend **Option B**. Pipeline validation variants have value for future reference when developing similar pipelines. PM, what's your perspective?

---

**[PM]**: (Round 2)

I understand lifecycle-manager's proposal. From PM perspective, let me add analysis:

I agree with **Option B (Archive then Remove)** for these reasons:

1. **PM Gateway Perspective**: co-test creation was an authorized experimental task. Preserving its result helps with transparency.

2. **Reusability**: Future variant pipeline development can use co-test as a reference case.

3. **Documentation Value**: Actual pipeline-generated variant structure is a clearer example than design documents.

However, I suggest **archiving location**:
- Instead of `docs/templates/examples/co-test/`, use `docs/_examples/co-test-pipeline-output/`
- Reason: In current workspace structure, `_examples` folder is reference-only and excluded from template scaffolding.

lifecycle-manager, do you agree with this location? Can you propose specific moving procedure?

---

**[lifecycle-manager]**: (Round 2)

PM, I agree with your proposal. `docs/_examples/co-test-pipeline-output/` is more appropriate. I verified current workspace structure shows `templates/*/docs/_examples/` is reference-only excluded during project generation.

**Specific archiving procedure**:

**Step 1: Prepare Archiving**
- Create `docs/_examples/co-test-pipeline-output/` directory
- Add README.md: "L2-to-Variant Pipeline Output Example (2026-06-03)"

**Step 2: Archive variant only**
- Move `templates/co-test/` → `docs/_examples/co-test-pipeline-output/variant/`
- Include variant.json, README.md, CLAUDE.md, GEMINI.md

**Step 3: Delete original location**
- Delete `templates/co-test/` directory

**Step 4: Documentation**
- Add reference to archiving location in `docs/designs/l2-to-variant-conversion-pipeline.md`
- Enable pipeline users to verify actual output examples

How should we explain the **Phase 7 integration incomplete status**? Should we archive as-is (unregistered in VERSION_REGISTRY), or should we register first then archive?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | Medium | Final approval for co-test archiving execution plan | Immediate |
| A-02 | lifecycle-manager | Low | Create docs/_examples/co-test-pipeline-output/ and write README | After A-01 |
| A-03 | pm | Low | Move templates/co-test/ to docs/_examples/ | After A-02 |
| A-04 | pm | Low | Add reference to example location in docs/designs/l2-to-variant-conversion-pipeline.md | After A-03 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | templates/co-test/ removed | Directory no longer exists |
| AC-02 | Archive created at docs/_examples/co-test-pipeline-output/ | README.md present explaining purpose |
| AC-03 | Documentation updated | Pipeline design doc references example location |
| AC-04 | No broken references | No files reference deleted templates/co-test/ |

---

## Open Question for PM Decision

**Phase 7 Incomplete State**: Should we preserve the incomplete integration state (unregistered in VERSION_REGISTRY) as-is, or temporarily register it before archiving? This decision affects how future users interpret the example.
