# AI Workspace Standards

> **Master configuration for Vibe Coding and Harness Engineering across all AI coding tools.**

This repository defines the shared workspace standards used by every project under the workspace root. It is designed to be cloned directly as the workspace root (`C:\git` on Windows · `~/git` on macOS/Linux) so that all projects inherit the same AI behavior, workflow, and quality rules automatically.

---

## What Is This?

Modern AI-assisted development requires more than prompts - it requires **consistent, enforced behavioral contracts** that every AI tool follows across every project. This repo provides:

| Concern | File | Audience |
|---------|------|----------|
| Shared workspace standards | [`CONSTITUTION.md`](CONSTITUTION.md) | All AI tools |
| Claude Code behaviors | [`CLAUDE.md`](CLAUDE.md) | Claude Code (CLI + Desktop) |
| Gemini / Antigravity behaviors | [`GEMINI.md`](GEMINI.md) | Gemini CLI + Antigravity engine |
| Change history | [`CHANGELOG.md`](CHANGELOG.md) | All |

### Two Philosophies, One Standard

**Vibe Coding** - AI takes the wheel. The developer describes intent; the AI agents (PM → Architect → Designer → Code Writer → Test Runner) execute the full workflow autonomously. These standards define the guardrails that keep autonomous execution safe and auditable.

**Harness Engineering** - Developer stays in the loop. AI tools are precision instruments: surgical edits, explicit plans, mandatory review gates. These standards define the harness that keeps AI output predictable and reviewable.

---

## Quick Start

### 1. Clone as workspace root

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. Activate local git hooks

```bash
git config core.hooksPath .githooks
```

### 3. Create your first project

```bash
# Default (latest template, co-develop variant)
bash scripts/new-project.sh "my-project-name"

# Specify a variant
bash scripts/new-project.sh "my-project-name" --variant co-develop

# Use a specific template version (see available: bash scripts/list-template-versions.sh)
bash scripts/new-project.sh "my-project-name" --version 0.4.0

# Windows PowerShell
.\scripts\new-project.ps1 "my-project-name"
.\scripts\new-project.ps1 "my-project-name" -Variant co-develop -Version 0.4.0
```

> **AI tool shortcut**: In Claude Code, use `/new-project "my-project-name"` instead of running the script directly.

Each new project is scaffolded from the selected template variant with `docs/context.md`, `AGENTS.md`, `agents/pm.md`, and all required configuration files. The template version and variant are recorded in `docs/context.md` for traceability.

### 4. Move to the new project & Start PM Kick-off

**CRITICAL**: You must exit your current AI session and start a new one inside the newly created project directory. If you remain at the workspace root, the AI will not load the project-specific configuration and will skip the kick-off meeting.

**Provide Context for Better Results**

The PM agent works best when you provide clear context:
1. **Project goal** - What you're building
2. **Agent team hint** (optional) - Suggested specialized agents
3. **Expected output** - Implementation plan, design, code

```bash
# 1. Exit the current AI session (if running)
# 2. Move into the newly created project folder
cd "my-project-name"

# 3. Start a fresh AI session to load project context
claude
# or
agy
```

**Example: Building a Tetris Game**

```
> "Build a Tetris game in TypeScript. Configure a specialized agent team
> (game-design for mechanics, game-logic for collision detection, graphics
> for rendering, qa for testing) and start the kick-off meeting to create
> an implementation plan."
```

This gives the PM agent clear context to:
- Understand your specific requirements
- Configure the right agent team (default or custom)
- Generate a focused kick-off agenda
- Present a concrete plan for your approval



---

## Repository Structure

```
C:\git\ (workspace root - this repo)
├── CONSTITUTION.md          # Master standard - read first in every session
├── CLAUDE.md                # Claude Code workspace behaviors
├── GEMINI.md                # Gemini CLI / Antigravity workspace behaviors
├── SECURITY.md              # Standard GitHub vulnerability reporting policy
├── CHANGELOG.md             # Workspace-level change history
├── README.md                # This file
├── README_ko.md             # This file (Korean)
├── .gitleaks.toml           # Secret scan config (extends upstream defaults)
├── memory/                  # Workspace-level memory logs
├── templates/               # Versioned template variants (tagged as template-vX.Y.Z)
│   ├── VERSION              # Current template semver (0.4.0)
│   ├── CHANGELOG.md         # Template-level change history
│   ├── co-develop/          # ✅ Stable — full software development agent team
│   │   ├── variant.json     # Variant metadata (name, status, version)
│   │   ├── agents/          # pm.md, architect.md, designer.md, code-writer.md, test-runner.md, security-monitor.md
│   │   ├── docs/            # context.md (10-section template), security.md
│   │   ├── scripts/         # dev-sync.sh/.ps1, sync-md.sh/.ps1, audit.sh/.ps1
│   │   ├── .claude/         # settings.json, commands/ (changelog, sync, memlog, etc.)
│   │   ├── .gemini/         # settings.json, commands/
│   │   ├── .githooks/       # pre-commit, pre-push
│   │   └── .github/         # CODEOWNERS, workflows, dependabot
│   ├── co-design/           # 🔵 Planned — UI/UX design workflow
│   └── co-work/             # 🔵 Planned — general collaboration workflow
├── scripts/
│   ├── audit.sh / .ps1                         # Documentation audit (checks ## Coding Guidelines, CHANGELOG, etc.)
│   ├── dev-sync.sh / .ps1                      # Full pipeline: memlog → sync-md → changelog → audit → commit → PR
│   ├── sync-md.sh / .ps1                       # MEMORY.md index updater
│   ├── new-project.sh / .ps1                   # New project scaffolding (--variant, --version flags)
│   ├── list-template-versions.sh / .ps1        # List available template versions (git tags)
│   └── validate-templates.sh / .ps1            # Validate template variant structural integrity
├── .githooks/
│   ├── pre-commit           # Smart conditional audit (memory/ files exempt)
│   └── pre-push             # Blocks direct push to main
├── .claude/
│   ├── settings.json        # {} (hooks disabled; enforced via pre-commit + dev-sync)
│   └── commands/            # Custom slash commands (/sync, /changelog, /memlog, etc.)
└── .gemini/
    └── settings.json        # Gemini CLI project settings
```

