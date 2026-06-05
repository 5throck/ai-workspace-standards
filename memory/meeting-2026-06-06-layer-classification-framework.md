# Meeting Transcript

**Date**: 2026-06-06
**Topic**: L0 L0+L1 L0+L1+L2 Layer Classification Framework
**Participants**: pm, architect
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

### **Round 1**

**[PM]**:
Welcome to this follow-up meeting on refining our layer classification framework. The user has made two critical corrections to our previous discussion:

1. `propagate-to-templates.ts` should be classified as L0 (not L0+L1) since it performs L0→L1 synchronization
2. Our design documentation should explicitly declare that only 3 layer types exist: L0, L0+L1, L0+L1+L2

These corrections strengthen our architecture by making the layer classification more precise and eliminating ambiguity. Let's discuss how to properly classify `propagate-to-templates.ts` and formalize our 3-type layer framework.

Architect, please start by analyzing what L0 means for a tool that performs L0→L1 synchronization.

---

**[Architect]**:
Thank you, PM. The user's correction is architecturally sound. Let me analyze the proper classification for `propagate-to-templates.ts`:

**What `propagate-to-templates.ts` actually does**:
- Reads files from workspace root (L0)
- Compares them against templates/common/ (L1)
- Applies changes to bring L1 in sync with L0
- Operates within the workspace context, not within templates

**Key insight**: This tool is **workspace infrastructure**, not template infrastructure. It's invoked from the workspace root to manage the L0→L1 publishing process. It doesn't need to exist in templates/common/ at all because:
- It's never called from within a template context
- It's only used by workspace maintainers to publish L0→L1
- It operates on L0 files as the source, L1 as the target

**Correct classification**: L0-only

This means:
- **Source of truth**: scripts/ (L0)
- **Deployment**: Does NOT get published to templates/common/
- **Usage**: Invoked from workspace root only
- **Purpose**: Workspace infrastructure for L0→L1 sync

This aligns perfectly with other L0-only tools like `new-project.sh`, `create-l2-scaffold.ts`, `publish-to-template.ts` - all workspace infrastructure that shouldn't exist in templates.

---

**[PM]**:
This clarifies the classification significantly. You're saying that tools which **manage the publishing process** are themselves L0-only because they're workspace infrastructure, not deliverable content.

Let me verify this understanding: `publish-to-template.ts` (L0→L1 publishing) and `propagate-to-templates.ts` (L0→L1 verification/sync) are both L0-only because they're part of the workspace infrastructure that manages templates, not part of the templates themselves?

---

**[Architect]**:
Exactly! You've captured the distinction perfectly:

**Workspace Infrastructure (L0-only)**:
- `publish-to-template.ts`: Publishes L0→L1
- `propagate-to-templates.ts`: Verifies/syncs L0→L1
- `new-project.sh`: Creates new projects from templates
- `create-l2-scaffold.ts`: Creates new L2 variants
- `tag-template.ts`: Tags template versions

These tools **manage the template system** but are not **part of** the template system.

**Template Content (L0+L1)**:
- `audit.ts`: Runs in workspace AND in projects
- `hooks/pre-commit.ts`: Used in workspace AND in projects
- `lib/error-handling.ts`: Library code used by scripts in both layers

This brings us to the user's second point: we need to explicitly declare that **only 3 layer types exist** in our architecture. The current SCRIPTS.md has an "L1-only" definition that creates confusion and violates our SSOT principle.

---

### **Round 2**

**[PM]**:
This distinction is clear and maintains our architectural principles. Now let's address the user's requirement to explicitly declare our 3-type layer framework in documentation.

Based on our discussion, the 3 valid layer types should be:

1. **L0-only**: Workspace infrastructure tools that manage the system but don't get published to templates
2. **L0+L1**: Scripts that exist in both workspace and templates, used in both contexts
3. **L0+L1+L2**: Scripts that flow all the way down to individual projects

Does this capture our complete layer framework? Or should "L0+L1+L2" be reconsidered given our Fork Model (L1→L2 relationship ends after scaffold)?

---

**[Architect]**:
Excellent question. You've identified a critical inconsistency in our current framework. Let me analyze "L0+L1+L2":

According to ADR-0031 (Fork Model), once an L2 variant is scaffolded from L1, the relationship **ends**. L2 evolves independently. So technically, "L0+L1+L2" suggests ongoing synchronization that doesn't actually happen.

**However**, looking at our current SCRIPTS.md registry, we have entries like:
- `audit.ts`: L0+L1
- `hooks/pre-commit.ts`: L0+L1  
- `lib/error-handling.ts`: L0+L1

I don't see any current entries classified as L0+L1+L2. The scaffold copies L1→L2 at creation time, then L2 is independent.

**Revised 3-type framework**:
1. **L0-only**: Workspace infrastructure, not published to templates
2. **L0+L1**: Published to templates, copied to L2 at scaffold time, then independent
3. **L0-only (Fork-specific)**: Tools that manage the fork process itself (new-project, create-l2-scaffold, etc.)

Wait, that's still 3 types but the third one is just a subcategory of L0-only. Let me reconsider.

**Actually, the user's proposed 3-type framework is**:
1. **L0**: Workspace-only
2. **L0+L1**: Workspace + Template snapshot
3. **L0+L1+L2**: Automatically flows to all layers

But given the Fork Model, type 3 doesn't really exist because L2 doesn't receive ongoing updates from L1.

---

**[PM]**:
This reveals an important clarification. If "L0+L1+L2" implies ongoing synchronization that doesn't happen due to the Fork Model, then our actual framework is simpler:

