# Project Constitution

These principles apply to every project under the workspace root (`C:\git` on Windows, or `~/git` on macOS/Linux). They define the **design standard** — implementation is handled per-project via each project's own scripts and settings.

> **📋 Every AI session MUST complete this checklist before touching any code:**
> - [ ] Read §1 — Folder Structure (understand where files live)
> - [ ] Read §3 — PR Workflow (understand commit/branch/PR rules)
> - [ ] Read §8 — Coding Behavior Guidelines (understand behavioral constraints)
> - [ ] Read §2 — Memory System (before ending any session that produced changes)
> - [ ] Read §5 — Multi-Agent Architecture (if spawning agents)
> - [ ] Read §4 — i18n (if the project has a user-facing UI)
> - [ ] Read §7 — New Project Init (when creating a new project)

**Sections:** Workspace · 1. Folder Structure · 2. Memory System · 3. PR Workflow · 4. i18n · 5. Agents · 6. Skills · 7. New Project Init · 8. Coding Behavior Guidelines

---

### Workspace Overview

> **Environment-specific path** — this file is configured for the current machine. If you move to a different OS or clone to a new location, update the workspace root in the platform config files (`CLAUDE.md`, `GEMINI.md`).
>
> | OS | Workspace root |
> |----|---------------|
> | Windows (current) | `C:\git` |
> | macOS / Linux | `~/git` or `/home/<user>/git` |

This workspace contains multiple independent projects. Each subdirectory is a separate project/repository. Run `ls` (or `dir` on Windows) at the workspace root to see the current list — do not rely on a hardcoded list.

Common project types:
- MCP (Model Context Protocol) servers and tools
- Python-based CLI applications
- Web applications and demos

Each project directory contains its own `docs/context.md` as the authoritative description.

#### Working with Projects

Navigate to the project directory before starting work. Each project has its own build system (`package.json`, `pyproject.toml`, etc.), dependencies, testing framework, and development workflow (`scripts/dev-sync.sh`).

**Session start checklist** (run in order at the beginning of every session):
0. **Forced Hook Activation**: Ensure automated PR-enforcement hooks are bound. Execute:
   ```bash
   git config core.hooksPath .githooks
   ```
1. **Read this file** (CONSTITUTION.md) — you are reading it now. Complete the section checklist at the top before proceeding.
2. Read the project's `docs/context.md` — single source of truth for purpose, tech stack, and architecture.
3. Read `AGENTS.md` — canonical agent roster.
4. Check `memory/MEMORY.md` — recent session history (skip if file does not exist).
5. Load any skills listed under `## Session Start Skills` in `docs/context.md`.

If `docs/context.md` does not exist (legacy or external project), fall back to `README.md` and any local `CLAUDE.md` or `GEMINI.md` in the project root.

#### General Development Notes

- Most projects use Python or JavaScript/TypeScript.
- Python projects use virtual environments (`.venv/`).
- Node.js projects use npm/yarn/pnpm for package management.
- Always check the project's `docs/context.md`, `CLAUDE.md`, and `GEMINI.md` for specific instructions.

---

### 1. Standard Folder Structure

Every project follows this layout. Omit folders that don't apply to the project type.

