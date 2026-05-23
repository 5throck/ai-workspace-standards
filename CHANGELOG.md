# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **[2026-05-23]**: `.githooks/pre-commit`: Markdown date auto-bumper 및 CHANGELOG auto-dating 로직 추가. 커밋 시 스테이징된 `.md` 파일의 `Last Updated:` 날짜를 자동으로 갱신하며, `CHANGELOG.md`의 미기재 항목에 날짜를 주입.

### Removed
- **[2026-05-23]**: `README.md` / `README_ko.md`: 더 이상 필요 없는 수동 킥오프("Multi-Agent Kickoff") 안내 문구 제거 (post-checkout 훅을 통해 백그라운드에서 자동화됨).


### Added — Go/Rust/Elixir stack support + unknown-stack security agent
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Go (`go mod download` + `go-licenses`), Rust (`cargo fetch` + `cargo-license`), Elixir (`mix deps.get`) stacks added; unknown-stack detection block prints a security banner pointing users to `agents/stack-setup.md` and blocks accidental installs
- **[2026-05-23]**: `templates/agents/stack-setup.md` (NEW): 6-phase security-conscious agent for unrecognized stacks — Stack ID → Web Research → Mandatory Security Review (🟢/🟡/🔴 risk levels, HIGH requires `CONFIRM HIGH RISK`) → Present Plan → Execute via sub-agent → Persist to setup.sh/ps1
- **[2026-05-23]**: `templates/AGENTS.md`: `stack-setup` added to Agent Roster (🔴 Security/Setup group) and Subagent Roster dispatch table

### Added — Multi-stack setup automation with mandatory Python venv and cross-platform support
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Python venv now uses `uv venv` + `uv pip install` when uv is available, falling back to `python -m venv` + `pip`; `py_install`/`Py-Install` helper abstracts manager; multi-stack OS-aware setup with OSI license audit — Node.js (npm + `license-checker`), Python (uv/venv + `pip-licenses`), Ruby, .NET, Maven, Gradle, CMake/Makefile; `--skip-license-check` flag
- **[2026-05-23]**: `CONSTITUTION.md` §8.5: Open-Source Package Policy — prefer OSI-approved licenses, document non-OSS exceptions
- **[2026-05-23]**: `templates/docs/context.md`: Coding Guidelines §5 Open-Source Package Policy added
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: step 9 prints directory-change banner with exact `cd <path>` command


### Changed — Antigravity 2.0 / Gemini CLI session start config (workspace + templates + 4 sub-projects)

**`GEMINI.md` (workspace root)**
- **[2026-05-23]**: Tool mapping expanded with full operational guidance (`StartLine`, `EndLine`, `IsArtifact`, `MatchPerLine`, `NEVER use cd`)
- **[2026-05-23]**: ⚠️ Multi-replace offset safeguard added (bottom-to-top chunk ordering rule)
- **[2026-05-23]**: ⚠️ Grep 50-match cap safeguard added (partitioning remediation)
- **[2026-05-23]**: Planning Mode artifact specifications added (`implementation_plan.md`, `task.md`, `walkthrough.md` — brain/ paths + ArtifactType metadata)
- **[2026-05-23]**: Subagent orchestration added (`define_subagent`, `invoke_subagent` JSON examples, `send_message`, Reactive Wakeup)

**`CLAUDE.md` (workspace root)**
- **[2026-05-23]**: Session Start steps 2, 3, 5에 workspace root에서는 skip함을 명시하는 노트 추가 (`docs/context.md`, `AGENTS.md` 부재 설명)

**`templates/GEMINI.md`**
- **[2026-05-23]**: 동일한 Antigravity 2.0 설정 전면 적용 (safeguards, Planning Mode artifacts, Subagent 오케스트레이션)
- **[2026-05-23]**: 파일 하단의 중복 `### Session Start` 섹션 제거 (상단 `## Context Loading`과 동일 내용)

### Changed — `scripts/audit.sh` + `scripts/audit.ps1` (workspace root) + `templates/scripts/audit.sh` + `templates/scripts/audit.ps1`
- **[2026-05-23]**: CHANGELOG.md `[Unreleased]` 섹션 존재 여부 검사를 `docs/context.md` 조건 블록 밖으로 이동 — 워크스페이스 루트 및 신규 프로젝트 모두 동일하게 강제
- **[2026-05-23]**: `scripts/audit.ps1` (workspace root): `.sh`와 체크 8개로 동기화 — AGENTS.md, agents/, .env.sample, scripts parity 체크 누락분 추가

