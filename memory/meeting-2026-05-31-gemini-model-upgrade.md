# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Upgrading the 3-Tier Gemini models to 3.1 Pro and 3.5 Flash
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
Let's discuss the proposed model upgrades. The user has requested we update the 3-tier strategy for Gemini. Currently, the documentation specifies `gemini-2.5-pro` for High and `gemini-2.0-flash` for Medium. The user wants to adopt a new generation of models:
- High: Gemini 3.1 Pro (Low)
- Medium: Gemini 3.5 Flash (Medium)
- Low: Gemini 3.5 Flash (Low)

Architect, how does this align with our architecture, and how should we structure the implementation across our workspace (schema, templates, documentation)?

**[architect]**: (Round 1)
Thank you, PM. Structurally, this represents a generational shift, but it fits perfectly into our existing 3-tier abstraction. The change involves updating the literal strings mapping to these tiers. 
Specifically, we need to update `CONSTITUTION.md` §5.4 (where the models are documented). We also need to add/update the `gemini` keys in `workspace-schema.json` to formally declare these mappings for schema validation. Currently, the schema and agent files only define `claude` tier string mappings (`claude-opus-4-7`, etc.). We should add the `gemini` mappings to establish true platform parity. Auditor, what compliance risks do you see with modifying these schema definitions and agent files?

**[auditor]**: (Round 1)
Architect correctly identifies that the `workspace-schema.json` currently lacks `gemini` specific mappings. To maintain cross-platform parity (which is a core constitutional principle), adding `gemini` keys to the schema and updating all agent files (`agents/*.md` and `templates/*/agents/*.md`) with `gemini: high/medium/low` frontmatter is the correct move. 
However, I want to clarify the user's requested naming convention: "Gemini 3.1 Pro (Low)" and "Gemini 3.5 Flash (Medium)". These appear to be UI display names rather than API model string IDs (like `gemini-3.5-flash`). We should ensure we document both the conceptual name and the exact API string if applicable, or just update the documentation to reflect these exact names if we are not binding them to a hardcoded API verifier. Automation-Engineer, what is the scope of the script updates required?

**[automation-engineer]**: (Round 1)
Good point, Auditor. The scope is quite broad but manageable.
1. `CONSTITUTION.md`: Update the text mentioning `gemini-2.5-pro` and `gemini-2.0-flash` to the new 3.x models.
2. `workspace-schema.json`: Add a `"gemini"` block under `"models"` mirroring the `"claude"` block, using standard API-like strings (e.g., `gemini-3.1-pro`, `gemini-3.5-flash`).
3. `agents/*.md` (Workspace & Templates): Add `gemini: [tier]` to the frontmatter of all agent files, alongside the `claude: [tier]` keys.
4. Validation scripts (`scripts/validate-agents.ts` or `audit.ts`): Ensure the schema validation checks both `claude` and `gemini` keys if they exist.

PM, are we ready to commit to this comprehensive update?

**[pm]**: (Round 2)
Yes, this comprehensive approach ensures we don't just patch the documentation, but actually build the Gemini 3.x models into the core schema of the workspace. This enforces platform parity. Architect, do we need to alter the tier logic itself, or just the mappings?

**[architect]**: (Round 2)
We only need to alter the mappings. The logic of High (PM/Architect), Medium (Auditor/QA/Docs), and Low (Code-Writer/Scaffolding) remains perfectly intact. The only nuance is that the user specified "Gemini 3.5 Flash (Low)" for the Low tier and "Gemini 3.5 Flash (Medium)" for the Medium tier. We will map the `gemini` schema as follows:
- High: `gemini-3.1-pro`
- Medium: `gemini-3.5-flash`
- Low: `gemini-3.5-flash-8b` (or simply `gemini-3.5-flash` with a note on token limits, depending on exact API string availability). We'll document the conceptual names exactly as requested in `CONSTITUTION.md`.

**[auditor]**: (Synthesis)
We have reached a consensus on the 3-Tier Gemini Model Upgrade.
1. **Agreements**: We will upgrade the documentation and schema to reflect the new Gemini 3.x generation (3.1 Pro for High, 3.5 Flash for Medium/Low). We will enforce platform parity by formally adding `gemini` model mappings to `workspace-schema.json` and all agent YAML frontmatter.
2. **Disagreements/Open Questions**: The exact API string for "Gemini 3.5 Flash (Low)" vs "Medium" isn't strictly defined in the prompt, but we will use `gemini-3.5-flash` as the base and document the user's exact conceptual terms.
3. **Next Actions**: 
   - PM to present the implementation plan for user approval.
   - Execute updates to `CONSTITUTION.md`, `workspace-schema.json`, and all agent files across the workspace and templates.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Propose implementation plan artifact to the user | Planning |
| A-02 | automation-engineer | Low | Update `workspace-schema.json` and `CONSTITUTION.md` | Execution |
| A-03 | automation-engineer | Low | Update all `agents/*.md` files (workspace + templates) | Execution |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `CONSTITUTION.md` reflects Gemini 3.1 Pro and 3.5 Flash models | Manual review |
| 2 | `workspace-schema.json` contains a valid `gemini` models block | Schema validation |
| 3 | `bun scripts/audit.ts` passes with the new `gemini` keys in agent files | Script execution |