```
<project-root>/
├── src/          # Source code
├── docs/         # Design docs, architecture, ADRs
│   ├── context.md    # Project knowledge — shared by all AI tools (required)
│   └── adr/          # Architecture Decision Records (ADRs)
│       └── NNNN-slug.md  # e.g., 0001-use-mcp-server.md
├── scripts/      # Automation scripts (.sh + .ps1 pairs, cross-platform)
├── locales/      # i18n translation files (UI projects only)
├── memory/       # session logs (shared by all AI tools)
│   ├── MEMORY.md     # Index of all log entries
│   └── YYYY-MM-DD.md # Daily development log
├── agents/       # Role-based agent definitions
│   └── pm.md         # PM orchestrator (always required)
├── skills/       # Reusable workflow skills
│   └── <name>/
│       └── SKILL.md
├── .github/              # GitHub-specific files
│   ├── workflows/        # GitHub Actions CI/CD pipelines
│   ├── CODEOWNERS        # Automatic PR reviewer assignment
│   └── pull_request_template.md  # Default PR body template
├── .gemini/              # Gemini CLI configuration
│   ├── settings.json
│   └── settings.local.json
├── .claude/              # Claude Code configuration
│   ├── commands/
│   ├── settings.json
│   └── settings.local.json
├── AGENTS.md             # Agent index (shared by all AI tools; canonical source)
├── CHANGELOG.md          # User-visible change history (required by audit.sh)
├── CLAUDE.md             # Claude Code config
├── GEMINI.md             # Gemini CLI config
├── SECURITY.md           # Security vulnerability reporting policy
└── .env.sample           # Required env variable template (never commit .env)
```

> **Note**: `.gemini/` and `.claude/` both exist in every project — they coexist and each AI tool reads only its own directory.

**Rules:**
- **Coding Guidelines in context.md**: `docs/context.md` must contain a `## Coding Guidelines` section with the mandatory template from §7. The `audit.sh` / `audit.ps1` script must verify this heading exists and abort with a non-zero exit code if it is missing.
- **Cross-Platform Script Parity**: `scripts/` must always provide both `.sh` (bash) and `.ps1` (PowerShell) pairs. Both files must accept the exact same positional parameters/flags, perform identical side-effects, and return unified exit codes (`0` for success, non-zero `>0` for error).
- **ADR Format Standard**: ADRs in `docs/adr/` must follow sequential 4-digit prefix naming (`0001-slug.md`). Every ADR must consist of three mandatory sections:
  1. **Context**: What is the problem or architectural background context?
  2. **Decision**: What choice was made and why?
  3. **Consequences**: What are the trade-offs, side-effects, and future implications of this decision?
