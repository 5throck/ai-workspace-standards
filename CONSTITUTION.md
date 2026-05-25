# Project Constitution

These principles apply to every project under the workspace root (`C:\git` on Windows, or `~/git` on macOS/Linux). They define the **design standard** - implementation is handled per-project via each project's own scripts and settings.

> **📋 Every AI session MUST complete this checklist before touching any code:**
> - [ ] Read §1 - Folder Structure (understand where files live)
> - [ ] Read §2 - Memory System (before ending any session that produced changes)
> - [ ] Read §3 - PR Workflow (understand commit/branch/PR rules)
> - [ ] Read §4 - i18n (if the project has a user-facing UI)
> - [ ] Read §5 - Multi-Agent Architecture (if spawning agents)
> - [ ] Read §6 - Skills (if using or creating skills)
> - [ ] Read §7 - New Project Init (when creating a new project)
> - [ ] Read §8 - Coding Behavior Guidelines (understand behavioral constraints)

**Sections:** Workspace · 1. Folder Structure · 2. Memory System · 3. PR Workflow · 4. i18n · 5. Multi-Agent Architecture · 6. Skills · 7. New Project Init · 8. Coding Behavior Guidelines

---

### Workspace Overview

> **Environment-specific path** - this file is configured for the current machine. If you move to a different OS or clone to a new location, update the workspace root in the platform config files (`CLAUDE.md`, `GEMINI.md`).
>
> | OS | Workspace root |
> |----|---------------|
> | Windows (current) | `C:\git` |
> | macOS / Linux | `~/git` or `/home/<user>/git` |

This workspace contains multiple independent projects. Each subdirectory is a separate project/repository. Run `ls` (or `dir` on Windows) at the workspace root to see the current list - do not rely on a hardcoded list.

Common project types:
- MCP (Model Context Protocol) servers and tools
- Python-based CLI applications
- Web applications and demos

Each project directory contains its own `docs/context.md` as the authoritative description.

#### Working with Projects

Navigate to the project directory before starting work. Each project has its own build system (`package.json`, `pyproject.toml`, etc.), dependencies, testing framework, and development workflow (`scripts/dev-sync.sh`).

**Session start checklist / Context Loading** (run in order at the beginning of every session):

> **Tool-Specific Instructions:**
> - **Claude Code / CLI tools**: Read the files using your native file reading capabilities.
> - **Gemini / Web UI tools**: Use the `@` file reference syntax to load these into context.

0. **Forced Hook Activation**: Ensure automated PR-enforcement hooks are bound. Execute:
   ```bash
   git config core.hooksPath .githooks
   ```
1. **Workspace Standard**: Read this file (`CONSTITUTION.md`) or load `@CONSTITUTION.md`. (For the root workspace itself, this file ALSO serves as the `docs/context.md` SSOT).
2. **Project Context**: Read `docs/context.md` or load `@docs/context.md`. (Skip at workspace root, as `CONSTITUTION.md` covers it).
3. **Agent Roster**: Read `AGENTS.md` or load `@AGENTS.md`.
4. **Session History**: Read `memory/MEMORY.md` or load `@memory/MEMORY.md` (skip if file does not exist).
5. **Session Skills**: Load any skills listed under `## Session Start Skills` in `docs/context.md` (or `CONSTITUTION.md` for the root workspace). (For Gemini, load `@skills/`).

If `docs/context.md` does not exist (legacy or external project), fall back to `README.md` and any local `CLAUDE.md` or `GEMINI.md` in the project root.

For internationalization (i18n) work, also load the baseline translation reference (e.g. `@locales/en.json`).

#### General Development Notes

- Most projects use Python or JavaScript/TypeScript.
- Python projects use virtual environments (`.venv/`).
- Node.js projects use npm/yarn/pnpm for package management.
- Always check the project's `docs/context.md`, `CLAUDE.md`, and `GEMINI.md` for specific instructions.

---

### 1. Standard Folder Structure

#### 1.1 Project Layout

Every project follows this layout. Omit folders that don't apply to the project type.

