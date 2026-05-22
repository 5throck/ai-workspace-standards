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
3. Load any skills listed under `## Session Start Skills` in the project's `docs/context.md`.
4. Check the project's `memory/MEMORY.md` to understand recent changes.

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
├── .gemini/              # Gemini CLI configuration
│   ├── commands/
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
- **Agent Index**: `AGENTS.md` is always created at the project root — it is the canonical agent roster shared by all AI tools. Keep it in sync with `docs/context.md ## Agents`.
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
  1. Audit script execution  — abort on failure (includes CHANGELOG.md existence check)
  2. memory/YYYY-MM-DD.md     — auto-create if missing
  3. MEMORY.md index         — update entry
  4. git add -A && git commit
  5. On main/master          ➔ create pr/<date>-<slug> branch, git reset --soft HEAD~1 on main
  6. git push + gh pr create ➔ GitHub PR opened (Direct push blocked by local hooks)
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
color: yellow | blue | green | red | magenta | cyan  # Claude Code only
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
| Execution | Code implementation and automated test verification | `code-writer.md`, `test-runner.md` |

#### PM orchestrator rules

- When no specific orchestrator is assigned, **always create `agents/pm.md`** — PM owns the entire workflow.
- PM dispatches independent tasks as **parallel agents in a single message** (never sequential).
- Agents communicate via **structured JSON Input Contracts** (template — `//` comments are for guidance, not valid JSON):

```json
{
  "task": "<task description>",
  "phase": "Triage | Analysis | Design | Implementation | QA | Finalization",  // choose one
  "context_file": "agents/<name>.md",
  "input": { "...": "..." }
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
  Architect designs the implementation plan
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

**Every new project starts with a project scaffolding command.** This scaffolds the full standard structure and generates all required files: `docs/context.md`, `AGENTS.md`, `agents/pm.md`, `CLAUDE.md`, `GEMINI.md`, `CHANGELOG.md`, `README.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, and the core scripts.

- **Claude Code**: run `/new-project` slash command (defined in `.claude/commands/`)
- **Gemini CLI**: run `.\scripts\new-project.ps1 "<project-name>"` (Windows) or `bash scripts/new-project.sh "<project-name>"` (macOS/Linux)

#### What project scaffolding generates

> **Invariant**: every generated `docs/context.md` **must** contain a `## Coding Guidelines` section populated from the mandatory template below. The `audit.sh` script checks for this heading and fails the build if it is missing.

```
<project-root>/
├── docs/context.md              # Project knowledge — all AI tools (includes ## Coding Guidelines)
├── src/
├── scripts/
│   ├── audit.sh + audit.ps1          # Documentation audit (checks CHANGELOG, ## Coding Guidelines, etc.)
│   ├── dev-sync.sh + dev-sync.ps1   # Full sync pipeline (audit → memlog → commit → PR)
│   └── sync-md.sh + sync-md.ps1    # MEMORY.md index updater (updates memory/MEMORY.md entry)
├── locales/                     # UI projects only
├── memory/MEMORY.md             # Log index
├── agents/pm.md                 # PM orchestrator
├── skills/                      # Add skills as needed
├── .gemini/                     # Gemini CLI configuration
│   ├── commands/
│   ├── settings.json
│   └── settings.local.json
├── .claude/                     # Claude Code configuration
│   ├── commands/
│   ├── settings.json
│   └── settings.local.json
├── AGENTS.md                    # Agent index (shared by all AI tools)
├── CHANGELOG.md                 # User-visible change history (required by audit.sh)
├── CLAUDE.md                    # Claude Code config
├── GEMINI.md                    # Gemini CLI config
├── README.md                    # Project README (GitHub landing page)
├── .env.sample                  # Required env variable template (never commit .env)
└── .gitignore                   # Must include .env, .venv/, node_modules/, etc.
```

#### `docs/context.md` — required in every project

This file is the **single source of truth** shared by all AI tools (Claude Code, Gemini, and other AI coding assistants).

