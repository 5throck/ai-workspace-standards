# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **[2026-05-30]**: feat: implement TS-based hooks and template synchronization
- **[2026-05-29]**: `templates/common/phase-definitions.md` — comprehensive 6-phase workflow definition with PM facilitator tasks for each phase (Initiation, Planning, Design Handoff, Execution, QA, Finalization)
- **[2026-05-29]**: Multi-Agent Phase Definitions section — added to all 4 variant AGENTS.md files (co-develop, co-design, co-work, co-security) with phase-specific specialist agent mappings and PM orchestrator guidance
- **[2026-05-29]**: `memory/meeting-2026-05-29-pm-facilitator-transition-review.md` — meeting transcript documenting 3-agenda review: PM facilitator transition, skill lifecycle procedures, and script advancement needs
- **[2026-05-29]**: `README.md` — added platform-specific installation methods to Project-Specific Tools table (e.g., `winget install OpenJS.NodeJS` for Windows) and reference to Getting Started guide
- **[2026-05-29]**: `templates/common/docs/context.md` — added "Platform-Specific Tools" table with standard package managers (winget, brew, apt, dnf) for consistent installation experiences
- **[2026-05-29]**: `docs/getting-started.md` — comprehensive installation guide with prerequisites checklist, troubleshooting, and platform-specific instructions
- **[2026-05-29]**: TypeScript helper scripts for project creation — `scripts/helpers/` directory with 8 modular scripts (template-validation.ts, lifecycle-governance.ts, validate-output.ts, substitute-placeholders.ts, update-variant-lifecycle.ts, write-scripts-snapshot.ts, merge-package-scripts.ts, inject-skills.ts)
- **[2026-05-29]**: Test 0e to `test-new-project.ts` — validates new-project.sh template verification logic checks common/ and variant/ separately
- **[2026-05-29]**: Documentation restructuring — Runtime vs Governance separation: `agents/*.md` with lifecycle frontmatter (phase, created, last_updated, governance) and `docs/lifecycle/agents/*.md` with detailed governance records
- **[2026-05-29]**: `docs/governance/` directory — centralized governance documentation (branch-strategy.md, pr-workflow.md, skill-update-procedure.md, LIFECYCLE_GOVERNANCE.md, lifecycle-governance.json)
- **[2026-05-29]**: `templates/common/variant/` directory — variant phase definitions moved from `docs/variant/` to correct template location
- **[2026-05-29]**: Lifecycle validation scripts — `validate-agents.sh`, `validate-skills.sh`, `validate-doc-folder.sh`, `cleanup-completed-md.sh`
- **[2026-05-29]**: `docs/lifecycle/` directory — governance records for all agents and skills with Phase History and Acceptance Criteria sections
- **[2026-05-29]**: `scripts/audit.sh` / `audit.ps1` — `check_command_parity()` check: compares `.claude/commands/` file list against `.gemini/commands/` and WARNs on missing files; supports `gemini-parity: skip` frontmatter for intentional Claude-only exceptions
- **[2026-05-29]**: `.gemini/commands/` directory at workspace root — `meeting.md`, `changelog.md`, `memlog.md`, `new-task.md`, `sync.md` created (cross-platform parity with `.claude/commands/`)
- **[2026-05-29]**: `docs/constitution/06-skill-lifecycle.md` — **Cross-Platform Deployment Rule** section: any command file in `.claude/commands/` must have a matching file in `.gemini/commands/`; `gemini-parity: skip` frontmatter as explicit opt-out mechanism
- **[2026-05-29]**: PM Orchestrator mode in `/meeting` skill — when PM is in participant list (default), PM opens each round (agenda + agent nomination), closes each round (synthesis + provisional decision), and delivers final synthesis owning the action items table; applied to all 6 meeting.md files (workspace root + 4 variants + templates/common/.gemini)
- **[2026-05-29]**: Meeting transcript: `memory/meeting-2026-05-28-gemini-parity-gap.md` — root cause analysis of Gemini command parity gap; 5 action items (A-01~A-05)
- **[2026-05-29]**: Meeting transcript: `memory/meeting-2026-05-28-script-pair-sync.md` — structural analysis of `intentional drift` policy flaw in `.sh`/`.ps1` horizontal sync; proposed `pair` field to SCRIPTS.md schema; 5 action items (A-01~A-05)

### Changed
- **[2026-05-29]**: `scripts/new-project.ps1` — fixed final working directory to match SH behavior; script now exits at workspace root (not project directory) after saving original location; aligns with README instructions for manual `cd`
- **[2026-05-29]**: `docs/getting-started.md` — removed redundant "Python 3 (Optional - Project-Specific)" section; simplified to avoid duplication with Optional Software section
- **[2026-05-29]**: `README.md` — added "Project-Specific Tools" table; removed Python/uv from Optional Tools; clarified project-specific tool installation
- **[2026-05-29]**: `docs/getting-started.md` — reclassified Python 3 from "essential" to "optional" (project-specific); updated prerequisites checklist to reflect Git + Bun as the only truly essential tools
- **[2026-05-29]**: `README.md` — removed Python from "Must-Have Tools" section; moved to "Optional Tools" (Python projects only)
- **[2026-05-29]**: `scripts/new-project.sh` — replaced all Python inline code with TypeScript helper calls; UTF-8 decoding errors resolved
- **[2026-05-29]**: `scripts/new-project.ps1` — replaced PowerShell native code with TypeScript helper calls; now uses identical logic to SH version (single source of truth)
- **[2026-05-29]**: `.claude/settings.json` and all template settings files — fixed SessionStart hook structure (added missing `matcher` and `hooks` wrapper)
- **[2026-05-29]**: `.gitignore` — added negation patterns for `!docs/governance/`, `!docs/lifecycle/`, `!docs/variant/`, `!docs/superpowers/`, `!templates/common/`
- **[2026-05-29]**: `CLAUDE.md` §2 — added platform parity note: "every command file in `.claude/commands/` must have a matching file in `.gemini/commands/`; see CONSTITUTION.md §6"
- **[2026-05-29]**: `GEMINI.md` §6 — added platform parity note referencing `CONSTITUTION.md §6 Cross-Platform Deployment Rule`
- **[2026-05-29]**: `.claude/commands/new-project.md` — added `gemini-parity: skip` frontmatter (Claude Code Agent tool dispatch has no Gemini equivalent)
- **[2026-05-29]**: `/meeting` skill — `Orchestrator: [PM | Facilitator]` field added to meeting header; transcript metadata includes orchestrator field

