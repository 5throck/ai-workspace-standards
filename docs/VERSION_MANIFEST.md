# VERSION_MANIFEST.md

**Generated**: 2026-06-27T11:09:07.503Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 8
- **Skills**: 18
- **Scripts**: 102
- **Commands**: 6

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents/architect.md | high | inherit | 2026-06-15 |
| auditor | agents/auditor.md | medium | inherit | 2026-06-15 |
| automation-engineer | agents/automation-engineer.md | low | inherit | 2026-06-15 |
| docs-writer | agents/docs-writer.md | medium | inherit | 2026-06-13 |
| lifecycle-manager | agents/lifecycle-manager.md | medium | inherit | 2026-06-13 |
| pm | agents/pm.md | high | inherit | 2026-06-18 |
| scaffolding-expert | agents/scaffolding-expert.md | low | inherit | 2026-06-15 |
| security-expert | agents/security-expert.md | medium | inherit | 2026-06-13 |

---

## Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | skills/agent-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| audit-workspace | 1.0.0 | skills/audit-workspace/SKILL.md | workspace | N/A | auditor |
| create-variant | 1.0.1 | skills/create-variant/SKILL.md | workspace | N/A | pm |
| finishing-a-development-branch | 1.0.0 | .claude/skills/finishing-a-development-branch/SKILL.md | both | N/A | N/A |
| meeting-facilitation | 1.4.0 | skills/meeting-facilitation/SKILL.md | workspace | N/A | pm |
| meeting-facilitation | 1.4.0 | .claude/skills/meeting-facilitation/SKILL.md | both | N/A | pm |
| platform-command-lifecycle-manager | 1.0.0 | .claude/skills/platform-command-lifecycle-manager/SKILL.md | both | N/A | pm |
| platform-skill-lifecycle-manager | 1.0.0 | .claude/skills/platform-skill-lifecycle-manager/SKILL.md | both | N/A | pm |
| project-review | 1.0.0 | skills/project-review/SKILL.md | workspace | N/A | pm |
| promote-variant | 1.0.1 | skills/promote-variant/SKILL.md | workspace | N/A | pm |
| script-lifecycle-manager | 1.2.0 | skills/script-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| security-scan | 1.0.0 | skills/security-scan/SKILL.md | workspace | N/A | security-expert |
| simulate-project-creation | 1.0.0 | skills/simulate-project-creation/SKILL.md | workspace | N/A | scaffolding-expert |
| simulate-project-creation | 1.0.0 | .claude/skills/simulate-project-creation/SKILL.md | both | N/A | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | skills/skill-lifecycle-manager/SKILL.md | workspace | N/A | pm |
| team-builder | 1.1.0 | skills/team-builder/SKILL.md | workspace | N/A | pm |
| translate | 1.0.0 | skills/translate/SKILL.md | workspace | N/A | pm |
| validate-docs-links | 1.0.0 | skills/validate-docs-links/SKILL.md | workspace | N/A | docs-writer |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | 1.0.0 | scripts/agent-create.ts | N/A |
| agent-delete.ts | 1.0.0 | scripts/agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | 1.1.3 | scripts/agent-lifecycle-audit.ts | N/A |
| agent-list.ts | 1.0.0 | scripts/agent-list.ts | N/A |
| agent-override-merge.ts | 1.0.0 | scripts/lib/agent-override-merge.ts | js-yaml |
| agent-promote.ts | 0.1.0 | scripts/helpers/agent-promote.ts | N/A |
| agent-similarity-analyzer.ts | 1.1.0 | scripts/helpers/agent-similarity-analyzer.ts | fs, path |
| agent-verify.ts | 1.0.1 | scripts/agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.1 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | 1.0.0 | scripts/archive-memory.ts | N/A |
| audit.ts | 2.10.1 | scripts/audit.ts | bun |
| beta-lifecycle.ts | 1.1.0 | scripts/helpers/beta-lifecycle.ts | fs, path |
| check-pm-approval.ts | 1.0.1 | scripts/check-pm-approval.ts | N/A |
| cleanup-completed-md.ts | 1.0.0 | scripts/cleanup-completed-md.ts | N/A |
| clear-pm-approval.ts | 1.0.0 | scripts/clear-pm-approval.ts | N/A |
| create-l2-scaffold.ts | 1.6.2 | scripts/create-l2-scaffold.ts | child_process, fs, path |
| dev-sync.ts | 1.3.0 | scripts/dev-sync.ts | bun |
| dispatch-parallel.ts | 1.0.0 | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | 1.0.0 | scripts/dispatch-serial.ts | N/A |
| dispatch.ts | 1.0.0 | scripts/dispatch.ts | N/A |
| encoding-utils.ts | 1.0.0 | scripts/lib/encoding-utils.ts | fs, path |
| error-handling.ts | 1.1.0 | scripts/lib/error-handling.ts | N/A |
| extends-validator.ts | 1.0.0 | scripts/helpers/extends-validator.ts | fs, path |
| fix-script-versions.ts | 1.1.0 | scripts/fix-script-versions.ts | fs, path |
| gen-pr-body.ts | 1.1.1 | scripts/gen-pr-body.ts | bun |
| generate-scripts-readme.ts | 1.0.0 | scripts/generate-scripts-readme.ts | N/A |
| generate-variant.ts | 1.7.1 | scripts/helpers/generate-variant.ts | fs, path |
| generate-version-manifest.ts | 1.0.2 | scripts/generate-version-manifest.ts | bun |
| golden-reference-loader.ts | 1.0.0 | scripts/helpers/golden-reference-loader.ts | fs, path |
| ingest-external-skills.ts | 1.0.1 | scripts/ingest-external-skills.ts | N/A |
| ingest-security-frameworks.ts | 1.0.0 | scripts/ingest-security-frameworks.ts | N/A |
| inject-global-plugins.ts | 1.0.1 | scripts/helpers/inject-global-plugins.ts | N/A |
| inject-skills.ts | 1.0.0 | scripts/helpers/inject-skills.ts | N/A |
| integration-helpers.ts | 1.1.0 | scripts/helpers/integration-helpers.ts | fs, path |
| l2-to-variant-pipeline.ts | 1.8.2 | scripts/l2-to-variant-pipeline.ts | fs, path |
| layer-filter.ts | 1.3.0 | scripts/helpers/layer-filter.ts | fs, path |
| lifecycle-governance.ts | 1.0.0 | scripts/helpers/lifecycle-governance.ts | N/A |
| lifecycle-sync-audit.ts | 1.4.1 | scripts/lifecycle-sync-audit.ts | N/A |
| list-template-versions.ts | 1.1.0 | scripts/list-template-versions.ts | bun |
| merge-frontmatter.ts | 1.8.4 | scripts/helpers/merge-frontmatter.ts | fs, js-yaml, path |
| merge-package-scripts.ts | 1.0.0 | scripts/helpers/merge-package-scripts.ts | N/A |
| new-project.ts | 1.1.8 | scripts/new-project.ts | N/A |
| normalize-agent-skills.ts | 1.0.0 | scripts/helpers/normalize-agent-skills.ts | fs, path |
| pipeline-state.ts | 1.1.0 | scripts/lib/pipeline-state.ts | fs, path |
| platform-context.ts | 1.0.0 | scripts/lib/platform-context.ts | bun, os |
| pm-md-parser.ts | 1.0.2 | scripts/helpers/pm-md-parser.ts | fs, js-yaml, path |
| post-write-lifecycle-check.ts | 1.0.0 | scripts/hooks/post-write-lifecycle-check.ts | bun |
| pre-commit.ts | 1.5.6 | scripts/hooks/pre-commit.ts | bun |
| pre-push.ts | 1.2.3 | scripts/hooks/pre-push.ts | bun |
| project-to-variant.ts | 1.0.1 | scripts/project-to-variant.ts | N/A |
| propagate-to-templates.ts | 2.0.9 | scripts/propagate-to-templates.ts | N/A |
| propagation-map-schema.ts | 1.0.0 | scripts/lib/propagation-map-schema.ts | N/A |
| qa-gate.ts | N/A | scripts/qa-gate.ts | bun |
| readme-lifecycle-audit.ts | 1.0.1 | scripts/readme-lifecycle-audit.ts | N/A |
| reconcile-with-l0-l1.ts | 1.2.0 | scripts/helpers/reconcile-with-l0-l1.ts | fs, path, semver |
| regenerate-agents-md.ts | 1.0.0 | scripts/regenerate-agents-md.ts | fs, path |
| remove-project.ts | 1.0.0 | scripts/remove-project.ts | N/A |
| resolve-variants.ts | 1.0.0 | scripts/resolve-variants.ts | fs, js-yaml, path |
| retry-handler.ts | 1.0.0 | scripts/retry-handler.ts | N/A |
| scan-l2-project.ts | 1.1.0 | scripts/helpers/scan-l2-project.ts | crypto, fs, path |
| security-validator.test.ts | 1.0.0 | scripts/helpers/security-validator.test.ts | bun:test |
| security-validator.ts | 1.0.0 | scripts/helpers/security-validator.ts | fs, path |
| skill-dependency-analysis.ts | 1.0.0 | scripts/skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | 1.1.3 | scripts/skill-lifecycle-audit.ts | N/A |
| spec-register.ts | 1.0.0 | scripts/spec-register.ts | N/A |
| substitute-placeholders.ts | 1.1.0 | scripts/helpers/substitute-placeholders.ts | N/A |
| sync-agent-status.ts | 1.0.0 | scripts/sync-agent-status.ts | N/A |
| sync-md.ts | 1.2.0 | scripts/sync-md.ts | N/A |
| sync-skill-status.ts | 1.0.0 | scripts/sync-skill-status.ts | N/A |
| sync-skills-to-l2.ts | 1.0.0 | scripts/sync-skills-to-l2.ts | N/A |
| sync-skills.ts | 1.0.0 | scripts/sync-skills.ts | N/A |
| tag-template.ts | 1.0.0 | scripts/tag-template.ts | bun |
| team-builder.ts | 1.2.0 | scripts/team-builder.ts | fs, path |
| template-utils.ts | 1.0.0 | scripts/helpers/template-utils.ts | N/A |
| template-validation.ts | 1.0.1 | scripts/helpers/template-validation.ts | N/A |
| test-extends-validator.ts | 1.0.0 | scripts/test-extends-validator.ts | fs, path |
| test-new-project.ts | 1.0.3 | scripts/test-new-project.ts | bun |
| test-platform-parity.ts | 0.2.3 | scripts/test-platform-parity.ts | fs, path |
| test-runner.ts | 1.0.2 | scripts/test-runner.ts | child_process, fs, path |
| translate-readme.ts | 1.0.0 | scripts/translate-readme.ts | bun, fs, path |
| update-variant-lifecycle.ts | 1.0.0 | scripts/helpers/update-variant-lifecycle.ts | N/A |
| upgrade-project.ts | 1.2.1 | scripts/upgrade-project.ts | N/A |
| validate-agents.ts | 1.0.0 | scripts/validate-agents.ts | N/A |
| validate-doc-folder.ts | 1.0.0 | scripts/validate-doc-folder.ts | fs, path |
| validate-md-language.ts | 1.4.3 | scripts/validate-md-language.ts | fs |
| validate-model-registry.ts | N/A | scripts/validate-model-registry.ts | N/A |
| validate-output.ts | 1.0.0 | scripts/helpers/validate-output.ts | N/A |
| validate-platform-parity.ts | 1.1.0 | scripts/helpers/validate-platform-parity.ts | fs, path |
| validate-pm-extends.ts | 0.3.0 | scripts/validate-pm-extends.ts | N/A |
| validate-skills.ts | 1.0.0 | scripts/validate-skills.ts | N/A |
| validate-templates.ts | 1.5.9 | scripts/validate-templates.ts | js-yaml |
| variant-feature.ts | 1.0.0 | scripts/variant-feature.ts | N/A |
| variant-governance-rules.ts | 1.1.0 | scripts/helpers/variant-governance-rules.ts | N/A |
| verify-agent-deliverables.ts | 1.0.0 | scripts/verify-agent-deliverables.ts | fs |
| verify-memory.ts | 1.0.0 | scripts/verify-memory.ts | fs, path |
| verify-new-project-tests.ts | 1.0.2 | scripts/verify-new-project-tests.ts | N/A |
| verify-platform-lifecycle.ts | 1.1.1 | scripts/verify-platform-lifecycle.ts | N/A |
| verify-readme-sync.ts | 1.1.1 | scripts/verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | 1.2.0 | scripts/verify-scripts.ts | fs, path |
| verify-skills.ts | 1.2.0 | scripts/verify-skills.ts | N/A |
| verify-template-integrity.ts | 1.0.0 | scripts/verify-template-integrity.ts | crypto, fs, path |
| write-scripts-snapshot.ts | 1.0.0 | scripts/helpers/write-scripts-snapshot.ts | N/A |

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
- **Skills with parity**: 5 / 18

---

## Drift Detection

⚠️ **Drift detected**:

- Skill agent-lifecycle-manager has no triggers defined
- Skill audit-workspace has no triggers defined
- Skill create-variant has no triggers defined
- Skill finishing-a-development-branch has no triggers defined
- Skill meeting-facilitation has no triggers defined
- Skill meeting-facilitation has no triggers defined
- Skill platform-command-lifecycle-manager has no triggers defined
- Skill platform-skill-lifecycle-manager has no triggers defined
- Skill project-review has no triggers defined
- Skill promote-variant has no triggers defined
- Skill script-lifecycle-manager has no triggers defined
- Skill security-scan has no triggers defined
- Skill simulate-project-creation has no triggers defined
- Skill simulate-project-creation has no triggers defined
- Skill skill-lifecycle-manager has no triggers defined
- Skill team-builder has no triggers defined
- Skill translate has no triggers defined
- Skill validate-docs-links has no triggers defined
- Command changelog not integrated as a skill
- Command commit-push-pr not integrated as a skill
- Command meeting not integrated as a skill
- Command memlog not integrated as a skill
- Command new-task not integrated as a skill
- Command sync not integrated as a skill
