---
name: meeting-2026-06-05-common-skills-deployment
description: Meeting on templates/common skill deployment policy — source of truth alignment, agent-lifecycle-manager promotion, Phase B reconcile risk for safety-os
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: templates/common Skills Deployment Policy for safety-os
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Current State

| Skill location | Count | Source used for safety-os |
|---|---|---|
| templates/common/.claude/skills/ | 4 | ❌ NOT used as source |
| templates/common/.gemini/skills/ | 4 | ❌ NOT used as source |
| safety-os .claude/skills/ | 8 | Copied from templates/co-work/ |
| safety-os .gemini/skills/ | 5 | Copied from templates/co-work/ |

Common skills present in safety-os: ✅ all 4 present, but sourced from co-work not common.

## Key Findings

1. **Source of Truth broken**: safety-os skills were copied from co-work, not templates/common — divergence risk when common is updated
2. **Content sync unverified**: no diff comparison between common and safety-os skill versions
3. **agent-lifecycle-manager ambiguity**: present in all variants but NOT in templates/common/ — de facto common skill without formal status
4. **Phase B reconcile risk**: common skills may be stripped as "identical to L0/L1" during l2-to-variant-pipeline.ts execution
5. **new-project.sh injection logic**: unverified whether common skills are injected separately

## Action Items

| # | Owner | Tier | Deliverable |
|---|---|---|---|
| A-12 | scaffolding-expert | Medium | Verify new-project.sh common skill injection logic + diff templates/common vs safety-os skill content |
| A-13 | architect | Medium | Re-sync common 4 skills from templates/common/ to safety-os if content differs |
| A-14 | architect | High | agent-lifecycle-manager common promotion — separate workspace-root PR item |
| A-15 | scaffolding-expert | Medium | Update _ORIGIN.md — document common skill sync source and Phase B reconcile caveat |
