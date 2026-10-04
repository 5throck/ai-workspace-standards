# Design: Done-Ticket Archive for the Ticket System

- **Spec id**: `2026-10-04-ticket-archive-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: `scripts/ticket.ts`, `scripts/helpers/ticket-store.ts`, `tickets/` store layout, `docs/designs/2026-08-16-governance-backlog-design.md` (store semantics), `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md` (Phase A)

## Problem

The ticket stores accumulate done tickets without bound. As of 2026-10-04 the live
stores hold 417 tickets, of which 410 are `done`; `list` and `board` print them on
every run, so the open-work signal (7 tickets) is buried under closed history.
Requirement: a ticket that has been `done` for at least 7 days must be archivable,
out of the live stores, without losing the file or its audit trail.

## Decisions

1. **One archive directory per store, mirroring store semantics.**
   - Service store `tickets/` → `tickets/archive/`. The `.gitignore` rule
     `tickets/*.yaml` covers direct children only, so this directory gets an
     explicit `tickets/archive/` ignore rule: service tickets are ephemeral
     (Task 8, Phase A design) and their archive stays local-only.
   - Governance store `tickets/governance/` → `tickets/governance/archive/`.
     Governance tickets are deliberately git-tracked, and so is their archive —
     the deferred-decision audit trail survives across machines (§3.7.5).
   Both are derived as `join(dir, 'archive')`; no store-layout constant leaves
   the store module.

2. **Eligibility: `done` for ≥ N days (default 7).**
   - The completion timestamp is the `at` of the last history entry with
     `to: 'done'`. A ticket qualifies when `now - doneAt >= N * 24h`.
   - Fallback for a hand-edited legacy ticket whose history lacks the done
     entry: the newest history entry's `at`, then `created_at`. File mtime is
     never used — it resets on every clone/checkout and would mis-age archived
     candidates on a fresh clone.
   - Non-done tickets never archive regardless of age. `--days N` accepts any
     non-negative integer; the default is 7.

3. **The archive move is a pure rename — zero content change.**
   `renameSync` under the source store's `withTicketLock`. No history entry is
   appended: `HistoryEntry.to` is status-typed and the archive state lives in
   the file path, not the content. Archived files stay schema-valid and render
   identically via `show`.

4. **CLI surface: `archive` subcommand, dry-run by default.**
   - `bun scripts/ticket.ts archive [--days N]` prints the plan (per store, id,
     age) and exits without touching files.
   - `--apply` executes the moves and prints a per-store summary.
   - `--restore <id>` moves one ticket back from its archive directory to the
     live store (id resolution accepts the same bare / `service/` / `governance/`
     forms as `move`).
   Archiving is explicit and human-gated; no scheduler runs it (non-goal below).

5. **Id resolution learns the archive; listings do not.**
   - `resolveTicketLocation` falls back to the two archive directories when the
     live stores miss. `show`, `move` (`--force`, done is terminal),
     `triage`/`resolve` therefore keep working on archived ids. The not-found
     error and the both-stores ambiguity error keep their shape.
   - `list --archived` scans the archive directories and prints an
     `[ARCHIVED]` marker; it composes with `--kind`. `list` and `board` default
     views are unchanged in code and now naturally show only live tickets.

## Id-allocation invariant

`createTicket` allocates today-dated ids from a scan of the two live
directories. Archived tickets carry a creation-date prefix at least 7 days old,
so a same-prefix collision between a live allocation and an archived id is
impossible while the 7-day dwell is respected. This invariant is asserted by
test: creating a ticket after `--apply` still allocates the next sequence.

## Known consequences (accepted)

- `upstream_request_status` (`mcp-upstream-server.ts`) walks the live governance
  directory; an archived upstream request no longer resolves by status. Merge
  and dedupe are unaffected — the merge path already ignores `done` tickets.
- `procedure-coverage.ts` maps procedures against live tickets; archived (old,
  done) tickets drop out of that map. This is the intended decluttering.
- Archiving git-tracked governance tickets stages a rename; the operator
  commits it like any tracked change. The CLI never commits.

## Non-goals

- No automatic or scheduled archiving: the nightly/weekly review or the PM runs
  `archive --apply` explicitly.
- No schema change: `ticket-schema.ts` is untouched.
- No compression/compaction of archive files.

## Tests

`tests/unit/ticket-archive.test.ts` covers: `doneAtOf` ordering and fallbacks;
candidate selection (non-done excluded, threshold respected); the move
(live file gone, archive file present and identical); store separation;
`listTickets` no longer returning archived tickets; `resolveTicketLocation`
archive fallback; `restoreTicket` round-trip; and the id-allocation invariant
after an apply. A CLI subprocess test drives `archive --apply` through
`TICKET_WORKSPACE_ROOT`.
