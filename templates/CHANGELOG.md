# Templates Changelog

All notable changes to the template variants are documented here.

## [Unreleased]
- ci.yml: unit-tests job flips to default-on (Release 2, ADR-0094/T-20260930-026) — set the repository variable CI_SKIP_DEFAULT_UNIT_TESTS to true to opt out; Release 1 opt-in verified live on co-newbiz.
### Added
- **[2026-10-01]**: `templates/common/.github/workflows/ci.yml` (T-20260930-026 PR-B, ADR-0094) — the workflow now carries `# PROJECT-JOBS-BEGIN`/`# PROJECT-JOBS-END` markers; upgrade-project preserves the region between them as project-owned (validated, not trusted). A new opt-in `unit-tests` job (gated by the `CI_ENABLE_DEFAULT_UNIT_TESTS` repository variable, 15-minute timeout, `persist-credentials: false`, pinned Bun `1.3.x`) runs `test:unit` when package.json defines it; the old commented test-python/test-node stubs were removed — stack-specific jobs now belong inside the project region.

## [0.8.3] - 2026-09-30
### Changed
- **[2026-10-01]**: auto-release 2026-10-01: 4 delivered paths (A 0 / M 4 / D 0 / R 0)

## [0.8.2] - 2026-09-30
### Changed
- **[2026-09-30]**: auto-release 2026-09-30: 22 delivered paths (A 0 / M 22 / D 0 / R 0)
- **[2026-09-29]**: `templates/common/agents/pm.md` — the 3-Tier Strategy pointer now links to "PM Tier Semantics" in the COMMON-AGENTS zone of `AGENTS.md`. The upgrade merge delivers that zone to existing projects. The pm.md body block also reaches existing projects, so the link now resolves there.
- **[2026-09-29]**: `templates/common/agents/pm.md` 1.2.1 and `templates/common/AGENTS.md` §3.6 — the PM tier is now a capability floor for a session-hosted agent on every platform (`tier_semantics: floor`, `session_hosted: true`, "Tier semantics" note). New scaffolds get the change. Existing projects do not get the AGENTS.md note through upgrade, because it sits outside the managed blocks.

## [0.8.1] - 2026-09-29
### Changed
- **[2026-09-29]**: auto-release 2026-09-29: 50 delivered paths (A 0 / M 50 / D 0 / R 0)

## [0.8.0] - 2026-09-29
### Changed
- **[2026-09-29]**: auto-release 2026-09-29: 54 delivered paths (A 25 / M 24 / D 5 / R 0)

## [0.7.0] - 2026-09-27
### Changed
- **[2026-09-27]**: auto-release 2026-09-27: 2508 delivered paths (A 1074 / M 947 / D 211 / R 276)
- **[2026-09-18]**: `templates/common/agents/pm.md` 1.2.0 — WORKSPACE-MANAGED block gains "Agent Hiring & Firing" (PM-decided timing, deprecate-default exit, hard delete on explicit user request) and "Skill Request Approval" (agent-initiated, PM-approved skill create/attach/remove). Variants inherit via the pm.md extends chain; `templates/common/skills/agent-lifecycle-manager` 1.2.0 and `skill-lifecycle-manager` 1.4.0 published from L0 via `propagate:apply`.
- **[2026-06-01]**: `co-security` variant: Redesigned workflow by merging Phase 1 and 2 into "Recon & Threat Modeling"
- **[2026-06-01]**: `co-security` variant: Fixed PM-ONLY Agent Roster in `AGENTS.md` and `docs/co-security.context.md`

### Fixed
- **[2026-06-09]**: fix: Windows project folder deletion permissions — enhanced Windows permission handling in `new-project.sh` (v1.7.1) and `new-project.ps1` (v1.7.2) to recursively remove hidden/system/readonly attributes (including inside `.git/`) and transfer ownership to the current user (`takeown`), preventing Windows Explorer administrator prompts during deletion.

## [0.6.0] - 2026-08-28
### Added
- **[2026-08-28]**: LICENSE rollout — template license mechanism introduced via `a5714968` (AGPL license template rollout across templates and variants).
- **[2026-08-28]**: Promoted 6 generic skills from `co-safety`/`co-work` to `templates/common/skills/` (`70fef8bf`).
- **[2026-08-30]**: Promoted `handbook` (0.4.0) and `handbook-sync-audit` (1.0.0) skills from `co-deck` to `templates/common/skills/` (`1653a84f`).

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
