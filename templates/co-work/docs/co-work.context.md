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

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

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

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Writing Guidelines
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; source: docs/constitution/08-coding-guidelines.md; hash: 3a0b3968 -->

### Core Principles

1. **Audience-first** — write for the reader; tailor tone, depth, and format to their context.
2. **Clarity over cleverness** — plain language preferred; no jargon without definition.
3. **Evidence-based** — all claims supported by sources or data; cite inline.
4. **Consistent voice** — follow the established style guide for tone and terminology.
5. **PR required** — all content changes via `/sync`; never direct push to main.

### Content Review Process

All content must pass a peer review before publication. Use the content review checklist in `docs/content-review-checklist.md`.

### Hybrid Scripting

All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).
<!-- END VARIANT-INJECT -->

## Automation Runbook — When to Script vs When to Hand Off

Every recurring task in an engagement lands in exactly one of three lanes. Decide **before the second manual repetition**; record the decision (lane + one-line reason) in the engagement coordination log.

| Lane | Use when | Owner | Artifact |
|------|----------|-------|----------|
| **1. Workspace script** | Inputs/outputs are workspace files; the transform is deterministic; reruns happen inside this engagement | any agent, via `bun scripts/...` (TypeScript only — ADR-0036) | script under `scripts/co-work/` + SCRIPTS.md row once it recurs |
| **2. Platform automation (hand-off)** | Cross-system triggers or schedules that outlive the engagement; needs org credentials/tenancy; multi-step human approvals | `project-coordinator` PLANS it — connector id + node id cited from `docs/connector-schemas.json` **[WORK-R2]** | automation proposal; execution lands in the org's workflow platform (n8n / Power Automate class), never in this workspace |
| **3. Human process** | Judgment-heavy, stakeholder-relations nuance, or ≤2 expected occurrences | the responsible agent | written runbook step in the engagement coordination doc |

**Decision ladder** (first match wins):

1. Does it touch systems outside the workspace (mail, chat, forms, ERP) or must it keep running after the engagement? → Lane 2.
2. Would a script need credentials the workspace must not hold? → Lane 2.
3. Is the expected occurrence count ≤2, or does quality depend on human judgment? → Lane 3.
4. Otherwise → Lane 1.

**Tie-breakers**: torn between Lanes 1 and 2, prefer Lane 1 for anything that produces deliverable content (Computational Integrity applies to it) and Lane 2 only for orchestration around that content. When a Lane 3 task reaches its third repetition, re-decide — it has usually become Lane 1 or 2 by then.

**Hard boundaries**: connector contracts are planning artifacts, not executors (Domain Rule 5) — the workspace never runs a cross-system automation. Conversely, deliverable-producing computation never lives in an external platform, where it escapes version control and audit.

---

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

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
4. Corporate document styles are SSOT'd at `docs/document-style-registry.json` - style bundles keyed by document type (memo, report, deck, reserved spreadsheet) for OOXML compilation. Agents producing OOXML deliverables MUST read the registry for the target document type rather than inventing styles; see `docs/document-style-registry.md` for the schema and consumption contract. **[WORK-R1]**
5. Workflow connector contracts are SSOT'd at `docs/connector-schemas.json` - trigger/event and action node contracts per integration (n8n-style node typing) for coordination automations. `project-coordinator` automation proposals MUST cite a connector id + node id from the pack; contracts are planning artifacts, not executors. See `docs/connector-schemas.md` for the schema and consumption contract. **[WORK-R2]**
6. **Automation lane decisions follow the Automation Runbook** **[WORK-R3]**: before the second manual repetition of any recurring task, record a lane decision (workspace script / platform hand-off / human process) with a one-line reason in the engagement coordination log, per the decision ladder in the Automation Runbook section. Cross-system automations are planned via `docs/connector-schemas.json` and executed in the org's workflow platform — never from this workspace; deliverable-producing computation stays in workspace scripts.

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

*co-work.context.md version: 1.3 — connector-schemas referenced (Domain Rule 5)*
*co-work.context.md version: 1.4 — Automation Runbook section added + Domain Rule 6 [WORK-R3] (when to script vs when to hand off; backlog §8 Open row 14, closed 2026-08-26)*
