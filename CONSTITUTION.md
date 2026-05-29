# Project Constitution

These principles apply to every project under the workspace root (`C:\git` on Windows, or `~/git` on macOS/Linux). They define the **design standard** - implementation is handled per-project via each project's own scripts and settings.

---

## Required Reading

> **AI tools MUST load these files at session start** in addition to this document:
> - `docs/constitution/05-multi-agent-architecture.md`
> - `docs/constitution/08-coding-guidelines.md`
> - `docs/constitution/09-operations-workflow.md` (for PM and maintenance tasks)

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

### 1. Standard Folder Structure → [Full details](docs/constitution/01-folder-structure.md)

Every project follows a standard layout with `src/`, `docs/`, `scripts/`, `memory/`, `agents/`, `skills/`, `.github/`, `.claude/`, and `.gemini/` directories. Key rules: `docs/context.md` is mandatory for all projects, `scripts/` must be divided into Tier 1 (Shell) and Tier 2 (Bun/TS) according to their purpose, and ADRs use sequential 4-digit prefix naming (`0001-slug.md`) with mandatory Context/Decision/Consequences sections.

---

### 2. Memory System → [Full details](docs/constitution/02-memory-system.md)

Every session that produces changes must be logged in `memory/YYYY-MM-DD.md` using the mandatory four-section format (Session Summary, Changes, Decisions, Open Issues). `CHANGELOG.md` is for product-facing changes (what), while `memory/` is for developer-facing documentation (how/why). Both must be in English. Archive when `MEMORY.md` exceeds ~50 rows: move older content to `docs/history.md` and `memory/archive/`.

---

### 3. GitHub PR Workflow → [Full details](docs/constitution/03-pr-workflow.md)

All changes reach `main` via Pull Request—never by direct push. The `/sync` pipeline enforces this: memlog → MEMORY.md → CHANGELOG → audit → branch → commit → push → PR. All Git artifacts (commits, PR titles/bodies, branch names, comments) must be in English. Follow Conventional Commits (`feat:`, `fix:`, `docs:`, etc.). Active branches follow pattern `pr/<YYYYMMDD-HHmmss>-<slug>`. Run `git config core.hooksPath .githooks` to bind pre-commit and pre-push hooks.

---

### 4. Internationalization (i18n) → [Full details](docs/constitution/04-i18n.md)

Apply only to projects with user-facing UI (web app, desktop app, CLI with messages). Pure API servers and libraries are exempt. Standard: 16 languages (`en` default, `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar` RTL). Translation files use flat JSON (`locales/<lang-code>.json`). Language detection: `APP_LOCALE` env var → OS locale → `en` fallback. All keys must exist in `en.json` as source of truth.

---

### 5. Multi-Agent Architecture → [Full details](docs/constitution/05-multi-agent-architecture.md)

Every project uses role-based agents defined in `agents/*.md` with YAML frontmatter (tier, model, color, description, examples). Three-tier cost optimization: High-tier models (claude-opus-4-7, gemini-2.5-pro) for PM/Architect; Medium-tier (claude-sonnet-4-6, gemini-2.0-flash) for Auditor/QA; Low-tier (claude-haiku-4-5) for execution. PM orchestrator follows 6-phase governance workflow (Team Assembly → Triage → Design → Implementation → QA → Finalization). See [§5.6 Agent Lifecycle](docs/constitution/05.6-agent-lifecycle.md) for creation/modification procedures.

---

### 5.6 Agent Lifecycle Management → [Full details](docs/constitution/05.6-agent-lifecycle.md)

Agents have three states: **active** (production use), **deprecated** (being phased out—reassign skills within 30 days), **retired** (move to `agents/_archive/`, delete after 90 days). PM is the designated owner of all agents. If an agent's prompt contains a vulnerability, immediately set `status: deprecated` and open a PR. Manage lifecycle via `agent:create.ts`, `agent:delete.ts`, and `agent:verify.ts`. After any agent change, update both `AGENTS.md` (canonical roster) and `CONSTITUTION.md §5` (architecture references).

---

### 6. Skill Lifecycle Management → [Full details](docs/constitution/06-skill-lifecycle.md)

Skills are reusable workflows defined as `skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`. When creating a new skill, use the `skill-creator` plugin and complete the registration checklist: add to `docs/context.md ## Skills` (individual projects) and `AGENTS.md ## Skills` (workspace root). Skills have four states: **draft**, **active**, **deprecated** (archive after 30 days), **archived** (delete after 90 days). Version bump rules: **patch** (1.0.x) for wording fixes, **minor** (1.x.0) for new steps, **major** (x.0.0) for rewrites. Shared skills (`owner: [agent1, agent2]`) require both owners' approval.

---

### 6.5 Script Lifecycle Management → [Full details](docs/constitution/06.5-script-lifecycle.md)

Scripts are managed across three ownership layers: L0 (`templates/common/scripts/`, templates team, SSOT), L1 (`scripts/` workspace root), L2 (`<project>/scripts/`, independent snapshot). Changes flow L0 → L1 → L2 at project creation time only—no automatic back-propagation. Scripts have three statuses: **active** (version bump required on change), **deprecated** (90-day minimum notice with `removal-date`), **experimental** (not propagated). Dependency tracking: scripts that call other scripts must declare `depends_on` in `SCRIPTS.md` Registry; `verify-scripts.ts` checks for circular and missing dependencies. Security advisories trigger immediate hard blocks.

---

### 7. New Project Initialization → [Full details](docs/constitution/07-new-project.md)

