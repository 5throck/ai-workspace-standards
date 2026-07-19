# VERSION_MANIFEST.md

**Generated**: 2026-07-19T06:00:13.089Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 8
- **Skills**: 23
- **Scripts**: 133
- **Commands**: 7

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents/architect.md | high        # claude-opus-4-7 | inherit | 2026-07-05 |
| auditor | agents/auditor.md | medium        # claude-sonnet-4-6 | inherit | 2026-07-05 |
| automation-engineer | agents/automation-engineer.md | low        # claude-haiku-4-5 | inherit | 2026-07-05 |
| docs-writer | agents/docs-writer.md | medium        # claude-sonnet-4-6 | inherit | 2026-07-05 |
| lifecycle-manager | agents/lifecycle-manager.md | medium        # claude-sonnet-4-6 | inherit | 2026-07-05 |
| pm | agents/pm.md | high        # claude-opus-4-7 | inherit | 2026-07-10 |
| scaffolding-expert | agents/scaffolding-expert.md | low        # claude-haiku-4-5 | inherit | 2026-07-05 |
| security-expert | agents/security-expert.md | medium        # claude-sonnet-4-6 | inherit | 2026-07-05 |

---

## Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | skills/agent-lifecycle-manager/SKILL.md | workspace | create agent, new agent, validate agents, agent lifecycle, manage agents | pm |
| audit-workspace | 1.0.0 | skills/audit-workspace/SKILL.md | workspace | audit workspace, run audit, check compliance, workspace check | auditor |
| create-variant | 1.0.1 | skills/create-variant/SKILL.md | workspace | create variant, new variant, create variant, variant creation, scaffold new variant, new co- project | pm |
| finishing-a-development-branch | 1.0.0 | .claude/skills/finishing-a-development-branch/SKILL.md | both | finish branch, complete work, wrap up, finishing a development branch, merge branch, create PR, push and PR | N/A |
| meeting | 1.4.0 | .claude/skills/meeting/SKILL.md | both | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| meeting-facilitation | 1.4.0 | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| platform-command-lifecycle-manager | 1.0.0 | .claude/skills/platform-command-lifecycle-manager/SKILL.md | both | create platform command, new .claude command, new .gemini command, platform command lifecycle, command parity, propagate command | pm |
| platform-skill-lifecycle-manager | 1.0.0 | .claude/skills/platform-skill-lifecycle-manager/SKILL.md | both | create platform skill, new .claude skill, new .gemini skill, platform skill version, platform skill lifecycle, update platform skill | pm |
| project-review | 1.1.0 | skills/project-review/SKILL.md | workspace | project review, review project, audit project, quality review | pm |
| project-to-variant | 1.0.0 | skills/project-to-variant/SKILL.md | workspace | convert project to variant, create variant from project, project to template, promote project to variant | scaffolding-expert |
| promote-variant | 1.0.1 | skills/promote-variant/SKILL.md | workspace | promote variant, Phase B, variant promotion, promote to template, create template from prototype | pm |
| script-lifecycle-manager | 1.2.0 | skills/script-lifecycle-manager/SKILL.md | workspace | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| security-scan | 1.0.0 | skills/security-scan/SKILL.md | workspace | security scan, scan for vulnerabilities, security check, run security | pm |
| simulate-project-creation | 1.0.0 | skills/simulate-project-creation/SKILL.md | workspace | simulate project, test scaffolding, dry run project creation | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | skills/skill-lifecycle-manager/SKILL.md | workspace | create skill, new skill, validate skills, skill lifecycle, manage skills | pm |
| source-command-commit-push-pr | 1.0.1 | .claude/skills/source-command-commit-push-pr/SKILL.md | both | commit-push-pr, commit and push, create PR | N/A |
| sync | 1.1.0 | skills/sync/SKILL.md | workspace | sync, /sync, commit and push, create PR | pm |
| team-builder | 1.1.0 | skills/team-builder/SKILL.md | workspace | build new agent team, create agent team, agent team setup, team builder | pm |
| ticket-run | 1.0.0 | skills/ticket-run/SKILL.md | workspace | ticket-run, process ticket queue, run next ticket | automation-engineer |
| translate | 1.0.0 | skills/translate/SKILL.md | workspace | translate, translation, localize, Korean translation | pm |
| upgrade-project | 1.1.0 | skills/upgrade-project/SKILL.md | workspace | upgrade project, upgrade template, sync project with template, refresh project, update project infrastructure | pm |
| validate-docs-links | 1.0.0 | skills/validate-docs-links/SKILL.md | workspace | validate links, check links, broken links, docs validation | pm |
| variant-feature | 1.0.0 | skills/variant-feature/SKILL.md | workspace | add feature to variant, extend variant, variant feature, add agent to variant, add skill to variant | scaffolding-expert |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | 1.0.1 | scripts/agent-create.ts | N/A |
| agent-delete.ts | 1.0.1 | scripts/agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | 1.1.4 | scripts/agent-lifecycle-audit.ts | N/A |
| agent-list.ts | 1.0.0 | scripts/agent-list.ts | N/A |
| agent-override-merge.ts | 1.0.1 | scripts/lib/agent-override-merge.ts | js-yaml |
| agent-promote.ts | 0.1.1 | scripts/helpers/agent-promote.ts | N/A |
| agent-similarity-analyzer.ts | 1.1.1 | scripts/helpers/agent-similarity-analyzer.ts | fs, path |
| agent-verify.ts | 1.0.1 | scripts/agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.1 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | 1.0.0 | scripts/archive-memory.ts | N/A |
| audit.ts | 2.10.7 | scripts/audit.ts | bun |
| auth.ts | 1.0.0 | scripts/lib/auth.ts | N/A |
| beta-lifecycle.ts | 1.2.0 | scripts/helpers/beta-lifecycle.ts | fs, path |
| capability-registry.ts | 1.0.0 | scripts/helpers/registries/capability-registry.ts | N/A |
| capability-validator.ts | 1.0.0 | scripts/validators/capability-validator.ts | fs, js-yaml, path |
| check-pm-approval.ts | 1.0.2 | scripts/check-pm-approval.ts | N/A |
| cleanup-completed-md.ts | 1.0.1 | scripts/cleanup-completed-md.ts | N/A |
| clear-pm-approval.ts | 1.0.0 | scripts/clear-pm-approval.ts | N/A |
| collaboration-plugin.ts | 1.0.0 | scripts/helpers/plugins/collaboration-plugin.ts | N/A |
| consulting-plugin.ts | 1.0.0 | scripts/helpers/plugins/consulting-plugin.ts | N/A |
| create-l2-scaffold.ts | 1.6.6 | scripts/create-l2-scaffold.ts | N/A |
| design-plugin.ts | 1.0.0 | scripts/helpers/plugins/design-plugin.ts | N/A |
| dev-sync.ts | 1.3.5 | scripts/dev-sync.ts | bun |
| development-plugin.ts | 1.0.0 | scripts/helpers/plugins/development-plugin.ts | N/A |
| dispatch-parallel.ts | 1.0.1 | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | 1.0.0 | scripts/dispatch-serial.ts | N/A |
| dispatch.ts | 1.0.0 | scripts/dispatch.ts | N/A |
| duplicate-validator.ts | 1.0.0 | scripts/validators/duplicate-validator.ts | fs, path |
| encoding-utils.ts | 1.0.0 | scripts/lib/encoding-utils.ts | fs, path |
| error-handling.ts | 1.1.0 | scripts/lib/error-handling.ts | N/A |
| extends-validator-wrapper.ts | 1.0.0 | scripts/validators/extends-validator-wrapper.ts | fs, js-yaml, path |
| extends-validator.ts | 1.0.1 | scripts/helpers/extends-validator.ts | fs, path |
| fix-script-versions.ts | 1.1.1 | scripts/fix-script-versions.ts | fs, path |
| game-plugin.ts | 1.0.0 | scripts/helpers/plugins/game-plugin.ts | N/A |
| gen-pr-body.ts | 1.1.5 | scripts/gen-pr-body.ts | bun |
| generate-scripts-readme.ts | 1.0.1 | scripts/generate-scripts-readme.ts | N/A |
| generate-variant.ts | 1.7.2 | scripts/helpers/generate-variant.ts | fs, path |
| generate-version-manifest.ts | 1.1.0 | scripts/generate-version-manifest.ts | bun, js-yaml |
| golden-reference-loader.ts | 1.0.1 | scripts/helpers/golden-reference-loader.ts | fs, path |
| index.ts | 1.0.0 | scripts/helpers/plugins/index.ts | N/A |
| index.ts | 1.0.0 | scripts/helpers/registries/index.ts | N/A |
| index.ts | 1.0.0 | scripts/validators/index.ts | N/A |
| ingest-external-skills.ts | 1.1.0 | scripts/ingest-external-skills.ts | N/A |
| ingest-security-frameworks.ts | 1.1.0 | scripts/ingest-security-frameworks.ts | N/A |
| inject-global-plugins.ts | 1.0.2 | scripts/helpers/inject-global-plugins.ts | N/A |
| inject-skills.ts | 1.0.1 | scripts/helpers/inject-skills.ts | N/A |
| integration-helpers.ts | 1.1.1 | scripts/helpers/integration-helpers.ts | fs, path |
| l2-to-variant-pipeline.ts | 1.9.0 | scripts/l2-to-variant-pipeline.ts | fs, path |
| language-guard.ts | 1.0.0 | scripts/lib/language-guard.ts | N/A |
| layer-filter.ts | 1.3.1 | scripts/helpers/layer-filter.ts | fs, path |
| lecture-plugin.ts | 1.0.0 | scripts/helpers/plugins/lecture-plugin.ts | N/A |
| lifecycle-governance.ts | 1.0.0 | scripts/helpers/lifecycle-governance.ts | N/A |
| lifecycle-sync-audit.ts | 1.4.3 | scripts/lifecycle-sync-audit.ts | N/A |
| list-template-versions.ts | 1.1.0 | scripts/list-template-versions.ts | bun |
| merge-frontmatter.ts | 1.8.6 | scripts/helpers/merge-frontmatter.ts | fs, js-yaml, path |
| merge-package-scripts.ts | 1.0.1 | scripts/helpers/merge-package-scripts.ts | N/A |
| new-project.ts | 1.4.0 | scripts/new-project.ts | js-yaml |
| normalize-agent-skills.ts | 1.0.1 | scripts/helpers/normalize-agent-skills.ts | fs, path |
| orphan-reference-validator.ts | 1.0.0 | scripts/validators/orphan-reference-validator.ts | fs, js-yaml, path |
| pipeline-state.ts | 1.1.1 | scripts/lib/pipeline-state.ts | fs, path |
| platform-context.ts | 1.0.0 | scripts/lib/platform-context.ts | bun, os |
| platform-parity-validator.ts | 1.0.0 | scripts/validators/platform-parity-validator.ts | fs, path |
| pm-md-parser.ts | 1.0.2 | scripts/helpers/pm-md-parser.ts | fs, js-yaml, path |
| post-write-lifecycle-check.ts | 1.0.1 | scripts/hooks/post-write-lifecycle-check.ts | bun |
| pre-commit.ts | 1.5.9 | scripts/hooks/pre-commit.ts | bun |
| pre-push.ts | 1.2.5 | scripts/hooks/pre-push.ts | bun |
| project-to-variant.ts | 1.0.2 | scripts/project-to-variant.ts | N/A |
| promotion-policy.ts | 1.0.0 | scripts/helpers/registries/promotion-policy.ts | N/A |
| propagate-to-templates.ts | 2.3.1 | scripts/propagate-to-templates.ts | js-yaml |
| propagation-map-schema.ts | 1.2.0 | scripts/lib/propagation-map-schema.ts | N/A |
| qa-gate.ts | N/A | scripts/qa-gate.ts | bun |
| readme-lifecycle-audit.ts | 1.0.2 | scripts/readme-lifecycle-audit.ts | N/A |
| reconcile-with-l0-l1.ts | 1.2.1 | scripts/helpers/reconcile-with-l0-l1.ts | fs, path, semver |
| regenerate-agents-md.ts | 1.0.1 | scripts/regenerate-agents-md.ts | fs, path |
| remove-project.ts | 1.0.1 | scripts/remove-project.ts | N/A |
| resolve-variants.ts | 1.0.1 | scripts/resolve-variants.ts | fs, js-yaml, path |
| retry-handler.ts | 1.0.1 | scripts/retry-handler.ts | N/A |
| rollback-partial-project.ts | 1.0.0 | scripts/helpers/rollback-partial-project.ts | N/A |
| scan-l2-project.ts | 1.1.1 | scripts/helpers/scan-l2-project.ts | crypto, fs, path |
| security-plugin.ts | 1.0.0 | scripts/helpers/plugins/security-plugin.ts | N/A |
| security-validator.test.ts | 1.0.1 | scripts/helpers/security-validator.test.ts | bun:test |
| security-validator.ts | 1.0.1 | scripts/helpers/security-validator.ts | fs, path |
| setup-github-branch-protection.ts | 1.0.1 | scripts/setup-github-branch-protection.ts | bun |
| skill-dependency-analysis.ts | 1.0.0 | scripts/skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | 1.2.0 | scripts/skill-lifecycle-audit.ts | N/A |
| spec-register.ts | 1.0.1 | scripts/spec-register.ts | N/A |
| ssrf.ts | 1.1.0 | scripts/lib/ssrf.ts | N/A |
| substitute-placeholders.ts | 1.1.1 | scripts/helpers/substitute-placeholders.ts | N/A |
| sync-agent-status.ts | 1.0.1 | scripts/sync-agent-status.ts | N/A |
| sync-md.ts | 1.2.0 | scripts/sync-md.ts | N/A |
| sync-skill-status.ts | 1.0.1 | scripts/sync-skill-status.ts | N/A |
| sync-skills-to-l2.ts | 1.0.1 | scripts/sync-skills-to-l2.ts | N/A |
| sync-skills.ts | 1.4.1 | scripts/sync-skills.ts | N/A |
| tag-template.ts | 1.0.1 | scripts/tag-template.ts | bun |
| team-builder.ts | 1.2.1 | scripts/team-builder.ts | N/A |
| template-utils.ts | 1.0.0 | scripts/helpers/template-utils.ts | N/A |
| template-validation.ts | 1.0.2 | scripts/helpers/template-validation.ts | N/A |
| test-extends-validator.ts | 1.0.1 | scripts/test-extends-validator.ts | fs, path |
| test-new-project.ts | 1.0.4 | scripts/test-new-project.ts | bun |
| test-platform-parity.ts | 0.2.4 | scripts/test-platform-parity.ts | fs, path |
| test-runner.ts | 1.0.3 | scripts/test-runner.ts | child_process, fs, path |
| ticket-schema.ts | 1.0.0 | scripts/helpers/ticket-schema.ts | N/A |
| ticket-store.ts | 1.0.0 | scripts/helpers/ticket-store.ts | js-yaml |
| ticket.ts | 1.0.0 | scripts/ticket.ts | N/A |
| translate-readme.ts | 1.0.0 | scripts/translate-readme.ts | bun, fs, path |
| types.ts | 1.0.0 | scripts/validators/types.ts | N/A |
| update-variant-lifecycle.ts | 1.0.1 | scripts/helpers/update-variant-lifecycle.ts | N/A |
| upgrade-project.ts | 1.7.0 | scripts/upgrade-project.ts | N/A |
| validate-agents.ts | 1.0.1 | scripts/validate-agents.ts | N/A |
| validate-doc-folder.ts | 1.0.0 | scripts/validate-doc-folder.ts | fs, path |
| validate-md-language.ts | 1.4.4 | scripts/validate-md-language.ts | fs |
| validate-model-registry.ts | N/A | scripts/validate-model-registry.ts | N/A |
| validate-output.ts | 1.0.1 | scripts/helpers/validate-output.ts | N/A |
| validate-platform-parity.ts | 1.1.1 | scripts/helpers/validate-platform-parity.ts | fs, path |
| validate-pm-extends.ts | 0.3.1 | scripts/validate-pm-extends.ts | N/A |
| validate-skills.ts | 1.0.1 | scripts/validate-skills.ts | N/A |
| validate-templates.ts | 1.5.13 | scripts/validate-templates.ts | js-yaml |
| validation-policy.ts | 1.0.0 | scripts/helpers/registries/validation-policy.ts | N/A |
| variant-feature.ts | 1.0.0 | scripts/variant-feature.ts | N/A |
| variant-governance-rules.ts | 1.1.1 | scripts/helpers/variant-governance-rules.ts | N/A |
| variant-json-validator.ts | 1.0.0 | scripts/validators/variant-json-validator.ts | N/A |
| variant-plugin.ts | 1.0.0 | scripts/helpers/plugins/variant-plugin.ts | N/A |
| variant-type-registry.ts | 1.0.0 | scripts/helpers/registries/variant-type-registry.ts | N/A |
| verify-agent-deliverables.ts | 1.0.1 | scripts/verify-agent-deliverables.ts | fs |
| verify-memory.ts | 1.0.1 | scripts/verify-memory.ts | fs, path |
| verify-new-project-tests.ts | 1.0.3 | scripts/verify-new-project-tests.ts | N/A |
| verify-platform-lifecycle.ts | 1.1.2 | scripts/verify-platform-lifecycle.ts | N/A |
| verify-readme-sync.ts | 1.1.1 | scripts/verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | 1.2.2 | scripts/verify-scripts.ts | fs, path |
| verify-skills.ts | 1.2.0 | scripts/verify-skills.ts | N/A |
| verify-template-integrity.ts | 1.0.0 | scripts/verify-template-integrity.ts | crypto, fs, path |
| workspace-integration.ts | 1.0.0 | scripts/helpers/workspace-integration.ts | crypto, fs, path |
| write-scripts-snapshot.ts | 1.0.1 | scripts/helpers/write-scripts-snapshot.ts | N/A |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | both | N/A |
| commit-push-pr | .claude/commands/commit-push-pr.md | both | N/A |
| meeting | .claude/commands/meeting.md | both | N/A |
| memlog | .claude/commands/memlog.md | both | N/A |
| new-task | .claude/commands/new-task.md | both | N/A |
| project-review | .claude/commands/project-review.md | both | N/A |
| sync | .claude/commands/sync.md | both | N/A |

---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: 7 / 7
- **Skills with parity**: 5 / 23

---

## Drift Detection

✅ No drift detected. All components are properly versioned and integrated.
