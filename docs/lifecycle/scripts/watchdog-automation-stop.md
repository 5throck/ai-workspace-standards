# watchdog-automation-stop.ts Script Lifecycle

## Metadata

- **Script**: watchdog-automation-stop (scripts/watchdog-automation-stop.ts)
- **Status**: active
- **Version**: 1.0.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-12
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-11-12 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-11-12

## Description

Out-of-process degraded-mode kill-switch for the unified 03:00 batch runner (T-20261112-002; ADR-0105 Decision 4; design `docs/designs/2026-11-12-unified-batch-runner-design.md` §4.5/AC-6). `writeAutomationStop({reason, stateDir?, now?, pid?})` writes `.pipeline-state/automation-stop` (JSON: reason, ISO timestamp, pid, plus a bounded 50-event history); `readAutomationStop(stateDir?)` and `stopFilePresent(stateDir?)` are the runner-side probes. Safety contract: MERGE-SAFE (temp file in the same directory, then one atomic rename — a concurrent runner never reads a truncated file), IDEMPOTENT (each invocation refreshes the top-level fields and appends an event), EVIDENCE-PRESERVING (unparseable non-empty content is renamed aside to `automation-stop.corrupt-<ts>`, never destroyed). CLI: `bun scripts/watchdog-automation-stop.ts [--state-dir <dir>] <reason>`; exit 0 written, 1 usage, 2 write error. Wiring: the host crontab 13:00 KST wall entry and the runner's own >2-unexpected-gate-failures stop both call it; clearing the stop-file is the runner's STEP-0 acknowledgment; the script never kills processes. L0-only, never propagated. Unit-pinned by `tests/unit/watchdog-automation-stop.test.ts`.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-12 | production | production | v1.0.0 (T-20261112-002; ADR-0105 Decision 4; design §4.5/AC-6): initial release — the enforcement point outside the runner process for the 13:00 wall, the >2-unexpected-gate-failures stop, and degraded mode (meeting 2026-11-12 preserved dissent S5: rails self-judged by the agent need out-of-process enforcement). Host crontab entry is operator-managed state recorded in the drill/report evidence, not in the repo. | automation-engineer |
