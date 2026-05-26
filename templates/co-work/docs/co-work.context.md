# [Project Name] — co-work Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md            — immutable project identity (architecture, standards)
>   2. docs/co-work.context.md    — THIS FILE — tool stack, agents, skills, workflow

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

| Skill | Directory | Trigger | Status |
|-------|-----------|---------|--------|
| Research Analysis | `.claude/skills/research-analysis/` | Analyzing topics, synthesizing research | active |
| Documentation Writing | `.claude/skills/documentation-writing/` | Creating guides, drafting communications | active |
| API Documentation | `.claude/skills/api-documentation/` | Documenting APIs and developer-facing specs | active |
| Agent Lifecycle Manager | `skills/agent-lifecycle-manager/` | Managing agent lifecycle | active |
| Skill Lifecycle Manager | `skills/skill-lifecycle-manager/` | Managing skill lifecycle | active |
| Meeting Facilitation | `skills/meeting-facilitation/` | Multi-agent meetings | active |

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

---

## Agent & Skill Lifecycle Management

This project follows explicit lifecycle management practices for Agents and Skills.

### Agent Lifecycle States

| State | Description | Action Required |
|-------|-------------|-----------------|
| **active** | In production use | Regular health checks via `agent:verify` |
| **deprecated** | Being phased out | Add frontmatter `status: deprecated` warning; reassign skills within 30 days |
| **retired** | No longer used | Move to `agents/_archive/`; delete after 90 days |

### Agent Lifecycle Commands

| Phase | Command | Documentation Update |
|-------|---------|---------------------|
| **Create** | `bun run agent:create <name> --role "Display" --group <group>` | Update `AGENTS.md` + this table |
| **List** | `bun run agent:list [--group <group>] [--verbose]` | N/A (read-only) |
| **Update** | Edit `agents/<name>.md` directly | Update `AGENTS.md` if role/triggers change |
| **Delete** | `bun run agent:delete <name> --force` | Update `AGENTS.md` + this table |
| **Verify** | `bun run agent:verify` | N/A (reports inconsistencies) |

### Skill Lifecycle States

| State | Description | Action Required |
|-------|-------------|-----------------|
| **draft** | Skill under development | Move to active after review |
| **active** | Skill in production use | Regular health checks |
| **deprecated** | Superseded, pending removal | Add frontmatter warning, archive after 30 days |
| **archived** | No longer used, kept for reference | Move to `skills/_archive/`, can delete after 90 days |

### Skill Lifecycle Commands

When PM agent modifies the agent team:

**New Agent Added:**
1. Does agent need a skill? → Create using `skill-creator:skill-creator`
2. Can existing skill be shared? → Update `owner: [agent1, agent2]`

**Agent Role Changed:**
1. Find all skills with `owner: changed-agent`
2. Update skill descriptions to reflect new scope
3. Bump version if capabilities changed (**patch** 1.0.x for wording, **minor** 1.x.0 for new steps, **major** x.0.0 for rewrites)

**Agent Removed:**
1. Find all skills with `owner: removed-agent`
2. Is skill shared? → Remove agent from owner list
3. Is skill needed by another agent? → Reassign owner
4. Is skill orphaned? → Change status to deprecated

### Audit Commands

- **Agent health**: `bun scripts/agent-lifecycle-audit.ts`
- **Skill health**: `bun scripts/skill-lifecycle-audit.ts`

Both audits check for:
- ✅ Missing owners
- ✅ Orphaned skills/agents (owner doesn't exist)
- ✅ Deprecated items still being modified
- ✅ Missing dependencies

---

## Scripts

<!-- Source Layer: L0 = templates/common (SSOT) | L1 = workspace root | L2 = project-local -->
<!-- Status: active | deprecated | experimental -->

| Script | Source Layer | Status |
|--------|-------------|--------|
| `scripts/audit.sh` / `.ps1` | L0 | active |
| `scripts/dev-sync.sh` / `.ps1` | L0 | active |
| `scripts/sync-md.sh` / `.ps1` | L0 | active |

> See SCRIPTS.md in templates/common/scripts/ for full lifecycle registry.

---

## Development Workflow

```
Brief / task received
  ↓
/sync "feat: description"
  ↓
  1. audit.sh — abort on failure
  2. memory/YYYY-MM-DD.md — session log (4-section format)
  3. MEMORY.md index update
  4. git add -A → commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-work standard)

```
Collaboration PM
  → Analyst (research — async)
  → Storyteller (narrative framework)
  → Content Writer + Technical Writer (parallel drafting)
  → Project Coordinator (stakeholder review loop)
  → Content Writer + Storyteller (polish)
  → MS365 Expert (publication)
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

1. Start every task with research or existing data — document sources before drafting.
2. All content must be reviewed by at least one stakeholder before publication.
3. Archive source materials alongside final artifacts.
4. Use templates and consistent formatting for all deliverables.
5. All PR titles, bodies, and review comments must be in **English**.

---

## Domain Rules

<!-- co-work variant specific rules — edit after project creation -->
1. All research findings must be logged to memory/ with source citations.
2. Stakeholder review comments must be tracked in the project coordination log.
3. Publication artifacts must be version-controlled before distribution.

---

*co-work.context.md version: 1.0 — created by /new-project*