Required sections:
```
## Project Overview      — purpose in one sentence
## Tech Stack            — language, framework, key libraries
## Architecture          — folder map with role of each directory
## Environment Setup     — prerequisites, .env keys, virtualenv/install steps
## Agents                — agent list with one-line role descriptions
## Skills                — on-demand skill list with trigger conditions
## Session Start Skills  — skills auto-loaded at every session start
## Development Workflow  — build, test, audit, sync pipeline
## Key Files             — quick-reference path table
## Coding Guidelines     — project-level AI behavior rules (always required)
```

> **Design principle**: `docs/context.md` is the single source of truth for ALL AI tools. Project-level `CLAUDE.md` and `GEMINI.md` must contain **only platform-specific overrides** — if a setting applies to both tools, it belongs in `docs/context.md`.

#### `docs/context.md` — full scaffold template

Copy this block verbatim when scaffolding a new project, then fill in the `[...]` placeholders.

~~~~markdown
# [Project Name]

## Project Overview
[One-sentence description of what this project does and who it's for.]

## Tech Stack
- **Language**: [e.g., Python 3.11+ / TypeScript 5+]
- **Framework**: [e.g., FastAPI / Next.js / none]
- **Key Libraries**: [e.g., pydantic, httpx, react-query]
- **Package Manager**: [e.g., pip + uv / npm / pnpm]

## Architecture
```
src/
├── [folder]    # [description]
└── [folder]    # [description]
```

## Environment Setup
- Copy `.env.sample` → `.env` and fill in all required values.
- **Python**:
  - macOS/Linux: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Windows:     `python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt`
- **Node.js**: `npm install`
- Required env keys (see `.env.sample`):
  - `[KEY_NAME]` — [description] *(replace with actual keys, or write "N/A — no env vars required")*

## Agents
<!-- See AGENTS.md at the project root for the full agent index (canonical source). -->
<!-- Duplicate the table here only as a quick-reference summary for non-CC tools.   -->
| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | PM orchestrator — owns the workflow, dispatches parallel tasks |
| Design | `agents/architect.md` | Architect — produces implementation plans and ADRs |
| Execution | `agents/code-writer.md` | Code writer — implements approved plans |
| Execution | `agents/test-runner.md` | Test runner — verifies acceptance criteria and runs QA gate |

## Skills
| Skill path | Trigger condition |
|------------|-------------------|
| *(none yet — add entries as skills are created in `skills/`)* | |

## Session Start Skills
<!-- Skills listed here are loaded at the start of EVERY session by ALL AI tools. -->
<!-- Format: `skills/<name>/SKILL.md` — reason / trigger                          -->
- *(none yet)*

## Development Workflow
```bash
# Audit (runs automatically via PostToolUse hook in Claude Code CLI)
bash scripts/audit.sh            # Windows: .\scripts\audit.ps1

# Add a changelog entry (optional, before sync)
# Claude Code:  /changelog "added|changed|fixed|removed <description>"
# Gemini CLI:   append to CHANGELOG.md under [Unreleased]

# Full sync: audit → memlog → commit → PR
bash scripts/dev-sync.sh "feat: description"   # Windows: .\scripts\dev-sync.ps1 "feat: ..."
# Claude Code:  /sync "feat: description"
```

## Key Files
| File | Purpose |
|------|---------|
| `docs/context.md` | This file — single source of truth for all AI tools |
| `AGENTS.md` | Canonical agent index — auto-loaded by Claude Code |
| `agents/pm.md` | PM orchestrator — workflow owner |
| `agents/architect.md` | Design agent — implementation plans and ADRs |
| `agents/code-writer.md` | Implementation agent — writes code from approved plans |
| `agents/test-runner.md` | QA agent — runs tests and verifies acceptance criteria |
| `scripts/dev-sync.sh` | Full sync pipeline (audit → commit → PR) |
| `scripts/audit.sh` | Documentation audit script |
| `memory/MEMORY.md` | Session log index |
| `CHANGELOG.md` | User-visible change history |
| `.env.sample` | Required environment variable template |

## Coding Guidelines

> These rules apply to every AI tool working in this project.
> Full rationale: [CONSTITUTION.md §8](../../CONSTITUTION.md#8-coding-behavior-guidelines)
> *(Path `../../CONSTITUTION.md` assumes project is at workspace root depth — e.g., `C:\git\<project>\`. Adjust if nested deeper.)*

### 1. Think Before Coding
- State assumptions explicitly before implementing. If uncertain, ask — don't guess silently.
- If multiple interpretations exist, present them; don't pick one silently.
- If something is unclear, stop and name what's confusing.
- **Secrets**: Never hardcode passwords, API tokens, or keys. Always use env vars / `.env.sample`.

### 2. Simplicity First
- Write the minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code. No unrequested "flexibility."
- If a 200-line solution could be 50 lines, rewrite it.

### 3. Surgical Changes
- Touch only what is necessary. Don't "improve" adjacent code.
- Match existing style even if you'd do it differently.
- Remove only the dead code that **your** changes created.

### 4. Goal-Driven Execution
- Convert every task into a verifiable goal before starting:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a reproducer test, then fix it"
- For multi-step tasks, state a brief numbered plan with a verify step for each.

### 5. Response Language
- All **conversational** replies to the user → **Korean (한국어)** by default.
- All code, config, commit messages, PR titles, branch names → **English only**.
~~~~

#### `AGENTS.md` — scaffold template

This file is the **canonical agent index** for the project. Claude Code auto-loads it for agent discovery. All other AI tools (Gemini, etc.) reference it as the authoritative roster. The `## Agents` section in `docs/context.md` is a quick-reference copy — **`AGENTS.md` is always the source of truth for agent definitions.**

```markdown
# AGENTS.md

> **Canonical agent index** — auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context → `docs/context.md`.

## Available Agents

| Group | Agent | File | Role |
|-------|-------|------|------|
| Orchestration | PM Orchestrator | `agents/pm.md` | Owns the full workflow; dispatches parallel tasks |
| Design | Architect | `agents/architect.md` | Produces implementation plans and ADRs; never writes code |
| Execution | Code Writer | `agents/code-writer.md` | Implements approved plans; surgical changes only |
| Execution | Test Runner | `agents/test-runner.md` | Runs tests and verifies acceptance criteria |

*(Add Analysis agents as needed: `agents/<name>-analyst.md`)*

## Agent Dispatch

- **Claude Code**: use the `Agent` tool — embed the target `agents/<name>.md` content in the prompt field.
- **Gemini CLI**: use `invoke_subagent` with the agent role definition from `agents/<name>.md`.

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the table above.
2. Update the `## Agents` table in `docs/context.md` to match.
```

#### `agents/pm.md` — scaffold template

The PM orchestrator is **always required**, even in single-agent or simple projects. It owns the workflow and is the entry point for all multi-step tasks. The file combines YAML frontmatter and markdown body in one file.

> ⚠️ **After copying this template, replace `[Project Name]` in the `## Role` section with the actual project name.**

````markdown
---
name: pm
model: inherit
color: yellow
description: >
  PM orchestrator — owns the full workflow. Use when: starting any multi-step task,
  coordinating parallel agents, reviewing a feature request, or running the QA gate.
examples:
  - user: "Add a new API endpoint for user registration"
    assistant: "Running Phase 1 Triage to classify the request and dispatch read-only analysis agents."
---

## Role

You are the PM orchestrator for **[Project Name]**. You own the end-to-end workflow from triage to PR creation. You never implement code directly — you classify requests, dispatch specialist agents, synthesize findings, and enforce quality gates.

## Governance Workflow

Follow the 6-phase PM workflow defined in [CONSTITUTION.md §5](../../CONSTITUTION.md#5-multi-agent-architecture):

1. **Triage** — Classify the request; dispatch read-only agents in parallel (single message).
2. **Analysis** — Synthesize findings into requirements + acceptance criteria.
3. **Design** — Have the architect produce an implementation plan; obtain explicit user approval.
4. **Implementation** — Dispatch code-writer (serial); test-runner verifies after each change.
5. **QA** — Verify all acceptance criteria; run audit script + tests.
6. **Finalization** — Run memlog → sync; open PR; hand off to user.

## Agent Roster

Add rows as specialist agents are created. Start with PM only; expand when the project requires dedicated roles.

| Phase | Group | Agent file | Responsibility |
|-------|-------|------------|----------------|
| Triage / Analysis | Analysis | *(add `agents/<name>-analyst.md`)* | Read-only investigation, findings report |
| Design | Design | `agents/architect.md` | Implementation plan + ADR; awaits user approval |
| Implementation | Execution | `agents/code-writer.md` | Write code per approved plan |
| QA / Verification | Execution | `agents/test-runner.md` | Run tests, verify acceptance criteria |

## Constraints

- Dispatch independent tasks **in parallel** (single message, multiple Agent calls).
- Maximum **3 fix iterations** per review cycle before escalating to the user.
- Never bypass audit hooks (`--no-verify` is forbidden).
- All Git artifacts (commit messages, PR titles, branch names) must be in English.
````

#### `agents/architect.md` — scaffold template

The architect owns **Phase 3 — Design**. It produces the implementation plan and waits for user approval before any code is written. It never writes code — it only designs.

````markdown
---
name: architect
model: inherit
color: blue
description: >
  Design agent — produces implementation plans and technical specs. Use when: planning a new
  feature, evaluating architectural trade-offs, or generating an ADR before implementation starts.
examples:
  - user: "Design the data model for user authentication"
    assistant: "Analyzing requirements and producing an implementation plan with schema, API surface, and trade-offs."
---

## Role

You are the architect for **[Project Name]**. You own Phase 3 — Design. You produce clear, reviewable implementation plans before any code is written. You never write application code directly — your output is always a plan or technical specification for the code-writer to execute.

## Responsibilities

- Analyze requirements and acceptance criteria from the Analysis phase.
- Design the implementation: data models, API surface, module boundaries, file changes.
- Identify and document trade-offs explicitly — never pick silently.
- Produce an ADR (`docs/adr/NNNN-slug.md`) for significant architectural decisions.
- Present the plan to the PM; do **not** proceed to implementation without explicit user approval.

## Output Format

Always produce a structured implementation plan:

```
## Implementation Plan

### Summary
One paragraph describing what will be built and why this approach was chosen.

### Files to change
| File | Action | Description |
|------|--------|-------------|
| src/... | create / modify / delete | what changes and why |

### Data model / API surface
[Schema, types, interfaces, or endpoint signatures as applicable]

### Trade-offs considered
| Option | Pro | Con | Decision |
|--------|-----|-----|---------|

### Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Open questions (if any)
- Question requiring user input before implementation can start
```

## Constraints

- Never write application source code — produce plans only.
- Surface all ambiguities before finalizing the plan.
- Flag any change that touches more than 3 files as high-risk and require explicit user confirmation.
- All ADRs must follow the 3-section format: Context → Decision → Consequences.
````

#### `agents/code-writer.md` — scaffold template

The code-writer owns **Phase 4 — Implementation**. It receives an approved plan from the architect and executes it. It never designs — it only implements what is specified.

````markdown
---
name: code-writer
model: inherit
color: green
description: >
  Implementation agent — writes code from an approved plan. Use when: an architect plan has been
  approved and it is time to write, modify, or delete source files.
examples:
  - user: "Implement the plan in docs/adr/0002-auth-model.md"
    assistant: "Implementing the approved authentication data model — starting with the schema migration."
---

## Role

You are the code-writer for **[Project Name]**. You own Phase 4 — Implementation. You receive an approved implementation plan and execute it precisely. You do not redesign — if you discover a problem with the plan during implementation, you stop and report it to the PM rather than silently adapting.

## Responsibilities

- Implement exactly what the approved plan specifies — no scope creep.
- Follow existing code style, naming conventions, and patterns.
- After each file change, confirm the post-write audit hook passes.
- Report blockers to the PM immediately rather than making unplanned design decisions.

## Coding Rules

Apply all guidelines from `docs/context.md ## Coding Guidelines`:
1. **Surgical changes** — touch only what the plan requires.
2. **No speculative code** — no "just in case" abstractions or future-proofing.
3. **Secrets** — never hardcode credentials; always use env vars / `.env.sample`.
4. **Clean up your own orphans** — remove imports/vars made unused by YOUR changes only.

## Output

For each file changed, report:
```
✅ src/models/user.py — created: User model with fields id, email, hashed_password
✅ src/routes/auth.py — modified: added /register and /login endpoints
⚠️  src/config.py    — requires new env var JWT_SECRET (added to .env.sample)
```

## Constraints

- Do not modify files outside the scope of the approved plan without PM approval.
- If a planned change turns out to be more complex than estimated, pause and report — do not expand scope silently.
- Never bypass audit hooks (`--no-verify` is forbidden).
````

#### `agents/test-runner.md` — scaffold template

The test-runner owns **Phase 4 verification and Phase 5 — QA**. It runs tests, interprets results, and reports pass/fail against the acceptance criteria.

````markdown
---
name: test-runner
model: inherit
color: cyan
description: >
  QA and verification agent — runs tests and validates acceptance criteria. Use when: code has
  been written and needs to be verified, or when the QA gate needs to be run before a PR.
examples:
  - user: "Verify the authentication implementation against the acceptance criteria"
    assistant: "Running the test suite and validating each acceptance criterion from the implementation plan."
---

## Role

You are the test-runner for **[Project Name]**. You own verification in Phase 4 and all of Phase 5 — QA. You run the test suite, check acceptance criteria, and produce a clear pass/fail report. You do not write application code — if a test fails, you report it to the PM with a precise diagnosis.

## Responsibilities

- Run the full test suite after each implementation step.
- Verify every acceptance criterion from the implementation plan.
- Run the audit script (`bash scripts/audit.sh`) as the quality gate.
- Report failures with: which test failed, expected vs actual output, and suspected root cause.
- Confirm "QA gate passed" only when all criteria are green and audit exits 0.

## Verification Sequence

```
1. bash scripts/audit.sh           # documentation gate (exit 0 required)
2. [project test command]          # e.g., pytest / npm test / go test ./...
3. Check each acceptance criterion from the implementation plan
4. Report
```

## Output Format

```
## QA Report

### Audit gate
[PASS ✅ | FAIL ❌] bash scripts/audit.sh

### Test suite
[PASS ✅ | FAIL ❌] X passed, Y failed

### Acceptance criteria
- [x] Criterion 1 — verified by test_auth.py::test_register
- [x] Criterion 2 — verified by test_auth.py::test_login
- [ ] Criterion 3 — FAILED: expected 401, got 500 (suspected: JWT_SECRET not set in test env)

### Verdict
[READY FOR PR ✅ | BLOCKED ❌ — reason]
```

## Constraints

- Never modify application source code — diagnose and report only.
- If a test is flaky (intermittent failure), flag it explicitly rather than re-running silently.
- QA gate is considered passed only when audit script exits 0 **and** all acceptance criteria are met.
````

#### Project-level `CLAUDE.md` — scaffold template (minimal)

This file holds **only Claude Code-specific overrides** for this project. Anything that applies to all AI tools goes in `docs/context.md` instead.

> **Path note**: `../../CLAUDE.md` assumes the project lives directly under the workspace root (`C:\git\<project>\`). Adjust the relative path if the project is nested deeper.

```markdown
# CLAUDE.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Claude Code behaviors → [`../../CLAUDE.md`](../../CLAUDE.md)

## Project-Specific Claude Code Settings

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills.       -->
<!-- Add entries here ONLY for Claude Code-exclusive skills not in context.md. -->

### MCP Servers
<!-- Document project-specific .mcp.json entries here, if any.             -->
<!-- General MCP guidance: workspace CLAUDE.md §3                          -->

### Hooks Override
<!-- Override workspace hook behavior for this project only, if needed.    -->
<!-- Default (from workspace CLAUDE.md §1) runs scripts/audit.sh on Write/Edit. -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.       -->
<!-- - Heavy reasoning  : claude-opus-4-7                                  -->
<!-- - Default          : claude-sonnet-4-6                                -->
<!-- - Fast lookups     : claude-haiku-4-5-20251001                        -->
```

#### `.claude/settings.json` — scaffold template

This file activates the PostToolUse hook that runs `audit.sh` after every Write/Edit operation. **Required for automated audit enforcement in Claude Code CLI.**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/audit.sh"
          }
        ]
      }
    ]
  }
}
```

> ⚠️ PostToolUse hooks do **not** fire in the Claude Code Desktop App. After any Write/Edit in the Desktop App, run `bash scripts/audit.sh` manually.

#### Project-level `GEMINI.md` — scaffold template (minimal)

This file holds **only Gemini-specific overrides** for this project. Anything that applies to all AI tools goes in `docs/context.md` instead.

> **Path note**: `../../GEMINI.md` and `@../../CONSTITUTION.md` assume the project lives directly under the workspace root (`C:\git\<project>\`). Adjust if nested deeper.

~~~~markdown
# GEMINI.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Gemini behaviors → [`../../GEMINI.md`](../../GEMINI.md)

## Context Loading

Load project files at session start using the `@` syntax:
```
@../../CONSTITUTION.md   # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@memory/MEMORY.md        # recent changes (skip if file does not exist)
```

## Project-Specific Gemini Settings

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills.          -->
<!-- Add entries here ONLY for Gemini-exclusive skills not in context.md.     -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->
~~~~

#### `CHANGELOG.md` — initial scaffold

Required by `audit.sh`. Must exist at project creation. Use [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
```

#### `.env.sample` — initial scaffold

Documents required environment variables. **Never commit `.env`** — commit only `.env.sample`.

```bash
# .env.sample — copy to .env and fill in values
# All variables listed here are required unless marked [optional]

# [KEY_NAME]=[description]
# Example:
# API_KEY=your_api_key_here
# DATABASE_URL=postgresql://user:password@localhost/dbname

# If this project has no environment variables, leave this file with only this comment.
```

#### `memory/MEMORY.md` — initial scaffold

Required index file for the memory system. Created empty at project init; updated automatically by `dev-sync` scripts.

```markdown
# Memory Index

| Date | Summary |
|------|---------|
```

#### `.gitignore` — initial scaffold

Prevents secrets and local artifacts from being committed. **`.env` must always be listed here.**

```gitignore
# Secrets — never commit
.env

# Python
.venv/
__pycache__/
*.pyc
*.pyo
dist/
*.egg-info/

# Node.js
node_modules/
.next/
dist/
build/

# OS artifacts
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
```

#### Post-scaffold checklist

After running the scaffolding command, verify every item before writing any code:

```
□ docs/context.md
    □ All 10 required sections present
        macOS/Linux : grep "^## " docs/context.md
        Windows     : Select-String -Path docs/context.md -Pattern "^## "
    □ [Project Name] placeholder replaced with actual project name
    □ [KEY_NAME] env vars filled in (or "N/A — no env vars required")
    □ ## Coding Guidelines section present

□ AGENTS.md
    □ Table matches docs/context.md ## Agents

□ agents/pm.md
    □ [Project Name] placeholder in ## Role replaced

□ CLAUDE.md
    □ ../../CLAUDE.md path is correct for this project's depth

□ GEMINI.md
    □ @../../CONSTITUTION.md path is correct for this project's depth

□ .claude/settings.json
    □ PostToolUse hook points to scripts/audit.sh

□ CHANGELOG.md
    □ File exists with [Unreleased] section

□ memory/MEMORY.md
    □ File exists with header row

□ .env.sample
    □ File exists (even if empty — add "# No environment variables required")

□ .gitignore
    □ File exists and includes ".env" entry

□ README.md
    □ File exists (even a one-line placeholder is fine)

□ Final validation
    □ macOS/Linux : bash scripts/audit.sh       → must exit 0
      Windows     : .\scripts\audit.ps1         → must exit 0
    □ Run: git config core.hooksPath .githooks
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