### Fixed
- **[2026-05-23]**: MD file consistency: unified Session Start Checklist across CLAUDE.md, GEMINI.md, and README.md (including templates/)
- **[2026-05-23]**: MD file consistency: updated subagent Phase 4 execution loop and `/sync` pipeline descriptions in `templates/` and root configurations

### Added
- **[2026-05-23]**: `scripts/sync-md.sh` and `scripts/sync-md.ps1` — missing files required by `dev-sync.sh` (workspace pipeline was broken without them)

### Fixed + Added — Global best practices audit (13 items)

**P1 — Bugs / Inconsistencies:**
- **[2026-05-23]**: `CONSTITUTION.md §5`: added `purple` to color palette (was missing after designer.md update)
- **[2026-05-23]**: `CONSTITUTION.md §5`: fixed JSON Input Contract — removed `//` comments (invalid JSON syntax)
- **[2026-05-23]**: `CONSTITUTION.md §1`: added `.github/` (workflows/, CODEOWNERS, pull_request_template.md) and `SECURITY.md` to standard folder structure
- **[2026-05-23]**: `CONSTITUTION.md §3`: added `perf:`, `ci:`, `style:`, `revert:` to Conventional Commits table (Conventional Commits v1.0 compliance)
- **[2026-05-23]**: `CONSTITUTION.md § Workspace`: unified Session Start checklist order (1→CONSTITUTION, 2→context.md, 3→AGENTS.md, 4→MEMORY.md, 5→skills) — was inconsistent with CLAUDE.md
- **[2026-05-23]**: `scripts/dev-sync.sh` + `dev-sync.ps1` (workspace): use `.github/pull_request_template.md` for PR body when present; fall back to `--fill`
- **[2026-05-23]**: `scripts/dev-sync.sh` (workspace): applied same perl escape fix and branch guard as templates

**P2 — Feature gaps:**
- **[2026-05-23]**: `CONSTITUTION.md §2`: added memory archiving policy (50-row threshold, 30-day retention, `memory/archive/` for older logs, `docs/history.md` for ADR summaries)
- **[2026-05-23]**: `templates/docs/context.md`: added `## Git / PR Workflow` section (present in all real projects but was missing from the template)
- **[2026-05-23]**: `.editorconfig` + `templates/.editorconfig`: new — charset/indent/EOL/trailing-whitespace rules for all editors (VS Code, JetBrains, Vim, etc.)

**P3 — Best practices:**
- **[2026-05-23]**: `templates/.github/CODEOWNERS`: new — automatic PR reviewer assignment template
- **[2026-05-23]**: `templates/.github/dependabot.yml`: new — dependency auto-update config template (pip/npm/github-actions stubs)
- **[2026-05-23]**: `templates/.github/workflows/ci.yml`: new — GitHub Actions CI stub (audit gate + Python/Node test job stubs)
- **[2026-05-23]**: `SECURITY.md` + `templates/SECURITY.md`: new — security vulnerability reporting policy (GitHub Advisory + response SLA)
- **[2026-05-23]**: `README.md`: updated Conventional Commits list to include new prefixes

### Fixed — Template system (14-item improvement pass)

**P1 — Bugs:**
- **[2026-05-23]**: `templates/scripts/dev-sync.sh`: perl changelog auto-insert now passes `$MSG` as a Perl variable (`BEGIN{$m=shift}`) — prevents breakage when commit message contains `/`, `&`, or `\`
- **[2026-05-23]**: `templates/scripts/dev-sync.ps1`: removed `-NoNewline` from `Set-Content` call — was silently stripping trailing newline from `CHANGELOG.md`
- **[2026-05-23]**: `templates/scripts/sync-md.sh` + `sync-md.ps1`: added deduplication guard — same-day entries no longer appended twice to `MEMORY.md`

**P2 — Feature gaps:**
- **[2026-05-23]**: `templates/scripts/audit.sh` + `audit.ps1`: strengthened from 4 → 8 checks (added: AGENTS.md existence, agents/ non-empty, .env.sample existence, scripts .sh/.ps1 parity)
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: post-scaffold audit runs automatically; added initial commit guidance; `.ps1` files now included in `git update-index --chmod=+x`
- **[2026-05-23]**: `templates/README.md`: added `## Contributing` and `## License` placeholder sections; added CLAUDE.md + GEMINI.md to Documentation links
- **[2026-05-23]**: `templates/docs/context.md`: converted Tech Stack from bullet list to table (better AI parseability; consistent with project examples)
- **[2026-05-23]**: `templates/GEMINI.md`: Session Start section now has actual `@`-syntax loading instructions (was comment-only)

