# [Project Name] — co-design Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md             — immutable project identity (architecture, standards)
>   2. docs/co-design.context.md   — THIS FILE — design stack, agents, skills, workflow

---

## Design Stack

| Layer | Technology / Standard |
|-------|----------------------|
| **Design Tokens** | [e.g., Figma Variables / CSS Custom Properties] |
| **Component Library** | [e.g., Custom / shadcn/ui / Material Design] |
| **Prototyping Tool** | [e.g., Figma / Framer / Principle] |
| **Handoff Format** | [e.g., Figma Dev Mode / Zeplin / Storybook] |
| **Research Tools** | [e.g., Maze, UserTesting, Hotjar] |

---

## Agents

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| Design PM (Orchestrator) | `agents/pm.md` | Design workflow management, dispatch, quality gates | active |
| UX Researcher | `agents/ux-researcher.md` | User research and insights | active |
| Design Lead | `agents/design-lead.md` | Design direction and system architecture | active |
| Visual Designer | `agents/visual-designer.md` | Visual designs and specifications | active |
| Prototype Engineer | `agents/prototype-engineer.md` | Interactive prototypes and handoff | active |
| Storyteller | `agents/storyteller.md` | Narrative and user journey definition | active |
| Typography Expert | `agents/typography-expert.md` | Type hierarchy and font systems | active |
| Service Designer | `agents/service-designer.md` | End-to-end service experience design | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Skill | Directory | Trigger | Status |
|-------|-----------|---------|--------|
| UI/UX Design Intelligence | `.claude/skills/ui-ux-design-intelligence/` | Building design systems, visual designs, UI components | active |
| Service Design | `.claude/skills/service-design/` | Designing end-to-end service experiences | active |
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
Design brief received
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

### Agent Dispatch Order (co-design standard)

```
Design PM
  → UX Researcher + Design Lead (parallel — research + strategy)
  → Visual Designer → Prototype Engineer (sequential — design + prototype)
  → UX Researcher (validation loop — continuous)
  → Design Lead + Visual Designer (system refinement + handoff)
```

### Workflow Phases

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM creates specialized design agents/skills | Design PM |
| 1 | Narrative & Ecosystem Mapping | Core user story, service touchpoints, problem space | Storyteller, UX Researcher |
| 2 | Foundational Exploration | Typographic hierarchy, visual mood boards, layout frameworks | Typography Expert, Visual Designer |
| 3 | Rapid Prototyping Loops | Continuous build/test low-fi → high-fi prototypes | Prototype Engineer, Design Lead |
| 4 | Continuous Validation | Parallel user testing and a11y validation | UX Researcher, Design Lead |
| 5 | System Refinement & Handoff | Polish, finalize design system, dev handoff | Visual Designer, Prototype Engineer |

> Phases 3 and 4 operate as a continuous loop rather than sequential steps.

---

## Design Guidelines

### Core Principles

| Principle | Description |
|-----------|-------------|
| **User-Centered** | All design decisions start from user needs; validated through research |
| **Accessible by Default** | WCAG AA compliance is a baseline, not an add-on |
| **System-Thinking** | Every design decision considers the broader design system |
| **Iterative Validation** | Designs validated through prototypes and user feedback |

### Rules

1. Start every design task with research or existing insights — document user needs before designing.
2. Every design decision must consider the broader design system — reuse before creating new.
3. WCAG AA is the minimum accessibility bar — aim higher when feasible.
4. Create prototypes to validate decisions before finalizing.
5. Explain design rationale and constraints explicitly, not just visual choices.
6. All PR titles, bodies, and review comments must be in **English**.

---

## Domain Rules

<!-- co-design variant specific rules — edit after project creation -->
1. Design tokens must be documented before implementation.
2. All new components require design system review from Design Lead.
3. User testing findings must be logged to memory/ before design decisions are finalized.

---

*co-design.context.md version: 1.0 — created by /new-project*
