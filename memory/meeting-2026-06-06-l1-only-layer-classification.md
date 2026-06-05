# Meeting Transcript

**Date**: 2026-06-06
**Topic**: L1-only Layer Classification Issue
**Participants**: pm, architect
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

### **Round 1**

**[PM]**:
Welcome to this meeting on the L1-only layer classification issue. The user has raised a valid concern about the logical contradiction in our current architecture: if L0 is the Single Source of Truth (SSOT), how can "L1-only" scripts exist? Let's discuss this architectural inconsistency and determine the correct classification.

Architect, you start us off by analyzing the current layer definitions and identifying the core contradiction.

---

**[Architect]**:
Thank you, PM. The contradiction is indeed fundamental. Looking at our SCRIPTS.md registry definitions:

```
L0      = workspace root only; must NOT be copied to templates/common/
L0+L1   = exists in scripts/ AND templates/common/scripts/
L1-only = generated project only; must exist in templates/common/scripts/ but not in scripts/
```

The problem is clear: our architecture states that "L0 is the SSOT" and "templates/common/scripts/ is a snapshot published from L0 via publish-to-template." If this is true, then **L1-only cannot exist** - anything in templates/common/scripts/ must either be:

1. Published from L0 (making it L0+L1), or
2. Directly authored in L1 without L0 source (which violates the SSOT principle)

The user's example of `propagate-to-templates.ts` illustrates this perfectly: it exists in templates/common/scripts/ but not in scripts/. According to our current definition, it's "L1-only," but this breaks our SSOT architecture because L1 has no independent source - L0 should be the source of everything.

I propose we eliminate the L1-only category entirely. Everything in templates/common/scripts/ must trace back to L0. The question is: how should we handle scripts like `propagate-to-templates.ts` that seem to belong in templates but not in scripts/?

---

**[PM]**:
Thank you for that analysis. The architectural contradiction is clear. If L1-only violates the SSOT principle, we need to decide: either eliminate L1-only as a category, or reconsider our SSOT definition.

Let me ask a follow-up: What's the actual purpose of scripts like `propagate-to-templates.ts` that live in templates/common/scripts/? Are they truly "L1-only" in intent, or should they be reclassified as L0?

---

**[Architect]**:
Excellent question. Let me analyze `propagate-to-templates.ts` specifically. This script's purpose is "L1→L2 sync tool" - it propagates changes from templates/common/ to variant projects.

The key insight is this: `propagate-to-templates.ts` operates **within the template system**, not within individual projects. It's a tool for managing the template infrastructure itself, similar to how `publish-to-template.ts` manages L0→L1 publishing.

Here's the critical distinction:
- `publish-to-template.ts`: L0 tool, publishes L0 → L1, lives in scripts/ (L0)
- `propagate-to-templates.ts`: L1 tool, propagates L1 → L2, lives in templates/common/scripts/

From a deployment perspective:
- `publish-to-template.ts` is L0 because it's invoked from workspace root
- `propagate-to-templates.ts` is invoked from within templates/common/ when managing template updates

**The real issue**: We're conflating two different concerns:
1. **Physical location**: Where the file lives
2. **Operational scope**: Where it gets invoked from

I propose we recognize a legitimate category: **L1 infrastructure scripts** that manage the template layer itself. These scripts are not "generated project only" - they're **template management tools**. They should be L0-authored but L1-deployed.

---

### **Round 2**

**[PM]**:
This is a key insight. You're distinguishing between physical location and operational scope. If I understand correctly, you're proposing that L1-only scripts are actually **L0-authored, L1-deployed template infrastructure**, not independently created L1 artifacts.

Let me push on this: If we recognize L1 infrastructure scripts as a legitimate category, how do we maintain the SSOT principle? Where is the source of truth for these scripts?

---

**[Architect]**:
You've identified the crux of the problem. The SSOT principle requires that everything has a single authoritative source. Here's my proposal:

**Source of Truth = L0 authorship, regardless of physical deployment location**

For `propagate-to-templates.ts`:
- **Source of truth**: Should be authored in scripts/ (L0) alongside `publish-to-template.ts`
- **Deployment**: Gets published to templates/common/scripts/ (L1) like other L0+L1 scripts
- **Invocation**: Called from within template context when managing L1→L2 propagation

