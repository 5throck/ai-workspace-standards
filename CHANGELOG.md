# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed — Antigravity 2.0 / Gemini CLI session start config (workspace + templates + 4 sub-projects)

**`GEMINI.md` (workspace root)**
- Tool mapping expanded with full operational guidance (`StartLine`, `EndLine`, `IsArtifact`, `MatchPerLine`, `NEVER use cd`)
- ⚠️ Multi-replace offset safeguard added (bottom-to-top chunk ordering rule)
- ⚠️ Grep 50-match cap safeguard added (partitioning remediation)
- Planning Mode artifact specifications added (`implementation_plan.md`, `task.md`, `walkthrough.md` — brain/ paths + ArtifactType metadata)
- Subagent orchestration added (`define_subagent`, `invoke_subagent` JSON examples, `send_message`, Reactive Wakeup)

**`CLAUDE.md` (workspace root)**
- Session Start steps 2, 3, 5에 workspace root에서는 skip함을 명시하는 노트 추가 (`docs/context.md`, `AGENTS.md` 부재 설명)

**`templates/GEMINI.md`**
- 동일한 Antigravity 2.0 설정 전면 적용 (safeguards, Planning Mode artifacts, Subagent 오케스트레이션)
- 파일 하단의 중복 `### Session Start` 섹션 제거 (상단 `## Context Loading`과 동일 내용)

### Changed — `scripts/audit.sh` + `scripts/audit.ps1` (workspace root) + `templates/scripts/audit.sh` + `templates/scripts/audit.ps1`
- CHANGELOG.md `[Unreleased]` 섹션 존재 여부 검사를 `docs/context.md` 조건 블록 밖으로 이동 — 워크스페이스 루트 및 신규 프로젝트 모두 동일하게 강제
- `scripts/audit.ps1` (workspace root): `.sh`와 체크 8개로 동기화 — AGENTS.md, agents/, .env.sample, scripts parity 체크 누락분 추가

### Fixed
- MD file consistency: unified Session Start Checklist across CLAUDE.md, GEMINI.md, and README.md (including templates/)
- MD file consistency: updated subagent Phase 4 execution loop and `/sync` pipeline descriptions in `templates/` and root configurations

### Added
- `scripts/sync-md.sh` and `scripts/sync-md.ps1` — missing files required by `dev-sync.sh` (workspace pipeline was broken without them)

### Fixed + Added — Global best practices audit (13 items)

**P1 — Bugs / Inconsistencies:**
- `CONSTITUTION.md §5`: added `purple` to color palette (was missing after designer.md update)
- `CONSTITUTION.md §5`: fixed JSON Input Contract — removed `//` comments (invalid JSON syntax)
- `CONSTITUTION.md §1`: added `.github/` (workflows/, CODEOWNERS, pull_request_template.md) and `SECURITY.md` to standard folder structure
- `CONSTITUTION.md §3`: added `perf:`, `ci:`, `style:`, `revert:` to Conventional Commits table (Conventional Commits v1.0 compliance)
- `CONSTITUTION.md § Workspace`: unified Session Start checklist order (1→CONSTITUTION, 2→context.md, 3→AGENTS.md, 4→MEMORY.md, 5→skills) — was inconsistent with CLAUDE.md
- `scripts/dev-sync.sh` + `dev-sync.ps1` (workspace): use `.github/pull_request_template.md` for PR body when present; fall back to `--fill`
- `scripts/dev-sync.sh` (workspace): applied same perl escape fix and branch guard as templates

**P2 — Feature gaps:**
- `CONSTITUTION.md §2`: added memory archiving policy (50-row threshold, 30-day retention, `memory/archive/` for older logs, `docs/history.md` for ADR summaries)
- `templates/docs/context.md`: added `## Git / PR Workflow` section (present in all real projects but was missing from the template)
- `.editorconfig` + `templates/.editorconfig`: new — charset/indent/EOL/trailing-whitespace rules for all editors (VS Code, JetBrains, Vim, etc.)

**P3 — Best practices:**
- `templates/.github/CODEOWNERS`: new — automatic PR reviewer assignment template
- `templates/.github/dependabot.yml`: new — dependency auto-update config template (pip/npm/github-actions stubs)
- `templates/.github/workflows/ci.yml`: new — GitHub Actions CI stub (audit gate + Python/Node test job stubs)
- `SECURITY.md` + `templates/SECURITY.md`: new — security vulnerability reporting policy (GitHub Advisory + response SLA)
- `README.md`: updated Conventional Commits list to include new prefixes

### Fixed — Template system (14-item improvement pass)

