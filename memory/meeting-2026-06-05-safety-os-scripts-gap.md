---
name: meeting-2026-06-05-safety-os-scripts-gap
description: Gap analysis for missing scripts from templates/common/scripts/ in Projects/safety-os/ — 3-tier classification and copy strategy
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: templates/common Skills and Scripts Gap in Projects/safety-os/
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Gap Summary

| Category | templates/common | safety-os | Gap |
|---|---|---|---|
| .claude/skills/ | 4 skills | 8 skills | No gap (safety-os superset) |
| .gemini/skills/ | 4 skills | 5 skills | No gap (safety-os superset) |
| scripts/ | ~70 files | 17 files | **51 files missing** |

---

## Script Classification (3-Tier)

### Tier 1 — Immediate copy required (PROMOTION_CHECKLIST + Phase A operations)
agent-verify.ts, agent-create.ts, agent-delete.ts, agent-list.ts,
dispatch.ts, dispatch-parallel.ts, dispatch-serial.ts,
check-pm-approval.ts, clear-pm-approval.ts,
validate-agents.ts, validate-skills.ts,
sync-md.ps1, sync-md.sh, dev-sync.ps1, dev-sync.sh,
gen-pr-body.ps1, gen-pr-body.sh, audit.ps1, audit.sh,
package.json (bun runtime config)

### Tier 2 — Recommended (Phase A quality)
cleanup-completed-md.ps1, cleanup-completed-md.sh,
translate-readme.ts, readme-lifecycle-audit.ts,
analyze-git-history.ts, generate-version-manifest.ts,
upgrade-project.ps1, upgrade-project.sh,
verify-agent-deliverables.ts, verify-new-project-tests.ts,
verify-readme-sync.ts, verify-skills.ts, verify-template-integrity.ts,
validate-doc-folder.ts, validate-model-registry.ts,
sync-agent-status.ts, sync-skill-status.ts, sync-skills.ts,
skill-dependency-analysis.ts

### Tier 3 — Exclude (workspace-root only)
new-project.sh/ps1, propagate-to-templates.ts, publish-to-template.ts,
tag-template.ts, list-template-versions.ts, test-new-project.ts,
test-runner.ts, team-builder.ts, fix-parse-agent.sed,
generate-scripts-readme.ts, install-bun.ps1/sh, setup.ps1/sh

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-10 | automation-engineer | Medium | Copy Tier 1+2 scripts (~38 files) + package.json + hooks/ extras to Projects/safety-os/scripts/, update SCRIPTS.md |
| A-11 | auditor | Medium | Verify bun scripts/agent-verify.ts runs + re-run bun scripts/safety-audit.ts |
