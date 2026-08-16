# Meeting: Governance Backlog Design

**Date**: 2026-08-16
**Facilitator**: PM
**Participants**: architect, automation-engineer, auditor
**Related**: `docs/adr/0055-spec-registry-enforcement.md`, PR #538, PR #539

## Agenda

Review the proposed design — extend `scripts/ticket.ts`'s `kind: manual` tickets with a `not_before` date field to serve as a reusable Governance Backlog, surfaced at session-start and Weekly Health Check, with a PM Gateway/Agent Teams dispatch convention for acting on ready items. Decide: approve as-is, approve with changes, or reject.

Immediate motivating case: spec-check Stage 2 (promote the relevance `Warn` to a blocking `Fail`) is gated on a ~1-week soak period after PR #538 merged (2026-08-16) — the first real backlog entry.

## Discussion

**PM**: Opening the floor. Context for everyone: this session diagnosed that the June spec-registry mechanism silently never ran, fixed it (PR #538, #539), and the user now wants deferred governance decisions — starting with Stage 2 of that same fix — to stop depending on human memory. Proposal on the table: reuse `ticket.ts`'s `kind: manual` tickets, add `not_before`, surface via `list --ready`. Architect, does the structure hold up?

**architect**: It holds up better than a new registry would — I checked, and `TRANSITIONS` already treats `status` as pure workflow position (`backlog → waiting → review → done`), so bolting `not_before` on as an *eligibility gate orthogonal to status* is a clean separation, not a schema collision. My one structural flag is for **automation-engineer**: `ticket.ts`'s header comment says `@l2-propagate: false` — this script is workspace-root-only. That's fine for the script itself, but it means the *documentation* wiring has to be equally careful about where it lives. Concretely: if we write "check `bun scripts/ticket.ts list --ready`" into `agents/pm.md`, that file has an L0→L1→L2 extends chain per CONSTITUTION §5.5 — it propagates into every variant's `templates/*/agents/pm.md`. A variant PM would then reference a script that doesn't exist in its own repo. That instruction belongs in `AGENTS.md` (explicitly L0-only SSOT, never propagated) or `CONSTITUTION.md`, not in `agents/pm.md`'s propagating body text.

**auditor**: Confirming that's a real contradiction, not a hypothetical — I'd have flagged exactly this under "cross-domain documentation consistency" if I'd audited it after the fact. Good that it's caught before, not after. One more for the same bucket: the session-start checklist lives in `CONSTITUTION.md`, which is itself L0-only and blocked from ever appearing in `templates/common/` (Check 0 in `validate-templates.ts` enforces this). So wiring the "ready backlog" surfacing into *that* checklist is automatically workspace-root-scoped and can't leak into variants by accident — that's the right anchor point, architect, not `agents/pm.md`.

**automation-engineer**: Agreed on where it lives — now the part I actually have to type. Two concrete gaps in the plan as stated. First: `ticket.ts`'s `list` command today only accepts `--status`, there's no `--kind` filter at all — I checked `scripts/ticket.ts` lines 70-76 myself, `listTickets(ticketsDir, { status: ... })` is the only option threaded through. `list --ready --kind manual` doesn't work until I add kind-filtering, not just a `--ready` flag. Second, date comparison: **architect**, "not_before <= today" sounds simple but this codebase already has one convention for it — `spec-register.ts`'s `today()` helper does `new Date().toISOString().split('T')[0]`, giving a UTC-normalized `YYYY-MM-DD` string, which sidesteps local-timezone-at-midnight bugs on Windows. I'll reuse that exact helper rather than inventing a second date convention — string comparison on `YYYY-MM-DD` is lexicographically correct, no Date-object arithmetic needed.

**architect**: Take the `today()` reuse, no objection — one shared date convention across `spec-register.ts` and `ticket.ts` is strictly better than two. On your first point: agreed `--kind` needs to exist independently of `--ready`, since someone will eventually want `list --kind service` too. Design update: `--ready` and `--kind` are independent, composable flags on `list`, not a single combined mode.

**automation-engineer**: Works for me. Test coverage note for the record: I want three explicit fixture cases in `tests/unit/ticket-*.test.ts` — `not_before` unset (always ready, backward-compat with every existing manual ticket), `not_before` in the past, `not_before` exactly equal to today (boundary — this is the one people get wrong with `<` vs `<=`). Not "future/past," specifically the equality boundary.

**PM**: Noted. Auditor, the Cron piece — user explicitly separated that as "notification only, confirm separately before creating." Anything from a consistency angle?

**auditor**: Just one thing to put in the doc so it doesn't get treated as done when it isn't: don't let the design doc's "Files Changed" table imply Cron setup ships in this PR. It's a documented recommendation the user can accept later, not a deliverable of this implementation pass — same pattern this session already used for Stage 2 itself (design it, don't execute it prematurely). Keep it in an "Out of Scope / Follow-up" section, not the changed-files table.

**PM**: Anything blocking approval, or is this refine-and-ship?

**auditor**: Synthesizing.

## Agreements

1. Reuse `ticket.ts`'s `kind: manual` + new `not_before` field — no new registry. (architect, unopposed)
2. Wire session-start surfacing into `CONSTITUTION.md`'s checklist and the dispatch convention into `AGENTS.md` — **not** `agents/pm.md`, which propagates to variants that don't have `ticket.ts`. (architect + auditor)
3. Reuse `spec-register.ts`'s `today()` UTC-date-string convention for the `not_before` comparison — don't invent a second date-handling approach. (automation-engineer + architect)
4. `list` needs an independent `--kind` filter added (currently only `--status` exists) — `--ready` and `--kind` compose, not a bundled flag. (automation-engineer)
5. Cron notification stays documented-but-not-executed in this pass — explicit "Out of Scope" section, separate confirmation before any real `CronCreate` call. (auditor)

## Open Questions

None blocking.

## Action Items

| # | Item | Owner |
|---|------|-------|
| 1 | Add `--kind` filter + `--ready` flag to `ticket.ts list`, reusing `spec-register.ts`'s `today()` convention | automation-engineer |
| 2 | Add `not_before` to `Ticket` schema + `createTicket()` + validation | automation-engineer |
| 3 | Add 3 boundary-case unit tests (unset / past / exactly-today) | automation-engineer |
| 4 | Wire surfacing into `CONSTITUTION.md` session-start checklist (not `agents/pm.md`) | docs-writer |
| 5 | Wire dispatch convention + backlog mention into `AGENTS.md` §3 (L0-only, not propagating) | docs-writer |
| 6 | Wire Weekly Health Check line in `docs/constitution/09-operations-workflow.md` | docs-writer |
| 7 | Register Stage 2 as the first real ticket, `not_before: 2026-08-23` | automation-engineer |

## Approval Status

READY ✅ (refine-and-ship — items 2 and 4 above are refinements to the design already presented, not new scope)