**P3 — Quality / best practices:**
- **[2026-05-23]**: `templates/.github/pull_request_template.md`: new file — PR body template for `gh pr create --fill`
- **[2026-05-23]**: `templates/scripts/dev-sync.sh` + `dev-sync.ps1`: added branch guard — if already on a PR branch, commits in place instead of creating a new branch
- **[2026-05-23]**: `templates/memory/MEMORY.md`: added explanatory header distinguishing index (MEMORY.md) from daily logs (YYYY-MM-DD.md)
- **[2026-05-23]**: `templates/agents/designer.md`: changed `color: magenta` → `color: purple` (was conflicting with analyst-example.md)
- **[2026-05-23]**: `scripts/audit.sh` (workspace): synced with template — now runs all 8 checks

### Fixed — MD file comparison (workspace + templates)
- **[2026-05-23]**: `templates/agents/architect.md`: Unicode corruption on line 60 — `Context ?? Decision` → `Context → Decision` (arrow was mangled to replacement characters)
- **[2026-05-23]**: `templates/agents/pm.md`: Phase 6 Finalization — added Co-Authored-By commit signature requirement
- **[2026-05-23]**: `templates/agents/code-writer.md`: added rule 5 — update `CHANGELOG.md [Unreleased]` after every change
- **[2026-05-23]**: `templates/CLAUDE.md`: added `### Custom Command Error Recovery` section (error handling for `/sync` failures, hook bypass prohibition)
- **[2026-05-23]**: `templates/GEMINI.md`: added `/new-project` and `/post-write` rows to command emulation table
- **[2026-05-23]**: `templates/CHANGELOG.md`: added `---` separator and Semantic Versioning link (parity with workspace format)
- **[2026-05-23]**: `CLAUDE.md` (workspace): added `## Session Start` checklist and doc intent statement at top
- **[2026-05-23]**: `GEMINI.md` (workspace): added `### 3. Response Language` section (Korean/English split rule)

### Changed
- **[2026-05-23]**: Improve `templates/AGENTS.md` with AI disclaimer, dispatch protocol, phase workflow, role boundary matrix, skills table, and expanded maintenance rule

### Fixed
- **[2026-05-23]**: `CONSTITUTION.md §7` — Windows `.\scripts\new-project.ps1` command had a line-break bug rendering it as `.\scripts` + `ew-project.ps1`
- **[2026-05-23]**: `scripts/audit.sh` — remove unused `PASS=0` / `FAIL=1` dead code variables
- **[2026-05-23]**: `CONSTITUTION.md §1` — add workspace-root exception note to AGENTS.md rule
- **[2026-05-23]**: Improve `templates/CLAUDE.md` with doc intent, CLI vs Desktop table, behavioral rules section, git hooks install, Co-Authored-By, and settings.json clarification
- **[2026-05-23]**: Improve `templates/GEMINI.md` with doc intent, tool name mapping table, git commit policy, command emulation guide, and `.claude/` coexistence rules

### Fixed — Missing slash commands / Skill registrations
- **[2026-05-23]**: `.claude/commands/memlog.md` 추가 (workspace + templates) — `/memlog` Skill 등록
- **[2026-05-23]**: `.claude/commands/new-task.md` 추가 (workspace + templates) — `/new-task` Skill 등록
- **[2026-05-23]**: `.claude/commands/new-project.md` 추가 (workspace only) — `/new-project` Skill 등록
- **[2026-05-23]**: `CLAUDE.md §2`: 커맨드 테이블 정확한 파일명 반영 및 Skill 등록 원리 설명 추가
- **[2026-05-23]**: `templates/CLAUDE.md`: Slash Commands 섹션 추가 (커맨드→Skill 자동 등록 원리 명시)
- **[2026-05-23]**: `templates/docs/context.md`: Development Workflow에 `/memlog` 추가, Slash Commands 테이블 추가

### Changed — License
- **[2026-05-23]**: MIT → AGPL-3.0

### Fixed — Scaffold guideline consistency (4th review — final)
- **[2026-05-23]**: `CONSTITUTION.md §5`: Phase 3 Governance Workflow에 Designer 병렬 dispatch 명시

