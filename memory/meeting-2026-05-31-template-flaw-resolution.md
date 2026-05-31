# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Addressing the Template Propagation Flaw in Centralized Architecture
**Participants**: pm, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user raised a critical flaw in our "Centralized Model Architecture" plan: If we strip `claude: [tier]` and `gemini: [tier]` from all agent markdown files, what happens when a new project is created from a template? The `workspace-schema.json` is a root-level workspace file; it is NOT copied into new projects. This means new projects will completely lose their model tier mapping. Architect, how do we solve this?

**[architect]**: (Round 1)
The user's insight is incredibly sharp. I completely missed that `workspace-schema.json` is exclusively a workspace root file and is not distributed to scaffolded projects. If we remove the abstract tier (`gemini: high`) from the `agents/*.md` files, a standalone project has no programmatic way to know which agent belongs to which tier.
To solve this while still minimizing maintenance overhead, we should adopt a **Hybrid Abstraction Approach**:
1. **Keep the Abstract Tier**: We KEEP `claude: high` and `gemini: high` in the YAML frontmatter of `agents/*.md`. This ensures that standalone projects still know the agent's tier natively.
2. **Remove the Hardcoded Literal Model**: We strictly BAN writing literal API models (e.g., `# gemini-3.1-pro`) in the agent files.
Because the abstract tier (`high/medium/low`) practically never changes for a specific role (a PM will always be `high`), we will never have to touch the 38 agent files during a model generation upgrade (e.g., from Gemini 3 to Gemini 4).

**[auditor]**: (Round 1)
Architect's solution is elegant. The only reason we touched 38 files today was because we had to inject the `gemini` keys and the `# gemini-3.1-pro` comments. If we simply delete the literal model comments from all agent files, the 38 files become completely decoupled from the specific LLM hardware generation.
To address the user's point about templates: `docs/context.md` in the templates must be updated to define the mapping (`high = gemini-3.1-pro`). When a new project is created, its local `docs/context.md` will contain the exact model strings, and its local `agents/*.md` will contain the abstract `tier: high`. This perfectly resolves the template isolation problem.

**[pm]**: (Round 2)
This solves both the maintainability problem and the template propagation problem. Architect, how does this affect our validation scripts?

**[architect]**: (Round 2)
The validation script (`validate-templates.ts`) currently uses the comment to double-check the model hint:
```typescript
const modelHint = claudeLine?.toLowerCase() ?? '';
```
We need to refactor `validate-templates.ts` to STOP enforcing or expecting the literal model string in the YAML comment. It should only validate that `gemini: high` matches the schema tier, and nothing else.

**[auditor]**: (Synthesis)
Here is our revised consensus, directly crediting the user's architectural foresight:
1. **Agreements**: 
   - We will NOT delete the `claude:` and `gemini:` keys from the agent files, preserving template independence.
   - We WILL delete the literal model string comments (e.g., `# claude-opus-4-7`) from all 38 agent files to achieve generational decoupling.
   - We will update the `templates/common/docs/context.md` and `CONSTITUTION.md` to be the sole sources of truth for mapping `high -> gemini-3.1-pro`.
   - We will refactor `validate-templates.ts` to remove the logic that expects model string comments.
2. **Next Actions**: PM will present this revised "Hybrid Abstraction Plan" to the user.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Revise Implementation Plan based on user's feedback | Planning |
| A-02 | automation-engineer | Low | Strip `# <model-name>` comments from all `agents/*.md` | Execution |
| A-03 | automation-engineer | Low | Refactor `validate-templates.ts` to remove comment hints | Execution |
| A-04 | docs-writer | Medium | Update `templates/common/docs/context.md` model mapping | Execution |
