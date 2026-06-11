# [Project Name] —co-work Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md            —immutable project identity (architecture, standards)
>   2. docs/co-work.context.md    —THIS FILE —tool stack, agents, skills, workflow

---

## Tool Stack

| Purpose | Tool |
|---------|-------|
| **Research** | [e.g., Perplexity, Google Scholar, Zotero] |
| **Documentation** | [e.g., Notion, Google Docs, Markdown] |
| **Coordination** | [e.g., Calendly, Slack, MS Teams] |
| **Productivity Suite** | [e.g., MS365, Google Workspace] |
| **Version Control** | Git + LFS for large assets |

---

## Agents

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| Collaboration PM (Orchestrator) | `agents/pm.md` | Collaboration workflow management, dispatch | active |
| Analyst | `agents/analyst.md` | Research and data analysis | active |
| Content Writer | `agents/content-writer.md` | Documentation and communication | active |
| Project Coordinator | `agents/project-coordinator.md` | Schedule and stakeholder management | active |
| Storyteller | `agents/storyteller.md` | Narrative framework and audience alignment | active |
| Technical Writer | `agents/technical-writer.md` | Technical documentation and specifications | active |
| MS365 Expert | `agents/ms365-expert.md` | MS365 / SharePoint automation and publishing | active |

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

## Development Workflow

```
Brief / task received
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

### Agent Dispatch Order (co-work standard)

```
Collaboration PM
  —Analyst (research —async)
  —Storyteller (narrative framework)
  —Content Writer + Technical Writer (parallel drafting)
  —Project Coordinator (stakeholder review loop)
  —Content Writer + Storyteller (polish)
  —MS365 Expert (publication)
```

### Workflow Phases

| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM forms collaboration team and establishes objectives | PM |
| 1 | Async Research & Discovery | Independent data gathering and fact-checking | Analyst |
| 2 | Narrative Framework & Alignment | Draft core storyline; obtain stakeholder alignment | Storyteller |
| 3 | Collaborative Drafting | Parallel creation of prose and technical docs | Content Writer, Technical Writer |
| 4 | Iterative Stakeholder Review | Continuous feedback loops with SMEs | Project Coordinator |
| 5 | Stylistic Polish & Finalization | Final formatting, brand voice refinement | Content Writer, Storyteller |
| 6 | Automated Publication | Push artifacts to channels, archive, notify stakeholders | MS365 Expert |

---

## Collaboration Guidelines

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Research-Driven** | All decisions start from evidence, validated through analysis |
| **Clear Communication** | Complex information synthesized for diverse audiences |
| **Stakeholder Alignment** | Inclusive communication and structured review processes |
| **Knowledge Management** | Organized archives and consistent documentation standards |

### Rules

1. Start every task with research or existing data —document sources before drafting.
2. All content must be reviewed by at least one stakeholder before publication.
3. Archive source materials alongside final artifacts.
4. Use templates and consistent formatting for all deliverables.
5. All PR titles, bodies, and review comments must be in **English**.

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

### Recommended Folder Structure (co-work)
| Folder | Purpose |
|--------|---------|
| `docs/reports/` | Final deliverables, client-ready reports |
| `docs/drafts/` | Work-in-progress documents and drafts |
| `docs/research/` | Research notes, reference materials |
| `memory/` | Session logs, meeting transcripts |

---

## Domain Rules

<!-- co-work variant specific rules —edit after project creation -->
1. All research findings must be logged to memory/ with source citations.
2. Stakeholder review comments must be tracked in the project coordination log.
3. Publication artifacts must be version-controlled before distribution.

---

*co-work.context.md version: 1.0 —created by /new-project*
