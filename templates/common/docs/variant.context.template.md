# [Project Name] — {{VARIANT_NAME}} Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md                        — immutable project identity (architecture, standards)
>   2. docs/{{VARIANT_NAME}}.context.md        — THIS FILE — tech stack, agents, skills, workflow

---

## Tech Stack

<!-- VARIANT-INJECT: tech-stack -->
| Layer | Technology |
|-------|-----------|
| **Language** | [e.g., TypeScript 5+ / Python 3.11+] |
| **Framework** | [e.g., Next.js / FastAPI / none] |
| **Database** | [e.g., PostgreSQL + Prisma / SQLite / none] |
| **Key Libraries** | [e.g., react-query, zod, httpx] |
| **Package Manager** | [e.g., pnpm / npm / uv] |
| **Testing** | [e.g., Vitest + Playwright / pytest] |
<!-- END VARIANT-INJECT -->

---

## Agents

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- context-proximity: This table intentionally mirrors AGENTS.md for AI context window efficiency.
     AI tools can read the full agent roster without loading AGENTS.md separately.
     Authoritative definitions: agents/*.md (full role specs) | AGENTS.md (roster + dispatch rules)
     Keep in sync with AGENTS.md when adding/removing agents. -->
<!-- VARIANT-INJECT: agents -->
| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | {{PM_ROLE_DESCRIPTION}} | active |
<!-- END VARIANT-INJECT -->

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

All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

---

## Environment Setup

<!-- VARIANT-INJECT: environment-setup -->
- Copy `.env.sample` — `.env` and fill in all required values.
- **Node.js**: `pnpm install` (or `npm install`)
- **Python**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Required env keys (see `.env.sample`): *(fill in after project creation)*
<!-- END VARIANT-INJECT -->

---

## Development Workflow

<!-- VARIANT-INJECT: development-workflow -->
```
Edit code
  —
/sync "feat: description"
  —
  1. audit.ts — abort on failure
  2. memory/YYYY-MM-DD.md — session log (4-section format)
  3. MEMORY.md index update
  4. git add -A — commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | PM creates specialized agents/skills if required |
| 1 | Triage | PM classifies request; dispatches read-only agents in parallel |
| 2 | Analysis | PM synthesizes findings into requirements + acceptance criteria |
| 3 | Design | Architect produces implementation plan + ADR |
| 4 | Implementation | Code Writer — Test Runner — loop up to 3× on failures |
| 5 | Finalization | PM logs decisions; runs `/sync`; opens PR |
<!-- END VARIANT-INJECT -->

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## [Domain] Guidelines
<!-- rename to match variant domain:
     co-develop → ## Coding Guidelines
     co-consult → ## Consulting Guidelines
     co-security → ## Security Guidelines
     co-design  → ## Design Guidelines
     co-work    → ## Writing Guidelines -->
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; update when source changes -->

> Replace this placeholder with variant-specific guidelines.
> This section is REQUIRED — audit.ts will flag its absence.

<!-- END VARIANT-INJECT -->

---

## Git / PR Workflow
<!-- intentional-duplicate: workspace standards §3 — maintained locally for AI context proximity; update when source changes -->

```
/sync "feat: description"
  — 1. memory log (memlog)
  — 2. MEMORY.md index update (sync-md)
  — 3. CHANGELOG.md [Unreleased] auto-add
  — 4. audit.ts  (must exit 0)
  — 5. git checkout -b pr/<date>-<slug>
  — 6. git commit + push
  — 7. gh pr create
```

> All PR titles, bodies, and review comments must be in **English**.

---

## File Organization Policy

### Recommended Folder Structure ({{VARIANT_NAME}})

<!-- VARIANT-INJECT: file-organization -->
| Folder | Purpose |
|--------|---------|
| `memory/` | Session logs, meeting transcripts |
<!-- END VARIANT-INJECT -->

---

## Domain Rules

<!-- VARIANT-INJECT: domain-rules -->
<!-- Add variant-specific domain rules here after project creation. -->
1. *(Add domain rule 1)*
2. *(Add domain rule 2)*
<!-- END VARIANT-INJECT -->

---

*{{VARIANT_NAME}}.context.md version: {{VERSION}} — created by /new-project*
