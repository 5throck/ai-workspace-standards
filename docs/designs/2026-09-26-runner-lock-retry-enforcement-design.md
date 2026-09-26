# 2026-09-26 Runner Lock & Retry Mechanical Enforcement — Design

- **Status**: designed (implementation ticketed)
- **Date**: 2026-09-26
- **Source**: 2026-09-26 4-domain project review, agent C finding 8 — "one retry and lock/escalation rules are prompt-only; nothing mechanical enforces them"; user directive to proceed with remaining review work
- **Tickets**: T-20260926-021 (implementation), T-20260926-022 (platform_settings scope adjudication), T-20260926-023 (co-newbiz docs/security adjudication — resolved by this investigation)

## 1. Problem

The workspace runs two unattended local automations — the 01:30 KST fleet-review+resync runner and the 03:00 KST governance-ticket batch runner — whose collision-safety and retry rules exist only as prose in the runner prompts, the constitution, and ADR-0089:

- R1: The batch limit ("up to 50 tickets / ~5 hours") and the one-retry rule (`failed → waiting` once, then escalate) are followed because the prompt says so; `ticket.attempts` increments forever with no cap (`scripts/helpers/ticket-store.ts`).
- R2: `.pipeline-state/automation.lock` is named in docs (ADR-0089, fleet design R1–R4) but no script implements acquire/poll/hard-stop.
- R3: `ticket.ts doctor`'s staleness scan (now covering both ticket populations, v1.2.1) reports stuck `running` tickets but nothing acts on the report.

A prompt-only contract is unverifiable and fails silently exactly when two runners overlap (e.g. a long 01:30 resync still running at 03:00).

## 2. Requirements

- R1: A runner that cannot prove exclusivity must not start batch work; an empty-queue check never touches the lock (fast path stays lock-free).
- R2: A stale lock (holder process provably dead) must be breakable without human intervention; a live lock must defer the run with a report-only exit.
- R3: Ticket retry count must be mechanically capped: a ticket that has exhausted its attempts may not re-enter `waiting` via the normal transition.
- R4: The runner must be able to discover its own instructions (batch limits, escalation path) from a machine-readable source, not only from the prompt text.

## 3. Decision

D1 — **Lock as a script, not a convention.** New `scripts/automation-lock.ts` (L0-only): `acquire <name>` / `release <name>` / `status [name]`. The lock file lives at `.pipeline-state/automation-<name>.lock` and records pid + hostname + acquired-at. `acquire` fails (exit 1) when the recorded pid is alive; a dead pid or foreign-host record is reported and (with `--break-stale`) removed atomically. Runners call `acquire` after their ready-check, `release` in a finally-equivalent path.

D2 — **Retry cap in the ticket store.** `move <id> waiting` fails when the resulting attempts would exceed a configurable cap (default 2, `--force` remains the documented escape). `ticket.ts doctor` gains a summary line listing tickets at/over cap so escalation is visible.

D3 — **Runner parameters become data.** The batch limit, retry cap, and lock name move into `.pipeline-state/runner-config.json` (gitignored template committed as `docs/examples/`); the runner prompt references the file instead of restating numbers, so a limit change is a config edit, not a prompt rewrite.

D4 — **Non-goals.** No cross-host advisory locking (single-operator workspace); no lock for report-only phases; the GitHub-side workflows stay `workflow_dispatch`-only (ADR-0082) so no cloud-side mutex is needed.

## 4. Verification plan (for the implementation ticket)

- Unit tests for lock acquire/release/stale-break and the attempts cap transition; `doctor` integration assertion.
- Live dry run: start the 03:00 runner while the lock is held by a live dummy pid → defers report-only; dead pid → breaks and proceeds.
- Gates: verify-scripts / typecheck / bun test / audit.
