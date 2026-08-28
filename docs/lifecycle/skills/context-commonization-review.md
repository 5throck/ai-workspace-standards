# context-commonization-review Skill — Lifecycle Record

## Metadata
- **Skill**: context-commonization-review
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-08-28
- **Last Updated**: 2026-08-29

## Description
Reviews cross-variant docs/<variant>.context.md duplication and promotes genuinely shared content into the common docs/context.md (ADR-0050 Part 3).

## Changelog
- 2026-08-28: Promoted from co-work/co-safety duplicate copies into the workspace-root common layer (identical body deduplicated; generic, not domain-specific).
- 2026-08-29: Lifecycle document created (backfill — record was missing after the promotion).

## Dependencies
- None (knowledge/process skill)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-28 | - | production | Promoted from duplicate variant-local copies to workspace common layer | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/context-commonization-review/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: common

## Notes
- Owner: architect
