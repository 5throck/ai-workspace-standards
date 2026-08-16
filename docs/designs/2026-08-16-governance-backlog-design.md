# Design: Governance Backlog

**Date**: 2026-08-16
**Status**: Approved
**Source**: brainstorming + meeting (`memory/meeting-2026-08-16-governance-backlog-design.md`)
**Spec ID**: 2026-08-16-governance-backlog-design
**Related**: [2026-08-16-spec-registry-enforcement-design.md](2026-08-16-spec-registry-enforcement-design.md), [ADR-0055](../adr/0055-spec-registry-enforcement.md), PR #538, PR #539

---

## Problem Statement

`ADR-0055` (Stage 2 of spec-registry-enforcement) is intentionally deferred: it can't safely promote the spec-check warning to a blocking failure until Stage 1's output has been observed on real commits for a soak period (~1 week). Nothing in this workspace currently tracks "come back to this after a date" — the only options were a prose reminder in a design doc (easy to forget, exactly the failure mode this session already diagnosed once for the spec registry itself) or relying on a human to remember.

More generally, this is not a one-off problem. Any deferred, judgment-gated governance decision (a soak period, a "revisit after N users adopt this," a scheduled deprecation check) has the same shape and the same risk of silently rotting.

**Goal**: a reusable mechanism for deferred governance decisions that surfaces automatically — at session start and during the existing Weekly Health Check ritual — without introducing yet another registry file for people to forget to check.

---

## Design

### Reuse `scripts/ticket.ts`, don't add a new registry

This workspace already has a Kanban-style ticket system (`scripts/ticket.ts`, `scripts/helpers/ticket-store.ts`, `scripts/helpers/ticket-schema.ts`) with a `kind: 'manual'` ticket type explicitly defined as "never auto-executed, picked up directly by a human" — the exact shape of a governance decision. Adding a parallel `docs/governance/backlog.json` registry would repeat the precise mistake just fixed in the spec registry (a well-designed tracking file nobody remembers to open). The `Ticket` schema's `status` state machine (`backlog → waiting → review → done`) already models workflow position; what's missing is an *eligibility gate* — "not actionable before this date" — which is orthogonal to status, not a replacement for it.

### Schema change

Add an optional `not_before?: string` (ISO `YYYY-MM-DD`) field to `Ticket` (`scripts/helpers/ticket-schema.ts`). Absent = always eligible (backward-compatible with every existing manual ticket). Present = not eligible until that date.

Date comparison reuses `spec-register.ts`'s existing `today()` convention (`new Date().toISOString().split('T')[0]`, UTC-normalized `YYYY-MM-DD` string) rather than inventing a second date-handling approach — string comparison on `YYYY-MM-DD` is lexicographically correct and avoids local-timezone-at-midnight bugs on Windows.

### CLI changes (`scripts/ticket.ts`)

- `create --manual "<title>" [--not-before YYYY-MM-DD] [--priority ...]`
- `list` gains two **independent, composable** flags (not a single bundled mode — someone will eventually want `list --kind service` without `--ready` too):
  - `--kind <service|manual>` — filter by kind (currently `list` only supports `--status`; this is a new capability, not a rename)
  - `--ready` — filter to tickets whose `status` is `backlog` or `waiting` AND (`not_before` unset OR `not_before` <= today)

### Surfacing (two touchpoints, both quiet-when-empty)

1. **Session start** — `CONSTITUTION.md`'s session start checklist gets a new step: run `bun scripts/ticket.ts list --ready --kind manual`; print only if non-empty (same "silent when nothing to do" pattern `dev-sync.ts` already uses for idempotent steps). `CONSTITUTION.md` is L0-only and blocked from ever appearing in `templates/common/` (`validate-templates.ts` Check 0), so this is automatically workspace-root-scoped — safe anchor point.
2. **Weekly Health Check** — `docs/constitution/09-operations-workflow.md` §9.1 gets the same command added to its Procedure block (same location as the `spec-backfill.ts --check` line added earlier this session) plus a checklist line.

### Dispatch convention (documentation only, no new mechanism)

