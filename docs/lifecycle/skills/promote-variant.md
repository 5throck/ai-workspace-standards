# Promote-Variant Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |
| 2026-08-24 | production | production | Version sync: aligned lifecycle doc to v1.2.1 per SKILL.md (country-profile readiness verification step added) | docs-writer |
| 2026-11-27 | production | production | Version sync: SKILL.md v1.4.0 → v1.4.1 — body script version pin refreshed (`l3-to-variant-pipeline.ts` v1.21.2 → v1.23.1 — SCRIPTS.md registry advanced; skill-lifecycle-audit SVP pin-drift warning) + last_reviewed stamp refresh — citation only, no procedure change | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/promote-variant/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: promote variant, Phase B, variant promotion, promote to template, create template from prototype
- [x] Successfully tested in Phase B promotion operations

## Dependencies

- pm (owner agent)
- create-variant (predecessor Phase A skill)
- scripts/l3-to-variant-pipeline.ts (promotion pipeline execution)
- scripts/validate-templates.ts (template validation)
- scripts/tag-template.ts (git tag publication)

## Usage Statistics

- **First Used**: 2026-06-05 (estimated, per last_reviewed)
- **Last Used**: 2026-07-03 (current session)
- **Total Invocations**: ~3+ (estimated — one per variant promotion)

## Metadata

- **Current Phase**: production
- **Version**: 1.4.1
- **Owner**: pm
- **Last Updated**: 2026-11-27 (Version 1.4.0 → 1.4.1: body script version pin refreshed `l3-to-variant-pipeline.ts` v1.21.2 → v1.23.1 + last_reviewed stamp — citation only. Previous: 2026-09-12 Version 1.3.0 → 1.4.0 aligned to SKILL.md frontmatter, T-20260912-010)
- **Last Reviewer**: automation-engineer
