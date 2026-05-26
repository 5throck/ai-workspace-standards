# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

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

*Last Updated: 2026-05-27*























