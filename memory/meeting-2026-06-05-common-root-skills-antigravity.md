---
name: meeting-2026-06-05-common-root-skills-antigravity
description: Gap analysis — templates/common/skills/ root-level skills missing from safety-os, Antigravity recognition impact
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: templates/common/skills/ Root Skills Deployment + Antigravity Gap Analysis
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Gap Summary

| Item | templates/common/ | safety-os | Gap |
|---|---|---|---|
| skills/ (root, platform-neutral) | 11 skills | 4 (Safety OS only) | **11 missing** |
| .gemini/commands/ | 6 files | 6 files | ✅ None |
| .gemini/skills/ | 4 skills | 5 skills | ✅ None |
| GEMINI.md Antigravity sections | present | 15 occurrences | ✅ None |

## Root Cause

safety-os was manually scaffolded (not via new-project.sh). new-project.sh performs
`cp -r "$COMMON_DIR/." "$PROJECT_DIR/"` which would have included common/skills/. Manual
scaffolding omitted this step.

## Antigravity Impact

Skill resolution priority (from GEMINI.md):
1. `skills/<name>/SKILL.md` (root level — HIGHEST priority)
2. `.gemini/skills/<name>/SKILL.md`
3. Global plugin skills

Without common/skills/ 11 skills, Antigravity cannot access: meeting-facilitation,
audit-workspace, script-lifecycle-manager, project-review, security-scan,
skill-lifecycle-manager, team-builder, translate, ui-ux-pro-max, validate-docs-links,
agent-lifecycle-manager.

## common/skills/ 11 Skills to Copy

agent-lifecycle-manager, audit-workspace, meeting-facilitation, project-review,
script-lifecycle-manager, security-scan, skill-lifecycle-manager, team-builder,
translate, ui-ux-pro-max, validate-docs-links

Final safety-os/skills/ = 4 Safety OS skills + 11 common = 15 total

## Action Items

| # | Owner | Tier | Deliverable |
|---|---|---|---|
| A-16 | scaffolding-expert | Medium | Copy all 11 from templates/common/skills/ to Projects/safety-os/skills/ |
| A-17 | auditor | Medium | Re-run safety-audit.ts + verify GEMINI.md Skill Resolution path |
| A-18 | scaffolding-expert | Medium | Update _ORIGIN.md — common/skills/ source and co-existence with Safety OS skills |
