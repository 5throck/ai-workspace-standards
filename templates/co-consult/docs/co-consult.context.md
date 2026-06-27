# [Project Name] — co-consult Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md               — immutable project identity (architecture, standards)
>   2. docs/co-consult.context.md    — THIS FILE — tech stack, agents, skills, workflow

---

## Tool Stack

> Add your engagement's specific tools and platforms here.
> Examples: research tools, communication platforms, productivity suites, data analysis tools.

| Purpose | Tool |
|---------|------|
| *(e.g., Research)* | *(e.g., your preferred research tool)* |
| *(e.g., Communication)* | *(e.g., your team's platform)* |

---

## Agents

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| **Engagement Leader** | `agents/pm.md` | Engagement orchestration, client interface, final decisions, QA | active |
| **Change Management Partner** | `agents/change-management-partner.md` | Organizational transformation, culture strategy, stakeholder alignment | active |
| **Strategy Analyst** | `agents/strategy-analyst.md` | Market analysis, competitive research, financial modeling | active |
| **Industry Expert** | `agents/industry-expert.md` | Industry-specific insights, competitive dynamics, regulatory landscape | active |
| **Subject Matter Expert** | `agents/sme.md` | Functional expertise (HR, Finance, Operations, Marketing) | active |
| **Communications Lead** | `agents/communications-lead.md` | Client communications, presentations, strategic narratives | active |
| **Solutions Architect** | `agents/solutions-architect.md` | Technical solution design, system architecture, implementation roadmaps | active |
| **Workstream Lead** | `agents/workstream-lead.md` | Workstream management, team coordination, progress tracking | active |
| **Delivery Manager** | `agents/delivery-manager.md` | Project delivery, operations coordination, resource allocation | active |
| **Technology Specialist** | `agents/technology-specialist.md` | Collaboration platforms, workflow automation, digital transformation | active |
| **Data Analyst** | `agents/data-analyst.md` | Statistical analysis, data modeling, visualization | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- DYNAMIC_SKILLS_START -->
**Platform Skills**

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Research Analysis** | `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| **Documentation Writing** | `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| **API Documentation** | `.claude/skills/api-documentation/SKILL.md` | Documenting REST APIs, GraphQL interfaces, SDKs |
| **Meeting Facilitation** | `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings |
| **Agent Lifecycle Manager** | `skills/agent-lifecycle-manager/SKILL.md` | Managing agent lifecycle and validation |
| **Skill Lifecycle Manager** | `skills/skill-lifecycle-manager/SKILL.md` | Managing skill lifecycle and validation |
| **Project Review** | `.claude/skills/project-review/SKILL.md` | Comprehensive parallel review of the project |
| **Team Builder** | `skills/team-builder/SKILL.md` | Build new agent team: requirements interview, benchmarking, proposal generation, approval gate |

**Phase 1 — Research & Analysis**

| Skill | File | Owner |
|-------|------|-------|
| **Competitive Intelligence** | `skills/competitive-intelligence/SKILL.md` | strategy-analyst |
| **Financial Modeling** | `skills/financial-modeling/SKILL.md` | strategy-analyst |
| **Insight Synthesis** | `skills/insight-synthesis/SKILL.md` | strategy-analyst |
| **Stakeholder Alignment** | `skills/stakeholder-alignment/SKILL.md` | change-management-partner |
| **Org Readiness Assessment** | `skills/org-readiness-assessment/SKILL.md` | change-management-partner |

**Phase 3 — Content Creation**

| Skill | File | Owner |
|-------|------|-------|
| **Change Impact Assessment** | `skills/change-impact-assessment/SKILL.md` | change-management-partner |
| **Narrative Framework** | `skills/narrative-framework/SKILL.md` | communications-lead |
| **Consulting Report Writing** | `skills/consulting-report-writing/SKILL.md` | communications-lead |
| **Executive Presentation** | `skills/executive-presentation/SKILL.md` | communications-lead |
| **Solution Design** | `skills/solution-design/SKILL.md` | solutions-architect |
| **Technical Feasibility** | `skills/technical-feasibility/SKILL.md` | solutions-architect |

**Phase 4 — Delivery**

| Skill | File | Owner |
|-------|------|-------|
| **Project Delivery** | `skills/project-delivery/SKILL.md` | delivery-manager |
| **Stakeholder Review Management** | `skills/stakeholder-review-management/SKILL.md` | delivery-manager |
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

<!-- VARIANT-INJECT: environment-setup [REQUIRED] -->
- Copy `.env.sample` → `.env` and fill in all required values.
- Required env keys (see `.env.sample`): *(fill in after project creation)*
<!-- END VARIANT-INJECT -->

---

## Development Workflow

```
Client brief / task received
  —
/sync "feat: description"
  —
  1. audit.ts — abort on failure
  2. memory/YYYY-MM-DD.md — session log (4-section format)
  3. MEMORY.md index update
  4. git add -A → commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-consult standard)

```
Engagement Leader
  ├── Strategy Analyst        (Phase 1 — research, async)
  ├── Change Management Partner  (Phase 1-2 — org & culture analysis)
  ├── [Industry Expert / SME]    (Phase 1 — specialist input, when needed)
  ├── Communications Lead        (Phase 3 — client deliverables, parallel)
  ├── Solutions Architect        (Phase 3 — technical design, parallel)
  ├── Workstream Lead            (Phase 3-4 — coordination, when 3+ streams)
  ├── Delivery Manager           (Phase 4 — stakeholder review & logistics)
  ├── Technology Specialist      (Phase 4 — platform implementation)
  └── Data Analyst               (Phase 1/3 — modeling & visualization, when needed)
```