`AGENTS.md` §3 — **not** `agents/pm.md`. Reason (caught in the design meeting): `agents/pm.md` has an L0→L1→L2 extends chain (CONSTITUTION §5.5) and propagates into every variant's `templates/*/agents/pm.md`; `ticket.ts` is `@l2-propagate: false` (workspace-root only), so a variant PM would inherit a reference to a script that doesn't exist in its own repo. `AGENTS.md` is explicitly the L0-only SSOT and never propagates — the correct location.

The convention itself: when a ready governance-backlog ticket requires implementation work (not just a decision), PM dispatches it through the normal PM Gateway path — optionally as a parallel Agent Teams teammate when the item is independent of other in-flight work. No new dispatch mechanism; this is one sentence connecting an existing signal (ready ticket) to an existing path (PM Gateway/Agent Teams dispatch).

### First real entry

Register Stage 2 itself: `bun scripts/ticket.ts create --manual "spec-check Stage 2: promote relevance Warn to Fail (ADR-0055)" --not-before 2026-08-23 --priority normal` — 2026-08-23 = PR #538 merge date (2026-08-16) + 7 days, matching ADR-0055's stated soak period.

---

## Out of Scope / Follow-up

- **Cron notification**: documenting a recommended `CronCreate` setup (weekly reminder to check the backlog) is worth a short note, but actually creating a live scheduled task is a persistent, standing configuration change and is **not** part of this implementation pass — requires separate explicit confirmation at the time, per the design meeting's ruling that this must not be implied as shipped in the Files Changed table.
- True per-ticket auto-execution of governance decisions (e.g., automatically flipping Stage 2 when `not_before` passes) — deliberately not built; these are judgment calls (`kind: manual`), not `kind: service` automation.

---

## Testing

Extend `tests/unit/ticket-*.test.ts` with 3 boundary cases (per automation-engineer in the design meeting — the equality boundary is the one implementations usually get wrong):
- `not_before` unset → always ready
- `not_before` in the past → ready
- `not_before` exactly equal to today → ready (`<=`, not `<`)

Manual verification: create a real ticket with `--not-before` tomorrow, confirm `list --ready` excludes it; register the real Stage 2 ticket and confirm it's excluded today and would be included on/after 2026-08-23; run `bun scripts/ticket.ts doctor`/`board` to confirm no schema regressions on existing tickets.

**Found during implementation**: `.gitignore` has `tickets/*.yaml` (deliberately, per its own "Task 8" comment — service-ticket instances are ephemeral/local by design). That silently defeated the entire point of a Governance Backlog: a `not_before`-bearing manual ticket created under `tickets/` would never leave this machine, contradicting "surfaces automatically at the next session, on any machine." Not caught in the design meeting. Fixed by routing `kind: manual` tickets to a new `tickets/governance/` subdirectory instead of a `.gitignore` change — `tickets/*.yaml`'s single `*` doesn't cross directory boundaries in gitignore syntax, so `tickets/governance/*.yaml` was already untracked-but-not-ignored with zero `.gitignore` edits needed (verified with `git check-ignore`). `scripts/ticket.ts`'s CLI layer (not the reusable `ticket-store.ts` functions, which already took an explicit `dir` parameter) now routes `create --manual` to `governanceDir`, merges both directories for `list`/`board`, and `move` resolves the correct directory by checking which one has the ticket file. `next`/`doctor` (service-only concepts — manual tickets never enter `running`) are unchanged.

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `scripts/helpers/ticket-schema.ts` | Modified | Add `not_before?: string` to `Ticket`; validation |
| `scripts/helpers/ticket-store.ts` | Modified | `createTicket()` accepts `not_before`; `listTickets()` supports `kind`/`ready` filters |
| `scripts/ticket.ts` | Modified | `create --not-before`; `list --kind`, `list --ready`; routes `kind: manual` tickets to a new git-tracked `tickets/governance/` subdirectory (see implementation finding above) |
| `tests/unit/ticket-*.test.ts` | Modified | 5 boundary-case tests (unset/past/exactly-today/future/done-excluded) |
| `CONSTITUTION.md` | Modified | Session start checklist: surface ready backlog tickets |
| `docs/constitution/09-operations-workflow.md` | Modified | Weekly Health Check: same command + checklist line |
| `AGENTS.md` | Modified | §3 dispatch convention for ready backlog items |
| `tickets/` | New entries | Stage 2 registered as the first real ticket |
| `scripts/SCRIPTS.md` | Modified | Version bumps for `ticket.ts` and helpers |