Each sub-project lives in its own directory and git repository:

```
C:\git\
├── my-project\              # Independent git repo
│   ├── docs/context.md      # Project knowledge (all AI tools)
│   ├── AGENTS.md            # Agent index
│   ├── CLAUDE.md            # Project-level Claude Code overrides
│   └── GEMINI.md            # Project-level Gemini overrides
└── another-project\         # Another independent git repo
```

---

## Session Start Checklist

Every AI session begins by running this checklist (defined in `CONSTITUTION.md`):

0. `git config core.hooksPath .githooks`
1. Read `CONSTITUTION.md` (this workspace standard)
2. Read the project's `docs/context.md`
3. Read `AGENTS.md` (canonical agent roster)
4. Check `memory/MEMORY.md` for recent changes
5. Load skills from `docs/context.md ## Session Start Skills`

---

## Multi-Agent Workflow

Projects use a 5-role agent model across 6 governance phases:

```
PM Orchestrator
  │
  ├─ Phase 1-2: Analysis agents (parallel)  →  findings + acceptance criteria
  ├─ Phase 3:   Architect + Designer        →  implementation plan + design spec (user approval required)
  ├─ Phase 4:   Code Writer + Test Runner   →  implementation + verification
  ├─ Phase 5:   QA gate                     →  audit.sh + tests pass
  └─ Phase 6:   Finalization                →  memlog → sync → PR
```

Agent scaffold templates for all roles live in `templates/co-develop/agents/`.

---

## Template Variants

New projects are scaffolded from versioned template variants. Templates are tagged in git as `template-vX.Y.Z`.

| Variant | Status | Description |
|---------|--------|-------------|
| `co-develop` | ✅ Stable | Full software development workflow — PM, Architect, Designer, Code Writer, Test Runner, Security Monitor |
| `co-design` | 🔵 Planned | UI/UX design workflow |
| `co-work` | 🔵 Planned | General collaboration workflow |

### Selecting a version and variant

```bash
# List available template versions
bash scripts/list-template-versions.sh

# Use latest template (default)
bash scripts/new-project.sh my-project

# Use a specific version
bash scripts/new-project.sh my-project --version 0.4.0

# Use a specific variant
bash scripts/new-project.sh my-project --variant co-develop
```

### Validating templates

When modifying template files, run the lifecycle validator to catch structural issues:

```bash
bash scripts/validate-templates.sh
```

Checks: agent frontmatter completeness, required sections (`## Meeting Participation`, `## Dispatch Protocol`), AGENTS.md roster parity, script `.sh`/`.ps1` parity, and shared file sync warnings. Also runs automatically via pre-commit when `templates/` files are staged.

---

## Design Principles

- **`docs/context.md` is the single source of truth** for every project - all AI tools share it.
- **`CLAUDE.md` / `GEMINI.md` (project-level) contain only platform-specific overrides.**
- **PR-only workflow** - all changes reach `main` via Pull Request. Direct push is blocked by `.githooks/pre-push`.
- **Conventional Commits** - `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **Cross-platform scripts** - every `.sh` has a `.cmd`/`.ps1` pair with identical behavior.
- **Coding Guidelines are audited** - `audit.sh` fails the build if `## Coding Guidelines` is missing from `docs/context.md`.
- **Security-First Scaffold** - Projects are automatically equipped with secrets detection (`.gitleaks.toml`), `SECURITY.md`, and secure pre-commit hooks to prevent credential leaks.

---

## Contributing

This is a **public repository**. Contributions are welcome via pull requests.

1. Branch off `main` using the naming convention: `pr/<YYYYMMDD-HHmmss>-<slug>`
2. All PRs must pass `bash scripts/audit.sh`
3. Add a `CHANGELOG.md` entry under `[Unreleased]` before merging
4. Follow `CONSTITUTION.md §8 - Coding Behavior Guidelines`
5. At least **1 approving review** is required before merging

---

## License

AGPL-3.0 - see [LICENSE](LICENSE)

---

*Maintained by [@5throck](https://github.com/5throck) · Last Updated: 2026-05-26*
