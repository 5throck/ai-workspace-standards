# Validate-Docs-Links Skill Lifecycle

## Created

2026-05-29

## Phase History

- **2026-09-09**: Deprecated — documentation link-check ownership moved into `project-review` baseline-only mode; removal date set to 2026-12-09.

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for documentation link validation | lifecycle-manager |
| 2026-09-09 | production | deprecated | Documentation link-check ownership moved into `project-review` baseline-only mode; removal 2026-12-09 | pm |
| 2026-09-12 | deprecated | retired | Skill directory removed (SSOT + all platform mirrors + L1 template copies); the companion SCRIPT `scripts/validate-docs-links.ts` remains active as the dev-sync/CI link-check gate; owner-approved early removal superseding the scheduled 2026-12-09 date (T-20260912-013) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Validate internal and external documentation links
- [x] Trigger conditions: Pre-commit, manual validation requests
- [x] Examples provided: Link checking, broken link detection
- [x] Successfully tested in link validation operations

## Dependencies

- pm (owner agent)
- auditor (validation)

## Usage Statistics

- **First Used**: 2026-05-20 (estimated)
- **Last Used**: 2026-05-28 (estimated)
- **Total Invocations**: ~15 (estimated)

## Metadata

- **Current Phase**: retired
- **Version**: 1.0.0
- **Owner**: pm
- **Last Updated**: 2026-09-12 (skill retired; owner-approved early removal superseding the scheduled 2026-12-09 date, T-20260912-013)
- **Last Reviewer**: lifecycle-manager
- **Removal Date**: 2026-09-12 (owner-approved early removal superseding the scheduled 2026-12-09 date, T-20260912-013)