**P1 — Bugs:**
- `templates/scripts/dev-sync.sh`: perl changelog auto-insert now passes `$MSG` as a Perl variable (`BEGIN{$m=shift}`) — prevents breakage when commit message contains `/`, `&`, or `\`
- `templates/scripts/dev-sync.ps1`: removed `-NoNewline` from `Set-Content` call — was silently stripping trailing newline from `CHANGELOG.md`
- `templates/scripts/sync-md.sh` + `sync-md.ps1`: added deduplication guard — same-day entries no longer appended twice to `MEMORY.md`

**P2 — Feature gaps:**
- `templates/scripts/audit.sh` + `audit.ps1`: strengthened from 4 → 8 checks (added: AGENTS.md existence, agents/ non-empty, .env.sample existence, scripts .sh/.ps1 parity)
- `scripts/new-project.sh` + `new-project.ps1`: post-scaffold audit runs automatically; added initial commit guidance; `.ps1` files now included in `git update-index --chmod=+x`
- `templates/README.md`: added `## Contributing` and `## License` placeholder sections; added CLAUDE.md + GEMINI.md to Documentation links
- `templates/docs/context.md`: converted Tech Stack from bullet list to table (better AI parseability; consistent with project examples)
- `templates/GEMINI.md`: Session Start section now has actual `@`-syntax loading instructions (was comment-only)

**P3 — Quality / best practices:**
- `templates/.github/pull_request_template.md`: new file — PR body template for `gh pr create --fill`
- `templates/scripts/dev-sync.sh` + `dev-sync.ps1`: added branch guard — if already on a PR branch, commits in place instead of creating a new branch
- `templates/memory/MEMORY.md`: added explanatory header distinguishing index (MEMORY.md) from daily logs (YYYY-MM-DD.md)
- `templates/agents/designer.md`: changed `color: magenta` → `color: purple` (was conflicting with analyst-example.md)
- `scripts/audit.sh` (workspace): synced with template — now runs all 8 checks

### Fixed — MD file comparison (workspace + templates)
- `templates/agents/architect.md`: Unicode corruption on line 60 — `Context ?? Decision` → `Context → Decision` (arrow was mangled to replacement characters)
- `templates/agents/pm.md`: Phase 6 Finalization — added Co-Authored-By commit signature requirement
- `templates/agents/code-writer.md`: added rule 5 — update `CHANGELOG.md [Unreleased]` after every change
- `templates/CLAUDE.md`: added `### Custom Command Error Recovery` section (error handling for `/sync` failures, hook bypass prohibition)
- `templates/GEMINI.md`: added `/new-project` and `/post-write` rows to command emulation table
- `templates/CHANGELOG.md`: added `---` separator and Semantic Versioning link (parity with workspace format)
- `CLAUDE.md` (workspace): added `## Session Start` checklist and doc intent statement at top
- `GEMINI.md` (workspace): added `### 3. Response Language` section (Korean/English split rule)

### Changed
- Improve `templates/AGENTS.md` with AI disclaimer, dispatch protocol, phase workflow, role boundary matrix, skills table, and expanded maintenance rule

### Fixed
- `CONSTITUTION.md §7` — Windows `.\scripts\new-project.ps1` command had a line-break bug rendering it as `.\scripts` + `ew-project.ps1`
- `scripts/audit.sh` — remove unused `PASS=0` / `FAIL=1` dead code variables
- `CONSTITUTION.md §1` — add workspace-root exception note to AGENTS.md rule
- Improve `templates/CLAUDE.md` with doc intent, CLI vs Desktop table, behavioral rules section, git hooks install, Co-Authored-By, and settings.json clarification
- Improve `templates/GEMINI.md` with doc intent, tool name mapping table, git commit policy, command emulation guide, and `.claude/` coexistence rules

### Fixed — Missing slash commands / Skill registrations
- `.claude/commands/memlog.md` 추가 (workspace + templates) — `/memlog` Skill 등록
- `.claude/commands/new-task.md` 추가 (workspace + templates) — `/new-task` Skill 등록
- `.claude/commands/new-project.md` 추가 (workspace only) — `/new-project` Skill 등록
- `CLAUDE.md §2`: 커맨드 테이블 정확한 파일명 반영 및 Skill 등록 원리 설명 추가
- `templates/CLAUDE.md`: Slash Commands 섹션 추가 (커맨드→Skill 자동 등록 원리 명시)
- `templates/docs/context.md`: Development Workflow에 `/memlog` 추가, Slash Commands 테이블 추가

### Changed — License
- MIT → AGPL-3.0

