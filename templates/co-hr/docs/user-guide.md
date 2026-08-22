# Co-HR User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> This guide explains how to *use* a co-hr project — how to hand engagement work to the
> agent team, what happens at each phase, and where output lands. For the full roster and
> repository layout, see [`../README.md`](../README.md); for governance rules, see
> [`../AGENTS.md`](../AGENTS.md).

## 1. Quick Start

1. Bring your request to the **PM** — it is the single entry point. Describe the engagement
   in plain language (the project's working language): *"Review our disciplinary-dismissal procedure for
   compliance"* or *"Design a new performance-management system for 300 employees."*
2. The PM classifies the request into one of **11 engagement archetypes**
   (see §2) and assigns the archetype's lead + supporting agents.
3. For any multi-agent task, the PM first shows an **execution plan table** and waits for
   your approval before dispatching:

   | Task | Agent | Tier | Model | Platform |
   |------|-------|------|-------|----------|
   | Statutory research (labor law of the target jurisdiction) | labor-compliance-analyst | High | claude-opus-5-0 | Claude Code |
   | Workforce data analysis | data-analyst | Medium | claude-sonnet-5-0 | Claude Code |

4. Once approved, specialists run — research in parallel where safe, writes serialized.
   Engagements with legal exposure pass a **compliance cross-validation** step
   (Phase 1.5) before design work begins.
5. The PM verifies results against acceptance criteria by running
   `bun scripts/audit.ts`, then presents the deliverable for **client sign-off**
   (Phase 2 approval gate).
6. The engagement closes via `/sync` — the only supported commit path; the pre-commit
   hook blocks direct `git commit` / `git push`.

> **Rule of thumb**: if you are unsure which specialist owns something, ask the PM —
> it routes; it never silently reassigns your request.

## 2. What Kind of Engagement Do You Have?

| Your scenario | Lead agent | Skill(s) involved |
|---------------|-----------|-------------------|
| Labor law compliance audit | labor-compliance-analyst | `k-law` (KR profile), `hr-metrics-analysis` |
| Labor dispute / labor-relations-authority response | labor-relations-specialist | `k-law` (KR profile) |
| Occupational safety & health compliance | safety-health-officer | `k-law` (KR profile), `k-kosis` (KR profile) |
| Org restructuring / workforce planning | org-design-consultant | `org-design-framework`, `org-readiness-assessment` |
| Compensation & benefits redesign | compensation-benefits-analyst | `compensation-benchmarking` |
| Performance management system design | performance-management-consultant | `performance-system-design` |
| Talent acquisition strategy | talent-acquisition-specialist | `talent-acquisition-strategy` |
| Learning & development / capability building | learning-development-specialist | `learning-curriculum-design` |
| Career & succession planning | career-succession-consultant | `career-path-succession-planning` |
| Change management / culture & rollout | change-management-partner | `stakeholder-alignment`, `org-readiness-assessment` |
| Cross-functional HR transformation | pm (coordinates multiple leads) | `consulting-report-writing` + archetype skills |

Requests spanning multiple archetypes are sequenced (one engagement completes before the
next starts) or PM-coordinated — see
[`engagement-orchestration.md`](engagement-orchestration.md).

## 3. The Standard Multi-Stage Workflow

```
Intake & Archetype Classification (PM)
        │
        ▼
Diagnosis & Research (archetype lead, parallel where safe)
        │
        ▼
Compliance & Cross-Validation (Phase 1.5 — legal-exposure engagements only)
        │
        ▼
Design ──► APPROVAL GATE (client sign-off, no execution without it)
        │
        ▼
Stakeholder Validation (change-management-partner, org-wide rollouts)
        │
        ▼
Delivery & Rollout ──► audit gate ──► /sync (commit + PR)
```

Key commands (inherited from the common template):

- `/sync "feat: ..."` — full pipeline: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — session logging and task blocks
- `/meeting "topic"` — structured multi-agent discussion when a decision is contested

Never bypass the PM workflow with direct specialist invocation, and never run raw
`git commit` / `git push` — the hooks will reject it.

## 4. Engagement Phase Structure

| Phase | Owner | What happens |
|-------|-------|--------------|
| 0 — Intake & Archetype Classification | pm | Request classified into one of 11 archetypes; lead + support assigned |
| 1 — Diagnosis & Research | Archetype lead | Statutory research (per active country profile), workforce data (data-analyst), or domain research |
| 1.5 — Compliance & Cross-Validation | pm (dispatches validators) | labor-compliance-analyst signs off legal exposure; data-analyst validates quantitative methodology |
| 2 — Design & Approval Gate | Archetype lead | Design/recommendation produced; **client sign-off required** before execution |
| 3 — Stakeholder Validation | change-management-partner | Always involved for org-wide rollouts, regardless of archetype |
| 4 — Delivery & Rollout | Archetype lead | Final deliverable production and rollout plan execution |

Reads (research, data pulls) may run in parallel; **writes are serialized** — one agent
writes a given file at a time, coordinated by the PM.

## 5. Where Your Output Goes

| Output | Location |
|--------|----------|
| Engagement documentation & reports | `docs/` |
| Session log entries | `memory/YYYY-MM-DD.md` (indexed by `memory/MEMORY.md`) |
| User-facing change entries | `CHANGELOG.md` → PR |
| Compliance verification | `bun scripts/audit.ts` (must exit 0 before `/sync`) |

Domain rules to keep in mind:

- Statutory claims must cite the applicable jurisdiction's law via its statute-lookup
  tooling (`k-law` when the active country profile is KR); workforce statistics use
  `k-kosis` under KR. Core statute families are enumerated by the active country
  profile (see `docs/countries/KR.md`).
- Legal-exposure engagements (restructuring, policy change, dismissal-adjacent) cannot
  pass Phase 2 without labor-compliance-analyst sign-off.
- The Phase 2 approval gate is hard: no execution work begins on unapproved designs,
  even under schedule pressure.
- Deliverables are consulting work product, not legal advice — flag jurisdiction-bound
  conclusions as requiring attorney review where applicable.
