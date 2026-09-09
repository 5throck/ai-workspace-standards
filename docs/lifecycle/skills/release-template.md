# Release-Template Skill — Lifecycle Record

## Metadata
- **Skill**: release-template
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-09-09
- **Last Updated**: 2026-09-09

## Description
Workspace-root template release workflow that delegates deterministic writes to
`scripts/release-template.ts`: bump `templates/VERSION`, cut
`templates/CHANGELOG.md` `[Unreleased]` content into a dated version section,
and create the `template-vX.Y.Z` git tag through `scripts/tag-template.ts`.

## Changelog
- 2026-09-09: 1.0.0 — created to replace manual prose-only release steps with one atomic helper.

## Dependencies
- Runtime companion: `scripts/release-template.ts`
- Delegates tag creation to `scripts/tag-template.ts`

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-09 | - | active | Atomic template release workflow added | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/release-template/SKILL.md`
- [x] Frontmatter valid; scope: workspace; l2_propagate: false
- [x] Registered in skills/SKILLS.md
- [x] Script writes `templates/VERSION` and `templates/CHANGELOG.md` together
- [x] Script delegates tag creation to `tag-template.ts`