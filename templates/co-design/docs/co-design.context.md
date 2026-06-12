# [Project Name] —co-design Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md             —immutable project identity (architecture, standards)
>   2. docs/co-design.context.md   —THIS FILE —design stack, agents, skills, workflow

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

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

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
All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

---

## Development Workflow

```
Design brief received
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

### Agent Dispatch Order (co-design standard)

```
Design PM
  —UX Researcher + Design Lead (parallel —research + strategy)
  —Visual Designer —Prototype Engineer (sequential —design + prototype)
  —UX Researcher (validation loop —continuous)
  —Design Lead + Visual Designer (system refinement + handoff)
```

### Workflow Phases

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM creates specialized design agents/skills | Design PM |
| 1 | Narrative & Ecosystem Mapping | Core user story, service touchpoints, problem space | Storyteller, UX Researcher |
| 2 | Foundational Exploration | Typographic hierarchy, visual mood boards, layout frameworks | Typography Expert, Visual Designer |
| 3 | Rapid Prototyping Loops | Continuous build/test low-fi —high-fi prototypes | Prototype Engineer, Design Lead |
| 4 | Continuous Validation | Parallel user testing and a11y validation | UX Researcher, Design Lead |
| 5 | System Refinement & Handoff | Polish, finalize design system, dev handoff | Visual Designer, Prototype Engineer |

> Phases 3 and 4 operate as a continuous loop rather than sequential steps.

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Design Guidelines
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; update when source changes -->

### Core Principles

1. **User-centered** — all design decisions grounded in user needs and research.
2. **Consistency first** — follow the established design system; document exceptions.
3. **Accessibility** — WCAG 2.1 AA compliance required for all UI components.
4. **Simplicity** — prefer fewer, well-considered decisions over complex solutions.
5. **PR required** — all design changes via `/sync`; never direct push to main.

### Design System

Maintain component library consistency: reuse existing components before creating new ones. Document any new components in `docs/design-system/`.

### Hybrid Scripting

All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).
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

### Recommended Folder Structure (co-design)
| Folder | Purpose |
|--------|---------|
| `docs/designs/` | Design decisions and rationale |
| `docs/specs/` | UI/UX specifications |
| `docs/prototypes/` | Prototype documentation |
| `memory/` | Session logs, design review transcripts |

---

## Domain Rules

<!-- co-design variant specific rules —edit after project creation -->
1. Design tokens must be documented before implementation.
2. All new components require design system review from Design Lead.
3. User testing findings must be logged to memory/ before design decisions are finalized.

---

*co-design.context.md version: 1.1 — normalized to canonical template structure*
