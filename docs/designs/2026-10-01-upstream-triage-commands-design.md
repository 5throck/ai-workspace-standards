# Design: ticket.ts triage/resolve subcommands for upstream requests (T-20261001-016)

- **Spec ID**: 2026-10-01-upstream-triage-commands
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-016; design §12 follow-up to PR #1286)

## Problem

pm-gateway-workflow §3.12 told the PM to hand-edit ticket YAML to record
`upstream.triage` and `upstream.resolution` — no ticket.ts command wrote those
fields, so every reply-back risked schema drift.

## Decision

- Store (ticket-store 1.6.0→1.7.0): `setUpstreamTriage` (inbox→backlog /
  ready→waiting; flagged promotion requires `confirmReviewed`) and
  `setUpstreamResolution` (write-once resolution; walks the LEGAL adjacency
  path to done — never a --force jump; writes `result` too). Requester-
  controlled upstream fields are immutable in both.
- CLI (ticket.ts 1.5.2→1.7.0): `triage <U-id> <inbox|ready> [--confirm-reviewed]`,
  `resolve <U-id> --outcome <fixed|rejected|local-only|duplicate> --summary "<text>"
  [--pr-url <url>] [--template-version <ver>]`. `TICKET_WORKSPACE_ROOT` env is a
  subprocess-test seam (pattern: UPSTREAM_INSTALL_HOME).
- Fixed a pre-existing gap surfaced by the CLI: `resolveTicketLocation` accepted
  explicit prefixes for T- ids only — `governance/U-…` now resolves (and
  `service/U-…` errors with guidance).
- §3.12 steps 3 and 8 rewritten around the commands.

## Accessibility

Non-UI tooling change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- tests/unit/ticket-upstream-triage.test.ts (10 cases incl. subprocess CLI) — pass
- Full ticket suite (schema/store/namespacing/attempts-cap) — 100 pass
