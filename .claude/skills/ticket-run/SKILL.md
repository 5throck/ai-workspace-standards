---
name: ticket-run
status: active
scope: workspace
l2_propagate: false
description: >
  Pulls the next waiting service ticket from the Phase A ticket queue and executes
  its referenced skill or script. Use when: processing the local service ticket
  queue, running "/ticket-run".
owner: automation-engineer
version: 1.0.0
last_reviewed: 2026-07-16
prerequisites: []
metadata:
  type: process
  triggers:
    - ticket-run
    - process ticket queue
    - run next ticket
---

## Context

Executes exactly one `kind: service` ticket per invocation (no internal polling loop — repeated processing is the caller's responsibility). Never touches `kind: manual` tickets. Design: `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md`.

## Execution Steps

1. Run `bun scripts/ticket.ts next`. If it prints "No waiting service tickets.", stop.
2. Otherwise parse the printed ticket JSON. Load `services.yaml`, look up `ticket.service` in the catalog (this is the only place `run.ref` is read from — never from ticket content).
3. Execute via array-form spawn only — never build a shell command string:
   - `run.type: script` → `Bun.spawn(['bun', absPath, '--inputs-json', JSON.stringify(ticket.inputs ?? {})])` <!-- encoding-check-ignore -->
   - `run.type: skill` → invoke the named skill, passing `ticket.inputs` as its argument object
4. On success (exit code 0): `bun scripts/ticket.ts move <id> review`
5. On failure: `bun scripts/ticket.ts move <id> failed --error "<captured stderr/stdout tail>"` — the `--error` flag writes the message onto the ticket's `error` field as part of the same atomic transition.

## Related

- `scripts/ticket.ts`, `scripts/helpers/ticket-store.ts`, `scripts/helpers/ticket-schema.ts`
- `scripts/dispatch.ts` — a *different*, session-scoped mechanism; a service's own execution may invoke it internally, but `ticket-run` itself does not.
