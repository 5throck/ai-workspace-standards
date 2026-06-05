---
name: meeting-2026-06-05-create-variant-skill-script
description: Design meeting for new-variant creation skill and script — based on co-safety Phase A experience
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: New Variant Creation Process — Skill and Script Design
**Participants**: architect, automation-engineer, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

The co-safety Phase A work established a repeatable process for creating new variants.
This meeting designs a skill and script to codify that process for future use.

## Existing Infrastructure

| Tool | Role |
|---|---|
| `new-project.sh` | template → L2 instance (existing, not changed) |
| `l2-to-variant-pipeline.ts` | L2 instance → templates/co-<name>/ (Phase B, existing) |
| `create-l2-scaffold.ts` (NEW) | common → Projects/<name>/ Phase A scaffold |
| `create-variant` skill (NEW) | Phase A process guide |
| `promote-variant` skill (NEW) | Phase B promotion guide |

## Deliverable Designs

### scripts/create-l2-scaffold.ts

Input: `bun scripts/create-l2-scaffold.ts <variant-name> [--domain <type>] [--dry-run]`

Automated steps:
1. Create Projects/<name>/ directory
2. Copy templates/common/ overlay (cp -r common/. Projects/<name>/)
3. Copy scripts/ Tier 1+2 (Tier 3 excluded — hardcoded list)
4. Generate variant.json stub (status: beta)
5. Generate _ORIGIN.md (version snapshot + reconcile warnings)
6. Generate _COMMON_VERSION.md
7. Generate PROMOTION_CHECKLIST.md (7-condition template)

NOT automated (requires domain knowledge):
- CLAUDE.md/GEMINI.md variant sections
- agents/ domain files
- domain-specific folder structures
- new-project.sh/ps1 enum addition (Phase B)

Tier 3 exclusion list (hardcoded):
new-project.sh/ps1, propagate-to-templates.ts, publish-to-template.ts,
tag-template.ts, list-template-versions.ts, test-new-project.ts, test-runner.ts,
team-builder.ts, fix-parse-agent.sed, generate-scripts-readme.ts,
install-bun.ps1/sh, setup.ps1/sh

### skills/create-variant/SKILL.md

Location: workspace root skills/create-variant/ (NOT in templates/common/skills/)
Triggers: 새 variant 만들기, new variant, variant 생성, create variant

Steps:
1. Run create-l2-scaffold.ts
2. Add variant section to CLAUDE.md/GEMINI.md (reconcile survival)
3. Clean AGENTS.md (remove workspace root agents, keep only variant agents)
4. Write domain agents (3-Section structure)
5. Write domain skills
6. Create domain folder structure
7. Complete variant.json
8. Define PROMOTION_CHECKLIST.md conditions

### skills/promote-variant/SKILL.md

Location: workspace root skills/promote-variant/
Triggers: variant 승격, Phase B, promote to template, promote variant

Steps:
1. Verify PROMOTION_CHECKLIST conditions
2. Run l2-to-variant-pipeline.ts
3. Handle manual copy items (per _ORIGIN.md)
4. Add enum to new-project.sh and new-project.ps1
5. Run validate-templates.ts
6. Run tag-template.ts

## Action Items

| # | Owner | Tier | Deliverable |
|---|---|---|---|
| B-01 | automation-engineer | High | scripts/create-l2-scaffold.ts — 7-step automation, Tier 3 exclusion, dry-run support |
| B-02 | docs-writer | Medium | skills/create-variant/SKILL.md — full Phase A checklist based on co-safety experience |
| B-03 | docs-writer | Medium | skills/promote-variant/SKILL.md — Phase B promotion guide |
| B-04 | automation-engineer | Medium | Update SCRIPTS.md + register both skills in AGENTS.md §Skills |
