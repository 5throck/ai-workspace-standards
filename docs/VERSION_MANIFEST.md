# VERSION_MANIFEST.md

**Generated**: 2026-08-24T22:41:55.129Z
**Manifest Version**: 1.0
**Location**: docs\VERSION_MANIFEST.md

---

## Summary

- **Agents**: 8
- **Skills**: 37
- **Scripts**: 80
- **Commands**: 8

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents/architect.md | high        # claude-opus-5-0 | inherit | 2026-08-15 |
| auditor | agents/auditor.md | medium        # claude-sonnet-5-0 | inherit | 2026-08-15 |
| automation-engineer | agents/automation-engineer.md | low        # claude-haiku-4-5 | inherit | 2026-08-15 |
| docs-writer | agents/docs-writer.md | medium        # claude-sonnet-5-0 | inherit | 2026-08-15 |
| lifecycle-manager | agents/lifecycle-manager.md | medium        # claude-sonnet-5-0 | inherit | 2026-08-15 |
| pm | agents/pm.md | high        # claude-opus-5-0 | inherit | 2026-08-23 |
| scaffolding-expert | agents/scaffolding-expert.md | low        # claude-haiku-4-5 | inherit | 2026-08-15 |
| security-expert | agents/security-expert.md | medium        # claude-sonnet-5-0 | inherit | 2026-08-15 |

---

## Skills