This means `propagate-to-templates.ts` should actually be classified as **L0+L1**, not L1-only. It's authored in L0 (SSOT maintained) but primarily operates in the L1 context.

The broader pattern: **Eliminate L1-only entirely**. Any script that needs to exist in templates/common/scripts/ should either:
1. Be L0+L1: Authored in L0, published to L1, used in template operations
2. Be pure L0: Workspace-only tools like new-project.sh

The "L1-only" category was a conceptual error - it implied L1 could have independent sources, which violates our SSOT architecture.

---

**[PM]**:
This clarifies the resolution significantly. You're proposing we eliminate the L1-only layer classification because it violates the SSOT principle. Everything should trace back to L0 authorship.

Let me confirm the action plan:

1. **Reclassify `propagate-to-templates.ts`** from "L1-only" to "L0+L1"
2. **Move physical file** from templates/common/scripts/ to scripts/
3. **Update SCRIPTS.md** registry to reflect L0+L1 classification
4. **Remove L1-only from layer definitions** entirely
5. **Update documentation** to clarify: L0 is always the SSOT; L1 is a published snapshot

Does this capture your proposal correctly?

---

**[Architect]**:
Yes, that captures it perfectly. Let me add one critical clarification on the file movement:

**Immediate action**: Copy `propagate-to-templates.ts` from templates/common/scripts/ to scripts/, update SCRIPTS.md to register it as L0+L1, then run `bun run publish-to-template` to publish it back to templates/common/scripts/.

This ensures:
- SSOT maintained in scripts/
- L1 receives updated version via standard publishing pipeline
- No breaking change to existing references in templates/common/

The key principle going forward: **All scripts in our system must have L0 as their source of truth.** The "L1-only" category was architecturally unsound because it implied L1 could be independent, which contradicts our fundamental SSOT design.

I recommend we also audit SCRIPTS.md for any other entries classified as L1-only and either reclassify them as L0+L1 (if they're legitimate infrastructure) or remove them entirely (if they're obsolete).

---

**[PM]**:
Excellent. The resolution is clear and maintains our architectural principles. Let me move to synthesis.

---

## Synthesis

### **[Auditor]**

### Points of Agreement

1. **L1-only is architecturally invalid**: The L1-only category contradicts the SSOT principle that L0 is the single source of truth for all scripts.

2. **Root cause identified**: `propagate-to-templates.ts` was classified as L1-only because it lives in templates/common/scripts/, but this violated the principle that all scripts must trace back to L0 authorship.

3. **Resolution agreed**: Eliminate L1-only as a layer category. Reclassify `propagate-to-templates.ts` from L1-only to L0+L1, maintaining L0 as the authoritative source.

4. **File movement strategy**: Copy `propagate-to-templates.ts` from templates/common/scripts/ to scripts/, update SCRIPTS.md registry, then publish back via standard pipeline.

5. **Documentation update needed**: Remove L1-only from layer definitions and clarify that L0 is always the SSOT.

### Open Questions

None - architectural resolution is clear and maintains governance principles.

### Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | Architect | Medium | Move propagate-to-templates.ts to scripts/ and reclassify as L0+L1 in SCRIPTS.md | L0-only | Phase 4 |
| A-02 | docs-writer | Low | Remove L1-only from SCRIPTS.md layer definitions and clarify L0 SSOT principle | L0-only | Phase 4 |
| A-03 | automation-engineer | Low | Audit SCRIPTS.md for any remaining L1-only entries and classify/reclassify | L0-only | Phase 4 |
| A-04 | Auditor | Medium | Run full audit after changes to verify no L1-only references remain in system | L0-only | Phase 4 |

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | propagate-to-templates.ts exists in scripts/ with @version header matching SCRIPTS.md | File exists and verify-scripts.ts passes |
| A-02 | SCRIPTS.md layer definitions exclude L1-only category | Documentation review |
| A-03 | No scripts classified as L1-only in registry | grep SCRIPTS.md confirms |
| A-04 | All audit checks pass with no L1-only warnings | bun scripts/audit.ts passes |