### Fixed — Scaffold guideline consistency (3rd 5-round review)
- **[2026-05-23]**: `templates/agents/pm.md`: Governance Workflow Phase 3에 designer parallel dispatch 명시
- **[2026-05-23]**: `CONSTITUTION.md §Workspace`: Session Start 체크리스트 순서 정정 (3↔4 교환 — MEMORY.md 먼저, skills 후)
- **[2026-05-23]**: `CONSTITUTION.md §3`: /sync 파이프라인 순서를 실제 dev-sync.sh와 일치시킴 (memlog→MEMORY.md→CHANGELOG→audit→branch→commit→push→PR)

### Fixed — Scaffold guideline consistency (2nd 5-round review)
- **[2026-05-23]**: `scripts/new-project.ps1`: git update-index를 git init 이후로 이동 (dead code 제거)
- **[2026-05-23]**: `templates/CLAUDE.md`: Hooks Override 주석 정정 (hook 비활성 상태 명확화), Step 0 표현 개선, `model: inherit` 상속 기본값 명시
- **[2026-05-23]**: `templates/GEMINI.md`: 이미 수정됨 (이전 라운드)
- **[2026-05-23]**: `templates/docs/context.md`: CONSTITUTION.md 링크 경로 수정 (`../` → `../../`)
- **[2026-05-23]**: `templates/AGENTS.md`: `_examples` 상대 경로 수정 (`../../templates/` → `../templates/`)
- **[2026-05-23]**: `CONSTITUTION.md §7`: "pm.md + 3 others" → "+ 4 others", `.claude/settings.json` 설명 정정
- **[2026-05-23]**: `GEMINI.md §3`: Context Loading에 `@AGENTS.md` 추가 (workspace 루트)

### Fixed — Scaffold guideline consistency (5-round review)
- **[2026-05-23]**: `templates/agents/pm.md`: Agent Roster에 `designer.md` 누락 추가
- **[2026-05-23]**: `templates/CLAUDE.md`: Session Start 섹션 구체화 (4단계 체크리스트)
- **[2026-05-23]**: `templates/GEMINI.md`: Context Loading에 `@AGENTS.md` 추가
- **[2026-05-23]**: `templates/agents/architect.md`: ADR 예시 경로 명확화 (workspace 상대경로)
- **[2026-05-23]**: `templates/AGENTS.md`: `_examples` 참조 경로 명확화 (workspace 상대경로)
- **[2026-05-23]**: `templates/docs/context.md`: Architecture placeholder 구체화, Key Files에 sync-md.sh 추가, Session Start Skills 작성 방법 안내, Development Workflow hook 상태 정정
- **[2026-05-23]**: `scripts/new-project.sh`: Perl 치환 특수문자 이스케이프(`\Q...\E`), Next steps에 test-runner 명령 안내 추가
- **[2026-05-23]**: `scripts/new-project.ps1`: `.sample` 중복 필터 제거, WSL용 `chmod +x` 패리티(git update-index) 추가, Next steps에 test-runner 명령 안내 추가

### Fixed — Project consistency (README, CLAUDE.md, CONSTITUTION.md)
- **[2026-05-23]**: `CLAUDE.md §1`: PostToolUse hook이 비활성화 상태임을 명확히 표기 (`.claude/settings.json`은 `{}`)
- **[2026-05-23]**: `README.md`: 4-role → 5-role agent 모델 수정 (Designer 추가), Repository Structure에 `templates/` 추가, Two Philosophies 설명에 Designer 포함, Multi-Agent Workflow 설명 업데이트
- **[2026-05-23]**: `CONSTITUTION.md §7`: Post-scaffold checklist agent 수 4 → 5 수정, `.\scriptsudit.ps1` 오타 수정 (`.\scripts\audit.ps1`)
- **[2026-05-23]**: `scripts/dev-sync.ps1`: 워크스페이스 루트에 누락된 파일 추가 (Script Parity 규칙 준수)

### Changed — workspace `.githooks/pre-commit` + `.claude/settings.json` + `.claude/commands/`
- **[2026-05-23]**: Applied same changes as templates/ to the workspace root itself
- **[2026-05-23]**: `.githooks/pre-commit`: conditional audit (memory/ exempt)
- **[2026-05-23]**: `.claude/settings.json`: PostToolUse hook 제거
- **[2026-05-23]**: `.claude/commands/changelog.md` + `sync.md`: 신규 추가
- **[2026-05-23]**: `scripts/dev-sync.sh`: 신규 추가 (memlog → sync-md → changelog → audit → commit)