```
<project-root>/
├── src/          # Source code
├── docs/         # Design docs, architecture, ADRs
│   ├── context.md    # Project knowledge - shared by all AI tools (required)
│   └── adr/          # Architecture Decision Records (ADRs)
│       └── NNNN-slug.md  # e.g., 0001-use-mcp-server.md
├── scripts/      # Automation scripts (.sh + .ps1 pairs, cross-platform)
│   └── temp/     # Temporary scratch scripts (git-ignored)
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

> **Note**: `.gemini/` and `.claude/` both exist in every project - they coexist and each AI tool reads only its own directory.

#### 1.2 Rules
- **Coding Guidelines in context.md**: `docs/context.md` must contain a `## Coding Guidelines` section with the mandatory template from §8. The `audit.sh` / `audit.ps1` script must verify this heading exists and abort with a non-zero exit code if it is missing.
- **Hybrid Scripting & Cross-Platform Parity**: The workspace follows a hybrid scripting model:
  1. **Utility Scripts** (e.g., `dev-sync`, `audit`) are implemented in pure PowerShell (`.ps1`) and Bash (`.sh`). `scripts/` must always provide both `.sh` and `.ps1` pairs. Both files must accept the exact same parameters and perform identical side-effects.
  2. **Agent Orchestration** (e.g., `dispatch`, `verify-skills`) and complex workflows are implemented in TypeScript (`.ts`) executed via Bun. These `.ts` files do not require PS1/SH pairs.
- **ADR Format Standard**: ADRs in `docs/adr/` must follow sequential 4-digit prefix naming (`0001-slug.md`). Every ADR must consist of three mandatory sections:
  1. **Context**: What is the problem or architectural background context?
  2. **Decision**: What choice was made and why?
  3. **Consequences**: What are the trade-offs, side-effects, and future implications of this decision?
- **Execution Paths**: Script references within code or documentation must use relative platform-agnostic formatting or supply examples for both terminal types.
- **Shared Memory**: `memory/` is strictly shared across all AI tools - not for general application data or temporary local logs.
- **Locales**: `locales/` uses flat JSON files matching ISO language codes (`ko.json`, `en.json`, etc.).
- **Orchestration**: `agents/pm.md` is always created - even for single-agent or simple projects.
- **Agent Index**: `AGENTS.md` is always created at the project root - it is the canonical agent roster shared by all AI tools. Keep it in sync with `docs/context.md ## Agents` (or `CONSTITUTION.md` for the root workspace).
- **Secrets**: `.env.sample` is always committed; `.env` is always in `.gitignore`.

---

### 2. Memory System

Every session that produces a meaningful change must be logged.

#### 2.1 Tracking Management Guidelines: CHANGELOG vs. Memory
To avoid noise and preserve agent context, maintain a strict separation of concerns:
- **Strictly English**: `CHANGELOG.md` and all `memory/` logs MUST be written in English. Do not write them in Korean even if the user converses in Korean.
- **`CHANGELOG.md` (Product-Facing)**: Document *what* changed for the end-user (e.g., new features, bug fixes). Use structured format (Added, Changed, Fixed).
- **`memory/` (Developer/AI-Facing)**: Document *how* and *why* it changed. Record the development process, architectural decisions, failed experiments, and agent task states to maintain AI context across sessions.

**`memory/MEMORY.md`** - index file, updated by `dev-sync` scripts automatically:
```markdown
| Date | Summary |
|------|---------|
| [2026-05-21](2026-05-21.md) | feat: add pricing formula |
```

**`memory/YYYY-MM-DD.md`** - daily log, written by the developer (via `/memlog` in Claude Code · manually in Gemini CLI):
```markdown
## <Feature / Module Name>
- **Files**: src/...
- **Purpose**: one-line summary
- **Decisions**: key technical choices
- **Issues**: symptom → root cause → resolution
```

#### 2.2 Rules
- Log files are written in **English**.
- Append to today's file - never overwrite.
- Run `/memlog` (Claude Code) or manually append to `memory/YYYY-MM-DD.md` (Gemini CLI) before running `sync` to ensure the log is recorded prior to commit.

