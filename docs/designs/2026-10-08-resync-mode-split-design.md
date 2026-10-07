# Nightly / Full Mode Split for project-resync — Design (proposed)

- **Date**: 2026-10-08
- **Status**: proposed (T-20261007-029)
- **Related**: project-resync 1.6.0 (Steps 2e/2f), `scripts/project-resync.ts`, upgrade-project skill

## Problem

One nightly pass carries two different workloads with different risk budgets:
the daily hygiene loop (Steps 0–2d + 2e/2f extraction, read-only over
`templates/`) and the FULL wave (upgrades, template-touching syncs, PR waves)
that needs the readiness gate, a clean-tree rule, and human attention. The
upgrade-project skill meanwhile carries procedure detail that duplicates its
scripts' own `--help`/preflight, and rots.

## Decision (proposed)

1. **Nightly mode (default)**: Steps 0–2d, 2e (upstream ledger), 2f (learning
   extraction), battery-only Phase 1b. Never opens upgrade PRs. Budget-capped
   as today.
2. **Full mode (`--full`)**: everything nightly does PLUS Steps 3–6 (upgrades,
   syncs, PR waves), gated on: (a) preflight green per target
   (`upgrade-project --preflight`, T-20261007-028), (b) an explicit
   `--full` on the invocation (never implied), (c) the Friday FULL override
   rule unchanged.
3. **Skill slimming**: the upgrade-project skill drops to procedure-only —
   what the operator does (preflight → apply → /sync with the composed body),
   with flags documented by the script's `--help` as the SSOT (the same
   thin-dispatcher doctrine as AGENTS.md).

## Consequences

- A nightly crash or quota breach can no longer strand a half-applied upgrade
  wave (full mode is opt-in per invocation).
- The skill's procedure text stops duplicating flag documentation.

## Open questions for the reviewer

- Whether `--full` should require an interactive confirm at runtime or the
  flag alone suffices (unattended 01:30 runs would pass the flag).
- Whether Step 2f learning extraction stays in nightly or moves to full
  (it files tickets only, so nightly is safe — keep).