### Workflow Phases

| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Engagement Initiation | Engagement Leader defines scope, assembles team, confirms client objectives | Engagement Leader |
| 1 | Research & Data Gathering | Strategy Analyst conducts market/competitive research; Change Management Partner assesses org readiness | Strategy Analyst, Change Management Partner |
| 2 | Design Review & Approval | Proposed approach presented to client/user; **approval gate** — no execution without sign-off | Engagement Leader |
| 3 | Content Creation | Communications Lead drafts client deliverables; Solutions Architect designs technical solutions (parallel) | Communications Lead, Solutions Architect |
| 4 | Platform Delivery | Delivery Manager coordinates stakeholder reviews; Technology Specialist implements M365 workflows | Delivery Manager, Technology Specialist |
| 5 | QA & Finalization | Engagement Leader runs audit scripts, validates all deliverables meet quality standards | Engagement Leader |
| 6 | PR & Handoff | Engagement Leader runs `/sync`, creates PR, delivers final output to client | Engagement Leader |

---

## Team Configuration Scenarios

See [`docs/team-configuration-guide.md`](team-configuration-guide.md) for full scenario details.

| Scenario | Core Agents | Duration | Best For |
|----------|------------|---------|----------|
| **Quick Assessment** | Engagement Leader + Strategy Analyst + Communications Lead | 1–2 weeks | Rapid diagnostics, feasibility studies |
| **Standard Engagement** | 5 core agents | 4–8 weeks | Strategy development, operational improvement |
| **Complex Transformation** | Full team (11 agents) | 8–16 weeks | Digital transformation, large-scale restructuring |
| **Specialized Expert** | 3–4 agents + expert | 2–4 weeks | Deep industry or functional focus |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Consulting Guidelines

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Evidence-Driven** | All recommendations grounded in data and validated research |
| **Client-Centric** | Deliverables tailored to client's audience and decision context |
| **Structured Communication** | Complex insights synthesized into clear, actionable outputs |
| **Stakeholder Alignment** | Inclusive review processes and executive-level engagement |
| **Change-Aware** | Organizational readiness and culture factored into every recommendation |

### Rules

1. Start every engagement with research — document sources before drafting recommendations.
2. All client deliverables must pass the Phase 2 approval gate before execution.
3. Archive source materials alongside final artifacts.
4. Use consistent templates and formatting for all client-facing deliverables.
5. All PR titles, bodies, and branch names must be in **English**.

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

### Recommended Folder Structure (co-consult)

| Folder | Purpose |
|--------|---------|
| `deliverables/reports/` | Final deliverables, client-ready reports |
| `deliverables/drafts/` | Work-in-progress documents and drafts |
| `deliverables/research/` | Research notes, source materials, data |
| `deliverables/presentations/` | Client presentation decks |
| `memory/` | Session logs, meeting transcripts |

> **Note**: The `deliverables/` subdirectories and their README.md files are created automatically during project scaffolding.

### Output Destination Mapping

Each agent must save its deliverables to the designated folder with the specified naming convention. `{topic}` is derived from the engagement subject or client brief.

| Agent | Output Type | Destination | Naming Convention |
|-------|-------------|-------------|-------------------|
| Industry Expert | Industry analysis reports, trend briefings | `deliverables/reports/` | `{topic}-industry-analysis-{YYYY-MM-DD}.md` |
| Industry Expert | Regulatory overviews | `deliverables/research/` | `{topic}-regulatory-{YYYY-MM-DD}.md` |
| Strategy Analyst | Research findings, competitive analyses, financial models | `deliverables/research/` | `{topic}-{report-type}-{YYYY-MM-DD}.md` |
| Data Analyst | Data analysis reports, model outputs | `deliverables/research/` | `{topic}-data-analysis-{YYYY-MM-DD}.md` |
| Subject Matter Expert | Functional analysis reports, benchmarking | `deliverables/research/` | `{topic}-{function}-analysis-{YYYY-MM-DD}.md` |
| Change Management Partner | Culture statements, readiness assessments | `deliverables/research/` | `{topic}-change-assessment-{YYYY-MM-DD}.md` |
| Communications Lead | Consulting reports, stakeholder comms | `deliverables/reports/` | `{deliverable-type}-{YYYY-MM-DD}.md` |
| Communications Lead | Executive presentations | `deliverables/presentations/` | `{deck-title}-{YYYY-MM-DD}.md` |
| Solutions Architect | Architecture documents, feasibility assessments | `deliverables/reports/` | `{topic}-architecture-{YYYY-MM-DD}.md` |
| Workstream Lead | Status reports, execution plans, risk logs | `deliverables/drafts/` | `{workstream}-{report-type}-{YYYY-MM-DD}.md` |
| Delivery Manager | Project status reports, stakeholder trackers | `deliverables/drafts/` | `delivery-{report-type}-{YYYY-MM-DD}.md` |

---

## Domain Rules

1. All research findings must be logged to `memory/` with source citations.
2. Client-facing deliverables require Engagement Leader sign-off before distribution.
3. Stakeholder review comments must be tracked in the delivery coordination log.
4. Publication artifacts must be version-controlled before distribution.
5. Change management assessments must include organizational readiness scores.
6. All agent-produced deliverables MUST be saved to their designated output folder per the **Output Destination Mapping** table above. Agents MUST read this table before saving any file. Do not hard-code output paths in agent or skill definitions — this table is the single source of truth. Create the destination folder if it does not exist.

---

*co-consult.context.md version: 2.1 — normalized to canonical template structure*