#### 2.3 Archiving Policy
- When `memory/MEMORY.md` exceeds ~50 rows or `docs/context.md` becomes difficult to navigate, archive older content:
  - Move completed ADR summaries and resolved decisions to `docs/history.md`
  - Retain the last 30 days in `memory/MEMORY.md`; move older daily logs to `memory/archive/`
  - Never delete logs - archive them

---

### 3. GitHub PR Workflow

#### 3.1 Core Rule

**All changes must reach `main` via a Pull Request - never by direct push.**

```
Edit code
  ↓  Post-Write Verification (Manually run audit scripts in Gemini/Desktop app, automated in CLI hooks)

/changelog "added|changed|fixed|removed <description>" (optional)
  ↓  Entry added to CHANGELOG.md under [Unreleased]

/sync "feat: description" (or running dev-sync scripts directly)
  ↓
  1. memory/YYYY-MM-DD.md     - append session log entry
  2. MEMORY.md index         - update entry
  3. CHANGELOG.md            - auto-insert commit message if [Unreleased] is empty
  4. Audit script execution  - abort on failure (includes CHANGELOG.md existence check)
  5. git checkout -b pr/<date>-<slug>
  6. git add -A && git commit
  7. git push + gh pr create ➔ GitHub PR opened (Direct push blocked by local hooks)
```

#### 3.2 Rules
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
- `/changelog` is **optional** - run it before syncing when your change needs a user-visible entry in `CHANGELOG.md`. Skip it for internal refactors, formatting, or tooling changes.
- Project-specific PR settings live in `.gemini/settings.json` or `.claude/settings.json` - kept version-controlled and shared with the team.

---

### 4. Internationalization (i18n)

Apply **only to projects with a user-facing UI** (web app, desktop app, CLI with user messages). Pure API servers and libraries are exempt.

#### 4.1 Supported Languages

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

#### 4.2 Implementation Pattern
- Translation files: `locales/<lang-code>.json` (flat key-value)
- Language detection priority: `APP_LOCALE` env var → OS locale (`LANG`/`LC_ALL`) → `en` fallback
- i18n module: `i18n.py` (Python) or `i18n.ts` (TypeScript)
- All keys must exist in `en.json` as the source of truth

```json
// locales/en.json - example
{
  "app.title": "My App",
  "error.not_found": "Resource not found: {name}",
  "button.submit": "Submit"
}
```

---

### 5. Multi-Agent Architecture

Every project uses a role-based agent structure. Agents are defined as markdown files in `agents/`.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Specialized agents for template maintenance (pm, architect, automation-engineer, security-expert, docs-writer, auditor, scaffolding-expert). See [AGENTS.md](AGENTS.md) for the complete roster.
> - **Individual Projects**: Generic agents for development workflows (pm, architect, designer, code-writer, test-runner). These are generated from `templates/agents/` at project init.

#### 5.1 Agent File Format (Standard Frontmatter)

```yaml
---
name: <agent-name>
tier:
  claude: high|medium|low        # claude-opus-4-7 | claude-sonnet-4.6 | claude-haiku-4-5
  antigravity: high|medium|low   # gemini-3.1-pro | gemini-3.5-flash
  gemini-cli: high|medium|low    # gemini-3.1-pro | gemini-3.5-flash
model: inherit
color: yellow | blue | green | red | magenta | cyan | purple  # Claude Code only
description: 'One-sentence role. Use when: "...", "...", "..."'
examples:
  - user: "..."
    assistant: "..."
---
```

The `description` field is how the AI tool selects the right agent - always write **when to use it** explicitly. The `tier` field enforces cost optimization across platforms.

#### 5.2 Role Groups

| Group | Responsibility | Tier | Core agents |
|-------|---------------|------|-------------|
| Orchestration | Team assembly, design validation, finalization | High | `pm.md` |
| Analysis | Read-only investigation, codebase exploration, data gathering | Medium | `*-analyst.md`, `auditor.md` |
| Design | Architecture decisions, implementation planning, technical spec | High | `architect.md` |
| Design | UI/UX specifications, wireframes, component and interaction design | Medium | `designer.md` |
| Execution | Code implementation and automated test verification | Low | `automation-engineer.md`, `docs-writer.md`, `scaffolding-expert.md` |
| Quality | Independent QA gate, security validation | Medium | `auditor.md`, `security-expert.md` |

