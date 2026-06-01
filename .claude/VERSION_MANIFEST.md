# Version Manifest

> **Last Generated**: 2026-06-01T02:49:46.018Z
> **Generation Source**: Auto-generated from source files by `scripts/generate-version-manifest.ts`
> **Single Source of Truth**: Source files (agents/*.md, skills/*/SKILL.md, scripts/*.ts)
> **Manual Annotations Section**: Below is human-maintained context

---

## Auto-Generated Sections

### Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents\architect.md | claude: high | inherit | 2026-05-31 |
| auditor | agents\auditor.md | claude: medium | inherit | 2026-06-01 |
| automation-engineer | agents\automation-engineer.md | claude: low | inherit | 2026-05-31 |
| docs-writer | agents\docs-writer.md | claude: medium | inherit | 2026-05-31 |
| lifecycle-manager | agents\lifecycle-manager.md | claude: medium | inherit | 2026-05-31 |
| pm | agents\pm.md | claude: high | inherit | 2026-06-01 |
| scaffolding-expert | agents\scaffolding-expert.md | claude: low | inherit | 2026-05-31 |
| security-expert | agents\security-expert.md | claude: medium | inherit | 2026-05-31 |

> **Notes**:
> - `tier` values: `high`, `medium`, `low`
> - `model` format: `claude-{model}-{major}-{minor}` or `gemini-{model}`
> - `last_modified` from git file timestamp

### Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
| agent-lifecycle-manager | 1.0.0 | skills\agent-lifecycle-manager\SKILL.md | workspace | N/A | pm |
| agent-lifecycle-manager | 1.0.0 | .claude\skills\agent-lifecycle-manager\SKILL.md | both | N/A | pm |
| audit-workspace | 1.0.0 | skills\audit-workspace\SKILL.md | workspace | N/A | auditor |
| audit-workspace | 1.0.0 | .claude\skills\audit-workspace\SKILL.md | both | N/A | auditor |
| finishing-a-development-branch | 1.0.0 | .claude\skills\finishing-a-development-branch\SKILL.md | both | N/A | N/A |
| meeting-facilitation | 1.3.2 | skills\meeting-facilitation\SKILL.md | workspace | N/A | pm |
| meeting-facilitation | 1.3.1 | .claude\skills\meeting-facilitation\SKILL.md | both | N/A | pm |
| platform-command-lifecycle-manager | 1.0.0 | .claude\skills\platform-command-lifecycle-manager\SKILL.md | both | N/A | pm |
| platform-skill-lifecycle-manager | 1.0.0 | .claude\skills\platform-skill-lifecycle-manager\SKILL.md | both | N/A | pm |
| project-review | 1.0.0 | skills\project-review\SKILL.md | workspace | N/A | pm |
| project-review | 1.0.0 | .claude\skills\project-review\SKILL.md | both | N/A | pm |
| script-lifecycle-manager | 1.2.0 | skills\script-lifecycle-manager\SKILL.md | workspace | N/A | pm |
| script-lifecycle-manager | 1.2.0 | .claude\skills\script-lifecycle-manager\SKILL.md | both | N/A | pm |
| security-scan | 1.0.0 | skills\security-scan\SKILL.md | workspace | N/A | security-expert |
| security-scan | 1.0.0 | .claude\skills\security-scan\SKILL.md | both | N/A | security-expert |
| simulate-project-creation | 1.0.0 | skills\simulate-project-creation\SKILL.md | workspace | N/A | scaffolding-expert |
| simulate-project-creation | 1.0.0 | .claude\skills\simulate-project-creation\SKILL.md | both | N/A | scaffolding-expert |
| skill-lifecycle-manager | 1.2.0 | skills\skill-lifecycle-manager\SKILL.md | workspace | N/A | pm |
| skill-lifecycle-manager | 1.2.0 | .claude\skills\skill-lifecycle-manager\SKILL.md | both | N/A | pm |
| translate | 1.0.0 | skills\translate\SKILL.md | workspace | N/A | pm |
| translate | 1.0.0 | .claude\skills\translate\SKILL.md | both | N/A | automation-engineer |
| ui-ux-pro-max | 1.0.0 | skills\ui-ux-pro-max\SKILL.md | workspace | N/A | architect |
| ui-ux-pro-max | 1.0.0 | .claude\skills\ui-ux-pro-max\SKILL.md | both | N/A | architect |
| validate-docs-links | 1.0.0 | skills\validate-docs-links\SKILL.md | workspace | N/A | docs-writer |
| validate-docs-links | 1.0.0 | .claude\skills\validate-docs-links\SKILL.md | both | N/A | docs-writer |

> **Notes**:
> - `version` from skill frontmatter `version` field
> - `platform`: `workspace`, `claude`, `gemini`, or `both`
> - `triggers` from skill frontmatter `metadata.triggers` array
> - `owner` from skill frontmatter `owner` field

### Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
| agent-create.ts | N/A | scripts\agent-create.ts | N/A |
| agent-delete.ts | N/A | scripts\agent-delete.ts | N/A |
| agent-lifecycle-audit.ts | N/A | scripts\agent-lifecycle-audit.ts | N/A |
| agent-list.ts | N/A | scripts\agent-list.ts | N/A |
| agent-verify.ts | N/A | scripts\agent-verify.ts | N/A |
| analyze-git-history.ts | 1.0.0 | scripts\analyze-git-history.ts | child_process |
| archive-memory.ts | N/A | scripts\archive-memory.ts | N/A |
| audit.ts | 2.4.0 | scripts\audit.ts | bun |
| check-pm-approval.ts | N/A | scripts\check-pm-approval.ts | N/A |
| clear-pm-approval.ts | N/A | scripts\clear-pm-approval.ts | N/A |
| dev-sync.ts | N/A | scripts\dev-sync.ts | bun |
| dispatch-parallel.ts | N/A | scripts\dispatch-parallel.ts | N/A |
| dispatch-serial.ts | N/A | scripts\dispatch-serial.ts | N/A |
| dispatch.ts | N/A | scripts\dispatch.ts | N/A |
| gen-pr-body.ts | N/A | scripts\gen-pr-body.ts | bun |
| generate-scripts-readme.ts | N/A | scripts\generate-scripts-readme.ts | N/A |
| generate-version-manifest.ts | 1.0.0 | scripts\generate-version-manifest.ts | bun |
| inject-global-plugins.ts | N/A | scripts\helpers\inject-global-plugins.ts | N/A |
| inject-skills.ts | N/A | scripts\helpers\inject-skills.ts | N/A |
| lifecycle-governance.ts | N/A | scripts\helpers\lifecycle-governance.ts | N/A |
| lifecycle-sync-audit.ts | N/A | scripts\lifecycle-sync-audit.ts | N/A |
| list-template-versions.ts | N/A | scripts\list-template-versions.ts | bun |
| merge-frontmatter.ts | N/A | scripts\helpers\merge-frontmatter.ts | fs, js-yaml, path |
| merge-package-scripts.ts | N/A | scripts\helpers\merge-package-scripts.ts | N/A |
| post-write-lifecycle-check.ts | N/A | scripts\hooks\post-write-lifecycle-check.ts | bun |
| pre-commit.ts | N/A | scripts\hooks\pre-commit.ts | bun |
| pre-push.ts | N/A | scripts\hooks\pre-push.ts | bun |
| publish-to-template.ts | N/A | scripts\publish-to-template.ts | N/A |
| qa-gate.ts | N/A | scripts\qa-gate.ts | bun |
| readme-lifecycle-audit.ts | N/A | scripts\readme-lifecycle-audit.ts | N/A |
| retry-handler.ts | N/A | scripts\retry-handler.ts | N/A |
| skill-dependency-analysis.ts | N/A | scripts\skill-dependency-analysis.ts | N/A |
| skill-lifecycle-audit.ts | N/A | scripts\skill-lifecycle-audit.ts | N/A |
| substitute-placeholders.ts | N/A | scripts\helpers\substitute-placeholders.ts | N/A |
| sync-agent-status.ts | N/A | scripts\sync-agent-status.ts | N/A |
| sync-md.ts | 1.2.0 | scripts\sync-md.ts | N/A |
| sync-skill-status.ts | N/A | scripts\sync-skill-status.ts | N/A |
| sync-skills.ts | N/A | scripts\sync-skills.ts | N/A |
| template-validation.ts | N/A | scripts\helpers\template-validation.ts | N/A |
| test-new-project.ts | N/A | scripts\test-new-project.ts | bun |
| test-runner.ts | N/A | scripts\test-runner.ts | child_process, fs, path |
| translate-readme.ts | N/A | scripts\translate-readme.ts | bun, fs, path |
| update-variant-lifecycle.ts | N/A | scripts\helpers\update-variant-lifecycle.ts | N/A |
| validate-agents.ts | N/A | scripts\validate-agents.ts | N/A |
| validate-doc-folder.ts | N/A | scripts\validate-doc-folder.ts | fs, path |
| validate-md-language.ts | 1.0.1 | scripts\validate-md-language.ts | fs |
| validate-model-registry.ts | N/A | scripts\validate-model-registry.ts | N/A |
| validate-output.ts | N/A | scripts\helpers\validate-output.ts | N/A |
| validate-skills.ts | N/A | scripts\validate-skills.ts | N/A |
| validate-templates.ts | N/A | scripts\validate-templates.ts | js-yaml |
| verify-agent-deliverables.ts | N/A | scripts\verify-agent-deliverables.ts | fs |
| verify-memory.ts | N/A | scripts\verify-memory.ts | fs, path |
| verify-new-project-tests.ts | N/A | scripts\verify-new-project-tests.ts | N/A |
| verify-platform-lifecycle.ts | N/A | scripts\verify-platform-lifecycle.ts | N/A |
| verify-readme-sync.ts | 1.0.1 | scripts\verify-readme-sync.ts | bun, fs, path |
| verify-scripts.ts | N/A | scripts\verify-scripts.ts | fs, path |
| verify-skills.ts | N/A | scripts\verify-skills.ts | N/A |
| verify-template-integrity.ts | N/A | scripts\verify-template-integrity.ts | crypto, fs, path |
| write-scripts-snapshot.ts | N/A | scripts\helpers\write-scripts-snapshot.ts | N/A |

> **Notes**:
> - `version` from `@version` comment in script header
> - `dependencies` extracted from import statements

### Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
| changelog | .claude\commands\changelog.md | both | N/A |
| commit-push-pr | .claude\commands\commit-push-pr.md | both | N/A |
| meeting | .claude\commands\meeting.md | both | N/A |
| memlog | .claude\commands\memlog.md | both | N/A |
| new-project | .claude\commands\new-project.md | claude | N/A |
| new-task | .claude\commands\new-task.md | both | N/A |
| sync | .claude\commands\sync.md | both | N/A |

> **Notes**:
> - `platform`: `both` if `.claude/commands/` and `.gemini/commands/` exist, otherwise specific platform
> - `skill_integration` derived from command content analysis

### Platform Parity Status

#### Claude ↔ Gemini Sync Status

| Artifact Type | Total | In Sync | Out of Sync | Missing Gemini |
|---------------|-------|---------|-------------|----------------|
| Skills | 25 | 25 | 0 | 0 |
| Commands | 7 | 6 | 1 | 1 |

#### Workspace → Templates/Common Propagation

| Artifact Type | Total | Propagated | Drift Detected |
|---------------|-------|------------|----------------|
| Scripts | 59 | 42 | 3 |

**Drift Details**:
- scripts/audit.ts: differs from templates/common/scripts/audit.ts
- scripts/dev-sync.ts: differs from templates/common/scripts/dev-sync.ts
- scripts/generate-version-manifest.ts: differs from templates/common/scripts/generate-version-manifest.ts

> **Note**: Agent propagation intentionally disabled (auditor, lifecycle-manager workspace-root-only)

### Drift Detection

#### Lifecycle Sync Drift

⚠ WARNING: Script sync drift detected between workspace and templates/common/
⚠ WARNING: scripts/audit.ts differs from templates/common/scripts/audit.ts
⚠ WARNING: scripts/dev-sync.ts differs from templates/common/scripts/dev-sync.ts
⚠ WARNING: scripts/generate-version-manifest.ts differs from templates/common/scripts/generate-version-manifest.ts

#### Platform Parity Drift

✓ All commands in sync between .claude/ and .gemini/

#### Documentation Drift

✓ No documentation version drift patterns detected

---

## Manual Annotations Section

> **This section is human-maintained. Do not edit auto-generated sections above.**

### Release Notes

#### Version 1.0.0 (2026-06-01)
- Initial VERSION_MANIFEST implementation
- Auto-generated sections for agents, skills, scripts, commands
- Platform parity status tracking
- Drift detection for lifecycle sync and documentation

### Migration Guides

#### Migrating from Manual Version Tracking
If you previously tracked versions manually in AGENTS.md or other docs:
1. All version information is now auto-generated from source files
2. Update AGENTS.md Skills table to reference VERSION_MANIFEST instead of maintaining local versions
3. Run `/sync` to regenerate manifest after any skill/script version change

### Deprecation Warnings

#### Deprecated Skills
- `simulate-project-creation` (removed 2026-06-01) - functionality integrated into new-project script

#### Deprecated Agents
- None

### Known Issues

- **Issue-001**: Script dependency extraction is heuristic-based - may miss dynamic requires
- **Issue-002**: Platform detection for commands assumes parity unless `gemini-parity: skip` present
