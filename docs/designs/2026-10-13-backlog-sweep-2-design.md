# Design: Backlog sweep 2 — Gemini toml renderer promotion, co-newbiz learning notes, ops-review gate check, co-safety evidence seed

- **Spec ID**: 2026-10-13-backlog-sweep-2-design
- **Date**: 2026-10-13
- **Status**: implemented
- **Tickets**: T-20261013-009 (phase 1), T-20261012-003/004/005, T-20261007-012, T-20261003-009 (user-directed sequential sweep)

## D1 — Gemini toml renderer promotion (T-20261013-009, phase 1)

Gemini CLI loads TOML commands only; the fleet ships `.gemini/commands/*.md`, which
Gemini never loads. Promoted Projects/co-abap's local renderer (v1.0.1) to
`scripts/render-commands.ts` (L0, v1.1.0) generalized to the fleet SSOT: source =
`.claude/commands/<name>.md` (ADR-0077 D4), output = `.gemini/commands/<name>.toml`
(`$ARGUMENTS` → `{{args}}`, `gemini-parity: skip` honored, write-mkdir hardened).
Root rendered 7 toml commands. The legacy `.md` files STAY for now — they are the
P-02 root↔common mirrors (validate-templates) and human-readable copies; the
toml-sync gate is `bun scripts/render-commands.ts --check` (unit-tested).

**Phase 2 (follow-up ticket)**: converging `templates/common/.gemini/commands` to
toml touches three interlocking gates (validate-templates checkCommands 1:1 block,
C-CM-01/02/04 common_commands coverage, P-02 md-filtered parity, audit parity
sections) plus project orphan-md cleanup — a dedicated migration design, not a
tag-on. Filed as the follow-up ticket; co-abap's local renderer/patches converge
there too.

## D2 — co-newbiz learning notes (T-20261012-003/004/005)

The three single-instance learning tickets are consolidated into
`docs/reports/2026-10-13-co-newbiz-learning-notes.md` (view-model extraction,
opt-in data-scope filter without FKs, percentage-colgroup two-step refactoring) —
each with its invariants, test discipline, and promotion gate (second adopter).
Tickets close as recorded; promotion stays human-judged on the gate.

## D3 — ops-review skill gate re-check (T-20261007-012)

The prospective skill is gated on a second variant adopting the ops-review pack.
Fleet re-check 2026-10-13: still single-instance (co-learning only) — gate unmet,
skill creation deferred. Ticket closed with the gate-evaluation result; the design
doc (2026-10-07-kpi-operations-review-design sections 7-8) remains the spec of
record for when a second adopter appears.

## D4 — co-safety evidence seed (T-20261003-009)

Three genuine decision records from the 2026-10-13 runner cycle, seeded to
`Projects/co-safety/docs/decisions/` with matching append-only EV ledger rows:
canary upgrade acceptance under a LOCAL-PATCH report (DEC-20261013-01), the
ADR-0085 D3 drift-policy override for stale PLATFORM_HARNESS mirrors
(DEC-20261013-02), and ghost-row dedupe plus root escalation (DEC-20261013-03).
**Scanner gap discovered**: M1-F3 counts only refs resolving against schema-file
basenames, so ledger-citing decisions (EV ids, F1 currency) cannot satisfy it even
when genuine — filed as a scanner triage ticket rather than forcing inapplicable
references (the ticket forbids fabricating for the metric).

## Verification

- `tests/unit/render-commands.test.ts` — toml rendering ($ARGUMENTS mapping, skip
  honor, drift detect/fix cycle), splitFrontmatter.
- Root battery: `audit.ts` green (render-commands --check passes at 7 sources),
  `validate-templates.ts` 0 errors, lifecycle-sync-audit clean, manifest regenerated.
- co-safety scan: DEC/EV records present; M1 gap filed as scanner triage.
