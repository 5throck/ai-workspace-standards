# upgrade-project Pre-upgrade Stash Tooling-Inventory Warning — Design

- **Date**: 2026-10-11
- **Status**: implemented
- **Spec id**: `2026-10-11-upgrade-stash-tooling-warning-design`
- **Ticket**: T-20261011-014 (upgrade-project stash/pop drops gitignored machine artifacts)
- **Affected**: `scripts/upgrade-project.ts` 1.69.0 → 1.70.0 (+ scrub-canonical L1 mirror), NEW `scripts/helpers/ignored-tooling.ts` 1.0.0 (+L1 mirror), registry rows, `tests/unit/ignored-tooling.test.ts`

## Problem

The pre-upgrade rollback snapshot is `git stash push -u` — it snapshots
untracked but NOT gitignored files. Machine-local tooling that is gitignored
(the observed casualty: co-abap's `vsp` binary) therefore falls outside the
snapshot, and a delivery pass that replaces their directory destroys it.
T-20261011-012 recorded the incident; this design implements the ticket's
requested remedy (warn with an inventory).

## Decision

Warning-only (the ticket offered warn-inventory OR stash-exclusion; a warning
cannot lose data, an exclusion could surprise the rollback contract):

- Before the stash, enumerate gitignored untracked files
  (`git ls-files --others --ignored --exclude-standard`) and select
  tooling-like entries with the new pure helper
  `selectIgnoredToolingArtifacts` (scripts/helpers/ignored-tooling.ts):
  skip dependency/cache/build trees; keep extensionless executables and
  binary-ish extensions (.bin/.exe/.dll/.so/.dylib/.app/.wasm); drop
  text-y local files and OS junk (.DS_Store et al. — leading-dot files read
  as extensionless, so junk is excluded by name).
- When non-empty, print a WARN inventory (up to 5 samples + count) and a
  back-up-before-upgrading hint. The stash behavior itself is unchanged.

## Verification

- Unit: tests/unit/ignored-tooling.test.ts (5 cases — binaries kept,
  dep/cache trees skipped, text/junk dropped, whitespace trimmed).
- typecheck 0 errors; full unit suite green; audit green at landing.
