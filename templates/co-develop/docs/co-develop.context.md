# [Project Name] ??co-develop Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE ??all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              ??immutable project identity (architecture, standards)
>   2. docs/co-develop.context.md   ??THIS FILE ??tech stack, agents, skills, workflow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | [e.g., TypeScript 5+ / Python 3.11+] |
| **Framework** | [e.g., Next.js / FastAPI / none] |
| **Database** | [e.g., PostgreSQL + Prisma / SQLite / none] |
| **Key Libraries** | [e.g., react-query, zod, httpx] |
| **Package Manager** | [e.g., pnpm / npm / uv] |
| **Testing** | [e.g., Vitest + Playwright / pytest] |

---

## Agents

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | Workflow management, dispatch, quality gates | active |
| Architect | `agents/architect.md` | System design, ADR production | active |
| Code Writer | `agents/code-writer.md` | Implementation per approved plan | active |
| Test Runner | `agents/test-runner.md` | Test authoring and execution | active |
| Security Monitor | `agents/security-monitor.md` | Security review, hook enforcement | active |
| Designer | `agents/designer.md` | UI/UX specs and component definitions | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

---

## Scripts

<!-- Source Layer: L0 = templates/common (SSOT) | L1 = workspace root | L2 = project-local -->
<!-- Status: active | deprecated | experimental -->

| Script | Type | Entrypoint | Source Layer | Status |
|--------|------|------------|-------------|--------|
| `audit` | Tier 2 | `package.json` (`bun run audit`) | L0 | active |
| `dev-sync` | Tier 2 | `package.json` (`bun run dev-sync`) | L0 | active |
| `sync-md` | Tier 2 | `package.json` (`bun run sync-md`) | L0 | active |

> See SCRIPTS.md in templates/common/scripts/ for full lifecycle registry.

### Hybrid Scripting
Tier 1 (Bootstrap) in Native Shell, Tier 2 (Ops/Automation) in Bun/TS + package.json.

---

## Environment Setup

- Copy `.env.sample` ??`.env` and fill in all required values.
- **Node.js**: `pnpm install` (or `npm install`)
- **Python**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Required env keys (see `.env.sample`): *(fill in after project creation)*

---

## Development Workflow

```
Edit code
  ??
/sync "feat: description"
  ??
  1. audit.sh ??abort on failure
  2. memory/YYYY-MM-DD.md ??session log (4-section format)
  3. MEMORY.md index update
  4. git add -A ??commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-develop standard)

```
PM ??Architect (design + ADR)
   ??Code Writer (implementation)
   ??Test Runner (QA gate)
   ??Security Monitor (review)
```

### Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | PM creates specialized agents/skills if required |
| 1 | Triage | PM classifies request; dispatches read-only agents in parallel |
| 2 | Analysis | PM synthesizes findings into requirements + acceptance criteria |
| 3 | Design | Architect produces implementation plan + ADR |
| 4 | Implementation | Code Writer ??Test Runner ??loop up to 3× on failures |
| 5 | Finalization | PM logs decisions; runs `/sync`; opens PR |

---

## Coding Guidelines
<!-- intentional-duplicate: CONSTITUTION.md §8 — maintained locally for AI context proximity; update when source changes -->

### Core Rules

1. **Think before coding** ??state assumptions; if uncertain, ask.
2. **Simplicity first** ??minimum code that solves the problem.
3. **Surgical changes** ??touch only what is necessary.
4. **No hardcoded secrets** ??always use env vars / `.env.sample`.
5. **PR required** ??all changes via `/sync`; never direct push to main.

### Plan Mode

Enter plan mode when: new feature, significant refactor, or change touches more than 2 files.

### Subagent Pattern

Each implementation task follows the Phase 4 execution loop:
1. **code-writer** implements
2. **test-runner** verifies acceptance criteria
3. **audit script** validates compliance
Maximum 3 iterations before escalating to user.

### Hybrid Scripting

- Complex orchestration ??**Bun TypeScript** (`.ts`)
- Everyday utilities ??**cross-platform shell** (`.sh` + `.ps1` pair, always kept in sync)

### Package Policy

Prefer OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
Avoid: GPL-3.0, AGPL-3.0, SSPL, BSL unless explicitly justified.

---

## Git / PR Workflow
<!-- intentional-duplicate: CONSTITUTION.md §3 — maintained locally for AI context proximity; update when source changes -->

```
/sync "feat: description"
  ?? 1. memory log (memlog)
  ?? 2. MEMORY.md index update (sync-md)
  ?? 3. CHANGELOG.md [Unreleased] auto-add
  ?? 4. audit.sh  (must exit 0)
  ?? 5. git checkout -b pr/<date>-<slug>
  ?? 6. git commit + push
  ?? 7. gh pr create
```

> All PR titles, bodies, and review comments must be in **English**.

---

## Domain Rules

<!-- co-develop variant specific rules ??edit after project creation -->
1. All implementation must have a corresponding test.
2. Architecture changes require Architect agent ADR before implementation.
3. Security Monitor must review before any PR targeting auth, secrets, or infra.

---

*co-develop.context.md version: 1.0 ??created by /new-project*
