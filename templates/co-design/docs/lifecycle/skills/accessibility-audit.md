# Accessibility-Audit Skill — Lifecycle Record

## Metadata
- **Skill**: accessibility-audit
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Defines automated WCAG 2.1 Level AA accessibility evaluation rules, DOM audit patterns, and remediation guidance using axe-core for UI components, templates, and web applications.

## Changelog
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- axe-core (^4.9 || ^5.0)
- JSDOM / Playwright / Puppeteer test runner

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/accessibility-audit/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: co-design

## Notes
- Propagates to L2 variants (`l2_propagate: true`)
- Owner: pm