**Real-world classification (what actually happens)**:
1. **L0**: Workspace-only (publish-to-template, new-project, etc.)
2. **L0+L1**: Exists in workspace and templates, copied to L2 once at scaffold time

This means we only have **2 active layer types**, not 3. The "L0+L1+L2" category is conceptually misleading because it suggests continuous propagation that doesn't occur.

Should we explicitly declare this 2-type framework in our documentation, or is the user proposing something different?

---

**[Architect]**:
Let me propose a more precise interpretation that reconciles the user's 3-type framework with our Fork Model:

**The 3 types refer to deployment scope, not synchronization behavior**:

1. **L0**: Deployed to workspace root only
2. **L0+L1**: Deployed to workspace + templates/common/, then copied to L2 at scaffold time
3. **L0+L1+L2**: (Hypothetical) Would mean continuous sync to all layers - but this doesn't exist in our architecture

**The key insight**: "L0+L1+L2" as a category doesn't mean "continuously syncs to all 3 layers" - it means "when scaffolding, this flows to L2 as well." But since we use the Fork Model, **everything stops at L1** for ongoing updates.

**What the user is asking for**: Explicit documentation that our architecture only supports 3 classification labels, regardless of how many are actually in use. The existence of "L1-only" in current documentation creates 4 categories and violates SSOT.

**Proposed declaration in SCRIPTS.md**:
```
Layer column values (only 3 valid types):
  L0      = workspace root only; does not propagate to templates or projects
  L0+L1   = exists in scripts/ AND templates/common/scripts/; copied to L2 at scaffold time only
  L0+L1+L2 = reserved for future use; not currently used due to Fork Model
```

---

**[PM]**:
This clarifies the framework significantly. You're proposing that we explicitly declare our 3-type classification system even if one type is currently unused, providing clarity and preventing future confusion.

The key declarations would be:
1. Only 3 layer types exist: L0, L0+L1, L0+L1+L2
2. L0+L1+L2 is reserved/not used due to Fork Model
3. "L1-only" category is eliminated (was architecturally invalid)
4. `propagate-to-templates.ts` classified as L0

Let me confirm the action plan:

1. **Move `propagate-to-templates.ts`** from templates/common/scripts/ to scripts/
2. **Classify as L0** in SCRIPTS.md
3. **Update SCRIPTS.md layer definitions** to explicitly declare only 3 valid types
4. **Remove all L1-only references** from documentation
5. **Add explanatory note** that L0+L1+L2 is reserved due to Fork Model

Does this capture the complete resolution?

---

**[Architect]**:
Yes, that captures it perfectly. Let me add one important clarification on the file movement strategy:

**Immediate execution**:
1. Copy `templates/common/scripts/propagate-to-templates.ts` → `scripts/propagate-to-templates.ts`
2. Add to SCRIPTS.md as L0 with version 1.1.1
3. Delete from templates/common/scripts/ (since L0 doesn't publish)
4. Update SCRIPTS.md layer definitions to declare only 3 valid types
5. Run full audit to verify no L1-only references remain

**Documentation update**:
```
## Layer Classification Framework (3 types only)

| Layer | Description | Publish | Example |
|-------|-------------|---------|---------|
| L0 | Workspace infrastructure only | No | new-project.sh, publish-to-template.ts, propagate-to-templates.ts |
| L0+L1 | Workspace + Template snapshot | Yes, to templates/common/ | audit.ts, hooks/pre-commit.ts |
| L0+L1+L2 | Reserved for future use | Not used (Fork Model) | N/A |

**Note**: "L1-only" category is architecturally invalid and has been removed.
All scripts must have L0 as their source of truth (SSOT principle).
```

This maintains our architectural principles while providing explicit clarity on our layer classification framework.

---

**[PM]**:
Excellent. The resolution is comprehensive and maintains governance principles. Let me move to synthesis.

---

## Synthesis

### **[Auditor]**

### Points of Agreement

1. **propagate-to-templates.ts classification**: Should be L0 (workspace infrastructure), not L0+L1. This tool manages L0→L1 synchronization but is itself workspace infrastructure.

2. **3-type layer framework**: Explicitly declare only 3 valid layer types: L0, L0+L1, L0+L1+L2. Eliminate "L1-only" as architecturally invalid.

3. **L0+L1+L2 status**: Reserved for future use, not currently implemented due to Fork Model (L1→L2 relationship ends after scaffold).

4. **L1-only elimination**: Remove all references to "L1-only" category from SCRIPTS.md and related documentation as it violates SSOT principle.

5. **File movement strategy**: Copy propagate-to-templates.ts to scripts/, classify as L0, remove from templates/common/scripts/ (L0 doesn't publish).

### Open Questions

None - framework resolution is clear and architecturally sound.

### Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | Architect | Medium | Move propagate-to-templates.ts to scripts/ and classify as L0 in SCRIPTS.md | L0-only | Phase 4 |
| A-02 | docs-writer | Medium | Update SCRIPTS.md to explicitly declare 3-type layer framework and remove L1-only | L0-only | Phase 4 |
| A-03 | docs-writer | Low | Add layer classification table to SCRIPTS.md with examples for each type | L0-only | Phase 4 |
| A-04 | Auditor | Medium | Run full audit to verify no L1-only references remain in system | L0-only | Phase 4 |

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | propagate-to-templates.ts exists in scripts/ with L0 classification and removed from templates/common/ | File exists, SCRIPTS.md updated, templates/common/ cleaned |
| A-02 | SCRIPTS.md explicitly declares only 3 layer types and removes L1-only definition | Documentation review |
| A-03 | Layer classification table present in SCRIPTS.md with examples for each type | Table exists and accurate |
| A-04 | All audit checks pass with no L1-only warnings | bun scripts/audit.ts passes |