### Fixed — Scaffold guideline consistency (4th review — final)
- `CONSTITUTION.md §5`: Phase 3 Governance Workflow에 Designer 병렬 dispatch 명시

### Fixed — Scaffold guideline consistency (3rd 5-round review)
- `templates/agents/pm.md`: Governance Workflow Phase 3에 designer parallel dispatch 명시
- `CONSTITUTION.md §Workspace`: Session Start 체크리스트 순서 정정 (3↔4 교환 — MEMORY.md 먼저, skills 후)
- `CONSTITUTION.md §3`: /sync 파이프라인 순서를 실제 dev-sync.sh와 일치시킴 (memlog→MEMORY.md→CHANGELOG→audit→branch→commit→push→PR)

### Fixed — Scaffold guideline consistency (2nd 5-round review)
- `scripts/new-project.ps1`: git update-index를 git init 이후로 이동 (dead code 제거)
- `templates/CLAUDE.md`: Hooks Override 주석 정정 (hook 비활성 상태 명확화), Step 0 표현 개선, `model: inherit` 상속 기본값 명시
- `templates/GEMINI.md`: 이미 수정됨 (이전 라운드)
- `templates/docs/context.md`: CONSTITUTION.md 링크 경로 수정 (`../` → `../../`)
- `templates/AGENTS.md`: `_examples` 상대 경로 수정 (`../../templates/` → `../templates/`)
- `CONSTITUTION.md §7`: "pm.md + 3 others" → "+ 4 others", `.claude/settings.json` 설명 정정
- `GEMINI.md §3`: Context Loading에 `@AGENTS.md` 추가 (workspace 루트)

### Fixed — Scaffold guideline consistency (5-round review)
- `templates/agents/pm.md`: Agent Roster에 `designer.md` 누락 추가
- `templates/CLAUDE.md`: Session Start 섹션 구체화 (4단계 체크리스트)
- `templates/GEMINI.md`: Context Loading에 `@AGENTS.md` 추가
- `templates/agents/architect.md`: ADR 예시 경로 명확화 (workspace 상대경로)
- `templates/AGENTS.md`: `_examples` 참조 경로 명확화 (workspace 상대경로)
- `templates/docs/context.md`: Architecture placeholder 구체화, Key Files에 sync-md.sh 추가, Session Start Skills 작성 방법 안내, Development Workflow hook 상태 정정
- `scripts/new-project.sh`: Perl 치환 특수문자 이스케이프(`\Q...\E`), Next steps에 test-runner 명령 안내 추가
- `scripts/new-project.ps1`: `.sample` 중복 필터 제거, WSL용 `chmod +x` 패리티(git update-index) 추가, Next steps에 test-runner 명령 안내 추가

### Fixed — Project consistency (README, CLAUDE.md, CONSTITUTION.md)
- `CLAUDE.md §1`: PostToolUse hook이 비활성화 상태임을 명확히 표기 (`.claude/settings.json`은 `{}`)
- `README.md`: 4-role → 5-role agent 모델 수정 (Designer 추가), Repository Structure에 `templates/` 추가, Two Philosophies 설명에 Designer 포함, Multi-Agent Workflow 설명 업데이트
- `CONSTITUTION.md §7`: Post-scaffold checklist agent 수 4 → 5 수정, `.\scriptsudit.ps1` 오타 수정 (`.\scripts\audit.ps1`)
- `scripts/dev-sync.ps1`: 워크스페이스 루트에 누락된 파일 추가 (Script Parity 규칙 준수)

### Changed — workspace `.githooks/pre-commit` + `.claude/settings.json` + `.claude/commands/`
- Applied same changes as templates/ to the workspace root itself
- `.githooks/pre-commit`: conditional audit (memory/ exempt)
- `.claude/settings.json`: PostToolUse hook 제거
- `.claude/commands/changelog.md` + `sync.md`: 신규 추가
- `scripts/dev-sync.sh`: 신규 추가 (memlog → sync-md → changelog → audit → commit)

### Changed — `templates/.githooks/pre-commit`
- Smart conditional audit: skips `audit.sh` when only `memory/` files are staged (session logs, daily entries)
- Runs audit only when structural files outside `memory/` are staged — prevents spurious failures on log-only commits

### Changed — `templates/.claude/settings.json`
- Removed PostToolUse hook — audit no longer fires on every Write/Edit
- Audit is now enforced exclusively via pre-commit hook and `dev-sync.sh` pipeline

### Changed — `templates/scripts/dev-sync.sh` + `dev-sync.ps1`
- Reordered pipeline: `memlog → sync-md → changelog → audit → commit → PR`
  (was: `audit → memlog → sync-md → commit`)