#### 5.3 PM Orchestrator Rules

- When no specific orchestrator is assigned, **always create `agents/pm.md`** - PM orchestrates Phases 0, 2, and 6 only.
- PM dispatches independent tasks as **parallel agents in a single message** (never sequential).
- **Autonomous Agent Handoffs**: Agents can dispatch each other directly via JSON contracts for routine workflows without PM intervention
- **Independent QA Gate**: Auditor owns Phase 5 QA gate autonomously using qa-gate.sh/.ps1 scripts
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

#### 5.4 PM Governance Workflow (6 Phases)

```
Phase 0 - Team Assembly & Skill Orchestration (Kickoff)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1 - Analysis & Triage
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 - Design
  Architect produces implementation plan + ADR
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Implementation (serial)
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 4 - QA Gate (Independent Auditor)
  Auditor executes qa-gate.sh/.ps1 autonomously
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE

Phase 5 - Finalization
  PM logs decisions to memory/YYYY-MM-DD.md
  PM runs /sync "type: description" → PR opened
```

#### 5.5 3-Tier Cost Optimization Model

The workspace enforces a **3-tier model strategy** to optimize cost and quality:

| Tier | Models | Role | Example Agents |
|------|--------|------|----------------|
| **High** | claude-opus-4-7, gemini-3.1-pro | Complex reasoning, architecture, PM orchestration | PM, Architect |
| **Medium** | claude-sonnet-4.6, gemini-3.5-flash | Review, QA, analysis, supervision | Auditor, Security Expert |
| **Low** | claude-haiku-4-5, gemini-3.5-flash | Fast coding, boilerplate, scoped tasks | Automation Engineer, Docs Writer |

**Tier Enforcement Rules:**
- All agents must specify tier in frontmatter for all platforms (claude, antigravity, gemini-cli)
- PM agent MUST leverage superpowers plugin for 3-tier enforcement
- Audit scripts validate tier compliance on every run

---

### 5.6 Agent Lifecycle Management

This workspace uses a **file-based agent system** where agents are defined as markdown files in `agents/`. The PM orchestrator is responsible for managing the agent lifecycle.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** agents focus on template maintenance, scaffolding validation, and meta-workflows.
> - **Individual Project** agents focus on project-specific implementation workflows.

#### Agent Lifecycle Phases

| Phase | Action | Command | Documentation Update |
|-------|--------|---------|---------------------|
| **Create** | Add new agent | `bun run agent:create <name> --role "Display" --group <group>` | Update `AGENTS.md` + `CONSTITUTION.md §5` |
| **List** | View all agents | `bun run agent:list [--group <group>] [--verbose]` | N/A (read-only) |
| **Update** | Modify agent | Edit `agents/<name>.md` directly | Update `AGENTS.md` if role/triggers change |
| **Delete** | Remove agent | `bun run agent:delete <name> --force` | Update `AGENTS.md` + `CONSTITUTION.md §5` |
| **Verify** | Check sync | `bun run agent:verify` | N/A (reports inconsistencies) |

#### Agent Management Commands

```bash
# Create a new agent
bun run agent:create <name> --role "Display Name" --group <group> --description "Purpose"

# List all agents
bun run agent:list
bun run agent:list --group Orchestration
bun run agent:list --verbose

# Delete an agent
bun run agent:delete <name>
bun run agent:delete <name> --force

# Verify documentation synchronization
bun run agent:verify
```

#### Documentation Synchronization Rule

**CRITICAL**: After any agent creation, modification, or deletion, the PM MUST update:

1. **AGENTS.md** - Canonical agent index:
   - Add/remove row from Agent Roster table
   - Add/remove row from Subagent Roster table (with Parallelizable/Write columns)
   - Update Skills table if agent uses skills

