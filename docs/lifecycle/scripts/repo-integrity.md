# repo-integrity.ts Script Lifecycle

## Metadata

- **Script**: repo-integrity (scripts/lib/repo-integrity.ts)
- **Status**: active
- **Version**: 1.0.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-09
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-11-09 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-11-09

## Description

Repository-config integrity guard: `snapshotRepoConfig(root?)` (sorted `git config --local --list` lines plus the effective `core.bare`), `diffRepoConfig(before, after)` (pure added/removed/changed, order-insensitive and multi-value aware), and `assertWorkTreeHealthy(root?)` (one-line refusal carrying the exact repair command when the tree is not usable). Closes the second corruption mode of the 2026-11-09 incident — worktrees share the main `.git/config`, so a redirected `git config` write is repo-wide. Every git spawn inside runs under `gitCleanEnv()`. L0+L1 delivered (the delivered `hooks/pre-push.ts` imports it). SSOT: `scripts/SCRIPTS.md` registry row (`lib/repo-integrity.ts`), spec `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` §11.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-09 | production | production | v1.0.0 (spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §11): initial release — snapshot/diff/work-tree-health primitives shared by dev-sync.ts v1.45.0 (start-of-run invariant + blocking step 4.88 config gate) and hooks/pre-push.ts v1.8.0 (snapshot/compare around the changed-path test run). Verified mechanism: with `core.bare = true`, `git rev-parse --is-inside-work-tree` prints `false` while still exiting 0, so the guard tests stdout rather than the exit code; `git config --local --list` keeps working, which is what makes the snapshot pair a viable detector. | automation-engineer |
