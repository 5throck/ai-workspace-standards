# Create-Variant Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |
| 2026-08-16 | production | production | Version drift fix: aligned lifecycle doc to v1.2.0 per SKILL.md | lifecycle-manager |
| 2026-08-24 | production | production | Version sync: aligned lifecycle doc to v1.4.1 per SKILL.md (i18n/country decision line added) | docs-writer |
| 2026-09-21 | production | production | SKILL.md v1.4.2: domain lists corrected to the variant-type registry (`abap-development`, `safety` added; unregistered-value fallback documented), `--domain ehs` example fixed to `--domain safety`, stale `docs/country-profiles.md` citation repointed, k-* country-scope list corrected to all six, OS-agnostic workspace-root wording, duplicate trigger removed (2026-09-21 project review H-8/M-10/M-7) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/create-variant/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: create variant, new variant, variant creation, scaffold new variant, new co- project
- [x] Successfully tested in variant creation operations (co-safety, co-legal, etc.)

## Dependencies

- pm (owner agent)
- scripts/create-l3-scaffold.ts (scaffold execution)
- promote-variant (subsequent Phase B skill)
- scripts/l3-to-variant-pipeline.ts (Phase B pipeline)

## Usage Statistics

- **First Used**: 2026-06-05 (estimated, per last_reviewed)
- **Last Used**: 2026-07-03 (current session)
- **Total Invocations**: ~5+ (estimated — one per variant created)

## Metadata

- **Current Phase**: production
- **Version**: 1.4.2
- **Owner**: pm
- **Last Updated**: 2026-09-21
- **Last Reviewer**: pm
