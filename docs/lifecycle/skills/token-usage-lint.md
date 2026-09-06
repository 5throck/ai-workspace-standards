# Token-Usage-Lint Skill — Lifecycle Record

## Metadata
- **Skill**: token-usage-lint
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-08-25 (co-design); promoted to L0 2026-09-06
- **Last Updated**: 2026-09-06

## Description
Token SSOT compliance lint: scans UI source for hardcoded design values (raw hex,
rgb()/hsl() literals, raw px) bypassing the project token source. Runnable companion
`scripts/design-lint.ts` (L0+L1) implements the detection/exemption/classification
scheme; this skill documents the workflow and remediation loop.

## Changelog
- 2026-08-25: 1.0.0 — created in co-design (variant backlog closure)
- 2026-09-06: 1.1.0 — runnable `design-lint.ts` companion (co-design); promoted to L0 (scope common)

## Dependencies
- Composes with `design-foundation`; follows `ui-ux-design-intelligence`

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-06 | - | active | Promoted to L0 per ADR-0068 plan Phase 3 | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/token-usage-lint/SKILL.md`
- [x] Frontmatter valid; scope: common
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
