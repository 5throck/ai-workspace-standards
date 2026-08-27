# VERSION_MANIFEST.md

**Generated**: 2026-06-05T22:18:53.052Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 15
- **Skills**: 30
- **Scripts**: 81
- **Commands**: 6

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| asset-integrity-agent | agents/asset-integrity-agent.md | N/A | N/A | 2026-06-05 |
| audit-agent | agents/audit-agent.md | N/A | inherit | 2026-06-05 |
| compliance-agent | agents/compliance-agent.md | N/A | inherit | 2026-06-05 |
| contractor-safety-agent | agents/contractor-safety-agent.md | N/A | N/A | 2026-06-05 |
| disaster-response-agent | agents/disaster-response-agent.md | N/A | N/A | 2026-06-05 |
| emergency-agent | agents/emergency-agent.md | N/A | inherit | 2026-06-05 |
| incident-investigation-agent | agents/incident-investigation-agent.md | N/A | N/A | 2026-06-05 |
| legal-agent | agents/legal-agent.md | N/A | N/A | 2026-06-05 |
| pm | agents/pm.md | N/A | inherit | 2026-06-05 |
| psm-agent | agents/psm-agent.md | N/A | N/A | 2026-06-05 |
| reporting-agent | agents/reporting-agent.md | N/A | N/A | 2026-06-05 |
| risk-assessment-agent | agents/risk-assessment-agent.md | N/A | inherit | 2026-06-05 |
| safety-governance-manager | agents/safety-governance-manager.md | N/A | inherit | 2026-06-05 |
| safety-workflow-manager | agents/safety-workflow-manager.md | N/A | inherit | 2026-06-05 |
| training-agent | agents/training-agent.md | N/A | N/A | 2026-06-05 |

---

## Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | skills/agent-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| agent-lifecycle-manager | 1.0.0 | .claude/skills/agent-lifecycle-manager/SKILL.md | both | N/A | pm |
| api-documentation | 1.0.0 | .claude/skills/api-documentation/SKILL.md | claude | N/A | N/A |
| asset-integrity-check | N/A | skills/daily/asset-integrity-check/SKILL.md | workspace | N/A | asset-integrity-agent |
| audit-preparation | N/A | skills/daily/audit-preparation/SKILL.md | workspace | N/A | audit-agent |
| audit-workspace | 1.0.0 | skills/audit-workspace/SKILL.md | workspace | N/A | auditor |
| compliance-gap | 1.0.0 | skills/daily/compliance-gap/SKILL.md | workspace | N/A | compliance-agent |
| contractor-onboarding | N/A | skills/daily/contractor-onboarding/SKILL.md | workspace | N/A | contractor-safety-agent |
| documentation-writing | 1.0.0 | .claude/skills/documentation-writing/SKILL.md | claude | N/A | N/A |
| emergency-response | 1.0.0 | skills/emergency/emergency-response/SKILL.md | workspace | N/A | emergency-agent |
| finishing-a-development-branch | 1.0.0 | .claude/skills/finishing-a-development-branch/SKILL.md | both | N/A | N/A |
| hazop-analysis | N/A | skills/investigation/hazop-analysis/SKILL.md | workspace | N/A | psm-agent |
| legalize-kr-sync | N/A | skills/legalize-kr-sync/SKILL.md | workspace | N/A | safety-workflow-manager |
| meeting-facilitation | 1.4.0 | skills/meeting-facilitation/SKILL.md | workspace | N/A | pm |
| permit-to-work | 1.0.0 | skills/daily/permit-to-work/SKILL.md | workspace | N/A | safety-workflow-manager |
| platform-command-lifecycle-manager | 1.0.0 | .claude/skills/platform-command-lifecycle-manager/SKILL.md | both | N/A | pm |
| platform-skill-lifecycle-manager | 1.0.0 | .claude/skills/platform-skill-lifecycle-manager/SKILL.md | both | N/A | pm |
| project-review | 1.0.0 | skills/project-review/SKILL.md | workspace | N/A | pm |
| psm-moc | 1.0 | skills/domains/functional/psm/moc/SKILL.md | workspace | N/A | psm-agent |
| research-analysis | 1.0.0 | .claude/skills/research-analysis/SKILL.md | claude | N/A | N/A |
| risk-assessment | 1.0.0 | skills/daily/risk-assessment/SKILL.md | workspace | N/A | risk-assessment-agent |
| root-cause-analysis | N/A | skills/investigation/root-cause-analysis/SKILL.md | workspace | N/A | incident-investigation-agent |
| script-lifecycle-manager | 1.2.0 | skills/script-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| security-scan | 1.0.0 | skills/security-scan/SKILL.md | workspace | N/A | security-expert |
| simulate-project-creation | 1.0.0 | .claude/skills/simulate-project-creation/SKILL.md | both | N/A | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | skills/skill-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| team-builder | 1.1.0 | skills/team-builder/SKILL.md | workspace | N/A | pm |
| translate | 1.0.0 | skills/translate/SKILL.md | workspace | N/A | pm |
| ui-ux-pro-max | 1.0.0 | skills/ui-ux-pro-max/SKILL.md | workspace | N/A | architect |
| validate-docs-links | 1.0.0 | skills/validate-docs-links/SKILL.md | workspace | N/A | docs-writer |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | N/A | scripts/agent-create.ts | N/A |
| agent-delete.ts | N/A | scripts/agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | N/A | scripts/agent-lifecycle-audit.ts | N/A |
| agent-list.ts | N/A | scripts/agent-list.ts | N/A |
| agent-verify.ts | N/A | scripts/agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.0 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | N/A | scripts/archive-memory.ts | N/A |
| audit.ts | 2.5.3 | scripts/audit.ts | bun |
| auto-executor.ts | N/A | scripts/lib/auto-executor.ts | N/A |
| beta-lifecycle.ts | N/A | scripts/helpers/beta-lifecycle.ts | fs, path |
| check-pm-approval.ts | N/A | scripts/check-pm-approval.ts | N/A |
| checkpoint-manager.ts | N/A | scripts/lib/checkpoint-manager.ts | N/A |
| clear-pm-approval.ts | N/A | scripts/clear-pm-approval.ts | N/A |
| dev-sync.ts | 1.2.2 | scripts/dev-sync.ts | bun |
| dispatch-parallel.ts | N/A | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | N/A | scripts/dispatch-serial.ts | N/A |
| dispatch.ts | N/A | scripts/dispatch.ts | N/A |
| encoding-utils.ts | N/A | scripts/lib/encoding-utils.ts | fs, path |
| error-handling.ts | N/A | scripts/lib/error-handling.ts | N/A |
| fetch-legalize.ts | N/A | scripts/fetch-legalize.ts | child_process, fs, path |
| gen-pr-body.ts | N/A | scripts/gen-pr-body.ts | bun |
| generate-playbook.ts | N/A | scripts/generate-playbook.ts | fs, path |
| generate-scripts-readme.ts | N/A | scripts/generate-scripts-readme.ts | N/A |
| generate-variant.ts | N/A | scripts/helpers/generate-variant.ts | fs, path |
| generate-version-manifest.ts | 1.0.1 | scripts/generate-version-manifest.ts | bun |
| inject-global-plugins.ts | N/A | scripts/helpers/inject-global-plugins.ts | N/A |
| inject-skills.ts | N/A | scripts/helpers/inject-skills.ts | N/A |
| integration-helpers.ts | N/A | scripts/helpers/integration-helpers.ts | fs, path |
| layer-filter.ts | N/A | scripts/helpers/layer-filter.ts | fs, path |
| lifecycle-governance.ts | N/A | scripts/helpers/lifecycle-governance.ts | N/A |
| lifecycle-sync-audit.ts | N/A | scripts/lifecycle-sync-audit.ts | N/A |
| mcp-cache.ts | N/A | scripts/lib/mcp-cache.ts | N/A |
| merge-frontmatter.ts | N/A | scripts/helpers/merge-frontmatter.ts | fs, js-yaml, path |
| merge-package-scripts.ts | N/A | scripts/helpers/merge-package-scripts.ts | N/A |
| pipeline-state.ts | N/A | scripts/lib/pipeline-state.ts | fs, path |
| plan-parser.ts | N/A | scripts/lib/plan-parser.ts | fs, js-yaml |
| platform-context.ts | N/A | scripts/lib/platform-context.ts | bun, os |
| platform-dispatcher.ts | N/A | scripts/lib/platform-dispatcher.ts | N/A |
| post-write-lifecycle-check.ts | N/A | scripts/hooks/post-write-lifecycle-check.ts | bun |
| pre-commit.ts | N/A | scripts/hooks/pre-commit.ts | bun |
| pre-push.ts | N/A | scripts/hooks/pre-push.ts | bun |
| propagate-to-templates.ts | N/A | scripts/propagate-to-templates.ts | N/A |
| publish-to-template.ts | N/A | scripts/publish-to-template.ts | N/A |
| qa-gate.ts | N/A | scripts/qa-gate.ts | bun |
| readme-lifecycle-audit.ts | N/A | scripts/readme-lifecycle-audit.ts | N/A |
| reconcile-with-l0-l1.ts | N/A | scripts/helpers/reconcile-with-l0-l1.ts | fs, path, semver |
| retry-handler.ts | N/A | scripts/retry-handler.ts | N/A |
| safety-audit.ts | N/A | scripts/safety-audit.ts | js-yaml |
| scan-l2-project.ts | N/A | scripts/helpers/scan-l2-project.ts | crypto, fs, path |
| skill-dependency-analysis.ts | N/A | scripts/skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | N/A | scripts/skill-lifecycle-audit.ts | N/A |
| start-mcp.ts | N/A | scripts/start-mcp.ts | child_process, path |
| substitute-placeholders.ts | N/A | scripts/helpers/substitute-placeholders.ts | N/A |
| sync-agent-status.ts | N/A | scripts/sync-agent-status.ts | N/A |
| sync-md.ts | 1.2.0 | scripts/sync-md.ts | N/A |
| sync-skill-status.ts | N/A | scripts/sync-skill-status.ts | N/A |
| sync-skills.ts | N/A | scripts/sync-skills.ts | N/A |
| tag-template.ts | 1.0.0 | scripts/tag-template.ts | bun |
| team-builder.ts | N/A | scripts/team-builder.ts | fs, path |
| template-validation.ts | N/A | scripts/helpers/template-validation.ts | N/A |
| test-runner.ts | N/A | scripts/test-runner.ts | child_process, fs, path |
| translate-readme.ts | N/A | scripts/translate-readme.ts | bun, fs, path |
| update-variant-lifecycle.ts | N/A | scripts/helpers/update-variant-lifecycle.ts | N/A |
| validate-agents.ts | N/A | scripts/validate-agents.ts | N/A |
| validate-doc-folder.ts | N/A | scripts/validate-doc-folder.ts | fs, path |
| validate-md-language.ts | 1.3.0 | scripts/validate-md-language.ts | fs |
| validate-output.ts | N/A | scripts/helpers/validate-output.ts | N/A |
| validate-platform-parity.ts | N/A | scripts/helpers/validate-platform-parity.ts | fs, path |
| validate-skills.ts | N/A | scripts/validate-skills.ts | N/A |
| validate-templates.ts | N/A | scripts/validate-templates.ts | N/A |
| variant-governance-rules.ts | N/A | scripts/helpers/variant-governance-rules.ts | N/A |
| verify-agent-deliverables.ts | N/A | scripts/verify-agent-deliverables.ts | fs |
| verify-memory.ts | N/A | scripts/verify-memory.ts | fs, path |
| verify-new-project-tests.ts | N/A | scripts/verify-new-project-tests.ts | N/A |
| verify-platform-lifecycle.ts | N/A | scripts/verify-platform-lifecycle.ts | N/A |
| verify-readme-sync.ts | 1.1.1 | scripts/verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | N/A | scripts/verify-scripts.ts | fs, path |
| verify-skills.ts | N/A | scripts/verify-skills.ts | N/A |
| verify-template-integrity.ts | N/A | scripts/verify-template-integrity.ts | crypto, fs, path |
| write-scripts-snapshot.ts | N/A | scripts/helpers/write-scripts-snapshot.ts | N/A |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | both | N/A |
| commit-push-pr | .claude/commands/commit-push-pr.md | both | N/A |
| meeting | .claude/commands/meeting.md | both | N/A |
| memlog | .claude/commands/memlog.md | both | N/A |
| new-task | .claude/commands/new-task.md | both | N/A |
| sync | .claude/commands/sync.md | both | N/A |

