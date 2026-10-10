# Templates Changelog

All notable changes to the template variants are documented here.

## [Unreleased]

## [0.16.0] - 2026-10-10
### Changed
- **[2026-10-11]**: auto-release 2026-10-11: 52 delivered paths (A 4 / M 48 / D 0 / R 0)

## [0.15.0] - 2026-10-08
### Changed
- **[2026-10-09]**: auto-release 2026-10-09: 279 delivered paths (A 12 / M 267 / D 0 / R 0)

## [0.14.0] - 2026-10-07
### Changed
- **[2026-10-08]**: auto-release 2026-10-08: 52 delivered paths (A 4 / M 48 / D 0 / R 0)

## [0.13.1] - 2026-10-07
### Changed
- **[2026-10-07]**: auto-release 2026-10-07: 9 delivered paths (A 0 / M 9 / D 0 / R 0)

## [0.13.0] - 2026-10-06
### Changed
- **[2026-10-07]**: auto-release 2026-10-07: 370 delivered paths (A 64 / M 296 / D 10 / R 0)
- **[2026-10-06]**: fix(fleet-remediation) [co-design, co-work, co-export, co-hr, co-news, co-game, co-security, co-price, co-safety]: all validate-variant-claims findings cleared (fleet 13/13 PASS 0) — ADR-0099 checklist ratifications for the four stable generation-1 migrations, stages/gates real criteria and untruncated titles, roster rows (i18n-specialist/pm) on every surface with ko mirrors, AGENTS.md thin-dispatcher regen, evidence_models_dir and missing governance paths nulled, co-safety fiction rows removed and start-mcp spawn fixed; 16 RACI accountable cells adjudicated from the superseded stage-owner fallback to doc-grounded procedure owners. Spec `2026-10-05-consult-abap-develop-review-remediation-design`.
- **[2026-10-06]**: fix(review-remediation) [co-consult, co-abap, co-develop]: all findings from the 2026-10-05 three-template scoped review fixed — co-consult HWP pipeline restored + report chain repaired (NEW package.json, GFM tables, path/exit-code/spawn hardening); co-abap setup.ts false-green fixed (uv/venv), .gitignore ships (no .env commits), vsp supply chain pinned + fail-closed on the verified canonical repo, deliverables tree, phase model + gates (DG-ABAP-02); co-develop 7-phase model unified, phantom handoff agents removed; all three PROMOTION_CHECKLISTs reconciled per ADR-0099 (migration fast-track waivers); i18n-specialist roster reconciliation; AGENTS.md thin-dispatcher regen ×3. Validator batch 2 (checks k–r) — all three variants PASS 0 findings. Evidence: `docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md`; spec `2026-10-05-consult-abap-develop-review-remediation-design`.
- **[2026-10-05]**: fix(review-remediation) [co-deck]: all 39 findings from the 2026-10-05 scoped project review fixed — `--auto-calibrate` TDZ crash, NEW template package.json (7 undeclared runtime deps), CRLF-tolerant frontmatter, snapshot/html-to-pdf/watch-deck/download-font hardening, stable-status metadata (betaLifecycleSummary null, PROMOTION_CHECKLIST post-promotion, README beta blocks out, roster 14), theme_manifest 6×6 schema with `default_theme`/`default_style`, process model unified on S1–S11 + user-guide §4 gate authority + phase↔stage mapping, AGENTS.md thin-dispatcher regen, stale doc paths/claims repaired, preview decks 28/28. Contract-truth validator `validate-variant-claims.ts` joins the review battery (7/7). Evidence: `docs/reports/2026-10-05-project-review-scoped-co-deck.md`; spec `2026-10-05-co-deck-review-remediation-design`.
- **[2026-10-05]**: fix(zen) [co-deck]: semi-opaque text panels that hug the text box — classic/minimal/premium-dark/academic render slide text on a style-tuned panel (warm paper / near-white / noir / sepia) instead of directly on the photo; `flex: 0 0 auto` + `width: fit-content` keep the box compact and centered (base.css stretched it full-width); white-bubble bubble hugs too (opacity 0.97). Zen standard-slide baselines regenerated. Spec `2026-10-05-zen-text-panel-readability`.
- **[2026-10-05]**: feat(zen) [co-deck]: sync from Projects/co-deck — zen overlay-above-text fix (`.slide-content` z-index), zen-scoped style differentiation (classic/minimal/premium-dark/academic), new zen-only `white-bubble` style (white bubble cards + orange `**keyword**` highlights, from the 2008 Corporate Culture Revolution reference), `inlineTitle()` markup+newline support in titles, content rules raised to 50-char titles / 5 bullets, zen baselines regenerated. Designs: `2026-10-05-zen-style-differentiation`, `2026-10-05-white-bubble-style`, `2026-10-05-zen-content-rules-50-5`.

## [0.12.0] - 2026-10-04
### Changed
- **[2026-10-05]**: auto-release 2026-10-05: 75 delivered paths (A 2 / M 73 / D 0 / R 0)

## [0.11.0] - 2026-10-03
### Changed
- **[2026-10-04]**: auto-release 2026-10-04: 32 delivered paths (A 1 / M 28 / D 3 / R 0)

## [0.10.0] - 2026-10-02
### Changed
- **[2026-10-03]**: auto-release 2026-10-03: 87 delivered paths (A 2 / M 79 / D 6 / R 0)
### Added
- **[2026-10-02]**: PM role bootstrap (spec 2026-10-02-pm-role-bootstrap-design) — new projects now ship the SessionStart hook `scripts/hooks/pm-role-bootstrap.ts` and a top-of-file "Session bootstrap (mandatory)" block in CLAUDE.md, GEMINI.md, CODEX.md and HERMES.md. Existing projects receive the hook and the settings.json entry through upgrade-project. They do not receive the top block.

## [0.9.0] - 2026-10-01
### Changed
- **[2026-10-02]**: auto-release 2026-10-02: 79 delivered paths (A 8 / M 71 / D 0 / R 0)
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
