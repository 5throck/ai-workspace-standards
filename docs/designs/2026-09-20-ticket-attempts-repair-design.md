# Ticket attempts Metadata Repair — Board-Blocking Schema Failure (T-20260912-030 runner follow-up)

**Spec ID**: 2026-09-20-ticket-attempts-repair
**Date**: 2026-09-20
**Author**: local governance-ticket runner (05:30 batch, ADR-0082)
**Status**: Approved → Implemented
**Related**: T-20260917-003 (attempts-vs-history validation), ADR-0082 (local-only ticket processing)

## Problem

`bun scripts/ticket.ts list` (and every dependent runner step) hard-failed with
`ticket.attempts (1) must equal the number of failed → waiting history transitions (0)`:
eight hand-authored done records (T-20260918-001..005, T-20260919-001..003, from the
ADR-0081 delivery-hardening sessions) carried `attempts: 1` — "completed in one
attempt" semantics — while ticket-schema v1.2.0 (T-20260917-003) defines attempts as
the count of `failed → waiting` transitions (zero for a clean history). One malformed
record poisoned the whole board read.

## Decision

1. **Repair**: correct the eight terminal-done records to `attempts: 0`, matching
   their clean histories. The records are terminal-done; the metadata correction is
   the minimal honest fix (no state rewriting).
2. **Not done — validator relaxation**: the fail-fast on `list` is a robustness gap
   (one malformed record poisons the board), but WARN-and-skip on read paths vs
   fail-closed state moves is a schema-design decision left open (see Open Issues).
3. **Writer-side convention (the actual root cause)**: ticket WRITERS must create
   records with `attempts: 0`. The delivery sessions' authoring path used "number of
   attempts worked" semantics. Flagged to those sessions; recurrence means the
   writer(s) get fixed, not the records.

## Verification

- `bun scripts/ticket.ts list` reads the full board (183 done / 0 open at fix time)
- `list --ready --kind manual` clean; `doctor` clean
- Replicated-schema scan over all governance yamls reports 0 mismatches