### Changed — `templates/.githooks/pre-commit`
- **[2026-05-23]**: Smart conditional audit: skips `audit.sh` when only `memory/` files are staged (session logs, daily entries)
- **[2026-05-23]**: Runs audit only when structural files outside `memory/` are staged — prevents spurious failures on log-only commits

### Changed — `templates/.claude/settings.json`
- **[2026-05-23]**: Removed PostToolUse hook — audit no longer fires on every Write/Edit
- **[2026-05-23]**: Audit is now enforced exclusively via pre-commit hook and `dev-sync.sh` pipeline

### Changed — `templates/scripts/dev-sync.sh` + `dev-sync.ps1`
- **[2026-05-23]**: Reordered pipeline: `memlog → sync-md → changelog → audit → commit → PR`
  (was: `audit → memlog → sync-md → commit`)
- **[2026-05-23]**: Added auto-changelog step: if `[Unreleased]` section has no entries, inserts the commit message automatically
- **[2026-05-23]**: Audit now runs after memory and changelog are updated — logically correct order

### Added — `templates/.claude/commands/changelog.md`
- **[2026-05-23]**: `/changelog "description"` command: adds a typed entry (`### Added/Changed/Fixed/Removed`) to `CHANGELOG.md [Unreleased]`

### Added — `templates/.claude/commands/sync.md`
- **[2026-05-23]**: `/sync "feat: ..."` command: wraps `bash scripts/dev-sync.sh` with pipeline description

### Added — `templates/agents/designer.md` (new)
- **[2026-05-23]**: UI/UX design agent for Phase 3 — Design group
- **[2026-05-23]**: Produces wireframes (text-based), component specs, design tokens, and accessibility checklists
- **[2026-05-23]**: Output format: Design Specification with Screen Overview, Component List, Interaction Spec, Design Tokens, Accessibility Notes
- **[2026-05-23]**: Added to `templates/AGENTS.md` and `templates/docs/context.md` agent tables
- **[2026-05-23]**: Added to CONSTITUTION.md §5 Role groups table

### Added — `templates/` folder (new)
- **[2026-05-23]**: Created `templates/` directory mirroring the exact structure of a new project — the folder itself is the authoritative scaffold reference
- **[2026-05-23]**: All project files: `docs/context.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CHANGELOG.md`, `.env.sample`, `.gitignore`
- **[2026-05-23]**: Config files: `.claude/settings.json`, `.gemini/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`
- **[2026-05-23]**: Agent definitions: `agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`
- **[2026-05-23]**: Scripts (cross-platform): `scripts/audit.sh`, `audit.ps1`, `dev-sync.sh`, `dev-sync.ps1`, `sync-md.sh`, `sync-md.ps1`
- **[2026-05-23]**: Structural stubs: `memory/MEMORY.md`, `docs/adr/.gitkeep`, `skills/.gitkeep`
- **[2026-05-23]**: `_examples/` subfolder (reference-only, excluded from new projects):
  - **[2026-05-23]**: `adr/0001-example-decision.md` — filled-in ADR example
  - **[2026-05-23]**: `agents/analyst-example.md` — domain analyst agent template
  - **[2026-05-23]**: `memory/2026-01-15-example.md` — daily session log example
  - **[2026-05-23]**: `skills/example-skill/SKILL.md` — reusable skill template

### Changed — `scripts/new-project.sh` + `new-project.ps1` (rewrite)
- **[2026-05-23]**: Replaced ~270-line heredoc approach with `cp -r templates/. <project>/` + `perl -pi` placeholder substitution
- **[2026-05-23]**: Script now has 6 logical steps: copy → remove `_examples/` → remove `.gitkeep` → substitute `[Project Name]` → chmod → git init
- **[2026-05-23]**: Emits `_examples/` path in output so users know where to find extension templates

### Changed — CONSTITUTION.md §7 (simplified)
- **[2026-05-23]**: Reduced from ~1,000 lines to ~70 lines — all template content moved to `templates/`
- **[2026-05-23]**: §7 now contains: scaffolding commands, generated-files table, and a concise post-scaffold checklist
- **[2026-05-23]**: Post-scaffold checklist reduced to essential placeholder checks only

### Changed — `.gitignore` (workspace)
- **[2026-05-23]**: Added `!templates/` negation so the new folder is tracked by git