2. **CONSTITUTION.md §5** - Multi-Agent Architecture:
   - Add/remove reference to agent in relevant subsections
   - Update role group definitions if applicable
   - Keep in sync with AGENTS.md

#### Verification

Run `bun run agent:verify` to check:
- All agents in `agents/` have corresponding entries in `AGENTS.md`
- All agents in `AGENTS.md` have corresponding files in `agents/`
- Agent metadata (role, group, triggers) is consistent

#### PM Responsibility

During **Phase 0 (Team Assembly)**, the PM:
1. Assesses workspace or project requirements
2. Creates specialized agents if needed using `agent:create.ts`
3. Updates `AGENTS.md` and `CONSTITUTION.md` with new agent entries
4. Documents agent handoff rules and dispatch triggers

> **Reference**: See `AGENTS.md` for complete agent roster, dispatch protocols, and maintenance rules.

---

### 6. Skills

Reusable workflow knowledge is defined as skills.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Skills focus on template maintenance and scaffolding validation (e.g., `ui-ux-pro-max`, `simulate-project-creation`, `security-scan`, `audit-workspace`).
> - **Individual Projects**: Skills are project-specific workflows defined by the development team.

#### 6.1 Folder Structure

Skills can exist in two locations:

```
# Project-specific skills (both AI tools)
skills/
└── <skill-name>/
    └── SKILL.md

# Claude Code-only skills (auto-registered)
.claude/skills/
└── <skill-name>/
    └── SKILL.md
```

> **Important:** Flat files like `skills/my-skill.md` are NOT recognized. Always use the directory format: `skills/my-skill/SKILL.md`.

| Location | Scope | AI Tools |
|----------|-------|----------|
| `skills/<name>/` | Project-specific, shared | Claude Code, Gemini |
| `.claude/skills/<name>/` | Claude Code-only | Claude Code only |

#### 6.2 Skill File Format (Standard Frontmatter)

```yaml
---
name: Skill Display Name
description: >
  Describe exactly when this skill should be loaded.
  The AI tool uses this to decide whether to auto-trigger it.
version: 1.0.0
---
```

#### 6.3 Skill Body Structure

```markdown
## Overview
One paragraph - what this skill enables and when to use it.

## <workflow-name>

**Purpose**: What this workflow accomplishes.
**Trigger**: When to apply it.

**Steps**:
1. Step one
2. Step two
3. Step three

**Output**: What the agent produces at the end.
```

#### 6.4 Skill Types

| Type | Description | Load timing |
|------|-------------|-------------|
| Session skill | Always-needed workflow for this project | Listed under `## Session Start Skills` in `docs/context.md` - loaded at session start by all AI tools |
| On-demand skill | Specialized knowledge for specific tasks | Auto-triggered by `description` matching |

#### 6.5 Skill Lifecycle Management

Skills have a lifecycle managed by the PM agent. When agent configurations change, skills may need to be created, updated, deprecated, or archived.

##### Skill Lifecycle States

| State | Description | Action Required |
|-------|-------------|-----------------|
| **draft** | Skill under development | Move to active after review |
| **active** | Skill in production use | Regular health checks |
| **deprecated** | Superseded, pending removal | Add frontmatter warning, archive after 30 days |
| **archived** | No longer used, kept for reference | Move to `skills/_archive/`, can delete after 90 days |

##### Skill Frontmatter Template

All skills should include lifecycle metadata:

```yaml
---
name: skill-name
description: This skill should be used when...
version: 1.2.3

# Lifecycle metadata
status: active           # draft | active | deprecated | archived
owner: agent-name        # Primary owning agent
requires: []             # Skills this depends on
supersedes: old-skill    # This replaces old skill
superseded_by: []        # If another skill replaces this

# Last updated
last_reviewed: 2026-05-25
last_reviewed_by: pm-agent
---
```

##### Running Skill Health Audit

Execute the audit script to check skill health:

**Bun:**
```bash
bun scripts/skill-lifecycle-audit.ts
```

