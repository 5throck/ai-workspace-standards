# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-consult Platform Parity Audit and SSOT Cleanup (_COMMON.md removal)
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Data Gathered

### Platform parity gaps (.claude vs .gemini skills)
- In `.claude/skills` but NOT `.gemini/skills`: api-documentation, documentation-writing, research-analysis
- All three carry `gemini-parity: skip` (intentional Claude-only) — not a technical violation
- But all three are co-work platform skills that were copied with the demo — domain mismatch for consulting

### Files found that should not be in a template
- `docs/GLOBAL_TOOLS.md` — hardcodes specific plugin names (superpowers, ui-ux-pro-max) in user's ~/.claude/plugins and ~/.gemini/config/plugins
- `.claude/settings.local.json` — local user session permissions (specific bun script commands)
- `agents/_COMMON.md` — workspace-root-level architecture doc about common-contract.json and override types; belongs in workspace root docs, not in a variant's agents/ folder
- `docs/adr/` — empty folder, no content

### Other findings
- `api-documentation` skill: domain mismatch for strategy consulting
- `documentation-writing`, `research-analysis`: co-work platform skills, potentially common value but requires separate task
- `new-project.md` absent from `.gemini/commands/` — intentional, consistent with other variants

---

## Transcript

**[architect]**: (Round 1)

Three platform parity issues identified in co-consult:

1. `api-documentation`, `documentation-writing`, `research-analysis` in `.claude/skills/` carry `gemini-parity: skip` — technically correct markers, but these are co-work platform skills that arrived via demo copy. `api-documentation` is a domain mismatch for strategy consulting.

2. `docs/GLOBAL_TOOLS.md` is not present in any other variant. It hardcodes plugin installation requirements for specific user environments — this is template contamination. Remove.

3. `.claude/settings.local.json` contains a local user's session-specific bash command allowlist from the demo creation session. This file must never be included in a template.

---

**[pm]**: (Round 1)

Priority classification:
- **Immediate removal (contamination)**: GLOBAL_TOOLS.md, settings.local.json
- **Domain review**: api-documentation (domain mismatch → remove), documentation-writing and research-analysis (consulting-applicable → candidates for common promotion, separate task)
- **adr/ folder**: only in co-consult — verify content before deciding

On `agents/_COMMON.md`: please confirm content and removal rationale.

---

**[architect]**: (Round 2)

`agents/_COMMON.md` content confirmed: describes workspace-root architecture — common-contract.json governance, override types (additive/replacement), anti-swelling threshold. This is `CONSTITUTION.md`/`docs/templates/` content, not L2 project content. When copied to an L2 project, it creates an orphaned governance document that confuses L2 users who have no common-contract.json context.

SSOT violation: this document belongs at the workspace root (already documented there), not in variant agents/ folder.

`docs/adr/` is empty — remove.

**Final cleanup matrix:**

| File/Folder | Type | Action |
|-------------|------|--------|
| `agents/_COMMON.md` | Wrong layer placement | Remove from co-consult |
| `docs/GLOBAL_TOOLS.md` | Hardcoded user environment | Remove from co-consult |
| `.claude/settings.local.json` | Local user file | Remove from co-consult |
| `.claude/skills/api-documentation/` | Domain mismatch | Remove from co-consult |
| `docs/adr/` | Empty folder | Remove from co-consult |
| `.claude/skills/documentation-writing/` | co-work legacy, common value | Separate task: common promotion |
| `.claude/skills/research-analysis/` | co-work legacy, common value | Separate task: common promotion |

---

**[pm]**: (Round 2)

documentation-writing and research-analysis common promotion requires co-work variant coordination — separate task, out of current scope.

**Final Agreements:**
1. **Immediate removal from co-consult**: agents/_COMMON.md, docs/GLOBAL_TOOLS.md, .claude/settings.local.json, .claude/skills/api-documentation/, docs/adr/
2. **No change now**: documentation-writing, research-analysis (remain in .claude/skills/ until common promotion task)
3. **Separate task**: documentation-writing + research-analysis common promotion after co-work coordination

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Medium | Remove from co-consult: agents/_COMMON.md, docs/GLOBAL_TOOLS.md, .claude/settings.local.json, .claude/skills/api-documentation/, docs/adr/ | Execution |
| A-02 | auditor | Medium | Run bun scripts/audit.ts + validate-templates.ts after removal | Verification |
| A-03 | (future) | Medium | documentation-writing + research-analysis: evaluate common promotion with co-work coordination | Separate task |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | agents/_COMMON.md absent from templates/co-consult/agents/ | ls check |
| 2 | docs/GLOBAL_TOOLS.md absent from templates/co-consult/docs/ | ls check |
| 3 | .claude/settings.local.json absent from templates/co-consult/.claude/ | ls check |
| 4 | .claude/skills/api-documentation/ absent from templates/co-consult/.claude/skills/ | ls check |
| 5 | docs/adr/ absent from templates/co-consult/docs/ | ls check |
| 6 | documentation-writing and research-analysis still present (not touched) | ls check |
| 7 | bun scripts/audit.ts exits 0 | Audit output |