- **Execution Paths**: Script references within code or documentation must use relative platform-agnostic formatting or supply examples for both terminal types.
- **Shared Memory**: `memory/` is strictly shared across all AI tools — not for general application data or temporary local logs.
- **Locales**: `locales/` uses flat JSON files matching ISO language codes (`ko.json`, `en.json`, etc.).
- **Orchestration**: `agents/pm.md` is always created — even for single-agent or simple projects.
- **Agent Index**: `AGENTS.md` is always created at the project root — it is the canonical agent roster shared by all AI tools. Keep it in sync with `docs/context.md ## Agents`. *(Exception: the workspace root itself — `C:\git\` — does not require an `AGENTS.md` because it contains no project code; each sub-project carries its own.)*
- **Secrets**: `.env.sample` is always committed; `.env` is always in `.gitignore`.

---

### 2. Memory System

Every session that produces a meaningful change must be logged.

**`memory/MEMORY.md`** — index file, updated by `dev-sync` scripts automatically:
```markdown
| Date | Summary |
|------|---------|
| [2026-05-21](2026-05-21.md) | feat: add pricing formula |
```

**`memory/YYYY-MM-DD.md`** — daily log, written by the developer (via `/memlog` in Claude Code · manually in Gemini CLI):
```markdown
## <Feature / Module Name>
- **Files**: src/...
- **Purpose**: one-line summary
- **Decisions**: key technical choices
- **Issues**: symptom → root cause → resolution
```

**Rules:**
- Log files are written in **English**.
- Append to today's file — never overwrite.
- Run `/memlog` (Claude Code) or manually append to `memory/YYYY-MM-DD.md` (Gemini CLI) before running `sync` to ensure the log is recorded prior to commit.

**Archiving policy:**
- When `memory/MEMORY.md` exceeds ~50 rows or `docs/context.md` becomes difficult to navigate, archive older content:
  - Move completed ADR summaries and resolved decisions to `docs/history.md`
  - Retain the last 30 days in `memory/MEMORY.md`; move older daily logs to `memory/archive/`
  - Never delete logs — archive them

---

### 3. GitHub PR Workflow

**All changes must reach `main` via a Pull Request — never by direct push.**

```
Edit code
  ↓  Post-Write Verification (Manually run audit scripts in Gemini/Desktop app, automated in CLI hooks)

/changelog "added|changed|fixed|removed <description>" (optional)
  ↓  Entry added to CHANGELOG.md under [Unreleased]

/sync "feat: description" (or running dev-sync scripts directly)
  ↓
  1. memory/YYYY-MM-DD.md     — append session log entry
  2. MEMORY.md index         — update entry
  3. CHANGELOG.md            — auto-insert commit message if [Unreleased] is empty
  4. Audit script execution  — abort on failure (includes CHANGELOG.md existence check)
  5. git checkout -b pr/<date>-<slug>
  6. git add -A && git commit
  7. git push + gh pr create ➔ GitHub PR opened (Direct push blocked by local hooks)
```

**Rules:**
- Each project must have `scripts/dev-sync.sh` and `scripts/dev-sync.ps1` adhering to the script parity rule.
- **Mandatory English Git & PR Artifacts**: All Git and GitHub-related artifacts (including commit messages, pull request titles, pull request descriptions/bodies, branch names, and code review comments) **MUST** be written entirely in **English**, regardless of the developer's native or session conversation language. Always double-check before pushing.
- **Conventional Commits Standard**: All commits in this workspace must adhere to the Conventional Commits specification:
  
  | Prefix | When to use |
  | :--- | :--- |
  | `feat:` | New feature |
  | `fix:` | Bug fix |
  | `docs:` | Documentation only |
  | `refactor:` | Code change with no new feature or fix |
  | `chore:` | Tooling, build, configurations |
  | `test:` | Adding or modifying tests |
  | `perf:` | Performance improvement (no feature/fix) |
  | `ci:` | CI/CD pipeline changes |
  | `style:` | Formatting only (no logic change) |
  | `revert:` | Revert a previous commit |

- **Branch Naming Standard**: Active development branches must follow the strict pattern: `pr/<YYYYMMDD-HHmmss>-<slug>` (automatically formatted and switched by `dev-sync` scripts).
- **GitHub PR Requirements**: The GitHub CLI (`gh`) must be installed and authenticated (`gh auth login`) globally to automate PR creation.
- **Forced Local Git Hooks**: Before triggering commits or PR workflows, all active sessions must ensure Git configuration points to local hooks:
  ```bash
  git config core.hooksPath .githooks
  ```
  This binds local automated hooks (like `pre-push` blocking direct `main` push, and `pre-commit` validating changelog compliance) forcibly.
- Workflow scripts must avoid interactive prompts to prevent terminal hangs during automated agent runs.
- `/changelog` is **optional** — run it before syncing when your change needs a user-visible entry in `CHANGELOG.md`. Skip it for internal refactors, formatting, or tooling changes.
- Project-specific PR settings live in `.gemini/settings.json` or `.claude/settings.json` — kept version-controlled and shared with the team.

---

### 4. Internationalization (i18n)

Apply **only to projects with a user-facing UI** (web app, desktop app, CLI with user messages). Pure API servers and libraries are exempt.

**Standard: 16 languages** (expand as needed):

| Code | Language | Code | Language |
|------|----------|------|----------|
| `en` | English (default) | `ko` | Korean |
| `ja` | Japanese | `zh-CN` | Chinese Simplified |
| `zh-TW` | Chinese Traditional | `de` | German |
| `es` | Spanish | `fr` | French |
| `pt` | Portuguese | `vi` | Vietnamese |
| `ms` | Malay | `id` | Indonesian |
| `th` | Thai | `ru` | Russian |
| `it` | Italian | `ar` | Arabic (RTL) |

> **Arabic (ar) RTL note:** Arabic is right-to-left. If rendering in a browser, set `dir="rtl"` on the root element or apply `direction: rtl` in CSS when `ar` is the active locale.

**Implementation pattern:**
- Translation files: `locales/<lang-code>.json` (flat key-value)
- Language detection priority: `APP_LOCALE` env var → OS locale (`LANG`/`LC_ALL`) → `en` fallback
- i18n module: `i18n.py` (Python) or `i18n.ts` (TypeScript)
- All keys must exist in `en.json` as the source of truth

```json
// locales/en.json — example
{
  "app.title": "My App",
  "error.not_found": "Resource not found: {name}",
  "button.submit": "Submit"
}
```

---

### 5. Multi-Agent Architecture

Every project uses a role-based agent structure. Agents are defined as markdown files in `agents/`.

#### Agent file format (standard frontmatter)

```yaml
---
name: <agent-name>
model: inherit
color: yellow | blue | green | red | magenta | cyan | purple  # Claude Code only
description: 'One-sentence role. Use when: "...", "...", "..."'
examples:
  - user: "..."
    assistant: "..."
---
```

The `description` field is how the AI tool selects the right agent — always write **when to use it** explicitly.

#### Role groups

| Group | Responsibility | Core agents |
|-------|---------------|-------------|
| Orchestration | Workflow management, parallel dispatch, quality gates | `pm.md` |
| Analysis | Read-only investigation, codebase exploration, data gathering | `*-analyst.md` |
| Design | Architecture decisions, implementation planning, technical spec | `architect.md` |
| Design | UI/UX specifications, wireframes, component and interaction design | `designer.md` |
| Execution | Code implementation and automated test verification | `code-writer.md`, `test-runner.md` |

#### PM orchestrator rules

- When no specific orchestrator is assigned, **always create `agents/pm.md`** — PM owns the entire workflow.
- PM dispatches independent tasks as **parallel agents in a single message** (never sequential).
- Agents communicate via **structured JSON Input Contracts**:

```json
{
  "task": "<task description>",
  "phase": "<one of: Triage | Analysis | Design | Implementation | QA | Finalization>",
  "context_file": "agents/<name>.md",
  "input": {}
}
```

- **Tool Abstraction**: The PM spawns child agent processes using the host tool's native subagent dispatching mechanism. The underlying tool handles process lifecycle and workspace sandboxing.

#### PM governance workflow (6 phases)

```
Phase 1 — Triage
  PM classifies the request and dispatches read-only agents in parallel (single message)

Phase 2 — Analysis
  Agents return findings → PM synthesizes into requirements + acceptance criteria

Phase 3 — Design
  Architect designs the implementation plan + ADR
  Designer produces UI/UX specs (parallel with Architect, if task has UI/UX surface)
  PM obtains explicit user approval before proceeding

Phase 4 — Implementation
  code-writer implements (serial) → test-runner verifies
  Post-write quality gate runs after every change

Phase 5 — QA
  All acceptance criteria verified
  Quality gate: audit script + tests pass

Phase 6 — Finalization
  PM runs memlog → sync scripts
  PR created and handed to user for review
```

---

### 6. Reusable Skills

Reusable workflow knowledge is defined as skills in `skills/`.

#### Folder structure

```
skills/
└── <skill-name>/     # Directory per skill — NOT a flat file
    └── SKILL.md      # Skill body
```

> **Important:** `skills/my-skill.md` (flat file) is NOT recognized as a skill by any AI tool. Always use `skills/my-skill/SKILL.md` (directory + file).

#### Skill file format (standard frontmatter)

```yaml
---
name: Skill Display Name
description: >
  Describe exactly when this skill should be loaded.
  The AI tool uses this to decide whether to auto-trigger it.
version: 1.0.0
---
```

#### Skill body structure

```markdown
## Overview
One paragraph — what this skill enables and when to use it.

## <workflow-name>

**Purpose**: What this workflow accomplishes.
**Trigger**: When to apply it.

**Steps**:
1. Step one
2. Step two
3. Step three

**Output**: What the agent produces at the end.
```

#### Skill types

| Type | Description | Load timing |
|------|-------------|-------------|
| Session skill | Always-needed workflow for this project | Listed under `## Session Start Skills` in `docs/context.md` — loaded at session start by all AI tools |
| On-demand skill | Specialized knowledge for specific tasks | Auto-triggered by `description` matching |

---

### 7. New Project Initialization

**Every new project starts with a project scaffolding command:**

- **Claude Code**: `/new-project` (slash command in `.claude/commands/`)
- **macOS / Linux**: `bash scripts/new-project.sh "<project-name>"`
- **Windows**: `.\scripts\new-project.ps1 "<project-name>"`

The script copies [`templates/`](templates/) directly into the new project directory,
substitutes the `[Project Name]` placeholder in all text files, removes `_examples/`,
and initializes git with hooks active.

#### What gets generated

The [`templates/`](templates/) folder mirrors the exact structure of a new project —
browse it directly to see what every file should look like. All scaffold templates
live there as **real, editable files** (not embedded strings).

| Generated file | Purpose | Action needed |
|----------------|---------|---------------|
| `docs/context.md` | Single source of truth — 10 required sections | Fill in `[...]` placeholders |
| `AGENTS.md` | Canonical agent index | Ready to use |
| `agents/pm.md` + 4 others | Role definitions (pm, architect, designer, code-writer, test-runner) | `[Project Name]` already substituted |
| `CLAUDE.md` / `GEMINI.md` | Platform-specific overrides | Add project-specific settings if needed |
| `.claude/settings.json` | Hooks config (disabled by default — `{}`) | Enable PostToolUse if needed |
| `.gemini/settings.json` | Gemini project settings | Ready to use (add settings as needed) |
| `scripts/` | audit, dev-sync, sync-md (.sh + .ps1) | Ready to use |
| `.githooks/` | pre-commit (audit gate) + pre-push (block main) | Ready to use |
| `CHANGELOG.md` | User-visible change history | Ready to use |
| `README.md` | GitHub landing page | Fill in project description |
| `.env.sample` | Environment variable template | Add required env keys |
| `.gitignore` | Standard ignore rules | Ready to use |
| `memory/MEMORY.md` | Session log index | Ready to use |

> **Extension templates** — ADR, analyst agent, skill, and daily log formats are **not**
> generated at project init. Find ready-to-copy examples in [`templates/_examples/`](templates/_examples/).

#### Post-scaffold checklist

```
□ docs/context.md
    □ [Project Name] on line 1 replaced with actual project name
    □ ## Tech Stack filled in
    □ ## Architecture src/ map filled in
    □ [KEY_NAME] env vars filled in (or "N/A — no env vars required")
    □ All 10 sections present:
        macOS/Linux : grep "^## " docs/context.md
        Windows     : Select-String -Path docs/context.md -Pattern "^## "

□ agents/ — [Project Name] substituted in all 5 ## Role sections
    □ agents/pm.md          □ agents/architect.md   □ agents/designer.md
    □ agents/code-writer.md □ agents/test-runner.md

□ README.md — project description filled in

□ Final validation
    □ macOS/Linux : bash scripts/audit.sh    → must exit 0
      Windows     : .\scripts\audit.ps1   → must exit 0
    □ git config core.hooksPath .githooks    (already set by script — verify it stuck)
```
---

### 8. Coding Behavior Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

#### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- **Secrets Management Rule**: Plaintext secrets (passwords, API tokens, security keys) **MUST NEVER** be hardcoded into application source files or configurations. All credentials must be loaded dynamically from local environment variables, system keychains, or secure config files. Establish a `.env.sample` template for every repository.

#### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

#### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

#### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

#### 5. Response Language

**Default to Korean unless explicitly instructed otherwise.**

- All conversational interactions with the user **MUST** be written in **Korean** (한국어), unless the user initiates or explicitly requests the conversation in English.
- This rule applies only to conversational text; actual codebase modifications, configuration scripts, Git messages, and PR documents must follow their respective English-only conventions.

---

*Last Updated: 2026-05-22*
