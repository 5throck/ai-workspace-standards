# Project-Review Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |
| 2026-07-10 | production | production | v1.1.0 — added conditional base-map MCP integration with Step 0 detection, Step 4c cross-validation, graceful degradation | pm |
| 2026-09-08 | production | production | v1.2.0 — machine-baseline-first (Step 0), scope triage full/scoped/baseline-only (Step 1.5), 4-slot dispatch cap with fallbacks, Class column + report persistence to docs/reports/, ticket wiring via ticket.ts (replaces unimplemented --tasks claim), post-fix verification + ratchet check (design: docs/designs/2026-09-08-project-review-v1.2-design.md) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/project-review/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: project review, review project, audit project, quality review
- [x] Successfully tested in project review operations
- [x] base-map MCP conditional integration (Step 0 detection, graceful degradation)
- [x] v1.2.0: machine baseline battery precedes agent dispatch; report persisted under docs/reports/; deferred outcomes ticketed via ticket.ts; script-gap findings feed the validator-hardening loop

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
- **Last Used**: 2026-09-08 (workspace-root + templates review; fixes landed via PR #821)
- **Total Invocations**: ~15+ (estimated — triggered by user request, PM detection, or QA escalation)

## Metadata

- **Current Phase**: production
- **Version**: 1.2.0
- **Owner**: pm
- **Last Updated**: 2026-09-08
- **Last Reviewer**: pm
