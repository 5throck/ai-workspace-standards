# Co-Design User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

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
| "Prepare final handoff materials for engineering" | `prototype-engineer`, `visual-designer` | `ui-ux-design-intelligence` | 4 |
| "Facilitate a cross-team design decision" | PM via `/meeting` | — | any |

**Notes:**
- `typography-expert` is optional — skip it if font decisions are already fixed by brand guidelines.
- `storyteller` is optional for purely functional/technical design work with no narrative dimension.
- If a request spans multiple rows (e.g. "research and then design an onboarding flow"), the PM will sequence multiple agents and show the full execution plan.

---

## 3. The Design Pipeline Walkthrough

Co-design follows a seven-phase pipeline (Phase 0–6). Prototyping (Phase 4) feeds back into validation loops rather than running as a strict linear handoff.

```
Design brief received
  │
  ▼
Phase 0 — Project Initiation     (PM)
  PM clarifies the design objective, confirms scope, and assembles the team.
  │
  ▼
Phase 1 — User Research & Narrative Foundation     (ux-researcher, storyteller)
  Research findings, personas, and the design philosophy statement.
  │
  ▼
Phase 2 — Design Direction & Approval     (design-lead, storyteller; PM gate)
  Design direction + token architecture synthesized — explicit user approval required.
  │
  ▼
Phase 3 — Design System & Execution     (design-lead, visual-designer, service-designer, typography-expert)
  High-fidelity designs, specs, and the type system per the approved direction.
  │
  ▼
Phase 4 — Prototyping & Handoff     (prototype-engineer; i18n-specialist support)
  Interactive prototypes, interaction specs, developer handoff docs;
  ux-researcher re-enters for validation loops when required.
  │
  ▼
Phase 5 — Lifecycle Finalization     (PM)
  Governance records updated, decisions logged to memory/.
  │
  ▼
Phase 6 — Quality Assurance & Finalization     (PM)
  bun scripts/audit.ts gate, then /sync "feat: description" → PR opened.
```

**Key commands/scripts involved:**
- `bun scripts/audit.ts` — the QA gate; runs at pre-push (`scripts/hooks/pre-push.ts`) and inside the `/sync` pipeline (audit gate step) — it does not run automatically after Write/Edit.
- `/sync "type(scope): message"` — the only sanctioned way to commit, push, and open a PR; direct `git commit`/`git push` calls are blocked by the pre-commit hook.
- `/meeting` — for resolving disagreements or reviewing decisions mid-pipeline without leaving the phase.

---

## 4. Engagement / Project Phase Structure

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|----------------|
| 0 | Project Initiation | PM clarifies the design objective, confirms scope, assembles the team | PM |
| 1 | User Research & Narrative Foundation | User research, personas, design philosophy statement | `ux-researcher`, `storyteller` |
| 2 | Design Direction & Approval | Direction + token architecture synthesized; explicit user-approval gate | PM + `design-lead`, `storyteller` |
| 3 | Design System & Execution | High-fidelity designs, specifications, type system per approved direction | `design-lead`, `visual-designer`, `service-designer`, `typography-expert` |
| 4 | Prototyping & Handoff | Interactive prototypes, interaction specs, developer handoff docs | `prototype-engineer` (optional support: `i18n-specialist`) |
| 5 | Lifecycle Finalization | Governance records updated, decisions logged | PM |
| 6 | Quality Assurance & Finalization | Audit gate, `/sync`, PR | PM |

> Full phase definitions live in [docs/phase-definitions.md](phase-definitions.md); project-specific customization of the design stack and workflow lives in [docs/co-design.context.md](co-design.context.md).

---

## 5. Output / Deliverable Locations

| Location | Contents |
|----------|----------|
| `docs/designs/` | Design decisions and rationale (design direction write-ups, ADR-style notes) |
| `docs/specs/` | UI/UX specifications (component specs, design token docs, accessibility reports) |
| `memory/YYYY-MM-DD.md` | Session logs, design review transcripts, meeting outcomes |
| `CHANGELOG.md` | User-facing summary of shipped design changes, under `[Unreleased]` until released |

Interactive prototypes live in the `playground/` demo app; prototype and handoff design docs live in `docs/designs/`.

Reuse existing components and tokens before creating new ones — document any new component in `docs/specs/` and register it with `design-lead` for design-system review.

---

*For the full agent roster, mission statement, and workflow overview, see [README.md](../README.md). For governance, dispatch rules, and the PM Gateway specification, see [AGENTS.md](../AGENTS.md).*
