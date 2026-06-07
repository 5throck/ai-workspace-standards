# Meeting Transcript
**Date**: 2026-06-07
**Topic**: Standardization of pm.md additive format across all variants
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
Welcome team. Our focus today is resolving the critical structural inconsistencies across the `pm.md` files in our variants (`co-work`, `co-design`, `co-develop`, `co-security`, `co-consult`). While `co-consult` uses a strict additive format with `<!-- VARIANT-SECTION -->` markers, the others do not, and the `common` skeleton lacks the injection anchors. I'd like the architect to lead off on how we can unify this architecture. 

**[architect]**: (Round 1)
Thank you, PM. I've reviewed the discrepancy. The current state is fractured: `co-consult` implements our new L2 additive design, while the older variants maintain raw markdown overrides. To ensure a robust inheritance model, I propose we completely standardize around the `<!-- VARIANT-SECTION: [id] -->` pattern. The `templates/common/agents/pm.md` MUST serve as the sole source of truth for the base skeleton, containing explicit injection anchors.

**[scaffolding-expert]**: (Round 1)
Building on the architect's proposal, I completely agree. From a scaffolding perspective, the lack of markers in the `common` file breaks our L1-to-L2 injection logic. If we standardize on the additive sections (`governance-workflow`, `agent-roster`, `dispatch-protocol`), the scaffolding scripts can dynamically inject the variant-specific YAML and Markdown into the `common` skeleton during instantiation without duplicating the 500-line base file in every variant.

**[auditor]**: (Round 1)
I support both the architect and scaffolding-expert. From a compliance and QA standpoint, having 5 different formats of `pm.md` makes automated validation nearly impossible. My `validate-templates.ts` script needs predictable structures. By enforcing the additive marker pattern universally, I can write strict RegEx checks to ensure no variant accidentally overrides the core PM constraints (like the direct execution ban).

**[architect]**: (Round 2)
Auditor, your point about the core constraints is exactly why we need this. I propose the following implementation: I will update the `common/agents/pm.md` to include the anchor markers. Then, I will strip down the `pm.md` in `co-work`, `co-design`, `co-develop`, and `co-security` to contain ONLY their YAML frontmatter and the 3 additive sections, exactly mirroring `co-consult`. 

**[scaffolding-expert]**: (Round 2)
Architect, that approach is sound. However, we also need to update the `create-l2-scaffold.ts` script to ensure that when a new L2 variant is created, it automatically generates a skeletal `pm.md` with these markers, rather than copying the entire `common` file. I'll take ownership of that script update.

**[auditor]**: (Round 2)
Excellent plan. To ensure this doesn't regress, I will also add a specific rule to the `audit.ts` script that explicitly checks for the presence of the `<!-- VARIANT-SECTION -->` markers in all variant `pm.md` files. If a variant file exceeds a certain file size (e.g., > 100 lines), the audit will fail, preventing the 500-line duplication bug we just faced.

---

**[auditor]**: (Synthesis)

**Points of Agreement**:
1. All variant `pm.md` files must use the strict additive format utilizing `<!-- VARIANT-SECTION: [id] -->` markers.
2. The `templates/common/agents/pm.md` must be updated to include the necessary injection anchors.
3. Variant `pm.md` files must not contain the core PM skeleton text, drastically reducing their size.

**Open Disagreements or Unresolved Questions**:
- None. Full consensus reached on the architectural pattern and implementation steps.

**Concrete Next Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Update `common/agents/pm.md` with injection anchors and refactor 4 variant `pm.md` files to the additive format. | Both | Phase 1-2 |
| A-02 | scaffolding-expert | Low | Update `create-l2-scaffold.ts` to support generating the additive `pm.md` during scaffolding. | Both | Phase 4 |
| A-03 | auditor | Medium | Add file size and marker presence validation to `audit.ts` for `pm.md` files. | Both | Phase 4 |
| A-04 | docs-writer | Medium | Document the `pm.md` additive architecture pattern in `CONSTITUTION.md` or `AGENTS.md`. | Both | Phase 4 |

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Update `common/agents/pm.md` and variant `pm.md` files | Phase 1-2 |
| A-02 | scaffolding-expert | Low | Update scaffolding scripts | Phase 4 |
| A-03 | auditor | Medium | Update audit script | Phase 4 |
| A-04 | docs-writer | Medium | Update documentation | Phase 4 |