Every new project starts with `/new-project` (Claude Code), `bash scripts/new-project.sh` (macOS/Linux), or `.\scripts\new-project.ps1` (Windows). The script copies `templates/` into the new directory, substitutes `[Project Name]` placeholders, removes `_examples/`, and initializes git with hooks active. Generated files include `docs/context.md` (fill in 10 sections), `AGENTS.md` (ready), 5 agent files (`[Project Name]` already substituted), `CLAUDE.md`/`GEMINI.md` (add project-specific settings if needed), `scripts/` (audit, dev-sync, sync-md), `.githooks/`, `CHANGELOG.md`, `README.md`, `.env.sample`, `.gitignore`, and `memory/MEMORY.md`.

---

### 8. Coding Behavior Guidelines → [Full details](docs/constitution/08-coding-guidelines.md)

Behavioral guidelines to reduce common LLM coding mistakes. **Think Before Coding**: state assumptions, surface tradeoffs, ask when uncertain. **Simplicity First**: minimum code, no speculative features, no premature abstractions. **Surgical Changes**: touch only what you must, match existing style, clean up only your own orphans. **Goal-Driven Execution**: define verifiable success criteria, loop until confirmed. **Secrets Management**: never hardcode credentials—use `.env.sample` template. **Open-Source Policy**: prefer OSI-approved licenses (MIT, Apache-2.0, BSD), audit after install. **Response Language**: default to Korean conversational, but all Git/PR artifacts must be English. **File Encoding**: all text files UTF-8 without BOM. **Hybrid Scripting**: Tier 1 (Bootstrap) in Native Shell, Tier 2 (Ops/Automation) in Bun/TS + package.json. **Bilingual README**: `templates/*` and workspace root require `README.md` and `README_ko.md` synced via `sync_version: <int>` YAML frontmatter. Other folders like `scripts/` require only English `README.md`.

---

### 9. Operations Workflow → [Full details](docs/constitution/09-operations-workflow.md)

Operational procedures for maintaining workspace health and lifecycle hygiene. **Post-Implementation QA (Mandatory)**: All tasks executed based on an `implementation_plan.md` or formal plan MUST undergo a QA validation step via testing or verification scripts before completion, regardless of the agentic tool used (Claude/Antigravity). **Weekly Health Check** (PM, every Friday): Run lifecycle audits (`agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`) and review deprecated items. **Monthly Lifecycle Review** (PM + Architect + Auditor, first Friday): Review deprecated items ≥30 days, perform archive cleanup (move to `*_archive/` after 30 days, delete after 90), plan template synchronization, create action items. **Quarterly Template Sync** (Architect + PM, start of each quarter): Validate templates, propagate L0 changes to variants, update `templates/VERSION`. **On-Demand Synchronization**: Run `sync-agent-status.sh` and `sync-skill-status.sh` after agent/skill changes. **Operational Metrics**: Track agent/skill health (100% target), deprecated backlog (<5 items), archive age (<90 days), template sync lag (<7 days).

---

### 10. Terminology → Canonical Definitions

The following terms have precise meanings across all workspace tools, agents, and documentation. Use these exact terms — do not substitute synonyms.

#### Template Variant
One of four project archetypes: `co-design`, `co-develop`, `co-work`, `co-security` (beta). Specifies which `templates/<variant>/` folder is used during project scaffolding. Recorded in `.claude/template-version.txt` as `variant=<value>`.

#### Platform Profile
Controls which AI-platform-specific configuration files are included in a project. Three values:
- `claude` — includes `CLAUDE.md` only; `GEMINI.md` is excluded
- `antigravity` — includes `GEMINI.md` only; `CLAUDE.md` is excluded
- `both` — includes both (default for all new projects)

Recorded in `.claude/template-version.txt` as `platform=<value>`.

#### WORKSPACE-MANAGED Marker
A pair of HTML comment markers used in MERGE-tier files to delimit sections managed by the workspace template system:

```
<!-- WORKSPACE-MANAGED -->
... content owned and updated by upgrade-project scripts ...
<!-- /WORKSPACE-MANAGED -->
```

Rules:
- Content between these markers is automatically replaced by `upgrade-project.sh/.ps1` during upgrades.
- Content outside the markers is user-owned and is never modified by upgrade scripts.
- `audit.sh` verifies that these markers exist in expected files.
- Do **not** remove or reorder these markers manually.

#### File Upgrade Tiers (LOCKED / MERGE / PRESERVE)

Used by `upgrade-project.sh/.ps1` to classify every project file during a template upgrade:

| Tier | Behavior | Examples |
|------|----------|---------|
| **LOCKED** | Always overwritten; diff shown before overwrite | `.githooks/*`, `.gitattributes`, `.gitleaks.toml` |
| **MERGE** | Only `WORKSPACE-MANAGED` sections replaced; rest preserved | `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md`, `.gitignore`, `agents/*.md` |
| **PRESERVE** | Never touched; listed in upgrade report only | `README.md`, `src/`, `docs/context.md`, project-specific files |

#### Platform Documentation Parity
The requirement that `CLAUDE.md` and `GEMINI.md` in every project template maintain equivalent section coverage. If a security configuration, behavioral rule, or workflow is documented in `CLAUDE.md`, an equivalent entry must exist in `GEMINI.md`, and vice versa. Verified during template validation (`validate-templates.sh/.ps1`).

#### Script Parity Annotation
A comment tag added to both `.sh` and `.ps1` versions of a script to declare that a specific security or behavioral check is implemented in both. Format: `# [parity:<tag>]`. Example: `# [parity:secret-scan]`. The `validate-templates.ts` script checks that tags present in `.sh` exist in the paired `.ps1` and vice versa.

---

*Last Updated: 2026-05-30*