### Fixed
- **[2026-05-29]**: Template folder structure — deleted completed plan files (`PHASE_3_DELIVERY.md`, `VARIANT_LIFECYCLE_INTEGRATION.md`), moved governance docs to `docs/governance/`
- **[2026-05-29]**: `templates/common/scripts/readme-lifecycle-audit.ts` (L1) — published CRLF fix from L0; L0/L1 drift resolved (both now normalize `\r\n` → `\n` in `parseSections`)
- **[2026-05-29]**: `scripts/audit.ps1` — added command parity check block mirroring `audit.sh` `check_command_parity()` (was absent, discovered via user review)

### Added
- **[2026-05-28]**: `scripts/upgrade-project.sh` / `.ps1` — new scripts to upgrade existing projects to the latest template version with 3-tier file classification (LOCKED/MERGE/PRESERVE), `--dry-run`, `--platform`, and pre-upgrade git stash snapshot
- **[2026-05-28]**: `--platform claude|antigravity|both` flag to `scripts/new-project.sh` / `.ps1` — controls which AI platform config files are included (default: `both`)
- **[2026-05-28]**: Security Bootstrap Check (5-point) to `scripts/new-project.sh` / `.ps1` and `upgrade-project.sh` / `.ps1` — halts on missing `.gitleaks.toml`, `.githooks/pre-commit`, `.gitattributes eol=lf`, `.gitignore .env`, or unset `core.hooksPath`
- **[2026-05-28]**: `CONSTITUTION.md §10 Terminology` — canonical definitions for Template Variant, Platform Profile, WORKSPACE-MANAGED Marker, LOCKED/MERGE/PRESERVE tiers, Platform Documentation Parity, Script Parity Annotation
- **[2026-05-28]**: Security & Hook Configuration section with `WORKSPACE-MANAGED` markers to all 3 variant `GEMINI.md` templates (`co-develop`, `co-design`, `co-work`)
- **[2026-05-28]**: feat: Variant lifecycle management system - 4-stage lifecycle (draft → beta → stable → deprecated) with transition criteria
- **[2026-05-28]**: feat: Template version tracking system - .template-info.json auto-generation on project creation
- **[2026-05-28]**: feat: /template-status skill for checking current template version against latest
- **[2026-05-28]**: feat: Template CHANGELOG.md and migration guide system in templates/common/
- **[2026-05-28]**: feat: validate-templates.ts lifecycle-based validation (status-aware checks)
- **[2026-05-28]**: feat: Common security-check.md for all variants (.gemini/commands/)
- **[2026-05-28]**: docs: Beta usage scope documentation in co-security.context.md
- **[2026-05-27]**: `scripts/publish-to-template.sh` / `.ps1` — new scripts to sync workspace changes into `templates/common/` (#109)
- **[2026-05-27]**: `skills/` directory — 9 workspace-root skills with SKILL.md, data files, and Python scripts (`ui-ux-pro-max`, `agent-lifecycle-manager`, `skill-lifecycle-manager`, `script-lifecycle-manager`, `meeting-facilitation`, `audit-workspace`, `security-scan`, `simulate-project-creation`, `validate-docs-links`) (#109)
- **[2026-05-27]**: `template-v0.5.0` git tag — enables `.\scripts\new-project.ps1 "name" -Version 0.5.0` versioned scaffold (#110)

### Changed
- **[2026-05-28]**: `agents/docs-writer.md` — tier promoted Low→Medium (`claude-sonnet-4-6`); role split with Architect (DocsWriter executes, Architect designs document architecture)
- **[2026-05-28]**: `AGENTS.md`, `CLAUDE.md` — Documentation Writer tier updated to Medium across all roster tables
- **[2026-05-28]**: chore: Variant status corrections
  - **[2026-05-29]**: co-develop: stable 0.4.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-work: stable 0.5.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-design: stable 0.5.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-security: draft 0.1.0 → beta 0.2.0 (beta promotion after A-04 verification)
- **[2026-05-28]**: chore: new-project.sh/ps1 now creates .template-info.json by default for all variants

### Security
- **[2026-05-28]**: security: co-security beta status restricts usage to test environments only (actual customer engagements prohibited)

### Fixed
- **[2026-05-27]**: `scripts/new-project.ps1`: wrap `git archive` and `tar` in `try/catch` to suppress `NativeCommandError` under inherited `ErrorActionPreference=Stop` (#112)
- **[2026-05-27]**: `scripts/new-project.ps1`: switch from PowerShell pipe to `git archive -o <tempfile>` + `tar -x -f <tempfile>` — PowerShell pipes corrupt binary tar streams (#111)
- **[2026-05-27]**: `templates/common/scripts/setup.ps1`: add `exit 0` at end — `git commit` exit code 1 ("nothing to commit") was causing false ⚠️ Setup error warning in `new-project.ps1` (#110)
- **[2026-05-27]**: `scripts/new-project.ps1`: improve error message for `git archive` failure on pre-v0.5.0 tags that lack `templates/common/` structure (#110)
- **[2026-05-27]**: `.gitattributes`: add `eol=lf` to `*.md` rule — CRLF on Windows checkout was corrupting YAML frontmatter in SKILL.md files, breaking `skill-lifecycle-audit.ts` (#111)
- **[2026-05-27]**: `skills/*.md`: normalize CRLF to LF; add missing `owner: pm` frontmatter field to 4 skills (`agent-lifecycle-manager`, `meeting-facilitation`, `script-lifecycle-manager`, `skill-lifecycle-manager`) (#109)
- **[2026-05-27]**: `templates/common/scripts/setup.ps1`: wrap `git clone`, `git rev-parse`, `git add`, `git commit` in `try/catch` — all inherited `NativeCommandError` false positives (#107, #108)

### Added
- **[2026-05-27]**: feat: Implement README synchronization policy and workspace QA rules

### Added
- **[2026-05-27]**: feat: Implement architectural refinements (TS migration, URL fix, Script parity)

### Added
- **[2026-05-27]**: chore\:\ update

### Added
- **[2026-05-27]**: chore\:\ update

### Added
- **[2026-05-27]**: `templates/common/docs/context.md` — new immutable common context file (project identity, architecture, key files, documentation standards) (#95)
- **[2026-05-27]**: `templates/co-develop/docs/co-develop.context.md` — new variant config file (tech stack, agents, skills, scripts, workflow) with lifecycle status columns (#95)
- **[2026-05-27]**: `templates/co-design/docs/co-design.context.md` — new variant config file for design projects (#95)
- **[2026-05-27]**: `templates/co-work/docs/co-work.context.md` — new variant config file for collaboration projects (#95)
- **[2026-05-27]**: All variant CLAUDE.md and GEMINI.md — Session Start context loading order added (#95)
- **[2026-05-27]**: `scripts/new-project.sh` / `.ps1` — provenance to variant.context.md; docs/context.md merge=ours in .gitattributes (#95)
- **[2026-05-27]**: `templates/common/scripts/SCRIPTS.md` — script lifecycle registry (Registry + Guide dual-section) (#96)
- **[2026-05-27]**: `scripts/verify-scripts.ts` — script registry verifier with --verify / --generate / --report modes (#96)
- **[2026-05-27]**: `CONSTITUTION.md §6.5` — Script Lifecycle Management section (ownership layers, states, deprecation/security protocols) (#96)
- **[2026-05-27]**: Meeting transcripts English mandate — `/meeting` skill updated to always save transcripts in English regardless of dialogue language; all variant `meeting.md` commands updated
- **[2026-05-27]**: Existing Korean meeting transcripts translated to English (`meeting-2026-05-27-template-lifecycle-review.md`, `meeting-2026-05-27-script-lifecycle-context-structure.md`)
- **[2026-05-27]**: `.githooks/pre-commit` — removed meeting-transcript Korean exemption; all `memory/*.md` files now subject to English-only enforcement
- **[2026-05-27]**: `scripts/verify-memory.ts` — memory log format verifier with --verify / --report modes (#99)
- **[2026-05-27]**: `scripts/sync-md.sh/ps1` — MEMORY.md 3-section structure (Sessions/Meetings/ADRs) with --meeting and --adr flags (#99)

### Changed
- **[2026-05-27]**: `.githooks/commit-msg` — auto-log now generates mandatory 4-section format (## Session Summary / ## Changes / ## Decisions / ## Open Issues) (#99)
- **[2026-05-27]**: `memory/MEMORY.md` — restructured into Sessions / Meetings / ADRs sections (#99)
- **[2026-05-27]**: `.claude/commands/memlog.md` — auto-scaffolds 4-section format with git diff pre-populated (#99)
- **[2026-05-27]**: `/meeting` skill — now registers transcript to MEMORY.md Meetings section after saving (#99)
- **[2026-05-27]**: `scripts/audit.sh` — memory format audit integrated as non-blocking warning (#99)

### Changed
- **[2026-05-27]**: `.github/pull_request_template.md` redesigned with Summary/Changes table/Test Plan/Security Checklist sections — applied to workspace and all template variants (#93)
- **[2026-05-27]**: `CONSTITUTION.md §2`: Memory session log mandatory four-section format (Session Summary, Changes, Decisions, Open Issues) with cross-tool consistency note (#93)
- **[2026-05-27]**: `CONSTITUTION.md §2.1`: CHANGELOG entry `(#PR-number)` reference requirement (#93)
- **[2026-05-27]**: `Documentation Standards` section added to all variant `docs/context.md` files (co-develop, co-design, co-work) (#93)
- **[2026-05-27]**: `scripts/dev-sync.sh` + `.ps1`: `[Unreleased]` content check — warns if section is empty before commit (#93)
- **[2026-05-27]**: `templates/common/.githooks/pre-commit`: §2-A UTF-8 Markdown encoding check + §2-B English-only enforcement added; section order corrected (#93)
- **[2026-05-27]**: `scripts/`: reverse-sync from `templates/common/scripts/` — added `verify-skills.ts`, `install-bun.sh/.ps1`, `dispatch-parallel.ts`, `dispatch-serial.ts`, `dispatch.ts`, `retry-handler.ts` (#93)

### Changed
- **[2026-05-27]**: `templates/CHANGELOG.md`: added `[0.5.0]` release entry with `(#PR)` reference format — establishes PR reference convention (#93)
- **[2026-05-27]**: `.githooks/pre-commit`: section header emoji replaced with `──` separator style for consistency with template (#93)

### Changed
- **[2026-05-26]**: docs: simplify co-develop variant summary for consistency

### Changed
- **[2026-05-26]**: docs: update variant summaries in root READMEs to reflect domain-native workflows

### Changed
- **[2026-05-26]**: docs: update co-design and co-work context.md with domain-native workflows

### Changed
- **[2026-05-26]**: docs: encapsulate multi-agent workflow details by variant

### Changed
- **[2026-05-26]**: docs: simplify repository structure for better maintainability

### Changed
- **[2026-05-26]**: docs: update templates directory structure in readme

### Changed
- **[2026-05-26]**: docs: sync readme structure with current repository state

### Changed
- **[2026-05-26]**: docs: standardize powershell argument casing in readme

### Changed
- **[2026-05-26]**: chore: remove stale meeting summary files

### Added
- **[2026-05-26]**: feat: enforce english only and utf-8 encoding in git hooks

### Added
- **[2026-05-26]**: feat: implement dynamic template generation and audit hooks

### Added
- **[2026-05-26]**: feat: sync docs context and add template validation logic

### Added
- **[2026-05-26]**: feat: implement agent lifecycle management and sync template agent references

### Added
- **[2026-05-25]**: feat\(lifecycle\)\:\ add\ execution\ location\ output\,\ simplify\ templates

### Added
- **[2026-05-25]**: feat: add agent and skill lifecycle management system with Bun/TypeScript audit scripts
  - **[2026-05-25]**: `scripts/agent-lifecycle-audit.ts` - validates agent frontmatter, AGENTS.md consistency, deprecated agent references
  - **[2026-05-25]**: `scripts/skill-lifecycle-audit.ts` - validates skill frontmatter, owner references, deprecated skills, dependencies
  - **[2026-05-25]**: Pre-commit hooks automatically run audits when agent/skill files are staged
  - **[2026-05-25]**: `.claude/skills/skill-lifecycle-manager/SKILL.md` - PM agent skill for managing skill lifecycle
- **[2026-05-25]**: docs: add lifecycle management sections to CONSTITUTION.md (§5.5 Agent Lifecycle, §6.5 Skill Lifecycle)
- **[2026-05-25]**: docs: add lifecycle management documentation to templates/docs/context.md with frontmatter templates and audit commands

### Changed
- **[2026-05-26]**: Update `README.md` and `README_ko.md` to reflect current state: co-design and co-work variants marked ✅ Stable, agent rosters listed, `common/skills/` added to structure, template version bumped to 0.5.0, branch naming convention updated to `feat/fix/docs` prefix
- **[2026-05-26]**: Bump `templates/VERSION` from `0.4.0` to `0.5.0`
- **[2026-05-25]**: feat: add `role` and `status: active` fields to all workspace root agent files (architect, auditor, automation-engineer, docs-writer, pm, scaffolding-expert, security-expert)
- **[2026-05-25]**: docs: update AGENTS.md and templates/AGENTS.md with skill-lifecycle-manager entry
- **[2026-05-25]**: docs: update platform notes to specify Bun-only for lifecycle audit scripts (removed Bash/PS1 references)
- **[2026-05-25]**: docs: improve README Step 4 - add concrete example (Tetris game) with context guidance and custom agent team explanation to help users understand PM kick-off process
- **[2026-05-25]**: docs: improve README Step 4 - add concrete example (Tetris game) with context guidance and custom agent team explanation to help users understand PM kick-off process
- **[2026-05-25]**: docs: apply same README improvements to README_ko.md for bilingual consistency

### Fixed
- **[2026-05-27]**: Wrap all git native commands in `setup.ps1` with `try/catch` to suppress PS5.1 `NativeCommandError` inheritance from `new-project.ps1` — affects `git clone`, `git rev-parse`, `git add`, `git commit` (`templates/common/scripts/setup.ps1`, #107, #108)
- **[2026-05-25]**: feat: enhance memory log format - commit-msg hook now captures rich context (summary, file count, decisions, issues) from commit body instead of generic placeholders
- **[2026-05-25]**: fix: resolve param syntax bug in powershell scripts

### Added
- **[2026-05-24]**: docs: multi-agent meeting summary - 96 improvement opportunities identified across 7 agents
- **[2026-05-24]**: feat: establish multi-agent harness for workspace root

### Added
- **[2026-05-24]**: feat: add scripts/temp directory for scratch scripts with gitignore rules

### Changed
- **[2026-05-24]**: chore: remove leftover temporary automation scripts from workspace root

### Changed
- **[2026-05-24]**: refactor: consolidate Session Start/Context Loading into CONSTITUTION.md and remove duplicates from CLAUDE and GEMINI templates

### Changed
- **[2026-05-24]**: refactor: remove duplicated Response Language block from GEMINI.md

### Changed
- **[2026-05-24]**: docs: backfill today's changelog entries that were missed due to the previous bug

### Fixed
- **[2026-05-24]**: scripts/dev-sync.*, 	emplates/scripts/dev-sync.*: Fixed bug where Changelog auto-add would skip logging after the first commit in a release cycle.
- **[2026-05-24]**: 	emplates/GEMINI.md, 	emplates/docs/context.md: Moved 'Pre-PR Security Gate' rule from GEMINI-specific instructions to common context.md Git/PR Workflow as it applies to all agents.
- **[2026-05-24]**: scripts/*.ps1, 	emplates/scripts/*.ps1: Fixed critical Windows CP949 encoding corruption bug by enforcing -Encoding UTF8 on all Get-Content calls.
- **[2026-05-24]**: 	emplates/AGENTS.md, 	emplates/CLAUDE.md, 	emplates/GEMINI.md, 	emplates/docs/context.md: Deduplicated behavioral rules into context.md and restored 3-tier strategy references. Removed Em Dashes to prevent encoding errors.


### Added
- **[2026-05-23]**: `templates/docs/context.md`, `templates/agents/pm.md`, `templates/agents/*.md`: PM-first multi-agent workflow enforcement. Added "Multi-Agent Workflow" section to context.md as single source of truth; PM agent declared as SINGLE ENTRY POINT; all specialist agents (architect, designer, code-writer, test-runner, security-monitor, stack-setup) now refuse direct invocation and redirect to PM.
- **[2026-05-23]**: `templates/CLAUDE.md`, `templates/GEMINI.md`: Added brief "Multi-Agent Workflow" reference pointing to docs/context.md; eliminated duplication.
- **[2026-05-23]**: `.githooks/pre-commit` + `templates/.githooks/pre-commit`: New §1-B - auto-creates memory log entry and CHANGELOG entry on every direct `git commit`, not just when using `dev-sync.sh`. Reads commit message from `.git/COMMIT_EDITMSG`; skips duplicates already written by dev-sync; stages generated files into the same commit.
- **[2026-05-23]**: `GEMINI.md`: Added §4 PR Language Rule (reference to CONSTITUTION.md §3); renumbered §4-7 → §5-8; Git & PR Additions: added PR Language bullet.
- **[2026-05-23]**: `CLAUDE.md`, `GEMINI.md`, `templates/CLAUDE.md`, `templates/GEMINI.md`, `templates/docs/context.md`: PR Language Rule consolidated to CONSTITUTION.md §3 as single source of truth; removed inline duplicates; all files now reference §3 instead.
- **[2026-05-23]**: `.github/pull_request_template.md`: Converted to English-only (removed Korean bilingual labels).
- **[2026-05-23]**: `templates/docs/context.md`, `templates/CLAUDE.md`, `templates/GEMINI.md`: §7 PR Language Rule added to scaffold - new projects inherit the English-only PR rule from creation.
- **[2026-05-23]**: `README_ko.md`: Step 3 updated from tool-based (Claude Code/Antigravity) to OS-based format; AI tool shortcut moved to tip note.
- **[2026-05-23]**: `templates/README_ko.md`: Full UTF-8 Korean rewrite replacing EUC-KR-corrupted content; mirrors `templates/README.md` structure.

### Added
- **[2026-05-23]**: `.githooks/pre-commit`: Add Markdown date auto-bumper and CHANGELOG auto-dating logic. Automatically updates `Last Updated:` date in staged `.md` files upon commit, and injects date into undated `CHANGELOG.md` entries.

### Removed
- **[2026-05-23]**: `README.md` / `README_ko.md`: Remove obsolete manual "Multi-Agent Kickoff" instruction text (automated in the background via post-checkout hook).


### Added -Go/Rust/Elixir stack support + unknown-stack security agent
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Go (`go mod download` + `go-licenses`), Rust (`cargo fetch` + `cargo-license`), Elixir (`mix deps.get`) stacks added; unknown-stack detection block prints a security banner pointing users to `agents/stack-setup.md` and blocks accidental installs
- **[2026-05-23]**: `templates/agents/stack-setup.md` (NEW): 6-phase security-conscious agent for unrecognized stacks -Stack ID -Web Research -Mandatory Security Review (?/?/? risk levels, HIGH requires `CONFIRM HIGH RISK`) -Present Plan -Execute via sub-agent -Persist to setup.sh/ps1
- **[2026-05-23]**: `templates/AGENTS.md`: `stack-setup` added to Agent Roster (? Security/Setup group) and Subagent Roster dispatch table

### Added -Multi-stack setup automation with mandatory Python venv and cross-platform support
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Python venv now uses `uv venv` + `uv pip install` when uv is available, falling back to `python -m venv` + `pip`; `py_install`/`Py-Install` helper abstracts manager; multi-stack OS-aware setup with OSI license audit -Node.js (npm + `license-checker`), Python (uv/venv + `pip-licenses`), Ruby, .NET, Maven, Gradle, CMake/Makefile; `--skip-license-check` flag
- **[2026-05-23]**: `CONSTITUTION.md` §8.5: Open-Source Package Policy -prefer OSI-approved licenses, document non-OSS exceptions
- **[2026-05-23]**: `templates/docs/context.md`: Coding Guidelines §5 Open-Source Package Policy added
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: step 9 prints directory-change banner with exact `cd <path>` command


### Changed -Antigravity 2.0 / Gemini CLI session start config (workspace + templates + 4 sub-projects)

**`GEMINI.md` (workspace root)**
- **[2026-05-23]**: Tool mapping expanded with full operational guidance (`StartLine`, `EndLine`, `IsArtifact`, `MatchPerLine`, `NEVER use cd`)
- **[2026-05-23]**: 🚨 Multi-replace offset safeguard added (bottom-to-top chunk ordering rule)
- **[2026-05-23]**: 🚨 Grep 50-match cap safeguard added (partitioning remediation)
- **[2026-05-23]**: Planning Mode artifact specifications added (`implementation_plan.md`, `task.md`, `walkthrough.md` -brain/ paths + ArtifactType metadata)
- **[2026-05-23]**: Subagent orchestration added (`define_subagent`, `invoke_subagent` JSON examples, `send_message`, Reactive Wakeup)

**`CLAUDE.md` (workspace root)**
- **[2026-05-23]**: Added note to skip Session Start steps 2, 3, 5 in workspace root (due to absence of docs/context.md and AGENTS.md)

**`templates/GEMINI.md`**
- **[2026-05-23]**: Fully applied identical Antigravity 2.0 settings (safeguards, Planning Mode artifacts, Subagent orchestration)
- **[2026-05-23]**: Removed duplicate `### Session Start` section at bottom of file (identical to `## Context Loading` at top)

### Changed -`scripts/audit.sh` + `scripts/audit.ps1` (workspace root) + `templates/scripts/audit.sh` + `templates/scripts/audit.ps1`
- **[2026-05-23]**: Moved CHANGELOG.md `[Unreleased]` section check outside `docs/context.md` condition block -enforced equally for workspace root and new projects
- **[2026-05-23]**: scripts/audit.ps1 (workspace root): synced to 8 checks with .sh -added missing checks for AGENTS.md, agents/, .env.sample, scripts parity

### Fixed
- **[2026-05-23]**: MD file consistency: unified Session Start Checklist across CLAUDE.md, GEMINI.md, and README.md (including templates/)
- **[2026-05-23]**: MD file consistency: updated subagent Phase 4 execution loop and `/sync` pipeline descriptions in `templates/` and root configurations

### Added
- **[2026-05-23]**: `scripts/sync-md.sh` and `scripts/sync-md.ps1` -missing files required by `dev-sync.sh` (workspace pipeline was broken without them)

### Fixed + Added -Global best practices audit (13 items)

**P1 -Bugs / Inconsistencies:**
- **[2026-05-23]**: `CONSTITUTION.md §5`: added `purple` to color palette (was missing after designer.md update)
- **[2026-05-23]**: `CONSTITUTION.md §5`: fixed JSON Input Contract -removed `//` comments (invalid JSON syntax)
- **[2026-05-23]**: `CONSTITUTION.md §1`: added `.github/` (workflows/, CODEOWNERS, pull_request_template.md) and `SECURITY.md` to standard folder structure
- **[2026-05-23]**: `CONSTITUTION.md §3`: added `perf:`, `ci:`, `style:`, `revert:` to Conventional Commits table (Conventional Commits v1.0 compliance)
- **[2026-05-23]**: `CONSTITUTION.md § Workspace`: unified Session Start checklist order (1?ONSTITUTION, 2?ontext.md, 3?GENTS.md, 4?EMORY.md, 5?kills) -was inconsistent with CLAUDE.md
- **[2026-05-23]**: `scripts/dev-sync.sh` + `dev-sync.ps1` (workspace): use `.github/pull_request_template.md` for PR body when present; fall back to `--fill`
- **[2026-05-23]**: `scripts/dev-sync.sh` (workspace): applied same perl escape fix and branch guard as templates

**P2 -Feature gaps:**
- **[2026-05-23]**: `CONSTITUTION.md §2`: added memory archiving policy (50-row threshold, 30-day retention, `memory/archive/` for older logs, `docs/history.md` for ADR summaries)
- **[2026-05-23]**: `templates/docs/context.md`: added `## Git / PR Workflow` section (present in all real projects but was missing from the template)
- **[2026-05-23]**: `.editorconfig` + `templates/.editorconfig`: new -charset/indent/EOL/trailing-whitespace rules for all editors (VS Code, JetBrains, Vim, etc.)

**P3 -Best practices:**
- **[2026-05-23]**: `templates/.github/CODEOWNERS`: new -automatic PR reviewer assignment template
- **[2026-05-23]**: `templates/.github/dependabot.yml`: new -dependency auto-update config template (pip/npm/github-actions stubs)
- **[2026-05-23]**: `templates/.github/workflows/ci.yml`: new -GitHub Actions CI stub (audit gate + Python/Node test job stubs)
- **[2026-05-23]**: `SECURITY.md` + `templates/SECURITY.md`: new -security vulnerability reporting policy (GitHub Advisory + response SLA)
- **[2026-05-23]**: `README.md`: updated Conventional Commits list to include new prefixes

### Fixed -Template system (14-item improvement pass)

**P1 -Bugs:**
- **[2026-05-23]**: `templates/scripts/dev-sync.sh`: perl changelog auto-insert now passes `$MSG` as a Perl variable (`BEGIN{$m=shift}`) -prevents breakage when commit message contains `/`, `&`, or `\`
- **[2026-05-23]**: `templates/scripts/dev-sync.ps1`: removed `-NoNewline` from `Set-Content` call -was silently stripping trailing newline from `CHANGELOG.md`
- **[2026-05-23]**: `templates/scripts/sync-md.sh` + `sync-md.ps1`: added deduplication guard -same-day entries no longer appended twice to `MEMORY.md`

**P2 -Feature gaps:**
- **[2026-05-23]**: `templates/scripts/audit.sh` + `audit.ps1`: strengthened from 4 -8 checks (added: AGENTS.md existence, agents/ non-empty, .env.sample existence, scripts .sh/.ps1 parity)
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: post-scaffold audit runs automatically; added initial commit guidance; `.ps1` files now included in `git update-index --chmod=+x`
- **[2026-05-23]**: `templates/README.md`: added `## Contributing` and `## License` placeholder sections; added CLAUDE.md + GEMINI.md to Documentation links
- **[2026-05-23]**: `templates/docs/context.md`: converted Tech Stack from bullet list to table (better AI parseability; consistent with project examples)
- **[2026-05-23]**: `templates/GEMINI.md`: Session Start section now has actual `@`-syntax loading instructions (was comment-only)

**P3 -Quality / best practices:**
- **[2026-05-23]**: `templates/.github/pull_request_template.md`: new file -PR body template for `gh pr create --fill`
- **[2026-05-23]**: `templates/scripts/dev-sync.sh` + `dev-sync.ps1`: added branch guard -if already on a PR branch, commits in place instead of creating a new branch
- **[2026-05-23]**: `templates/memory/MEMORY.md`: added explanatory header distinguishing index (MEMORY.md) from daily logs (YYYY-MM-DD.md)
- **[2026-05-23]**: `templates/agents/designer.md`: changed `color: magenta` -`color: purple` (was conflicting with analyst-example.md)
- **[2026-05-23]**: `scripts/audit.sh` (workspace): synced with template -now runs all 8 checks

### Fixed -MD file comparison (workspace + templates)
- **[2026-05-23]**: `templates/agents/architect.md`: Unicode corruption on line 60 -`Context ?? Decision` -`Context ??Decision` (arrow was mangled to replacement characters)
- **[2026-05-23]**: `templates/agents/pm.md`: Phase 6 Finalization -added Co-Authored-By commit signature requirement
- **[2026-05-23]**: `templates/agents/code-writer.md`: added rule 5 -update `CHANGELOG.md [Unreleased]` after every change
- **[2026-05-23]**: `templates/CLAUDE.md`: added `### Custom Command Error Recovery` section (error handling for `/sync` failures, hook bypass prohibition)
- **[2026-05-23]**: `templates/GEMINI.md`: added `/new-project` and `/post-write` rows to command emulation table
- **[2026-05-23]**: `templates/CHANGELOG.md`: added `---` separator and Semantic Versioning link (parity with workspace format)
- **[2026-05-23]**: `CLAUDE.md` (workspace): added `## Session Start` checklist and doc intent statement at top
- **[2026-05-23]**: `GEMINI.md` (workspace): added `### 3. Response Language` section (Korean/English split rule)

### Changed
- **[2026-05-23]**: Improve `templates/AGENTS.md` with AI disclaimer, dispatch protocol, phase workflow, role boundary matrix, skills table, and expanded maintenance rule

### Fixed
- **[2026-05-23]**: `CONSTITUTION.md §7` -Windows `.\scripts\new-project.ps1` command had a line-break bug rendering it as `.\scripts` + `ew-project.ps1`
- **[2026-05-23]**: `scripts/audit.sh` -remove unused `PASS=0` / `FAIL=1` dead code variables
- **[2026-05-23]**: `CONSTITUTION.md §1` -add workspace-root exception note to AGENTS.md rule
- **[2026-05-23]**: Improve `templates/CLAUDE.md` with doc intent, CLI vs Desktop table, behavioral rules section, git hooks install, Co-Authored-By, and settings.json clarification
- **[2026-05-23]**: Improve `templates/GEMINI.md` with doc intent, tool name mapping table, git commit policy, command emulation guide, and `.claude/` coexistence rules

### Fixed -Missing slash commands / Skill registrations
- **[2026-05-23]**: Added `.claude/commands/memlog.md` (workspace + templates) -registered `/memlog` Skill
- **[2026-05-23]**: Added `.claude/commands/new-task.md` (workspace + templates) -registered `/new-task` Skill
- **[2026-05-23]**: Added `.claude/commands/new-project.md` (workspace only) -registered `/new-project` Skill
- **[2026-05-23]**: CLAUDE.md §2: reflected exact filenames in command table and added explanation of Skill registration principle
- **[2026-05-23]**: templates/CLAUDE.md: added Slash Commands section (specifying command->Skill auto-registration principle)
- **[2026-05-23]**: templates/docs/context.md: added `/memlog` to Development Workflow, added Slash Commands table

### Changed -License
- **[2026-05-23]**: MIT -AGPL-3.0

### Fixed -Scaffold guideline consistency (4th review -final)
- **[2026-05-23]**: CONSTITUTION.md §5: specified Designer parallel dispatch in Phase 3 Governance Workflow

### Fixed -Scaffold guideline consistency (3rd 5-round review)
- **[2026-05-23]**: templates/agents/pm.md: specified designer parallel dispatch in Governance Workflow Phase 3
- **[2026-05-23]**: CONSTITUTION.md §Workspace: corrected Session Start checklist order (swapped 3<->4 -MEMORY.md first, then skills)
- **[2026-05-23]**: CONSTITUTION.md §3: synced /sync pipeline order with actual dev-sync.sh (memlog->MEMORY.md->CHANGELOG->audit->branch->commit->push->PR)

### Fixed -Scaffold guideline consistency (2nd 5-round review)
- **[2026-05-23]**: scripts/new-project.ps1: moved git update-index after git init (removed dead code)
- **[2026-05-23]**: templates/CLAUDE.md: corrected Hooks Override comment (clarified inactive hook state), improved Step 0 expression, specified `model: inherit` default
- **[2026-05-23]**: templates/GEMINI.md: already modified (previous round)
- **[2026-05-23]**: templates/docs/context.md: fixed CONSTITUTION.md link path (`../` -> `../../`)
- **[2026-05-23]**: templates/AGENTS.md: fixed `_examples` relative path (`../../templates/` -> `../templates/`)
- **[2026-05-23]**: CONSTITUTION.md §7: "pm.md + 3 others" -> "+ 4 others", corrected `.claude/settings.json` description
- **[2026-05-23]**: GEMINI.md §3: added `@AGENTS.md` to Context Loading (workspace root)

### Fixed -Scaffold guideline consistency (5-round review)
- **[2026-05-23]**: templates/agents/pm.md: added missing `designer.md` to Agent Roster
- **[2026-05-23]**: templates/CLAUDE.md: detailed Session Start section (4-step checklist)
- **[2026-05-23]**: templates/GEMINI.md: added `@AGENTS.md` to Context Loading
- **[2026-05-23]**: templates/agents/architect.md: clarified ADR example path (workspace relative path)
- **[2026-05-23]**: templates/AGENTS.md: clarified `_examples` reference path (workspace relative path)
- **[2026-05-23]**: templates/docs/context.md: detailed Architecture placeholder, added sync-md.sh to Key Files, added guide for Session Start Skills, corrected Development Workflow hook state
- **[2026-05-23]**: scripts/new-project.sh: escaped Perl replacement special characters (`\Q...\E`), added test-runner command guide to Next steps
- **[2026-05-23]**: scripts/new-project.ps1: removed duplicate `.sample` filter, added `chmod +x` parity for WSL (git update-index), added test-runner command guide to Next steps

### Fixed -Project consistency (README, CLAUDE.md, CONSTITUTION.md)
- **[2026-05-23]**: CLAUDE.md §1: clearly indicated that PostToolUse hook is inactive (`.claude/settings.json` is `{}`)
- **[2026-05-23]**: README.md: updated 4-role -> 5-role agent model (added Designer), added `templates/` to Repository Structure, included Designer in Two Philosophies, updated Multi-Agent Workflow
- **[2026-05-23]**: CONSTITUTION.md §7: updated Post-scaffold checklist agent count 4 -> 5, fixed `.\scriptsudit.ps1` typo (`.\scripts\audit.ps1`)
- **[2026-05-23]**: scripts/dev-sync.ps1: added missing file to workspace root (Script Parity rule compliance)

### Changed -workspace `.githooks/pre-commit` + `.claude/settings.json` + `.claude/commands/`
- **[2026-05-23]**: Applied same changes as templates/ to the workspace root itself
- **[2026-05-23]**: `.githooks/pre-commit`: conditional audit (memory/ exempt)
- **[2026-05-23]**: .claude/settings.json: removed PostToolUse hook
- **[2026-05-23]**: .claude/commands/changelog.md + sync.md: newly added
- **[2026-05-23]**: `scripts/dev-sync.sh`: Added newly (memlog -> sync-md -> changelog -> audit -> commit)

### Changed -`templates/.githooks/pre-commit`
- **[2026-05-23]**: Smart conditional audit: skips `audit.sh` when only `memory/` files are staged (session logs, daily entries)
- **[2026-05-23]**: Runs audit only when structural files outside `memory/` are staged -prevents spurious failures on log-only commits

### Changed -`templates/.claude/settings.json`
- **[2026-05-23]**: Removed PostToolUse hook -audit no longer fires on every Write/Edit
- **[2026-05-23]**: Audit is now enforced exclusively via pre-commit hook and `dev-sync.sh` pipeline

### Changed -`templates/scripts/dev-sync.sh` + `dev-sync.ps1`
- **[2026-05-23]**: Reordered pipeline: `memlog ??sync-md ??changelog ??audit ??commit ??PR`
  (was: `audit ??memlog ??sync-md ??commit`)
- **[2026-05-23]**: Added auto-changelog step: if `[Unreleased]` section has no entries, inserts the commit message automatically
- **[2026-05-23]**: Audit now runs after memory and changelog are updated -logically correct order

### Added -`templates/.claude/commands/changelog.md`
- **[2026-05-23]**: `/changelog "description"` command: adds a typed entry (`### Added/Changed/Fixed/Removed`) to `CHANGELOG.md [Unreleased]`

### Added -`templates/.claude/commands/sync.md`
- **[2026-05-23]**: `/sync "feat: ..."` command: wraps `bash scripts/dev-sync.sh` with pipeline description

### Added -`templates/agents/designer.md` (new)
- **[2026-05-23]**: UI/UX design agent for Phase 3 -Design group
- **[2026-05-23]**: Produces wireframes (text-based), component specs, design tokens, and accessibility checklists
- **[2026-05-23]**: Output format: Design Specification with Screen Overview, Component List, Interaction Spec, Design Tokens, Accessibility Notes
- **[2026-05-23]**: Added to `templates/AGENTS.md` and `templates/docs/context.md` agent tables
- **[2026-05-23]**: Added to CONSTITUTION.md §5 Role groups table

### Added -`templates/` folder (new)
- **[2026-05-23]**: Created `templates/` directory mirroring the exact structure of a new project -the folder itself is the authoritative scaffold reference
- **[2026-05-23]**: All project files: `docs/context.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CHANGELOG.md`, `.env.sample`, `.gitignore`
- **[2026-05-23]**: Config files: `.claude/settings.json`, `.gemini/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`
- **[2026-05-23]**: Agent definitions: `agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`
- **[2026-05-23]**: Scripts (cross-platform): `scripts/audit.sh`, `audit.ps1`, `dev-sync.sh`, `dev-sync.ps1`, `sync-md.sh`, `sync-md.ps1`
- **[2026-05-23]**: Structural stubs: `memory/MEMORY.md`, `docs/adr/.gitkeep`, `skills/.gitkeep`
- **[2026-05-23]**: `_examples/` subfolder (reference-only, excluded from new projects):
  - **[2026-05-23]**: `adr/0001-example-decision.md` -filled-in ADR example
  - **[2026-05-23]**: `agents/analyst-example.md` -domain analyst agent template
  - **[2026-05-23]**: `memory/2026-01-15-example.md` -daily session log example
  - **[2026-05-23]**: `skills/example-skill/SKILL.md` -reusable skill template

### Changed -`scripts/new-project.sh` + `new-project.ps1` (rewrite)
- **[2026-05-23]**: Replaced ~270-line heredoc approach with `cp -r templates/. <project>/` + `perl -pi` placeholder substitution
- **[2026-05-23]**: Script now has 6 logical steps: copy -remove `_examples/` -remove `.gitkeep` -substitute `[Project Name]` -chmod -git init
- **[2026-05-23]**: Emits `_examples/` path in output so users know where to find extension templates

### Changed -CONSTITUTION.md §7 (simplified)
- **[2026-05-23]**: Reduced from ~1,000 lines to ~70 lines -all template content moved to `templates/`
- **[2026-05-23]**: §7 now contains: scaffolding commands, generated-files table, and a concise post-scaffold checklist
- **[2026-05-23]**: Post-scaffold checklist reduced to essential placeholder checks only

### Changed -`.gitignore` (workspace)
- **[2026-05-23]**: Added `!templates/` negation so the new folder is tracked by git

### Added -CONSTITUTION.md §7 (scaffold template completeness review)
- **[2026-05-23]**: `scripts/audit.sh` + `audit.ps1` scaffold templates added to §7 (previously only copied from workspace, never documented)
- **[2026-05-23]**: `scripts/dev-sync.ps1` scaffold template added alongside existing `dev-sync.sh` template (Windows parity)
- **[2026-05-23]**: `scripts/sync-md.ps1` scaffold template added alongside existing `sync-md.sh` template (Windows parity)
- **[2026-05-23]**: `.gemini/settings.json` scaffold template added (`{}`) -referenced in checklist but never templated
- **[2026-05-23]**: **Extension templates** subsection added (created on demand, not at project init):
  - **[2026-05-23]**: `docs/adr/NNNN-slug.md` -Architecture Decision Record (3-section: Context -Decision -Consequences)
  - **[2026-05-23]**: `agents/<name>-analyst.md` -Analysis agent (read-only investigator; dispatched by PM in Phase 1-)
  - **[2026-05-23]**: `memory/YYYY-MM-DD.md` -Daily session log format

### Fixed -CONSTITUTION.md §7 (path bugs)
- **[2026-05-23]**: `CLAUDE.md` scaffold: `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md` -`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md` (project-root file is one level above workspace, not two)
- **[2026-05-23]**: `GEMINI.md` scaffold: `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md` -`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md`; `@../https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md` -`@https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md`
- **[2026-05-23]**: Path notes for both templates corrected; clarified that `../../` is correct only for files inside subdirectories (`docs/`, `agents/`, etc.)
- **[2026-05-23]**: Post-scaffold checklist: path check items updated to show correct `../` expectation with anti-pattern warning

### Fixed -`scripts/audit.sh` + `audit.ps1`
- **[2026-05-23]**: CONSTITUTION.md check: now looks at both `./CONSTITUTION.md` and `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md` -previously always failed when run from a project directory (CONSTITUTION.md lives at workspace root, one level up)

### Fixed -`scripts/new-project.sh`
- **[2026-05-23]**: `dev-sync.sh` stub: corrected git workflow order -`git checkout -b "$BRANCH"` now runs before `git add -A && git commit` (previously committed to main before creating the PR branch)
- **[2026-05-23]**: Generated `CLAUDE.md` / `GEMINI.md`: fixed path references (`../../` -`../`)
- **[2026-05-23]**: Added `README.md` generation (was missing -checklist required it but script never created it)
- **[2026-05-23]**: Added `.gemini/settings.json` generation (`{}`)
- **[2026-05-23]**: `dev-sync.sh` memlog line: changed `echo "Session synced: $MSG"` to `echo "## Session ??$MSG"` (matches §7 template)

### Fixed/Added -`scripts/new-project.ps1`
- **[2026-05-23]**: Full rewrite for feature parity with `new-project.sh`:
  - **[2026-05-23]**: Now generates all files: `docs/context.md` (full 10-section template), `AGENTS.md`, agent stubs (all 4), `CHANGELOG.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, `CLAUDE.md`, `.claude/settings.json`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `scripts/dev-sync.ps1`, `scripts/dev-sync.sh`, `scripts/sync-md.ps1`, `scripts/sync-md.sh`, `.githooks/pre-commit`, `.githooks/pre-push`
  - **[2026-05-23]**: Copies `audit.sh` + `audit.ps1` from workspace
  - **[2026-05-23]**: Emits actionable "Next steps" instructions on completion

### Fixed -CONSTITUTION.md §7 (5-round iterative review)
- **[2026-05-23]**: `README.md` scaffold template: changed outer fence from ` ```markdown ` to `~~~~markdown` to fix nested code block rendering (same fix applied earlier to `docs/context.md` and `GEMINI.md`)
- **[2026-05-23]**: `scripts/dev-sync.sh` scaffold: fixed git workflow order -`git checkout -b "$BRANCH"` now runs **before** `git add -A && git commit` to prevent commits landing on `main` before the PR branch is created
- **[2026-05-23]**: `agents/pm.md` scaffold header: added 🚨 stub-replacement warning (consistent with architect, code-writer, test-runner)
- **[2026-05-23]**: Post-scaffold checklist: added `agents/pm.md ??full template used (not a stub)` check (script stubs all 4 agents, not 3)
- **[2026-05-23]**: §7 intro: expanded generated-files list to include all 4 agent files (`agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`)

## [2026-05-22]

### Added -CONSTITUTION.md

#### §1 Standard Folder Structure
- Added `.env.sample` and `.gitignore` to the standard folder structure tree
- Added rule: `AGENTS.md` is always created at project root as the canonical agent roster
- Added rule: `.env.sample` always committed; `.env` always in `.gitignore`

#### §5 Multi-Agent Architecture
- Split "Execution" group into distinct **Design** and **Execution** groups
  - **Design**: `architect.md` -architecture decisions, implementation planning, technical spec
  - **Execution**: `code-writer.md`, `test-runner.md` -code implementation and test verification

#### §6 Reusable Skills
- Updated Session skill load timing to reference `docs/context.md ## Session Start Skills`

#### §7 New Project Initialization -scaffold templates
- `docs/context.md` full scaffold template
  - Cross-platform Python venv activation (macOS/Linux + Windows)
  - `## Session Start Skills` section
  - `## Agents` table with all 4 core agents and Group column
  - `## Key Files` expanded with AGENTS.md, CHANGELOG.md, and all agent files
  - Path assumption note added to `## Coding Guidelines` link
  - Outer fence changed to `~~~~markdown` to fix nested code block rendering
- `AGENTS.md` scaffold template (new) -canonical agent index with Group column, dispatch guidance, maintenance rule
- `agents/pm.md` scaffold template (new) -YAML frontmatter + markdown body, 6-phase workflow, Agent Roster with Group column
- `agents/architect.md` scaffold template (new) -design-only agent; produces plans/ADRs; structured Implementation Plan output format
- `agents/code-writer.md` scaffold template (new) -implements approved plans only; per-file change report format
- `agents/test-runner.md` scaffold template (new) -QA agent; verification sequence; structured QA Report with READY/BLOCKED verdict
- `CLAUDE.md` project-level scaffold template (new) -Session Start, MCP Servers, Hooks Override, Model Selection Override
- `.claude/settings.json` scaffold template (new) -PostToolUse hook wiring for `scripts/audit.sh`
- `GEMINI.md` project-level scaffold template (new) -`@`-syntax context loading, model selection override
- `CHANGELOG.md` initial scaffold (new)
- `.env.sample` initial scaffold (new)
- `memory/MEMORY.md` initial scaffold (new)
- `.gitignore` initial scaffold covering Python, Node.js, OS artifacts (new)
- Post-scaffold checklist (new) -10-item verification with cross-platform commands

#### §7 Design principle
- `docs/context.md` = single source of truth for ALL AI tools; project-level `CLAUDE.md`/`GEMINI.md` = platform-specific overrides only

---

*Last Updated: 2026-05-29*

























