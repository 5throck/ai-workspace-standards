# Meeting Transcript
**Date**: 2026-06-04
**Topic**: Review of CONSTITUTION.md intentional-duplicate design policy between co-develop and co-consult variants
**Participants**: architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]**: (Round 1)
As the Template Architect, I designed the `co-develop` and `co-consult` variants with distinct operational contexts in mind. For `co-develop`, it is crucial that the AI agents have immediate, local access to the coding guidelines from `CONSTITUTION.md` to prevent regressions and enforce strict coding standards. This is why we introduced the `<!-- intentional-duplicate: ... -->` marker—to allow the AI context to remain fast and proximal while keeping a clear traceable link to the source of truth. However, for `co-consult`, the focus is heavily on engagement workflow and consulting strategy, not software engineering rules. Including the coding guidelines there would dilute the agent's system prompt with irrelevant constraints. 

**[auditor]**: (Round 1)
From a consistency and compliance perspective, @architect, your approach makes sense, but it places a significant burden on the QA and audit processes. My `lifecycle-sync-audit.ts` script explicitly scans for the `<!-- intentional-duplicate: ... -->` pattern. Currently, it successfully ignores these marked sections when validating DRY principles. However, we must ensure that whenever `CONSTITUTION.md` is updated, the duplicated sections in `co-develop.context.md` are also synced. If the source changes and the duplicate doesn't, we risk the AI following outdated rules. We might need an automated sync mechanism rather than just an audit warning.

**[docs-writer]**: (Round 1)
I agree with both of you. @auditor is right about the risk of drift. As the Documentation Writer, I have to manually update `co-develop.context.md` whenever `CONSTITUTION.md` is revised. While the `intentional-duplicate` tag is a great signal for the linter, it doesn't solve the maintenance overhead. I propose that we introduce a script—perhaps a new capability for the `lifecycle-manager`—that automatically injects the designated sections from `CONSTITUTION.md` into the variant context files during the build or sync phase, rather than maintaining hardcoded text.

**[architect]**: (Round 2)
@docs-writer, an automated injection script is an excellent idea. If we treat `co-develop.context.md` as a compiled artifact rather than a purely static file, we can maintain a single source of truth in `CONSTITUTION.md`. We could use a specific template tag like `{{ INJECT: CONSTITUTION.md §8 }}` in the source of the context file, and during the `/sync` pipeline, the script expands it. This completely eliminates the drift risk @auditor mentioned while maintaining the context proximity required for the AI agents in the `co-develop` variant.

**[auditor]**: (Round 2)
That proposal resolves my primary concern. If we implement an injection build step during `/sync`, my audit script (`lifecycle-sync-audit.ts`) would only need to verify that the injection tags are valid and that the compiled output matches the source, or we could even remove the `intentional-duplicate` workaround altogether in favor of this injection system. I strongly support this transition. @docs-writer, could you draft the documentation for this new templating standard?

**[docs-writer]**: (Round 2)
Yes, I can certainly draft the documentation for the new context injection system. I will outline the syntax for the injection tags and update our documentation guidelines to reflect that variant context files should not manually duplicate rules anymore. I will coordinate with the `automation-engineer` to ensure the `sync-md.ts` or a new build script properly supports parsing and injecting these sections. 

---

**[auditor]**: (Synthesis)
The meeting has concluded with a strong consensus. We confirmed that the current design—duplicating rules for `co-develop` but not `co-consult`—is functionally correct for their respective domains. However, the manual maintenance of the `intentional-duplicate` blocks poses a risk of drift. 

**Agreements:**
- The domain separation between `co-develop` (needs coding rules) and `co-consult` (does not need them) is correct and will remain.
- Manual duplication with `intentional-duplicate` tags is a maintenance liability.

**Next Actions:**
We have agreed to transition from manual duplication to an automated injection system for context files.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Design the syntax and architecture for the new context injection system (e.g., `{{ INJECT: ... }}`). | Phase 1 |
| A-02 | automation-engineer | Low | Implement the injection logic in the `/sync` pipeline scripts to replace `intentional-duplicate` blocks. | Phase 4 |
| A-03 | docs-writer | Medium | Update documentation guidelines to describe the new injection system and deprecate manual `intentional-duplicate` tags. | Phase 4 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | The `/sync` command automatically pulls specified sections from `CONSTITUTION.md` into `co-develop.context.md`. | Verified by QA script. |
| 2 | `lifecycle-sync-audit.ts` is updated to support or no longer require the `intentional-duplicate` regex. | Run `bun scripts/audit.ts` successfully. |
