---
content_hash: PLACEHOLDER
sync_version: 1
---

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

## Prerequisites

**Before using this workspace**, ensure you have the required software installed:

> **📖 Detailed Guide**: See [Getting Started](docs/getting-started.md) for complete installation instructions and troubleshooting.

### Must-Have Tools

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Git** | 2.x+ | Version control, hooks automation | [git-scm.com](https://git-scm.com/downloads) |
| **Bun** ⭐ | 1.x+ | TypeScript scripts, project creation (REQUIRED) | `curl -fsSL https://bun.sh/install \| bash` |

**BREAKING CHANGE**: Bun is now **required** for project creation (replaces Python/PowerShell inline code).

### Optional Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **GitHub CLI (gh)** | PR automation | [cli.github.com](https://cli.github.com/) |

### Quick Verification

```bash
# Check essential tools
git --version    # Should show 2.x.x
bun --version    # Should show 1.x.x
```

**Install missing tools**: See [Getting Started](docs/getting-started.md#-essential-software-must-have) for detailed installation instructions.

---

## Quick Start

### 0. Install prerequisites (if not already installed)

```bash
# Install Bun (REQUIRED) — https://bun.sh/docs/installation
curl -fsSL https://bun.sh/install | bash   # Unix/Linux/macOS
powershell -c "irm bun.sh/install.ps1 | iex"  # Windows

# Verify installation
git --version
bun --version
```

> **Note**: `scripts/install-bun.sh` and `install-bun.ps1` have been removed. Install Bun directly from [bun.sh](https://bun.sh) before using any workspace script.

### 1. Clone as workspace root

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. Open Claude Code

```bash
claude
```

> Git hooks (`.githooks/`) are configured automatically on first Claude session start via the `SessionStart` hook in `.claude/settings.json` — no manual `git config` needed.

### 3. Create your first project

```bash
# Default (latest template, co-develop variant) — all platforms
bun scripts/new-project.ts "my-project-name"

# Specify a variant
bun scripts/new-project.ts "my-project-name" --variant co-develop

# Use a specific template version (see available: bun scripts/list-template-versions.ts)
bun scripts/new-project.ts "my-project-name" --version 0.5.0
```

> **[Breaking Change — 2026-06-11]**: `bash scripts/new-project.sh` and `.\scripts\new-project.ps1` have been replaced by `bun scripts/new-project.ts` (ADR-0036). Update any aliases or CI pipelines accordingly.

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
├── memory/                  # Workspace-level memory logs
├── agents/                  # Workspace-level specialist agents
├── skills/                  # Workspace-level reusable skills
├── tests/                   # Integration and unit test suites
├── scripts/                 # Core automation and audit scripts
├── .githooks/               # Git hooks for enforcing PR policies and rules
├── .claude/ & .gemini/      # AI tools global settings and custom slash commands
└── templates/               # Versioned AI project templates (co-develop, co-design, etc.)
    ├── common/              # Shared scripts, hooks, and skills across all variants
    ├── co-develop/          # ✅ Stable — full software development agent team
    ├── co-design/           # ✅ Stable — specialized UI/UX design agent team
    ├── co-work/             # ✅ Stable — general collaboration and documentation agent team
    ├── co-security/         # ✅ Stable — red team and threat modeling agent team
    ├── co-consult/          # ✅ Stable — strategy consulting and analysis agent team
    └── co-deck/             # 🔶 Beta — lecture and presentation material production agent team
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

Each template variant in this workspace provides a highly optimized, specialized **multi-agent workflow and agent team** tailored for its specific purpose.

- **co-develop**: A 6-phase linear governance pipeline for software development and verification
- **co-design**: A 5-phase iterative design-native workflow focused on rapid prototyping and continuous user validation
- **co-work**: A 6-phase asynchronous collaboration workflow focused on parallel drafting and continuous stakeholder review
- **co-security**: A 6-phase security engagement workflow covering Red Team ops, threat modeling, and Ansible-based patch automation
- **co-consult**: A 7-phase strategy consulting workflow covering research, analysis, deliverable creation, and client delivery
- **co-deck**: An 11-stage lecture material production workflow from research to print-ready PDF, with 5 approval gates

**💡 How to Check Workflow Details**
Specific agent rosters and governance phases are managed within the documents of each generated project. After scaffolding a project, check:
1. `AGENTS.md`: The full specification of agent roles and permissions deployed in the project
2. `docs/context.md`: The project goal and workflow context for initial session kickoff

---

## Template Variants

New projects are scaffolded from versioned template variants. Templates are tagged in git as `template-vX.Y.Z`.

| Variant | Status | Description |
|---------|--------|-------------|
| `co-develop` | ✅ Stable | Full software development workflow — PM, Architect, Designer, Code Writer, Test Runner, Security Monitor |
| `co-design` | ✅ Stable | UI/UX design workflow — PM, Design Lead, UX Researcher, Visual Designer, Prototype Engineer, Storyteller, Service Designer, Typography Expert |
| `co-work` | ✅ Stable | General collaboration workflow — PM, Analyst, Technical Writer, Content Writer, Project Coordinator, Storyteller, MS365 Expert |
| `co-security` | ✅ Stable | Security engagement workflow — PM, Red Team Lead, Pentester, Threat Modeler, Patch Engineer, Report Writer |
| `co-consult` | ✅ Stable | Strategy consulting workflow — Engagement Leader, Strategy Analyst, Industry Expert, Change Management Partner, Communications Lead, Solutions Architect, and more |
| `co-deck` | 🔶 Beta | Lecture material production workflow — PM, Version, Research, Storyline, Design, Build, Measure, Export |

### Selecting a version and variant

```bash
# List available template versions
bun scripts/list-template-versions.ts

# Use latest template (default)
bun scripts/new-project.ts my-project

# Use a specific version
bun scripts/new-project.ts my-project --version 0.5.0

# Use a specific variant
bun scripts/new-project.ts my-project --variant co-develop
```

### Validating templates

When modifying template files, run the lifecycle validator to catch structural issues:

```bash
bun scripts/validate-templates.ts
```

Checks: agent frontmatter completeness, required sections (`## Meeting Participation`, `## Dispatch Protocol`), AGENTS.md roster parity, and shared file sync warnings. Also runs automatically via pre-commit when `templates/` files are staged.

---

## Design Principles

- **`docs/context.md` is the single source of truth** for every project - all AI tools share it.
- **`CLAUDE.md` / `GEMINI.md` (project-level) contain only platform-specific overrides.**
- **PR-only workflow** - all changes reach `main` via Pull Request. Direct push is blocked by `.githooks/pre-push`.
- **Conventional Commits** - `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **TypeScript-only scripts** - all `scripts/` are `.ts` files executed via `bun` (ADR-0036). No `.sh/.ps1` pairs.
- **Coding Guidelines are audited** - `audit.ts` fails the build if `## Coding Guidelines` is missing from `docs/context.md`.
- **Security-First Scaffold** - Projects are automatically equipped with secrets detection (`.gitleaks.toml`), `SECURITY.md`, and secure pre-commit hooks to prevent credential leaks.

---

---

## Contributing

This is a **public repository**. Contributions are welcome via pull requests.

1. Branch off `main` using the naming convention: `feat/<slug>`, `fix/<slug>`, or `docs/<slug>`
2. All PRs must pass `bun scripts/audit.ts`
3. Add a `CHANGELOG.md` entry under `[Unreleased]` before merging
4. Follow `CONSTITUTION.md §8 - Coding Behavior Guidelines`
5. At least **1 approving review** is required before merging

---

## License

AGPL-3.0 - see [LICENSE](LICENSE)

---

*Maintained by [@5throck](https://github.com/5throck) · Last Updated: 2026-06-19*
