# AI Workspace Standards

> **Master configuration for Vibe Coding and Harness Engineering across all AI coding tools.**

This repository defines the shared workspace standards used by every project under the workspace root. It is designed to be cloned directly as the workspace root (`C:\git` on Windows · `~/git` on macOS/Linux) so that all projects inherit the same AI behavior, workflow, and quality rules automatically.

---

## What Is This?

Modern AI-assisted development requires more than prompts — it requires **consistent, enforced behavioral contracts** that every AI tool follows across every project. This repo provides:

| Concern | File | Audience |
|---------|------|----------|
| Shared workspace standards | [`CONSTITUTION.md`](CONSTITUTION.md) | All AI tools |
| Claude Code behaviors | [`CLAUDE.md`](CLAUDE.md) | Claude Code (CLI + Desktop) |
| Gemini / Antigravity behaviors | [`GEMINI.md`](GEMINI.md) | Gemini CLI + Antigravity engine |
| Change history | [`CHANGELOG.md`](CHANGELOG.md) | All |

### Two Philosophies, One Standard

**Vibe Coding** — AI takes the wheel. The developer describes intent; the AI agents (PM → Architect → Designer → Code Writer → Test Runner) execute the full workflow autonomously. These standards define the guardrails that keep autonomous execution safe and auditable.

**Harness Engineering** — Developer stays in the loop. AI tools are precision instruments: surgical edits, explicit plans, mandatory review gates. These standards define the harness that keeps AI output predictable and reviewable.

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
# Claude Code
/new-project

# Gemini CLI / bash
bash scripts/new-project.sh "my-project-name"

# PowerShell
.\scripts\new-project.ps1 "my-project-name"
```

Each new project is scaffolded with `docs/context.md`, `AGENTS.md`, `agents/pm.md`, and all required configuration files automatically.

### 4. Multi-Agent Kickoff (Recommended)

Before writing any code, start a PM-led kickoff meeting to plan the architecture and roles.
Ask your AI assistant:
> *"Let's start the PM agent kickoff meeting for this project."*

---

## Repository Structure

```
C:\git\ (workspace root — this repo)
├── CONSTITUTION.md          # Master standard — read first in every session
├── CLAUDE.md                # Claude Code workspace behaviors
├── GEMINI.md                # Gemini CLI / Antigravity workspace behaviors
├── CHANGELOG.md             # Workspace-level change history
├── README.md                # This file
├── templates/               # Authoritative scaffold — new-project.sh copies this
│   ├── agents/              # pm.md, architect.md, designer.md, code-writer.md, test-runner.md, security-monitor.md
│   ├── docs/context.md      # Full 10-section project context template
│   ├── scripts/             # dev-sync.sh/.ps1, sync-md.sh/.ps1, audit.sh/.ps1
│   ├── .claude/             # settings.json ({}), commands/changelog.md, sync.md
│   ├── .gemini/             # settings.json
│   ├── .githooks/           # pre-commit (smart conditional), pre-push
│   └── _examples/           # Reference-only ADR, analyst agent, session log, skill
├── scripts/
│   ├── audit.sh / .ps1      # Documentation audit (checks ## Coding Guidelines, CHANGELOG, etc.)
│   ├── dev-sync.sh / .ps1   # Full pipeline: memlog → sync-md → changelog → audit → commit → PR
│   ├── sync-md.sh / .ps1    # MEMORY.md index updater
│   └── new-project.sh / .ps1 # New project scaffolding (copies templates/)
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

Agent scaffold templates for all roles live in `templates/agents/`.

---

## Design Principles

- **`docs/context.md` is the single source of truth** for every project — all AI tools share it.
- **`CLAUDE.md` / `GEMINI.md` (project-level) contain only platform-specific overrides.**
- **PR-only workflow** — all changes reach `main` via Pull Request. Direct push is blocked by `.githooks/pre-push`.
- **Conventional Commits** — `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **Cross-platform scripts** — every `.sh` has a `.ps1` pair with identical behavior.
- **Coding Guidelines are audited** — `audit.sh` fails the build if `## Coding Guidelines` is missing from `docs/context.md`.
- **Security-First Scaffold** — Projects are automatically equipped with secrets detection (`.gitleaks.toml`), `SECURITY.md`, and secure pre-commit hooks to prevent credential leaks.

---

## Contributing

This is a **private repository**. Access is limited to invited collaborators.

1. Branch off `main` using the naming convention: `pr/<YYYYMMDD-HHmmss>-<slug>`
2. All PRs must pass `bash scripts/audit.sh`
3. Add a `CHANGELOG.md` entry under `[Unreleased]` before merging
4. Follow `CONSTITUTION.md §8 — Coding Behavior Guidelines`
5. At least **1 approving review** is required before merging

---

## License

AGPL-3.0 — see [LICENSE](LICENSE)

---

*Maintained by [@5throck](https://github.com/5throck) · Last Updated: 2026-05-22*
