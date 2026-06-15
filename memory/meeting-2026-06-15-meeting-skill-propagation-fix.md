# Meeting Transcript
**Date**: 2026-06-15
**Topic**: Meeting Skill Gap — Improvement Plan for commands/skills Propagation in New Project Creation
**Participants**: architect, automation-engineer, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Investigation of why the `meeting` skill does not work properly in the `co-architect` project, specifically identifying gaps introduced during new project creation via `new-project.ts`.

Diagnosed issues:
1. `propagation-map.json` missing `claude-commands` and `gemini-commands` domains
2. `templates/co-work/.claude/skills/simulate-project-creation` present (L0-only file contaminating variant template)
3. `templates/common/.gemini/commands/meeting.md` at version 1.3.1 while `.claude/commands/meeting.md` is at 1.4.0
4. All variant templates missing `.gemini/commands/` directory
5. `propagate-to-templates --check-drift` reporting all variant templates as missing `meeting-facilitation/SKILL.md` (incorrect — variant skills/ is an override space, not a mirror of common)

---

## Transcript

**[Architect]**: (Round 1)

The core issue is a gap in propagation layer design. `propagation-map.json` defines `scripts`, `claude-skills`, and `gemini-skills` domains but is missing `claude-commands` and `gemini-commands`. Commands and skills belong to the same "platform configuration" category — managing only one side for propagation is a structural inconsistency. Since `meeting-facilitation` is a registration stub in `skills/` pointing to the actual implementation in `commands/`, any gap in commands propagation leaves the stub pointing at nothing. Asked automation-engineer whether adding the domain to the map is sufficient or whether propagate-to-templates.ts logic also needs changes.

**[Automation-Engineer]**: (Round 1)

Agreed on the inconsistency. Analysis of `propagate-to-templates.ts` shows that existing `claude-skills` / `gemini-skills` processing patterns mean that adding a new domain to `propagation-map.json` will automatically be handled — no script changes needed. However, the drift-check also flags `meeting-facilitation/SKILL.md` as missing from variant templates. This is because variant `skills/` directories are designed as override spaces (inheriting from common), but drift-check treats absence as a missing file. Needs scaffolding-expert's view. Also flagged that `simulate-project-creation` in `co-work/.claude/skills/` is an L0-only file that should not be in variant templates.

**[Scaffolding-Expert]**: (Round 1)

Explained the `new-project.ts` flow: copy `templates/common/` entirely, then overlay `templates/<variant>/`. `common/skills/meeting-facilitation/SKILL.md` is correctly copied to new projects in step 1 — variant templates do not need to contain it. The drift-check assumption that "whatever is in common must be in variant" is incorrect. `variant/skills/` is an override space, not a mirror. However, commands are different: if a variant needs to customize a command, there is currently no override path. Proposed formalizing the commands override pattern (flat override, same as skills) and adjusting drift-check to skip skills that exist only in common.

**[Auditor]**: (Round 1)

Identified three confirmed violations: (1) `propagation-map.json` missing commands domains, (2) `templates/co-work/.claude/skills/simulate-project-creation` L0 contamination, (3) `.gemini/commands/meeting.md` version mismatch (1.3.1 vs 1.4.0 — functionally identical, metadata only). Proposed short-term vs. long-term split: immediate fixes for the three violations, ADR-required change for drift-check logic. Asked architect about flat vs. subdirectory override structure for commands.

**[Architect]**: (Round 2)

Flat override is correct — same pattern as skills, already working. `templates/co-work/.claude/commands/meeting.md` presence would override common's version in the overlay step. No subdirectory needed. Noted that propagation-map.json commands domain must define exclude list carefully (e.g., `sync.md` requires L1 transformation to remove `/new-project` row — this transformation logic already exists in `propagate-to-templates.ts` and will auto-trigger when the domain is added). Asked automation-engineer whether `sync.md` transformation is automatically triggered by map addition.

**[Automation-Engineer]**: (Round 2)

Confirmed: `sync.md` transformation (C-1: remove new-project row, C-2: update command count) is automatically applied during propagation — no additional handling needed when the domain is added to the map. However, flagged that drift-check may use a separate hardcoded code path, not map-driven. Must verify before implementation: even if propagation works via map, drift-check might still report false positives. Proposed adding "common-only files are OK" exception to both skills and commands drift-check logic.

**[Scaffolding-Expert]**: (Round 2)

Summarized two scenarios for why meeting feels broken: (1) Gemini platform version mismatch (1.3.1 vs 1.4.0) may cause confusion during skill registration even if content is identical; (2) `simulate-project-creation` contamination causes unnecessary item in skill list. Recommended execution order: update propagation-map.json → run `bun scripts/propagate-to-templates.ts` → clean variant templates. Also recommended adding a pre-generation validation in `new-project.ts` to warn when L0-only files are found in variant templates.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | Add `claude-commands` and `gemini-commands` domains to `propagation-map.json` and run propagation | Both | Phase 3 |
| A-02 | automation-engineer | Low | Remove `templates/co-work/.claude/skills/simulate-project-creation` directory | Both | Phase 3 |
| A-03 | automation-engineer | Low | Sync `templates/common/.gemini/commands/meeting.md` version from 1.3.1 to 1.4.0 | Both | Phase 3 |
| A-04 | automation-engineer | Medium | Audit `propagate-to-templates.ts` drift-check logic — add "common-only OK" exception for skills and commands (per ADR-0031 override-space design) | L0-only | Phase 4 |
| A-05 | scaffolding-expert | Low | Add pre-generation validation to `new-project.ts` to warn when L0-only files found in variant template source | L0-only | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `bun scripts/propagate-to-templates.ts --check-drift` reports 0 errors for commands domains | Run drift-check after propagation |
| AC-02 | `simulate-project-creation` not present in any variant template `.claude/skills/` | `ls templates/co-*/.claude/skills/` |
| AC-03 | Both `.claude/commands/meeting.md` and `.gemini/commands/meeting.md` at version 1.4.0 in templates/common | diff the two files |
| AC-04 | drift-check does not report variant skills/ as missing when file exists in common | Run drift-check and confirm no false positives |
| AC-05 | `bun scripts/new-project.ts` warns if L0-only file detected in variant source | Test with current co-work template |
