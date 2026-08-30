# Security-Scan Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for security scanning | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Security vulnerability scanning
- [x] Trigger conditions: Daily scans, pre-PR validation, manual requests
- [x] Examples provided: Advisory scan, CVE checking
- [x] Successfully tested in security scan operations

## Dependencies

- security-expert (owner agent)

## Usage Statistics

- **First Used**: 2026-05-10 (estimated)
- **Last Used**: 2026-05-28 (estimated)
- **Total Invocations**: ~20 (estimated)

## Metadata

- **Current Phase**: production
- **Owner**: security-expert
- **Last Updated**: 2026-08-30 (SKILL.md 1.0.0 → 1.1.0: mandated explicit `--config .gitleaks.toml` on all gitleaks invocations — subdirectory scans without it silently fall back to the default ruleset and lose workspace allowlists)
- **Last Reviewer**: lifecycle-manager
