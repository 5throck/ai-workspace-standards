# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Refactoring 3-Tier Model Architecture for Easier Maintenance
**Participants**: pm, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has pointed out a significant architectural flaw: upgrading the Gemini model required us to modify 38 agent files. They suggested that maintaining the 3-Tier model strategy purely within `CONSTITUTION.md` and `docs/context.md` would be much more effective. Architect, what is the root cause of this high maintenance overhead, and how can we solve it?

**[architect]**: (Round 1)
The root cause is that the literal API strings (e.g., `# gemini-3.1-pro` and `# claude-opus-4-7`) and the platform-specific tier bindings (`claude: high`, `gemini: high`) are currently hardcoded into the YAML frontmatter of every single `agents/*.md` file. 
When a new generation of LLMs is released, we are forced to update every file. The user's suggestion to centralize this is spot on.

We have a few options:
**Option A (User's Idea): Centralize in `CONSTITUTION.md` and `workspace-schema.json`**. We completely remove the `claude:` and `gemini:` model/tier definitions from the YAML frontmatter of the 38 `agents/*.md` files. We rely exclusively on `workspace-schema.json` (which orchestration scripts read) and `CONSTITUTION.md` (which humans and AI read) to map `pm -> high -> gemini-3.1-pro`.
**Option B: Keep Abstract Tiers, Remove Literal Comments**. We keep `tier: high` in the agent frontmatter but remove the platform-specific keys (`claude:`, `gemini:`) and the literal model comments.

**[auditor]**: (Round 1)
Option A is vastly superior for maintainability. The YAML frontmatter in `agents/*.md` should only define the agent's identity and lifecycle (`name`, `description`, `lifecycle.phase`), not the underlying hardware/model it runs on. The infrastructure mapping (which model runs which agent) belongs in a configuration file (`workspace-schema.json`) and documentation (`CONSTITUTION.md`).
If we adopt Option A:
1. We remove all `claude:` and `gemini:` lines from the 38 agent files.
2. We update `workspace-schema.json` so that `"agent_tiers"` is the sole source of truth for an agent's tier.
3. We update `scripts/validate-templates.ts` and `scripts/audit.ts` to stop looking for tier information inside the agent markdown files.

**[pm]**: (Round 2)
Auditor's approach strongly aligns with the user's intent. By stripping infrastructure metadata from the agent files, we achieve true separation of concerns. Architect, how does this impact orchestration scripts that might read the markdown files to determine the model?

**[architect]**: (Round 2)
Currently, our `workspace-schema.json` already contains the full `"agent_tiers"` mapping (e.g., `"pm": "high"`) and the `"models"` block (e.g., `"high": "gemini-3.1-pro"`). Any script (like `dispatch.ts` or a future orchestrator) can easily read `workspace-schema.json` instead of parsing the markdown frontmatter. 
Furthermore, as the user suggested, `CONSTITUTION.md` §5 and `docs/context.md` will clearly document this 3-tier strategy, providing context to any LLM reading the codebase.

**[auditor]**: (Synthesis)
We have reached a consensus to implement Option A (Centralization).
1. **Agreements**: 
   - Remove `claude: [tier]` and `gemini: [tier]` from all 38 `agents/*.md` files across the workspace and templates.
   - Designate `workspace-schema.json` and `CONSTITUTION.md` as the exclusive single sources of truth for model tier mappings.
   - Strip the markdown frontmatter validation logic from `validate-templates.ts` to match this new simplified architecture.
2. **Next Actions**: PM will draft an Implementation Plan presenting this "Decoupled Model Architecture" for the user's final approval.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Create Implementation Plan for removing tier frontmatter | Planning |
| A-02 | automation-engineer | Low | Execute global removal of model tiers from `agents/*.md` | Execution |
| A-03 | automation-engineer | Low | Refactor `validate-templates.ts` to remove legacy YAML checks | Execution |
