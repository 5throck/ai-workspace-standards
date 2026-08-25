# [Project Name] —co-develop Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              —immutable project identity (architecture, standards)
>   2. docs/co-develop.context.md   —THIS FILE —tech stack, agents, skills, workflow

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

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

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
| Stack Setup | `agents/stack-setup.md` | Unknown tech stack identification, risk-assessed setup plan, security-reviewed environment bootstrap | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

> **Lifecycle procedures**: See `templates/common/docs/context.md § Lifecycle Management`

---

## Environment Setup

- Copy `.env.sample` —`.env` and fill in all required values.
- **Node.js**: `bun install`
- **Python**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Required env keys (see `.env.sample`): *(fill in after project creation)*

---

## Development Workflow

```
Edit code
  —
/sync "feat: description"
  —
  1. audit.ts —abort on failure
  2. memory/YYYY-MM-DD.md —session log (4-section format)
  3. MEMORY.md index update
  4. git add -A —commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-develop standard)

```
PM —Architect (design + ADR)
   —Code Writer (implementation)
   —Test Runner (QA gate)
   —Security Monitor (review)
```

### Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | PM creates specialized agents/skills if required |
| 1 | Triage | PM classifies request; dispatches read-only agents in parallel |
| 2 | Analysis | PM synthesizes findings into requirements + acceptance criteria |
| 3 | Design | Architect produces implementation plan + ADR |
| 4 | Implementation | Code Writer —Test Runner —loop up to 3× on failures |
| 5 | Finalization | PM logs decisions; runs `/sync`; opens PR |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Coding Guidelines
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; source: docs/constitution/08-coding-guidelines.md; hash: d03bef2a -->

### Core Rules

1. **Think before coding** —state assumptions; if uncertain, ask.
2. **Simplicity first** —minimum code that solves the problem.
3. **Surgical changes** —touch only what is necessary.
4. **No hardcoded secrets** —always use env vars / `.env.sample`.
5. **PR required** —all changes via `/sync`; never direct push to main.

### Plan Mode

Enter plan mode when: new feature, significant refactor, or change touches more than 2 files.

### Subagent Pattern

Each implementation task follows the Phase 4 execution loop:
1. **code-writer** implements
2. **test-runner** verifies acceptance criteria
3. **audit script** validates compliance
Maximum 3 iterations before escalating to user.

### Hybrid Scripting
All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

### Package Policy

Prefer OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
Avoid: GPL-3.0, AGPL-3.0, SSPL, BSL unless explicitly justified.

<!-- END VARIANT-INJECT -->

---

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

---


## File Organization Policy

### Recommended Folder Structure (co-develop)
| Folder | Purpose |
|--------|---------|
| `docs/adr/` | Architecture Decision Records |
| `docs/specs/` | Technical specifications |
| `docs/api/` | API documentation |
| `memory/` | Session logs, meeting transcripts, QA reports, stack-setup records |

---

## Per-Role Deliverable Artifacts

Every specialist dispatch leaves one durable artifact on disk - never chat output only (MetaGPT-style PRD/design/task hand-off chain). The same contract is stated in each agent file's `## Output Format → Required Deliverable Artifact` section.

| Role | Required artifact | Path convention | Consumed by |
|------|-------------------|-----------------|-------------|
| PM | Execution plan table + session log | `memory/YYYY-MM-DD.md` (workspace-governed, see AGENTS.md §5) | All specialists |
| architect | Implementation plan doc (+ ADR for architectural decisions) | `docs/specs/<NNNN>-<slug>-design.md`, `docs/adr/NNNN-slug.md` | designer, code-writer |
| designer | Design specification (wireframes, components, tokens) | `docs/specs/<NNNN>-<slug>-ui-spec.md` | code-writer |
| code-writer | Source change + colocated tests (+ `docs/api/` when interfaces change) | project source tree | test-runner |
| test-runner | QA Report (audit + tests + acceptance verdict) | `memory/qa/<YYYY-MM-DD>-<slug>.md` | PM |
| security-monitor | Structured finding files + scan summary | `security/YYYY-MM-DD-{slug}.md` | PM |
| stack-setup | Approved setup record (commands, sources, risks, results) | `memory/<YYYY-MM-DD>-stack-setup-<slug>.md` | PM, future sessions |

---

## Domain Rules

<!-- co-develop variant specific rules —edit after project creation -->
1. All implementation must have a corresponding test.
2. Architecture changes require Architect agent ADR before implementation.
3. Security Monitor must review before any PR targeting auth, secrets, or infra. **[DEVELOP-R1]**
4. Every specialist dispatch must leave its Required Deliverable Artifact on disk - chat output alone does not complete a hand-off (see Per-Role Deliverable Artifacts). **[DEVELOP-R2]**

---

<!-- COMMON-CONTEXT:START -->
This project follows the workspace coding standards defined in the project's Coding Guidelines section.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*co-develop.context.md version: 1.2 — Per-Role Deliverable Artifacts chain + [DEVELOP-R2] added (2026-08-25); previous: 1.1 normalized to canonical template structure*
