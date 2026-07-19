# Co-Design User Guide

> A practical, task-oriented companion to [README.md](../README.md). Where the README introduces the team, this guide shows you how to actually get work done: how to start an engagement, who to ask for what, and where the results land.

---

## 1. Quick Start

1. **Talk to the PM first.** Never invoke a specialist agent directly — always start your request with the Project Manager (PM). The PM is the single point of entry for the whole team.
2. **The PM produces an execution plan table** before dispatching anyone. For any multi-step request (2+ agents or 2+ sequential steps), expect to see a table like:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | Map onboarding journey | `service-designer` | Medium | sonnet |
   | 2 | Define design tokens | `design-lead` | High | opus |
   | N | `/sync "feat: onboarding journey + tokens"` | pm | Medium | sonnet |

   Review the plan, then approve it before work begins.
3. **Specialists execute**, handing off to each other directly for routine steps (e.g. `design-lead` → `visual-designer`) without re-routing through the PM every time.
4. **Close out with `/sync`.** Every engagement segment ends with `/sync "type(scope): message"`, which runs the full pipeline: memlog → CHANGELOG entry → audit → commit → push → PR. Do not commit or push directly — the pre-commit hook blocks it.

**Other everyday commands:**
- `/changelog "..."` — add a `CHANGELOG.md [Unreleased]` entry ahead of a sync.
- `/memlog "summary"` — log a session note without running the full pipeline.
- `/meeting "topic" [--agents a,b] [--rounds N]` — run a structured multi-agent discussion in place, e.g. to resolve a design disagreement between `design-lead` and `storyteller`.

---

## 2. What Kind of Design Task Do You Have?

Use this table to figure out who (or what skill) to ask the PM to bring in. You don't need to name the agent yourself — just describe the problem; the PM will match it — but knowing the mapping helps you phrase requests and set expectations.

| Your scenario | Agent(s) | Skill(s) | Phase |
|----------------|----------|----------|-------|
| "We don't know what users actually need / struggle with" | `ux-researcher` | — | 1 |
| "What's the story / philosophy behind this design system?" | `storyteller` | — | 1–2 |
| "Define our design tokens, color system, and component architecture" | `design-lead` | `ui-ux-design-intelligence` | 2–3 |
| "Design this screen / component / flow" | `visual-designer` | `ui-ux-design-intelligence` | 3 |
| "Pick typefaces and define our type scale" | `typography-expert` | — | 3 |
| "Map the customer's end-to-end journey / service blueprint" | `service-designer` | `service-design` | 3 |
| "Optimize a specific touchpoint or align frontstage/backstage ops" | `service-designer` | `service-design` | 3 |
| "Build an interactive prototype for testing or stakeholder demo" | `prototype-engineer` | — | 4 |
| "Validate this design with real users / run usability tests" | `ux-researcher` | — | 4 (loop) |
| "Prepare final handoff materials for engineering" | `prototype-engineer`, `visual-designer` | `ui-ux-design-intelligence` | 5 |
| "Facilitate a cross-team design decision" | PM via `/meeting` | — | any |

**Notes:**
- `typography-expert` is optional — skip it if font decisions are already fixed by brand guidelines.
- `storyteller` is optional for purely functional/technical design work with no narrative dimension.
- If a request spans multiple rows (e.g. "research and then design an onboarding flow"), the PM will sequence multiple agents and show the full execution plan.

---

## 3. The Design Pipeline Walkthrough

Co-design follows a six-phase pipeline (Phase 0–5). Phases 3 and 4 form a continuous build/test loop rather than a strict linear handoff.

```
Design brief received
  │
  ▼
Phase 0 — Team Assembly           (PM)
  PM creates/confirms the specialized agent & skill roster for this project.
  │
  ▼
Phase 1 — Narrative & Ecosystem Mapping     (storyteller, ux-researcher)
  Core user story, service touchpoints, and problem space defined.
  │
  ▼
Phase 2 — Foundational Exploration          (typography-expert, visual-designer, design-lead)
  Typographic hierarchy, visual mood boards, layout frameworks, design tokens.
  │
  ▼
Phase 3 ⇄ Phase 4 — Rapid Prototyping & Continuous Validation   (loop)
  prototype-engineer + design-lead build low-fi → high-fi prototypes;
  ux-researcher + design-lead run parallel user testing and a11y validation.
  Repeat until the design holds up under test.
  │
  ▼
Phase 5 — System Refinement & Handoff       (visual-designer, prototype-engineer)
  Polish, finalize the design system, produce dev handoff package.
  │
  ▼
/sync "feat: description"
  1. bun scripts/audit.ts      — abort on failure
  2. memory/YYYY-MM-DD.md      — session log written
  3. MEMORY.md index updated
  4. CHANGELOG.md [Unreleased] entry added
  5. git commit (on pr/<date>-<slug> branch)
  6. git push + gh pr create
```

**Key commands/scripts involved:**
- `bun scripts/audit.ts` — the QA gate; also runs automatically via the PostToolUse hook after Write/Edit on the CLI (run manually on the Desktop App).
- `/sync "type(scope): message"` — the only sanctioned way to commit, push, and open a PR; direct `git commit`/`git push` calls are blocked by the pre-commit hook.
- `/meeting` — for resolving disagreements or reviewing decisions mid-pipeline without leaving the phase.

---

## 4. Engagement / Project Phase Structure

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|----------------|
| 0 | Team Assembly | PM creates specialized design agents/skills | Design PM |
| 1 | Narrative & Ecosystem Mapping | Core user story, service touchpoints, problem space | Storyteller, UX Researcher |
| 2 | Foundational Exploration | Typographic hierarchy, visual mood boards, layout frameworks | Typography Expert, Visual Designer, Design Lead |
| 3 | Rapid Prototyping Loops | Continuous build/test low-fi → high-fi prototypes | Prototype Engineer, Design Lead |
| 4 | Continuous Validation | Parallel user testing and a11y validation | UX Researcher, Design Lead |
| 5 | System Refinement & Handoff | Polish, finalize design system, dev handoff | Visual Designer, Prototype Engineer |

> Full phase and dispatch-trigger definitions live in [AGENTS.md](../AGENTS.md); project-specific customization of the design stack and workflow lives in [docs/co-design.context.md](co-design.context.md).

---

## 5. Output / Deliverable Locations

| Location | Contents |
|----------|----------|
| `docs/designs/` | Design decisions and rationale (design direction write-ups, ADR-style notes) |
| `docs/specs/` | UI/UX specifications (component specs, design token docs, accessibility reports) |
| `docs/prototypes/` | Prototype documentation and handoff notes |
| `memory/YYYY-MM-DD.md` | Session logs, design review transcripts, meeting outcomes |
| `CHANGELOG.md` | User-facing summary of shipped design changes, under `[Unreleased]` until released |

Reuse existing components and tokens before creating new ones — document any new component in `docs/specs/` and register it with `design-lead` for design-system review.

---

*For the full agent roster, mission statement, and workflow overview, see [README.md](../README.md). For governance, dispatch rules, and the PM Gateway specification, see [AGENTS.md](../AGENTS.md).*
