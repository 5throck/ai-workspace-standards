# Meeting Transcript
**Date**: 2026-06-07
**Topic**: Content-level standardization of pm.md additive overrides to match variant.json intent
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
Welcome back, team. While we successfully established the structural `<!-- VARIANT-SECTION -->` markers, the user has correctly pointed out a deeper issue. The *content* inside these markers is completely inconsistent. `common/agents/pm.md` is essentially a 1:1 copy of the workspace root, while the variant `pm.md` files (`co-work`, `co-design`, etc.) contain outdated legacy boilerplate (the old 7-phase text) instead of minimal additive overrides. Furthermore, the text in the variants completely ignores the specific intent declared in their `variant.json` files. Architect, how should we resolve this content discrepancy?

**[architect]**: (Round 1)
I've reviewed the files, and the discrepancy is severe. For example, `co-work/variant.json` explicitly states its override reason is "Phase 3 = Stakeholder Alignment". However, its actual `pm.md` file just blindly copies the old "Phase 3 = Design Handoff (variant-specific)" boilerplate. The entire point of the Additive Architecture is that the L2 variants should ONLY contain the *delta*—the specific changes—not the entire duplicated workflow. The content inside the markers in the variants must be radically minimized to only include the overriding text.

**[scaffolding-expert]**: (Round 1)
Exactly. If the L2 variants contain the full boilerplate, our `create-l2-scaffold.ts` script is just injecting redundant text. The base L1 `common/agents/pm.md` should hold the canonical default text for the Governance Workflow and Agent Roster inside its anchors. If a variant like `co-work` overrides Phase 3, its `pm.md` should provide the exact replacement text for the entire section or the specific delta, but currently, it's just a copy-paste of a legacy version.

**[auditor]**: (Round 1)
From an audit perspective, the mismatch between a variant's `variant.json` declaration and its actual `pm.md` implementation is a critical documentation failure. If `variant.json` claims the Roster includes `researcher` and `doc-writer`, but the `pm.md` table lists `content-writer` and `analyst`, the variant contract is broken. We must enforce absolute alignment between the JSON schema intent and the Markdown content.

**[architect]**: (Round 2)
To resolve this, I propose a complete rewrite of the content inside the `<!-- VARIANT-SECTION -->` blocks for all 5 variants (`co-consult`, `co-work`, `co-design`, `co-develop`, `co-security`). I will manually strip out all the common boilerplate and rewrite their Governance Workflow and Agent Roster tables to strictly and ONLY reflect the unique agents and phase overrides declared in their `variant.json` files.

**[scaffolding-expert]**: (Round 2)
I agree. In tandem, I will review `templates/common/agents/pm.md` to ensure it contains the 100% up-to-date canonical text from the workspace root (`agents/pm.md`) inside its anchors. This way, any variant that doesn't override a section (or only overrides part of it) will fall back to the correct, modern SSOT text during scaffolding.

**[auditor]**: (Round 2)
This is the correct path. Once the files are rewritten, they will truly embody the Additive Template Architecture. I will verify the changes against the `variant.json` manifests to ensure 100% alignment once you complete the rewrite.

---

**[auditor]**: (Synthesis)

**Points of Agreement**:
1. Variant `pm.md` files currently contain outdated legacy boilerplate instead of minimal additive overrides.
2. The content inside the variants' `pm.md` markers must be completely rewritten to perfectly match the specific intent declared in their respective `variant.json` files.
3. `common/agents/pm.md` must contain the canonical default text from the workspace root inside its anchors.

**Open Disagreements or Unresolved Questions**:
- None. Full consensus on rewriting the content to match `variant.json`.

**Concrete Next Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Rewrite the content inside `<!-- VARIANT-SECTION -->` for all 5 variants to strictly match `variant.json` intent and remove legacy boilerplate. | Both | Phase 1-2 |
| A-02 | scaffolding-expert | Low | Ensure `common/agents/pm.md` contains the canonical workspace root text inside its anchors. | Both | Phase 4 |

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Rewrite additive content in 5 variant `pm.md` files | Phase 1-2 |
| A-02 | scaffolding-expert | Low | Verify canonical text in `common/agents/pm.md` | Phase 4 |
