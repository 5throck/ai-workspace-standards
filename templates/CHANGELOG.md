# Templates Changelog

All notable changes to the template variants are documented here.

## [Unreleased]
### Changed
- **[2026-06-01]**: `co-security` variant: Redesigned workflow by merging Phase 1 and 2 into "Recon & Threat Modeling"
- **[2026-06-01]**: `co-security` variant: Fixed PM-ONLY Agent Roster in `AGENTS.md` and `docs/co-security.context.md`
## [0.5.0] - 2026-05-27
### Added
- `.github/pull_request_template.md` with Summary/Changes/Test Plan/Security Checklist sections (#92)
- `Documentation Standards` section in all variant `docs/context.md` files: mandatory session log format and CHANGELOG entry format (#92)
- Skills registry cross-check in `scripts/audit.sh` and `scripts/audit.ps1` (#92)
- PROJECT_NAME validation (alphanumeric + hyphens + underscores, max 64 chars) in `new-project.sh` and `new-project.ps1` (#92)
- Lifecycle Management section in `AGENTS.md` with agent/skill lifecycle tables (#92)

### Changed
- `skill-lifecycle-manager` SKILL.md synced to latest frontmatter format (#92)

### Removed
- Duplicate `skill-lifecycle-manager` from `co-develop/.claude/skills/` (#92)

## [0.4.0] - 2026-05-26
### Added
- Multi-agent `/meeting` command with inline role-play orchestration (#91)
- Silent mode (default) and `--dialogue` opt-in for meeting transcripts (#91)
- Variant directory structure: `co-develop/`, `co-design/`, `co-work/` (#91)
- `validate-templates.ts` lifecycle validation script (#91)
- `templates/VERSION` semver tracking (#91)

### Changed
- All agent files updated with `## Meeting Participation` sections (#91)
- `## Dispatch Protocol` sections standardized across all agents (#91)

## [0.3.0] - 2026-05-25
### Added
- `## Meeting Participation` sections added to all workspace agents

## [0.2.0] - 2026-05-24
### Added
- 3-tier agent cost model (high/medium/low)

## [0.1.0] - 2026-05-23
### Added
- Initial template structure