| Name | Version | Status | Location | Platform | Triggers | Owner |
|------|---------|--------|----------|----------|----------|-------|
| accessibility-audit | 1.0.0 | active | skills/accessibility-audit/SKILL.md | workspace | accessibility-audit, /accessibility-audit, axe-core audit, wcag accessibility check, wcag 2.1 aa | pm |
| agent-lifecycle-manager | 1.0.0 | active | skills/agent-lifecycle-manager/SKILL.md | workspace | create agent, new agent, validate agents, agent lifecycle, manage agents | pm |
| audit-workspace | 1.0.0 | active | skills/audit-workspace/SKILL.md | workspace | audit workspace, run audit, check compliance, workspace check | auditor |
| context-commonization-review | 1.1.0 | active | skills/context-commonization-review/SKILL.md | workspace | context commonization review, variant context duplication, commonization review, context.md duplication review, context.md commonization | architect |
| create-variant | 1.4.1 | active | skills/create-variant/SKILL.md | workspace | create variant, new variant, create variant, variant creation, scaffold new variant, new co- project | pm |
| explain-me | 1.0.0 | experimental | skills/explain-me/SKILL.md | workspace | /explain-me, /reportme, make a report, create report, explain this topic | pm |
| finishing-a-development-branch | 1.0.0 | active | .claude/skills/finishing-a-development-branch/SKILL.md | both | finish branch, complete work, wrap up, finishing a development branch, merge branch, create PR, push and PR | N/A |
| gateguard | 1.0.0 | active | skills/gateguard/SKILL.md | workspace | gateguard, /gateguard, investigate file, check before edit, pre-edit check | pm |
| mece-logic-auditor | 1.0.0 | active | skills/mece-logic-auditor/SKILL.md | workspace | mece-logic-auditor, /mece-logic-auditor, MECE audit, issue tree audit, logic auditor, strategic reasoning evaluation | strategy-analyst |
| meeting | 1.4.0 | active | .claude/skills/meeting/SKILL.md | both | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| meeting-facilitation | 1.4.0 | active | skills/meeting-facilitation/SKILL.md | workspace | meeting, agent discussion, collaborative decision, multi-agent coordination, facilitate meeting | pm |
| platform-command-lifecycle-manager | 1.0.0 | active | .claude/skills/platform-command-lifecycle-manager/SKILL.md | both | create platform command, new .claude command, new .gemini command, platform command lifecycle, command parity, propagate command | pm |
| platform-skill-lifecycle-manager | 1.0.0 | active | .claude/skills/platform-skill-lifecycle-manager/SKILL.md | both | create platform skill, new .claude skill, new .gemini skill, platform skill version, platform skill lifecycle, update platform skill | pm |
| presenter-mode | 1.0.1 | active | skills/presenter-mode/SKILL.md | workspace | presenter-mode, /presenter-mode, dual-window sync, presenter view | html-build |
| project-review | 1.1.0 | active | skills/project-review/SKILL.md | workspace | project review, review project, audit project, quality review | pm |
| project-to-variant | 1.3.0 | active | skills/project-to-variant/SKILL.md | workspace | convert project to variant, create variant from project, project to template, promote project to variant | scaffolding-expert |
| promote-variant | 1.2.1 | active | skills/promote-variant/SKILL.md | workspace | promote variant, Phase B, variant promotion, promote to template, create template from prototype | pm |
| sarif-exporter | 1.0.0 | active | skills/sarif-exporter/SKILL.md | workspace | sarif-exporter, /sarif-exporter, sarif export, export sarif report, sarif format | security-expert |
| script-lifecycle-manager | 1.2.0 | active | skills/script-lifecycle-manager/SKILL.md | workspace | create script, update script, deprecate script, script lifecycle, manage scripts | pm |
| security-scan | 1.0.0 | active | skills/security-scan/SKILL.md | workspace | security scan, scan for vulnerabilities, security check, run security | pm |
| simulate-l3-to-variant-promotion | 1.0.0 | active | skills/simulate-l3-to-variant-promotion/SKILL.md | workspace | simulate l2 promotion, test l2 pipeline, dry run variant promotion, test create-l3-scaffold | automation-engineer |
| simulate-project-creation | 1.0.1 | active | skills/simulate-project-creation/SKILL.md | workspace | simulate project, test scaffolding, dry run project creation | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | active | skills/skill-lifecycle-manager/SKILL.md | workspace | create skill, new skill, validate skills, skill lifecycle, manage skills | pm |
| sound-synth | 1.0.0 | active | skills/sound-synth/SKILL.md | workspace | sound-synth, /sound-synth, procedural sound generation, 8-bit retro sound effects, jsfxr sound synth | sound-designer |
| source-command-commit-push-pr | 1.0.1 | active | .claude/skills/source-command-commit-push-pr/SKILL.md | both | commit-push-pr, commit and push, create PR | N/A |
| standup-synthesizer | 1.0.0 | active | skills/standup-synthesizer/SKILL.md | workspace | standup digest, daily standup, synthesize standup, work summary | pm |
| stride-threat-matrix | 1.0.0 | active | skills/stride-threat-matrix/SKILL.md | workspace | stride-threat-matrix, /stride-threat-matrix, threat modeling, dread risk scoring, stride matrix | security-expert |
| swe-solve | 1.0.0 | active | skills/swe-solve/SKILL.md | workspace | swe-solve, solve issue, autonomous issue resolution, issue to pr | pm |
| sync | 1.2.0 | active | skills/sync/SKILL.md | workspace | sync, /sync, commit and push, create PR | pm |
| team-builder | 1.1.0 | active | skills/team-builder/SKILL.md | workspace | build new agent team, create agent team, agent team setup, team builder | pm |
| ticket-run | 1.0.0 | active | skills/ticket-run/SKILL.md | workspace | ticket-run, process ticket queue, run next ticket | automation-engineer |
| translate | 1.0.1 | active | skills/translate/SKILL.md | workspace | translate, translation, Korean translation | pm |
| update-bun-packages | 1.3.0 | active | skills/update-bun-packages/SKILL.md | workspace | update bun packages, upgrade bun packages, bun update, update dependencies, upgrade dependencies | pm |
| upgrade-project | 1.2.1 | active | skills/upgrade-project/SKILL.md | workspace | upgrade project, upgrade template, sync project with template, refresh project, update project infrastructure | pm |
| validate-docs-links | 1.0.0 | active | skills/validate-docs-links/SKILL.md | workspace | validate links, check links, broken links, docs validation | pm |
| variant-feature | 1.0.0 | active | skills/variant-feature/SKILL.md | workspace | add feature to variant, extend variant, variant feature, add agent to variant, add skill to variant | scaffolding-expert |
| zod-contract-gate | 1.0.0 | active | skills/zod-contract-gate/SKILL.md | workspace | zod-contract-gate, /zod-contract-gate, zod contract validation, schema contract gate, runtime schema validation | architect |

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | 1.0.1 | scripts/agent-create.ts | N/A |
| agent-delete.ts | 1.0.1 | scripts/agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | 1.1.5 | scripts/agent-lifecycle-audit.ts | N/A |
| agent-list.ts | 1.1.0 | scripts/agent-list.ts | N/A |
| agent-verify.ts | 1.0.2 | scripts/agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.2 | scripts/analyze-git-history.ts | child_process |
| archive-memory.ts | 1.0.0 | scripts/archive-memory.ts | N/A |
| audit.ts | 2.21.1 | scripts/audit.ts | bun |
| cleanup-completed-md.ts | 1.1.0 | scripts/cleanup-completed-md.ts | N/A |
| clear-pm-approval.ts | 1.0.0 | scripts/clear-pm-approval.ts | N/A |
| compile-tokens.ts | 1.0.0 | scripts/compile-tokens.ts | N/A |
| create-l3-scaffold.ts | 1.12.1 | scripts/create-l3-scaffold.ts | N/A |
| dev-sync.ts | 1.7.4 | scripts/dev-sync.ts | bun |
| dispatch-parallel.ts | 1.0.1 | scripts/dispatch-parallel.ts | N/A |
| dispatch-serial.ts | 1.0.1 | scripts/dispatch-serial.ts | N/A |
| dispatch.ts | 1.0.0 | scripts/dispatch.ts | N/A |
| fix-script-versions.ts | 1.1.1 | scripts/fix-script-versions.ts | fs, path |
| gen-pr-body.ts | 1.2.0 | scripts/gen-pr-body.ts | bun |
| generate-ide-rules.ts | 1.0.0 | scripts/generate-ide-rules.ts | N/A |
| generate-l3-readme.ts | 1.0.3 | scripts/generate-l3-readme.ts | fs, path |
| generate-scripts-readme.ts | 1.0.3 | scripts/generate-scripts-readme.ts | N/A |
| generate-skill-graph.ts | 1.1.0 | scripts/generate-skill-graph.ts | N/A |
| generate-version-manifest.ts | 1.2.0 | scripts/generate-version-manifest.ts | bun, js-yaml |
| ingest-external-skills.ts | 1.1.0 | scripts/ingest-external-skills.ts | N/A |
| ingest-security-frameworks.ts | 1.1.0 | scripts/ingest-security-frameworks.ts | N/A |
| l3-to-variant-pipeline.ts | 1.12.1 | scripts/l3-to-variant-pipeline.ts | fs, path |
| lifecycle-sync-audit.ts | 1.4.8 | scripts/lifecycle-sync-audit.ts | N/A |
| list-template-versions.ts | 1.1.0 | scripts/list-template-versions.ts | bun |
| md-to-ooxml.ts | 1.2.0 | scripts/md-to-ooxml.ts | fs, path |
| new-project.ts | 1.8.0 | scripts/new-project.ts | js-yaml |
| project-to-variant.ts | 1.2.0 | scripts/project-to-variant.ts | N/A |
| promote-context-section.ts | 1.0.0 | scripts/promote-context-section.ts | N/A |
| propagate-to-templates.ts | 2.5.1 | scripts/propagate-to-templates.ts | js-yaml |
| qa-gate.ts | N/A | scripts/qa-gate.ts | bun |
| readme-lifecycle-audit.ts | 1.0.4 | scripts/readme-lifecycle-audit.ts | N/A |
| regenerate-agents-md.ts | 1.1.0 | scripts/regenerate-agents-md.ts | fs, path |
| remove-project.ts | 1.0.1 | scripts/remove-project.ts | N/A |
| render-pdf-deck.ts | 1.0.0 | scripts/render-pdf-deck.ts | N/A |
| resolve-variants.ts | 1.0.1 | scripts/resolve-variants.ts | fs, js-yaml, path |
| retry-handler.ts | 1.0.1 | scripts/retry-handler.ts | N/A |
| setup-github-branch-protection.ts | 1.0.1 | scripts/setup-github-branch-protection.ts | bun |
| skill-dependency-analysis.ts | 1.0.2 | scripts/skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | 1.3.0 | scripts/skill-lifecycle-audit.ts | N/A |
| spec-backfill.ts | 1.0.0 | scripts/spec-backfill.ts | N/A |
| spec-register.ts | 1.1.0 | scripts/spec-register.ts | N/A |
| sync-agent-status.ts | 1.0.1 | scripts/sync-agent-status.ts | N/A |
| sync-md.ts | 1.3.0 | scripts/sync-md.ts | N/A |
| sync-skill-status.ts | 1.0.1 | scripts/sync-skill-status.ts | N/A |
| sync-skills-to-l2.ts | 1.0.1 | scripts/sync-skills-to-l2.ts | N/A |
| sync-skills.ts | 1.4.1 | scripts/sync-skills.ts | N/A |
| tag-template.ts | 1.0.1 | scripts/tag-template.ts | bun |
| team-builder.ts | 1.2.1 | scripts/team-builder.ts | N/A |
| test-extends-validator.ts | 1.0.1 | scripts/test-extends-validator.ts | fs, path |
| test-l3-to-variant-promotion.ts | 1.1.0 | scripts/test-l3-to-variant-promotion.ts | bun |
| test-new-project.ts | 1.0.4 | scripts/test-new-project.ts | bun |
| test-platform-parity.ts | 0.2.4 | scripts/test-platform-parity.ts | fs, path |
| test-runner.ts | 1.1.0 | scripts/test-runner.ts | fs, os, path |
| ticket.ts | 1.1.0 | scripts/ticket.ts | N/A |
| translate-readme.ts | 1.0.0 | scripts/translate-readme.ts | bun, fs, path |
| upgrade-project.ts | 1.10.1 | scripts/upgrade-project.ts | N/A |
| validate-agents.ts | 1.0.5 | scripts/validate-agents.ts | N/A |
| validate-doc-folder.ts | 1.1.0 | scripts/validate-doc-folder.ts | fs, path |
| validate-docs-links.ts | 1.0.0 | scripts/validate-docs-links.ts | fs, path |
| validate-md-language.ts | 1.6.1 | scripts/validate-md-language.ts | fs |
| validate-model-registry.ts | N/A | scripts/validate-model-registry.ts | N/A |
| validate-pm-extends.ts | 0.3.1 | scripts/validate-pm-extends.ts | N/A |
| validate-skills.ts | 1.0.3 | scripts/validate-skills.ts | N/A |
| validate-templates.ts | 1.13.0 | scripts/validate-templates.ts | js-yaml |
| variant-feature.ts | 1.0.0 | scripts/variant-feature.ts | N/A |
| verify-adr-governance.ts | 1.4.0 | scripts/verify-adr-governance.ts | N/A |
| verify-agent-deliverables.ts | 1.0.1 | scripts/verify-agent-deliverables.ts | fs |
| verify-country-prune.ts | 1.0.0 | scripts/verify-country-prune.ts | N/A |
| verify-memory.ts | 1.1.0 | scripts/verify-memory.ts | fs, path |
| verify-new-project-tests.ts | 1.0.3 | scripts/verify-new-project-tests.ts | N/A |
| verify-platform-lifecycle.ts | 1.1.2 | scripts/verify-platform-lifecycle.ts | N/A |
| verify-readme-sync.ts | 1.4.0 | scripts/verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | 1.4.1 | scripts/verify-scripts.ts | fs, path |
| verify-skill-graph.ts | 1.0.1 | scripts/verify-skill-graph.ts | N/A |
| verify-skills.ts | 1.2.0 | scripts/verify-skills.ts | N/A |
| verify-template-integrity.ts | 1.0.0 | scripts/verify-template-integrity.ts | crypto, fs, path |

---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude/commands/changelog.md | both | N/A |
| commit-push-pr | .claude/commands/commit-push-pr.md | both | N/A |
| gateguard | .claude/commands/gateguard.md | both | N/A |
| meeting | .claude/commands/meeting.md | both | N/A |
| memlog | .claude/commands/memlog.md | both | N/A |
| new-task | .claude/commands/new-task.md | both | N/A |
| project-review | .claude/commands/project-review.md | both | N/A |
| sync | .claude/commands/sync.md | both | N/A |

---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: 8 / 8
- **Skills with parity**: 5 / 37

---

## Drift Detection

✅ No drift detected. All components are properly versioned and integrated.
