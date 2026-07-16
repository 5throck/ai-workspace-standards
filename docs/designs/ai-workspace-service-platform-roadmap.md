# AI Workspace → Service Platform Roadmap

**Date**: 2026-07-16
**Status**: Proposed (Phase A design approved; Phase B+ not started)
**Owner**: architect (this document), automation-engineer (Phase A implementation)
**Related**: [meeting-2026-07-16-ticket-kanban-design-review.md](../../memory/meeting-2026-07-16-ticket-kanban-design-review.md), `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md`, superseded: [meeting-2026-05-28-kanban-process-design.md](../../memory/archive/meeting-2026-05-28-kanban-process-design.md)

---

## 1. Vision

AI Workspace today is a **project standard**: a repository structure (agents, skills, scripts, governance) that makes a codebase legible to AI agents. The long-term direction is to extend this into a **service platform**: the same repository becomes an **AI Service Instance** — a unit that declares services it can perform, accepts requests for those services as tickets, and executes them (locally or on a hosted worker) under a shared queue/kanban model.

```
Repository (AI-legible project standard)   →   Workspace (AI Service Instance)
```

The central server, when it exists, does not run AI itself — it only handles authentication, service registry, ticket queue/kanban, scheduling, billing, and monitoring. Execution always happens in a Workspace (local or hosted), acting as a Worker that understands tickets, not the internals of any other workspace.

## 2. Phases

| Phase | Scope | Status |
|---|---|---|
| **A — Local Ticket/Kanban** | File-based service catalog (`services.yaml`) + ticket queue (`tickets/*.yaml`) + CLI (`scripts/ticket.ts`) + execution skill (`skills/ticket-run/`), workspace root (L0) only, single local user, no server | Design approved with changes (2026-07-16); implementation not started |
| **B — Team Sharing** | Same schema shared via git across a team; adds Requested/Approved lanes ahead of Waiting; multi-workspace-owner tickets; revisits the `tickets/` git-tracking policy set in Phase A | Not started — depends on real usage evidence from Phase A |
| **C — Central Orchestrator** | Hosted service: auth, service registry, ticket queue, scheduler, billing, worker allocation, artifact storage, notification. Workspaces become pull-based Workers | Not started — requires Phase B validation before server architecture is designed |
| **D — Public Service Catalog** | Central server aggregates `services.yaml` declarations from many workspaces into a browsable catalog (marketplace-like); users select a service, a ticket is created automatically | Not started |
| **E — SaaS** | Individual/team-hosted service offering, billing, multi-tenant operation | Not started |

Phase advancement is **not automatic on a calendar** — see §4 for promotion criteria, modeled on the existing beta→stable variant promotion pattern (`scripts/helpers/registries/promotion-policy.ts`, `docs/reports/variant-promotion-roadmap-2026-07.md`) rather than a fixed timeline.

## 3. Invariants (must hold at every phase)

These are binding decisions carried forward from the 2026-07-16 design review; a later phase may extend them but must not violate them without a new design review:

1. **`schemaVersion` is mandatory** on the service catalog and ticket schema from Phase A onward, so schema changes at any later phase are migrations, not silent breaks.
2. **Workers understand tickets, not workspaces.** A worker (local CLI in Phase A, hosted process in Phase C) never needs workspace-internal knowledge beyond what the ticket + referenced service declare.
3. **Execution targets are always allowlisted**, never freely specified by ticket content. `run.ref` resolves only against the service catalog, under an explicit path/name allowlist — this must hold even when Phase C introduces remote execution.
4. **The human review gate (`review→done`) is never removed**, only re-scoped. At Phase C it may become a configurable approval policy (auto-approve for trusted services, manual for others), but a bypass-everything mode is out of scope indefinitely.
5. **No bespoke scheduler is built while a native one suffices.** Per the 2026-06-02 decision (`memory/archive/meeting-2026-06-02-gemini-workspace-schedule.md`), scheduling should use native platform mechanisms (OS cron, Claude Code's schedule feature, `mcp__scheduled-tasks__*`) wherever available. Phase A's `schedule:` field in `services.yaml` is schema-only (no runtime) for exactly this reason; Phase C's scheduler component must justify explicitly why native scheduling is no longer sufficient before building one.

## 4. Phase Transition Criteria

| Transition | Minimum evidence required before design work starts |
|---|---|
| A → B | Phase A used in the owner's real daily workflow for a meaningful period; the retry (`failed→waiting`) and stale-`running` detection mechanisms have actually been exercised by a real failure, not just tested; no unresolved P0 security item from the Phase A security review remains open. |
| B → C | Phase B has run with at least one other real collaborator (not solo use); the `tickets/` git-tracking policy chosen in Phase A/B has proven workable at team scale (no unmanageable merge-conflict rate). |
| C → D/E | Explicit business decision outside this document's scope — requires its own design review once C is operating. |

These mirror the evidence-based (not calendar-based) gate already used for variant beta→stable promotion in this repo, applied here to phase advancement instead of variant status.

## 5. Reconciliation with Existing Repo Material

This roadmap does not introduce automation concepts in a vacuum. The following existing/prior decisions were checked and are carried forward or explicitly superseded:

- **Superseded**: the 2026-05-28 Kanban design (`kanban/board.md`, `CARD-YYYYMMDD-NNN`, GitHub Projects sync via `gh project item-add`) was never implemented and is now formally replaced by the Phase A ticket schema per the user's 2026-07-16 decision. General human tasks (the old design's primary use case) are folded into the unified ticket schema as `run: {type: manual}` — see the Phase A design doc for the schema-level separation this requires between manual and executable ticket types.
- **`scripts/dispatch.ts` (existing)** is session-scoped, ad-hoc agent fan-out with no persistent state — it is not superseded and is not the same mechanism as the Phase A ticket worker. `skills/ticket-run` may invoke `dispatch.ts` internally when a ticket's referenced service itself requires multi-agent work, but the ticket queue itself is the persistent layer `dispatch.ts` has never had. This relationship must be stated explicitly in the Phase A skill's documentation to avoid confusing the two.
- **No ADR currently governs dispatch/queue/scheduler architecture.** This roadmap is the first document to describe that layer end-to-end; a formal ADR should be written once Phase A implementation lands, both to close this documentation gap and to avoid repeating the pattern flagged in `docs/templates/known-issues.json` ISSUE-004/ISSUE-006 (designs that describe mechanisms never implemented, or whose documented status silently drifts from reality). This document's own status line (top of file) must be kept current as phases progress — that discipline is itself the lesson from those two known issues and from the 2026-05-28 Kanban design's fate.

## 6. Non-Goals (explicit, all phases unless stated)

- Building a workflow DSL (multi-step orchestration language) — Phase A explicitly reuses existing skills/scripts as atomic execution units instead.
- Multi-worker concurrency / distributed locking — deferred to Phase B at the earliest, and only if team usage demonstrates real contention.
- Authentication, billing, and multi-tenancy — Phase C+ only.
