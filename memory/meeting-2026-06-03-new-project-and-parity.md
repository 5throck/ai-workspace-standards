# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-consult Addition Full Ripple Check — new-project Scripts, Antigravity Parity, _COMMON.md
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Data Gathered

### new-project script status
- `scripts/new-project.sh` L0: co-consult missing from variants list, Usage message, error message, description
- `scripts/new-project.ps1` L0: same gaps
- `templates/common/scripts/new-project.sh` L1: same gaps
- `templates/common/scripts/new-project.ps1` L1: same gaps
- `.claude/commands/new-project.md` L0: "Available variants: co-develop, co-design, co-work, co-security" — co-consult missing
- `templates/common/.claude/commands/new-project.md` L1: same gap
- `new-project.sh` supports --platform flag (claude|antigravity|both) — no variant-specific platform branch found

### GEMINI.md parity
- GEMINI.md at L0: 0 co-consult references — but GEMINI.md does not contain variant lists (behavior rules only)
- CLAUDE.md at L0: also no explicit variant list
- Conclusion: no actual parity gap

### Previously decided (prior meetings)
- agents/_COMMON.md removal
- docs/GLOBAL_TOOLS.md removal
- .claude/settings.local.json removal
- .claude/skills/api-documentation/ removal
- docs/adr/ removal
- Skill deduplication (Type A/B/C)

---

## Transcript

**[architect]**: (Round 1)

Four topics analyzed.

**Topic 1 — new-project script gaps (most critical)**

co-consult was added to inject-skills.ts and templates/README.md but NOT to the actual project creation path:

| File | Status |
|------|--------|
| scripts/new-project.sh L0 | ❌ Missing from variants variable, Usage, error msg, description |
| scripts/new-project.ps1 L0 | ❌ Same |
| templates/common/scripts/new-project.sh L1 | ❌ Same |
| templates/common/scripts/new-project.ps1 L1 | ❌ Same |
| .claude/commands/new-project.md L0 | ❌ Missing from variants list |
| templates/common/.claude/commands/new-project.md L1 | ❌ Same |

Running `bash scripts/new-project.sh my-project --variant co-consult` currently produces "Unknown variant" error.

**Topic 2 — L0/L1 Antigravity (GEMINI) parity**

README.md was updated but GEMINI.md has 0 co-consult references. CONSTITUTION.md §10 parity rule requires CLAUDE.md/GEMINI.md to be kept in sync. However, neither file contains explicit variant lists — both define workflow behavior rules only. No actual gap.

---

**[pm]**: (Round 1)