### Added — CONSTITUTION.md §7 (scaffold template completeness review)
- **[2026-05-23]**: `scripts/audit.sh` + `audit.ps1` scaffold templates added to §7 (previously only copied from workspace, never documented)
- **[2026-05-23]**: `scripts/dev-sync.ps1` scaffold template added alongside existing `dev-sync.sh` template (Windows parity)
- **[2026-05-23]**: `scripts/sync-md.ps1` scaffold template added alongside existing `sync-md.sh` template (Windows parity)
- **[2026-05-23]**: `.gemini/settings.json` scaffold template added (`{}`) — referenced in checklist but never templated
- **[2026-05-23]**: **Extension templates** subsection added (created on demand, not at project init):
  - **[2026-05-23]**: `docs/adr/NNNN-slug.md` — Architecture Decision Record (3-section: Context → Decision → Consequences)
  - **[2026-05-23]**: `agents/<name>-analyst.md` — Analysis agent (read-only investigator; dispatched by PM in Phase 1–2)
  - **[2026-05-23]**: `memory/YYYY-MM-DD.md` — Daily session log format

### Fixed — CONSTITUTION.md §7 (path bugs)
- **[2026-05-23]**: `CLAUDE.md` scaffold: `../../CLAUDE.md` → `../CLAUDE.md` (project-root file is one level above workspace, not two)
- **[2026-05-23]**: `GEMINI.md` scaffold: `../../GEMINI.md` → `../GEMINI.md`; `@../../CONSTITUTION.md` → `@../CONSTITUTION.md`
- **[2026-05-23]**: Path notes for both templates corrected; clarified that `../../` is correct only for files inside subdirectories (`docs/`, `agents/`, etc.)
- **[2026-05-23]**: Post-scaffold checklist: path check items updated to show correct `../` expectation with anti-pattern warning

### Fixed — `scripts/audit.sh` + `audit.ps1`
- **[2026-05-23]**: CONSTITUTION.md check: now looks at both `./CONSTITUTION.md` and `../CONSTITUTION.md` — previously always failed when run from a project directory (CONSTITUTION.md lives at workspace root, one level up)

### Fixed — `scripts/new-project.sh`
- **[2026-05-23]**: `dev-sync.sh` stub: corrected git workflow order — `git checkout -b "$BRANCH"` now runs before `git add -A && git commit` (previously committed to main before creating the PR branch)
- **[2026-05-23]**: Generated `CLAUDE.md` / `GEMINI.md`: fixed path references (`../../` → `../`)
- **[2026-05-23]**: Added `README.md` generation (was missing — checklist required it but script never created it)
- **[2026-05-23]**: Added `.gemini/settings.json` generation (`{}`)
- **[2026-05-23]**: `dev-sync.sh` memlog line: changed `echo "Session synced: $MSG"` to `echo "## Session — $MSG"` (matches §7 template)

### Fixed/Added — `scripts/new-project.ps1`
- **[2026-05-23]**: Full rewrite for feature parity with `new-project.sh`:
  - **[2026-05-23]**: Now generates all files: `docs/context.md` (full 10-section template), `AGENTS.md`, agent stubs (all 4), `CHANGELOG.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, `CLAUDE.md`, `.claude/settings.json`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `scripts/dev-sync.ps1`, `scripts/dev-sync.sh`, `scripts/sync-md.ps1`, `scripts/sync-md.sh`, `.githooks/pre-commit`, `.githooks/pre-push`
  - **[2026-05-23]**: Copies `audit.sh` + `audit.ps1` from workspace
  - **[2026-05-23]**: Emits actionable "Next steps" instructions on completion

### Fixed — CONSTITUTION.md §7 (5-round iterative review)
- **[2026-05-23]**: `README.md` scaffold template: changed outer fence from ` ```markdown ` to `~~~~markdown` to fix nested code block rendering (same fix applied earlier to `docs/context.md` and `GEMINI.md`)
- **[2026-05-23]**: `scripts/dev-sync.sh` scaffold: fixed git workflow order — `git checkout -b "$BRANCH"` now runs **before** `git add -A && git commit` to prevent commits landing on `main` before the PR branch is created
- **[2026-05-23]**: `agents/pm.md` scaffold header: added ⚠️ stub-replacement warning (consistent with architect, code-writer, test-runner)
- **[2026-05-23]**: Post-scaffold checklist: added `agents/pm.md — full template used (not a stub)` check (script stubs all 4 agents, not 3)
- **[2026-05-23]**: §7 intro: expanded generated-files list to include all 4 agent files (`agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`)

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

*Last Updated: 2026-05-23*
