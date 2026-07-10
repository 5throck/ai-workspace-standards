# Project-Review Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |
| 2026-07-10 | production | production | v1.1.0 — added conditional base-map MCP integration with Step 0 detection, Step 4c cross-validation, graceful degradation | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/project-review/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: project review, review project, audit project, quality review
- [x] Successfully tested in project review operations
- [x] base-map MCP conditional integration (Step 0 detection, graceful degradation)

## Dependencies

- pm (owner agent)
- architect (architecture review domain)
- auditor (standards compliance review domain)
- automation-engineer (automation review domain)
- docs-writer (documentation review domain)
- security-expert / security-monitor (security review domain)
- lifecycle-manager (lifecycle review domain)
- scaffolding-expert (scaffolding review domain, workspace only)
- base-map MCP (optional — local model tools for cross-validation)

## Usage Statistics

- **First Used**: 2026-05-30 (estimated, per last_reviewed)
- **Last Used**: 2026-07-10 (two-round project review session)
- **Total Invocations**: ~12+ (estimated — triggered by user request, PM detection, or QA escalation)

## Metadata

- **Current Phase**: production
- **Version**: 1.1.0
- **Owner**: pm
- **Last Updated**: 2026-07-10
- **Last Reviewer**: pm