CONSTITUTION.md §10 Lifecycle: scripts/*.ts (and by extension .sh/.ps1 in same directory) must propagate to templates/common/scripts/. Both L0 and L1 need the same new-project fixes.

GEMINI.md parity confirmation needed: does GEMINI.md have any variant-listing section?

---

**[architect]**: (Round 2)

GEMINI.md grep result was 0 matches for co-consult. Both CLAUDE.md and GEMINI.md contain workflow behavior rules, not variant lists. **No parity gap confirmed.**

new-project.sh `--platform` flag analysis: the script supports claude|antigravity|both but has no variant-specific platform branches. Adding co-consult to the variants list is sufficient — no additional platform logic needed.

**Final new items matrix:**

| # | File | Layer | Change |
|---|------|-------|--------|
| 1 | scripts/new-project.sh | L0 | Add co-consult to variants list, Usage, error msg, description |
| 2 | scripts/new-project.ps1 | L0 | Same |
| 3 | templates/common/scripts/new-project.sh | L1 | Propagate same change |
| 4 | templates/common/scripts/new-project.ps1 | L1 | Propagate same change |
| 5 | .claude/commands/new-project.md | L0 | Add co-consult to variants list |
| 6 | templates/common/.claude/commands/new-project.md | L1 | Propagate same change |

---

**[pm]**: (Round 2)

GEMINI.md parity: no gap confirmed.

**Consolidated remaining work across all three meetings:**

**Group A — new-project scripts (this meeting)**
6 files: sh/ps1 at L0 + L1, new-project.md at L0 + L1

**Group B — co-consult SSOT cleanup (prior meeting)**
5 removals: agents/_COMMON.md, docs/GLOBAL_TOOLS.md, .claude/settings.local.json, .claude/skills/api-documentation/, docs/adr/

**Group C — skill deduplication (prior meeting)**
Type A: delete meeting-facilitation + skill-lifecycle-manager from 5 variants
Type B: register agent-lifecycle-manager as override in 5 variant.json files
Type C: delete 6 infra skills from co-consult + update common project-review enum

Execution order: B (removals, safest) → C (skill dedup) → A (script edits, most careful)

---

## Consolidated Action Items (All Three Meetings)

### Group A — new-project Scripts
| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | automation-engineer | Medium | scripts/new-project.sh L0: add co-consult to variants variable, Usage, error message, description line |
| A-02 | automation-engineer | Medium | scripts/new-project.ps1 L0: same additions |
| A-03 | automation-engineer | Medium | templates/common/scripts/new-project.sh L1: propagate identical change |
| A-04 | automation-engineer | Medium | templates/common/scripts/new-project.ps1 L1: propagate identical change |
| A-05 | automation-engineer | Medium | .claude/commands/new-project.md L0: add co-consult to variants list |
| A-06 | automation-engineer | Medium | templates/common/.claude/commands/new-project.md L1: propagate same change |

### Group B — co-consult SSOT Cleanup
| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| B-01 | automation-engineer | Medium | Remove agents/_COMMON.md from templates/co-consult |
| B-02 | automation-engineer | Medium | Remove docs/GLOBAL_TOOLS.md from templates/co-consult |
| B-03 | automation-engineer | Medium | Remove .claude/settings.local.json from templates/co-consult |
| B-04 | automation-engineer | Medium | Remove .claude/skills/api-documentation/ from templates/co-consult |
| B-05 | automation-engineer | Medium | Remove docs/adr/ from templates/co-consult |

### Group C — Skill Deduplication
| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| C-01 | automation-engineer | Medium | Delete meeting-facilitation/ from co-develop/co-design/co-work/co-security/co-consult |
| C-02 | automation-engineer | Medium | Delete skill-lifecycle-manager/ from co-develop/co-design/co-work/co-security/co-consult |
| C-03 | automation-engineer | Medium | Add agent-lifecycle-manager override entry to 5 variant.json skill_manifest sections |
| C-04 | automation-engineer | Medium | Update templates/common/skills/project-review/SKILL.md enum: add co-consult |
| C-05 | automation-engineer | Medium | Delete 6 infra skills from co-consult: audit-workspace, project-review, script-lifecycle-manager, security-scan, translate, validate-docs-links |

### Verification
| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| V-01 | auditor | Medium | bun scripts/audit.ts + validate-templates.ts — exit 0 |
| V-02 | pm | Medium | Test: bash scripts/new-project.sh test-proj --variant co-consult succeeds |

## Acceptance Criteria
| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | new-project.sh includes co-consult in variant list and help text | grep check |
| 2 | new-project.ps1 includes co-consult in variant list and help text | grep check |
| 3 | templates/common/ versions match L0 | diff check |
| 4 | new-project.md (L0 + L1) lists co-consult | grep check |
| 5 | agents/_COMMON.md absent from templates/co-consult | ls check |
| 6 | meeting-facilitation/ absent from all 5 variant skills/ | ls check |
| 7 | skill-lifecycle-manager/ absent from all 5 variant skills/ | ls check |
| 8 | agent-lifecycle-manager in all 5 variant.json with type=override | JSON check |
| 9 | co-consult skills/ has only consulting + agent-lifecycle-manager skills | ls check |
| 10 | bun scripts/audit.ts exits 0 | Audit output |