---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: 6 / 6
- **Skills with parity**: 5 / 30

---

## Drift Detection

⚠️ **Drift detected**:

- Agent asset-integrity-agent missing tier or model metadata
- Agent audit-agent missing tier or model metadata
- Agent compliance-agent missing tier or model metadata
- Agent contractor-safety-agent missing tier or model metadata
- Agent disaster-response-agent missing tier or model metadata
- Agent emergency-agent missing tier or model metadata
- Agent incident-investigation-agent missing tier or model metadata
- Agent legal-agent missing tier or model metadata
- Agent pm missing tier or model metadata
- Agent psm-agent missing tier or model metadata
- Agent reporting-agent missing tier or model metadata
- Agent risk-assessment-agent missing tier or model metadata
- Agent safety-governance-manager missing tier or model metadata
- Agent safety-workflow-manager missing tier or model metadata
- Agent training-agent missing tier or model metadata
- Skill agent-lifecycle-manager has no triggers defined
- Skill agent-lifecycle-manager has no triggers defined
- Skill api-documentation has no triggers defined
- Skill asset-integrity-check missing version
- Skill asset-integrity-check has no triggers defined
- Skill audit-preparation missing version
- Skill audit-preparation has no triggers defined
- Skill audit-workspace has no triggers defined
- Skill compliance-gap has no triggers defined
- Skill contractor-onboarding missing version
- Skill contractor-onboarding has no triggers defined
- Skill documentation-writing has no triggers defined
- Skill emergency-response has no triggers defined
- Skill finishing-a-development-branch has no triggers defined
- Skill hazop-analysis missing version
- Skill hazop-analysis has no triggers defined
- Skill legalize-kr-sync missing version
- Skill legalize-kr-sync has no triggers defined
- Skill meeting-facilitation has no triggers defined
- Skill permit-to-work has no triggers defined
- Skill platform-command-lifecycle-manager has no triggers defined
- Skill platform-skill-lifecycle-manager has no triggers defined
- Skill project-review has no triggers defined
- Skill psm-moc missing version
- Skill psm-moc has no triggers defined
- Skill research-analysis has no triggers defined
- Skill risk-assessment has no triggers defined
- Skill root-cause-analysis missing version
- Skill root-cause-analysis has no triggers defined
- Skill script-lifecycle-manager has no triggers defined
- Skill security-scan has no triggers defined
- Skill simulate-project-creation has no triggers defined
- Skill skill-lifecycle-manager has no triggers defined
- Skill team-builder has no triggers defined
- Skill translate has no triggers defined
- Skill ui-ux-pro-max has no triggers defined
- Skill validate-docs-links has no triggers defined
- Command changelog not integrated as a skill
- Command commit-push-pr not integrated as a skill
- Command meeting not integrated as a skill
- Command memlog not integrated as a skill
- Command new-task not integrated as a skill
- Command sync not integrated as a skill
