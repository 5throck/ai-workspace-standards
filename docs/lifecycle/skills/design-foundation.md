# Design-Foundation Skill — Lifecycle Record

## Metadata
- **Skill**: design-foundation
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-30
- **Last Updated**: 2026-08-30

## Description
Style-neutral procedure for deriving a project's own design system: domain evidence → design
principles → recorded design decisions (`design_decisions` YAML in the project's `docs/design.md`)
→ 3-layer token architecture (Primitive → Semantic ← `[data-theme]` mapping → Component) →
validation contract. Companion artifacts: `templates/common/docs/design-foundation.md` (spec) and
`templates/common/docs/design-tokens.template.css` (scaffold). Extracted from the proven methods of
Projects/co-price (Onyx 2.0) and Projects/co-newbiz (Onyx 3.0) without prescribing their styles.

## Changelog
- 2026-08-30: 1.0.0 — created (spec: docs/designs/2026-08-30-design-foundation-design.md)

## Dependencies
- None (procedural skill); composes with `token-usage-lint` and `accessibility-audit`; enables
  `ui-ux-design-intelligence`

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-30 | - | active | Initial release with Design Foundation framework | pm |

## Acceptance Criteria

### Active Phase

- [x] SKILL.md exists at `skills/design-foundation/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
- [x] Scope: common (propagates L0 → L1); `l2_propagate: false` (autonomous per-project adoption)
- [x] Triggers avoid co-design `ui-ux-design-intelligence` overlap ("design system" excluded)

## Notes
- Owner: architect
- Follow-up backlog: automated design-lint implementation; co-design `tokens.json` flat → 3-layer migration
