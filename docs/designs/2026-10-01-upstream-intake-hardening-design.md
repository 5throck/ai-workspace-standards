# Design: upstream intake hardening — races, corrupt rendering, retention (T-20261001-017)

- **Spec ID**: 2026-10-01-upstream-intake-hardening
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-017; remaining scope of the PR #1286 follow-ups)

## Problem

The daily-cap counters, the known-projects first-seen state and the audit
append are read-then-write: two parallel server instances could double-spend
caps or double-record the first-seen gate. `ticket.ts show` hard-failed on a
corrupt/hand-edited upstream block. The audit-log retention question (design
Q6) was open.

## Decision (mcp-upstream-server 1.4.0 → 1.5.0)

- Intake lock: the whole accept/merge/reject critical section (cap read →
  audit append) runs under a mkdir-based lock (`logs/upstream-intake/.intake-lock`)
  — atomic on every filesystem. Stale locks (>30s, crashed server) are taken
  over; the deadline (default 5s) falls OPEN to the pre-lock single-instance
  behavior rather than refusing service. `UPSTREAM_LOCK_TIMEOUT_MS` is the
  switch (0 = immediate fail-open; parsed separately from readCap so 0 is legal
  without changing cap semantics). Id allocation stays EEXIST-retried.
- Retention (Q6): daily `.jsonl` audit files prune after 90 days at startup,
  best-effort; `known-projects.json` and the lock dir are never touched.
- `ticket.ts show` (1.7.0) falls back to `readTicketRaw` (ticket-store 1.7.0)
  when validation fails: a CORRUPT banner plus boundary-tag-escaped raw YAML,
  so the PM can repair instead of hitting an opaque schema error.

No behaviour change to the approved intake design.

## Accessibility

Non-UI tooling change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- tests/unit/mcp-upstream-server.test.ts — 73 pass (3 new: stale takeover,
  fail-open deadline, retention prune)
- tests/unit/ticket-upstream-triage.test.ts — corrupt-show fallback case
