# Accessibility-Audit Skill — Lifecycle Record

## Metadata
- **Skill**: accessibility-audit
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-08-06 (co-design); promoted to L0 2026-09-06
- **Last Updated**: 2026-09-06

## Description
Automated WCAG 2.1 Level AA accessibility evaluation rules, DOM audit patterns, and
remediation guidance using axe-core for UI components, templates, and web applications.
Promoted from the co-design variant (L2-as-basis decision, unified design/a11y/UD plan;
user-confirmed) so every scaffolded project receives it via L0→L1 propagation.

## Changelog
- 2026-08-06: 1.0.0 — created in co-design
- 2026-09-06: 1.1.0 — promoted to L0 (scope common); body unchanged

## Dependencies
- None (procedural skill); composed with `design-foundation` and `token-usage-lint`

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-06 | - | active | Promoted to L0 per ADR-0068 plan Phase 3 | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/accessibility-audit/SKILL.md`
- [x] Frontmatter valid; scope: common
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