The audit checks for:
- ✅ Skills without owners
- ✅ Orphaned skills (owner agent doesn't exist)
- ✅ Deprecated skills still being modified
- ✅ Missing dependencies (requires field)
- ✅ Circular dependencies

##### Agent Configuration Change Workflow

When PM agent modifies the agent team:

**New Agent Added:**
1. Does agent need a skill? → Create using `skill-creator:skill-creator`
2. Can existing skill be shared? → Update `owner: [agent1, agent2]`

**Agent Role Changed:**
1. Find all skills with `owner: changed-agent`
2. Update skill descriptions to reflect new scope
3. Bump version if capabilities changed

**Agent Removed:**
1. Find all skills with `owner: removed-agent`
2. Is skill shared? → Remove agent from owner list
3. Is skill needed by another agent? → Reassign owner
4. Is skill orphaned? → Change status to deprecated

**Agent Consolidation:**
1. List all skills from merged agents
2. Identify duplicates → Use `supersedes` field to mark old
3. Keep most complete version
4. Update `owner: new-consolidated-agent`

##### Pre-commit Integration

Skills are automatically validated on commit:

```bash
git add .claude/skills/new-skill/SKILL.md
git commit -m "feat: add new skill"
# → Skill Lifecycle Audit runs automatically
```

If audit fails:
- Add missing `owner: agent-name` to frontmatter
- Reassign orphaned skills to valid agents
- Archive deprecated skills to `skills/_archive/`

---

### 7. New Project Initialization

#### 7.1 Project Scaffolding Commands

**Every new project starts with a project scaffolding command:**

- **Claude Code**: `/new-project` (slash command in `.claude/commands/`)
- **macOS / Linux**: `bash scripts/new-project.sh "<project-name>"`
- **Windows**: `.\scripts\new-project.ps1 "<project-name>"`

The script copies [`templates/`](templates/) directly into the new project directory,
substitutes the `[Project Name]` placeholder in all text files, removes `_examples/`,
and initializes git with hooks active.

#### 7.2 What Gets Generated

The [`templates/`](templates/) folder mirrors the exact structure of a new project -
browse it directly to see what every file should look like. All scaffold templates
live there as **real, editable files** (not embedded strings).

| Generated file | Purpose | Action needed |
|----------------|---------|---------------|
| `docs/context.md` | Single source of truth - 10 required sections | Fill in `[...]` placeholders |
| `AGENTS.md` | Canonical agent index | Ready to use |
| `agents/pm.md` + 4 others | Role definitions (pm, architect, designer, code-writer, test-runner) | `[Project Name]` already substituted |
| `CLAUDE.md` / `GEMINI.md` | Platform-specific overrides | Add project-specific settings if needed |
| `.claude/settings.json` | Hooks config (disabled by default - `{}`) | Enable PostToolUse if needed |
| `.gemini/settings.json` | Gemini project settings | Ready to use (add settings as needed) |
| `scripts/` | audit, dev-sync, sync-md (.sh + .ps1) | Ready to use |
| `.githooks/` | pre-commit (audit gate) + pre-push (block main) | Ready to use |
| `CHANGELOG.md` | User-visible change history | Ready to use |
| `README.md` | GitHub landing page | Fill in project description |
| `.env.sample` | Environment variable template | Add required env keys |
| `.gitignore` | Standard ignore rules | Ready to use |
| `memory/MEMORY.md` | Session log index | Ready to use |

> **Extension templates** - ADR, analyst agent, skill, and daily log formats are **not**
> generated at project init. Find ready-to-copy examples in [`templates/_examples/`](templates/_examples/).

#### 7.3 Post-Scaffold Checklist

```
□ docs/context.md
    □ [Project Name] on line 1 replaced with actual project name
    □ ## Tech Stack filled in
    □ ## Architecture src/ map filled in
    □ [KEY_NAME] env vars filled in (or "N/A - no env vars required")
    □ All 10 sections present:
        macOS/Linux : grep "^## " docs/context.md
        Windows     : Select-String -Path docs/context.md -Pattern "^## "

□ agents/ - [Project Name] substituted in all 5 ## Role sections
    □ agents/pm.md          □ agents/architect.md   □ agents/designer.md
    □ agents/code-writer.md □ agents/test-runner.md

□ README.md - project description filled in

□ Final validation
    □ macOS/Linux : bash scripts/audit.sh    → must exit 0
      Windows     : .\scripts\audit.ps1   → must exit 0
    □ git config core.hooksPath .githooks    (already set by script - verify it stuck)
```
---

### 8. Coding Behavior Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

#### 8.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- **Secrets Management Rule**: Plaintext secrets (passwords, API tokens, security keys) **MUST NEVER** be hardcoded into application source files or configurations. All credentials must be loaded dynamically from local environment variables, system keychains, or secure config files. Establish a `.env.sample` template for every repository.

#### 8.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

#### 8.3 Surgical Changes

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

#### 8.4 Goal-Driven Execution

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

#### 8.5 Open-Source Package Policy

**Prefer OSI-approved open-source packages. Audit licenses after every install.**

When adding or recommending dependencies:
- **Prefer** packages with OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, LGPL-2.1+, PSF-2.0.
- **Avoid** packages with proprietary, commercial-only, or copyleft licenses (GPL-3.0, AGPL-3.0, SSPL, BSL) unless the project's own license and legal context explicitly permit it.
- **Always check** license compatibility when mixing packages (e.g., GPL in an MIT project requires careful review).
- Run a license audit after `npm install` / `pip install` and review any flagged packages before committing.
- If a proprietary alternative exists alongside a viable OSS equivalent, default to the OSS option.
- Document any intentional non-OSS dependency with a comment in `docs/context.md` explaining the justification.

#### 8.6 Response Language

**Default to Korean unless explicitly instructed otherwise.**

- All conversational interactions with the user **MUST** be written in **Korean** (한국어), unless the user initiates or explicitly requests the conversation in English.
- This rule applies only to conversational text; actual codebase modifications, configuration scripts, Git messages, and PR documents must follow their respective English-only conventions.

#### 8.7 File Encoding Rule (Markdown & Scripts)
- All text files, including Markdown (`.md`) and scripts (`.ps1`, `.sh`, `.py`, `.js`, etc.), must be saved as **UTF-8 (without BOM)**.
- When generating files programmatically (e.g. PowerShell scripts), explicitly use `-Encoding UTF8` (or `[System.Text.UTF8Encoding]::new($false)`) to prevent fallback to localized ANSI (CP949) encodings.
- Git configuration (`core.quotepath false` and `i18n.commitencoding utf-8`) helps, but the source files themselves must be strictly UTF-8 encoded to prevent character corruption.

#### 8.8 Hybrid Scripting & Cross-Platform Rule
- **Hybrid Approach**: The project uses a hybrid scripting model. Complex multi-agent orchestration (e.g., `dispatch.ts`, `retry-handler.ts`, `verify-skills.ts`) is implemented in **Bun (.ts)**. Everyday development utilities (e.g., `dev-sync`, `audit`) use native shell scripts.
- **Utility Script Pairing**: All utility shell scripts must be cross-platform compatible. Any creation, modification, or deletion of a PowerShell utility script (`.ps1`) MUST be accompanied by the exact same operation on its corresponding Bash script counterpart (`.sh`), and vice versa. They must always be kept in sync as a pair (e.g., `dev-sync.ps1` and `dev-sync.sh`).

#### 8.9 Bilingual Documentation Rule
- **README Pairing Requirement**: For any `README.md` file created in the `templates/` directory, a corresponding Korean version `README_ko.md` MUST also be created and maintained.
- **Synchronization**: When a `README.md` is modified, the corresponding `README_ko.md` MUST be updated to reflect the same changes. The Korean version should be a faithful translation, maintaining the same structure and content coverage.
- **Directory Structure**: Both files MUST reside in the same directory:
  ```
  templates/<directory>/
  ├── README.md      # English version
  └── README_ko.md   # Korean version (translation of README.md)
  ```
- **Verification**: The `audit.sh` / `audit.ps1` script will check for orphaned `README.md` files without corresponding `README_ko.md` in the `templates/` directory and report them as documentation violations.

---

*Last Updated: 2026-05-25*