- Added auto-changelog step: if `[Unreleased]` section has no entries, inserts the commit message automatically
- Audit now runs after memory and changelog are updated — logically correct order

### Added — `templates/.claude/commands/changelog.md`
- `/changelog "description"` command: adds a typed entry (`### Added/Changed/Fixed/Removed`) to `CHANGELOG.md [Unreleased]`

### Added — `templates/.claude/commands/sync.md`
- `/sync "feat: ..."` command: wraps `bash scripts/dev-sync.sh` with pipeline description

### Added — `templates/agents/designer.md` (new)
- UI/UX design agent for Phase 3 — Design group
- Produces wireframes (text-based), component specs, design tokens, and accessibility checklists
- Output format: Design Specification with Screen Overview, Component List, Interaction Spec, Design Tokens, Accessibility Notes
- Added to `templates/AGENTS.md` and `templates/docs/context.md` agent tables
- Added to CONSTITUTION.md §5 Role groups table

### Added — `templates/` folder (new)
- Created `templates/` directory mirroring the exact structure of a new project — the folder itself is the authoritative scaffold reference
- All project files: `docs/context.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CHANGELOG.md`, `.env.sample`, `.gitignore`
- Config files: `.claude/settings.json`, `.gemini/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`
- Agent definitions: `agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`
- Scripts (cross-platform): `scripts/audit.sh`, `audit.ps1`, `dev-sync.sh`, `dev-sync.ps1`, `sync-md.sh`, `sync-md.ps1`
- Structural stubs: `memory/MEMORY.md`, `docs/adr/.gitkeep`, `skills/.gitkeep`
- `_examples/` subfolder (reference-only, excluded from new projects):
  - `adr/0001-example-decision.md` — filled-in ADR example
  - `agents/analyst-example.md` — domain analyst agent template
  - `memory/2026-01-15-example.md` — daily session log example
  - `skills/example-skill/SKILL.md` — reusable skill template

### Changed — `scripts/new-project.sh` + `new-project.ps1` (rewrite)
- Replaced ~270-line heredoc approach with `cp -r templates/. <project>/` + `perl -pi` placeholder substitution
- Script now has 6 logical steps: copy → remove `_examples/` → remove `.gitkeep` → substitute `[Project Name]` → chmod → git init
- Emits `_examples/` path in output so users know where to find extension templates

### Changed — CONSTITUTION.md §7 (simplified)
- Reduced from ~1,000 lines to ~70 lines — all template content moved to `templates/`
- §7 now contains: scaffolding commands, generated-files table, and a concise post-scaffold checklist
- Post-scaffold checklist reduced to essential placeholder checks only

### Changed — `.gitignore` (workspace)
- Added `!templates/` negation so the new folder is tracked by git

### Added — CONSTITUTION.md §7 (scaffold template completeness review)
- `scripts/audit.sh` + `audit.ps1` scaffold templates added to §7 (previously only copied from workspace, never documented)
- `scripts/dev-sync.ps1` scaffold template added alongside existing `dev-sync.sh` template (Windows parity)
- `scripts/sync-md.ps1` scaffold template added alongside existing `sync-md.sh` template (Windows parity)
- `.gemini/settings.json` scaffold template added (`{}`) — referenced in checklist but never templated
- **Extension templates** subsection added (created on demand, not at project init):
  - `docs/adr/NNNN-slug.md` — Architecture Decision Record (3-section: Context → Decision → Consequences)
  - `agents/<name>-analyst.md` — Analysis agent (read-only investigator; dispatched by PM in Phase 1–2)
  - `memory/YYYY-MM-DD.md` — Daily session log format

### Fixed — CONSTITUTION.md §7 (path bugs)
- `CLAUDE.md` scaffold: `../../CLAUDE.md` → `../CLAUDE.md` (project-root file is one level above workspace, not two)
- `GEMINI.md` scaffold: `../../GEMINI.md` → `../GEMINI.md`; `@../../CONSTITUTION.md` → `@../CONSTITUTION.md`
- Path notes for both templates corrected; clarified that `../../` is correct only for files inside subdirectories (`docs/`, `agents/`, etc.)
- Post-scaffold checklist: path check items updated to show correct `../` expectation with anti-pattern warning

### Fixed — `scripts/audit.sh` + `audit.ps1`
- CONSTITUTION.md check: now looks at both `./CONSTITUTION.md` and `../CONSTITUTION.md` — previously always failed when run from a project directory (CONSTITUTION.md lives at workspace root, one level up)

