# Meeting: Phase A Local File-based Service Ticket + Kanban — Design Review

**Date**: 2026-07-16
**Facilitator**: PM
**Participants**: architect, automation-engineer, security-expert, auditor
**Topic**: Review of the approved-in-principle Phase A design (services.yaml catalog + tickets/*.yaml + scripts/ticket.ts + skills/ticket-run) before writing the implementation plan.

## Agenda

Review the design from four angles — architecture, implementation, security, governance/QA — and produce a single action list before moving to `writing-plans`.

## Design Reviewed

- `services.yaml` (root): service catalog — `id/name/description/run:{type: skill|script, ref}/inputs[]`; `schedule:` section reserved (schema only, Phase 2).
- `tickets/T-<YYYYMMDD>-<seq>.yaml`: one file per ticket; `status` field (not folder moves): `backlog→waiting→running→review→done|failed`; `priority`; `history[]` per transition; `result`/`error`.
- `scripts/ticket.ts`: `create/list/next/move/board(--html)`.
- `scripts/helpers/ticket-schema.ts`: catalog + ticket validation, transition enforcement.
- `skills/ticket-run/SKILL.md`: pulls next ticket, executes referenced skill/script, success→review, fail→failed. Human gate review→done.
- Deps: js-yaml only. Single local worker, no locking. L0-only for Phase A (no templates/common propagation).

## Findings by Agent

### Architect — Approve with changes
1. **No schemaVersion** on services.yaml or ticket files — breaks the stated long-term promise (same schema promotes to central server) at the first field migration. Add `schemaVersion: 1` now.
2. **backlog→waiting trigger undefined** — must specify what moves a ticket between these states (manual `move` in Phase A; scheduler in Phase 2).
3. **Non-atomic status writes** — read-modify-write can corrupt on crash mid-write.
4. **Ticket ID collision** — directory-scan-based seq races under concurrent sessions (Agent Teams makes this realistic despite "single worker" assumption).
5. **`failed` is a dead end** — no `failed→waiting` retry transition, no `attempts` counter.
6. **L0/L2 boundary** needs explicit propagation-exclusion declaration or audit/parity checks will flag it.

### Automation Engineer — Sound, with concrete fixes
1. ID collision fix: create ticket file with `{ flag: 'wx' }` (fails on EEXIST), retry with next seq — no lock file needed.
2. Status updates: write via temp file + `renameSync` (atomic on same volume, works on Windows).
3. Add stale-`running` detection (flag tickets running longer than N minutes) — fold into `list` or a `doctor` subcommand.
4. Keep the transition table as one exported `TRANSITIONS: Record<Status, Status[]>` constant, used by both enforcement and tests; test exhaustively.
5. `move` should require `--force` for non-adjacent transitions to prevent bypassing the review gate.

### Security Expert — Top risk is execution-time injection
1. **Command/prompt injection via ticket inputs** (highest risk) — `ticket-run` must never shell-interpolate inputs; use array-form spawn (`Bun.spawn([...argv])`), pass inputs as JSON, validate against the `inputs[]` declaration (name allowlist, type, length cap). In Phase B, a git-pulled malicious ticket becomes an RCE vector if this isn't closed now.
2. **`run.ref` path traversal** — resolve only from services.yaml (never from ticket content), allowlist pattern (`^scripts/[a-z0-9-]+\.ts$` / `^skills/[a-z0-9-]+$`), assert resolved path stays under workspace root.
3. **Secrets in ticket YAML** (inputs or `error:` stdout tail) — document "no secrets in inputs, reference env var names"; consider redaction pass on stored error output.
4. **HTML board XSS** — escape all ticket-derived text; add a restrictive CSP meta tag to the generated static board.
5. **YAML parsing** — use `yaml.load(..., { schema: JSON_SCHEMA })`, cap file size before parsing.
6. Defer to Phase B/C: ticket provenance/signing, per-service input schema validation (zod), execution sandboxing/timeouts, server-side authz/rate-limiting.

### Auditor — Compliant if these are followed
1. L0 containment: `services.yaml`, `tickets/`, `scripts/ticket.ts`, `scripts/helpers/ticket-schema.ts`, `skills/ticket-run/` must be excluded from L2 generation — extend `WORKSPACE_ONLY_FILES` in `new-project.ts:315` (verify it covers directories, not just files) and/or use `@l2-propagate:false` / `l2_propagate: false`.
2. Register `ticket.ts` via the script-lifecycle-manager skill (not by hand-editing SCRIPTS.md).
3. `skills/ticket-run/SKILL.md` frontmatter: `scope: local` (not `common`) for Phase A; check `metadata.triggers` don't collide with existing skills (e.g. `new-task`).
4. English-only for all new docs/help text; run `audit.ts` before commit; new root file (`services.yaml`) may need whitelisting if audit enforces a root-manifest check.
5. **Decision needed and recommended**: exempt ticket-state transitions from the CHANGELOG obligation (per-transition history[] already gives an audit trail; requiring a changelog entry per ticket move is disproportionate).
6. **Recommendation**: `.gitignore` ticket instances (`tickets/*.yaml`); track only `services.yaml` and the schema/validator code. Avoids commit churn incompatible with the /sync-only commit policy; revisit at Phase B promotion.

## Synthesized Decisions / Action Items (for the implementation plan)

| # | Action | Owner (Phase 4) | Source |
|---|---|---|---|
| 1 | Add `schemaVersion: 1` to services.yaml and ticket schema; validator rejects unknown versions | automation-engineer | architect |
| 2 | Ticket writes: create via `wx` flag (collision-safe seq), updates via temp-file + `renameSync` | automation-engineer | architect, automation-engineer |
| 3 | Add `failed→waiting` retry transition + `attempts` counter to the state machine | automation-engineer | architect |
| 4 | Add stale-`running` detection (`list`/`doctor`) | automation-engineer | automation-engineer |
| 5 | `TRANSITIONS` table as single exported constant; exhaustive transition-matrix test | automation-engineer | automation-engineer |
| 6 | `move` requires `--force` for non-adjacent transitions | automation-engineer | automation-engineer |
| 7 | `ticket-run` spawns via argv array (no shell interpolation); inputs validated against declared schema (name allowlist/type/length) | automation-engineer, security-expert | security-expert |
| 8 | `run.ref` resolved only from services.yaml, allowlist pattern, resolved-path-under-root assertion | automation-engineer | security-expert |
| 9 | Document "no secrets in ticket inputs"; consider redacting `error:` stdout tail | automation-engineer, docs-writer | security-expert |
| 10 | HTML board: escape all ticket-derived text + CSP meta tag | automation-engineer | security-expert |
| 11 | YAML load with `JSON_SCHEMA` + file-size cap | automation-engineer | security-expert |
| 12 | Explicit L0 exclusion: extend `WORKSPACE_ONLY_FILES` (verify directory coverage) and/or `@l2-propagate:false` / `l2_propagate: false` | automation-engineer | auditor |
| 13 | Register `ticket.ts` via script-lifecycle-manager skill | automation-engineer | auditor |
| 14 | `skills/ticket-run/SKILL.md`: `scope: local`, non-colliding triggers | automation-engineer | auditor |
| 15 | Decide + document: ticket-state transitions exempt from CHANGELOG obligation | architect (design doc) | auditor |
| 16 | `.gitignore` `tickets/*.yaml`; track `services.yaml` + schema/validator only | architect (design doc) | auditor |

## Outcome

Design **approved with changes**. No blocking disagreements between agents — all four reviews converge on the same shape (file-based tickets, status-as-field, human review gate) and add hardening items rather than challenging the approach. Next step: fold action items 1–16 into the design doc, then proceed to `writing-plans` for the Phase 4 implementation plan.
