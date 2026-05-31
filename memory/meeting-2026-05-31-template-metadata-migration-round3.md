# Meeting Transcript (Continued)
**Date**: 2026-05-31
**Topic**: Migration of Variant/Template Governance Files to `docs/` (Deep Dependency Analysis)
**Participants**: pm, architect, lifecycle-manager, auditor
**Rounds**: 3
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript (Round 3)

**[pm]**: 
The user requested a more thorough and concrete review of the migration plan. We must ensure we haven't missed any hardcoded references. Auditor, what did the deep dependency scan reveal?

**[auditor]**: 
The deep scan revealed several critical dependencies we missed in Round 2:
1. **Scaffolding Scripts (`new-project.sh` & `new-project.ps1`)**: These root scripts explicitly parse `templates/common/lifecycle-governance.json` to enforce the pre-scaffold QA gate. If we move this file to `docs/templates/`, project creation will break.
2. **IDE Settings (`.claude/settings.local.json` & `.gemini/settings.local.json`)**: These files contain raw Python one-liners used by the IDE to fetch orchestrator names from `templates/common/lifecycle-governance.json`. 
3. **Migration Guides (`migrations/README.md`)**: References `VERSION_REGISTRY.json` in its instructions.
4. **Agent Tools**: The `validate-templates.ts` script is heavily dependent on all 7 of these metadata files. It expects them in `templates/common/`. 

**[architect]**:
This confirms the user's intuition that we needed a more meticulous review. If we move the 7 JSON metadata files from `templates/common/` to `docs/templates/`:
- `new-project.sh/.ps1` must be updated to read `GOVERNANCE_JSON="$WORKSPACE_ROOT/docs/templates/lifecycle-governance.json"`.
- We must update the `python -c` snippets in `.claude/settings.local.json` and `.gemini/settings.local.json` to point to `docs/templates/lifecycle-governance.json`.
- `validate-templates.ts` must update `govPath`, `commonLcPath`, `schemaPath`, etc., to point to `docs/templates/`.
- `phase-definitions.md` moving to `templates/common/docs/phase-definitions.md` is correct, but we must also update `docs/governance/pm-orchestrator-parameters.md` which references it.

**[lifecycle-manager]**:
Don't forget my audits! `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, and `lifecycle-sync-audit.ts` likely contain hardcoded paths to `templates/common/VERSION_REGISTRY.json` or `lifecycle-governance.json`. They must be updated.

**[pm]**:
Excellent. The user was right to ask for a deeper check. The revised plan must explicitly list all these edge cases:
1. Move the 7 JSONs to `docs/templates/`.
2. Move `phase-definitions.md` to `templates/common/docs/`.
3. Update `new-project.sh` & `new-project.ps1`.
4. Update `validate-templates.ts` & 3 lifecycle audit scripts.
5. Update IDE settings (`settings.local.json` for both `.claude` and `.gemini`).
6. Update markdown documentation (`agents/lifecycle-manager.md`, `CONSTITUTION.md`, `migrations/README.md`, `pm-orchestrator-parameters.md`, and variant `AGENTS.md` files).

I will update the Implementation Plan to reflect this granular scope and ask for the user's final sign-off.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Revise Implementation Plan with granular dependency list | Planning |
| A-02 | pm | High | Present revised plan to user for final approval | Planning |