### Fixed — `scripts/new-project.sh`
- `dev-sync.sh` stub: corrected git workflow order — `git checkout -b "$BRANCH"` now runs before `git add -A && git commit` (previously committed to main before creating the PR branch)
- Generated `CLAUDE.md` / `GEMINI.md`: fixed path references (`../../` → `../`)
- Added `README.md` generation (was missing — checklist required it but script never created it)
- Added `.gemini/settings.json` generation (`{}`)
- `dev-sync.sh` memlog line: changed `echo "Session synced: $MSG"` to `echo "## Session — $MSG"` (matches §7 template)

### Fixed/Added — `scripts/new-project.ps1`
- Full rewrite for feature parity with `new-project.sh`:
  - Now generates all files: `docs/context.md` (full 10-section template), `AGENTS.md`, agent stubs (all 4), `CHANGELOG.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, `CLAUDE.md`, `.claude/settings.json`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `scripts/dev-sync.ps1`, `scripts/dev-sync.sh`, `scripts/sync-md.ps1`, `scripts/sync-md.sh`, `.githooks/pre-commit`, `.githooks/pre-push`
  - Copies `audit.sh` + `audit.ps1` from workspace
  - Emits actionable "Next steps" instructions on completion

### Fixed — CONSTITUTION.md §7 (5-round iterative review)
- `README.md` scaffold template: changed outer fence from ` ```markdown ` to `~~~~markdown` to fix nested code block rendering (same fix applied earlier to `docs/context.md` and `GEMINI.md`)
- `scripts/dev-sync.sh` scaffold: fixed git workflow order — `git checkout -b "$BRANCH"` now runs **before** `git add -A && git commit` to prevent commits landing on `main` before the PR branch is created
- `agents/pm.md` scaffold header: added ⚠️ stub-replacement warning (consistent with architect, code-writer, test-runner)
- Post-scaffold checklist: added `agents/pm.md — full template used (not a stub)` check (script stubs all 4 agents, not 3)
- §7 intro: expanded generated-files list to include all 4 agent files (`agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`)

## [2026-05-22]

### Added — CONSTITUTION.md

#### §1 Standard Folder Structure
- Added `.env.sample` and `.gitignore` to the standard folder structure tree
- Added rule: `AGENTS.md` is always created at project root as the canonical agent roster
- Added rule: `.env.sample` always committed; `.env` always in `.gitignore`

#### §5 Multi-Agent Architecture
- Split "Execution" group into distinct **Design** and **Execution** groups
  - **Design**: `architect.md` — architecture decisions, implementation planning, technical spec
  - **Execution**: `code-writer.md`, `test-runner.md` — code implementation and test verification

#### §6 Reusable Skills
- Updated Session skill load timing to reference `docs/context.md ## Session Start Skills`

#### §7 New Project Initialization — scaffold templates
- `docs/context.md` full scaffold template
  - Cross-platform Python venv activation (macOS/Linux + Windows)
  - `## Session Start Skills` section
  - `## Agents` table with all 4 core agents and Group column
  - `## Key Files` expanded with AGENTS.md, CHANGELOG.md, and all agent files
  - Path assumption note added to `## Coding Guidelines` link
  - Outer fence changed to `~~~~markdown` to fix nested code block rendering
- `AGENTS.md` scaffold template (new) — canonical agent index with Group column, dispatch guidance, maintenance rule
- `agents/pm.md` scaffold template (new) — YAML frontmatter + markdown body, 6-phase workflow, Agent Roster with Group column
- `agents/architect.md` scaffold template (new) — design-only agent; produces plans/ADRs; structured Implementation Plan output format
- `agents/code-writer.md` scaffold template (new) — implements approved plans only; per-file change report format
- `agents/test-runner.md` scaffold template (new) — QA agent; verification sequence; structured QA Report with READY/BLOCKED verdict
- `CLAUDE.md` project-level scaffold template (new) — Session Start, MCP Servers, Hooks Override, Model Selection Override
- `.claude/settings.json` scaffold template (new) — PostToolUse hook wiring for `scripts/audit.sh`
- `GEMINI.md` project-level scaffold template (new) — `@`-syntax context loading, model selection override
- `CHANGELOG.md` initial scaffold (new)
- `.env.sample` initial scaffold (new)
- `memory/MEMORY.md` initial scaffold (new)
- `.gitignore` initial scaffold covering Python, Node.js, OS artifacts (new)
- Post-scaffold checklist (new) — 10-item verification with cross-platform commands

#### §7 Design principle
- `docs/context.md` = single source of truth for ALL AI tools; project-level `CLAUDE.md`/`GEMINI.md` = platform-specific overrides only

---

*Last Updated: 2026-05-22*
