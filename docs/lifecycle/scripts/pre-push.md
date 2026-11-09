# pre-push.ts Script Lifecycle

## Metadata

- **Script**: pre-push (scripts/hooks/pre-push.ts)
- **Status**: active
- **Version**: 1.8.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-09
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-11-09 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-11-09 (record created; the hook itself predates it)

## Description

TS pre-push hook: scoped gitleaks secret scan, lifecycle audit, changed-path test run, and branch protection. Since v1.8.0 the changed-path test run is wrapped in a repository-config integrity check (snapshot → run → compare, FATAL on any delta) because this hook is the one place where a test spawn historically inherited `GIT_DIR` from `git push`. v1.8.1 makes both snapshot reads fail closed (an unreadable pre- or post-run snapshot aborts non-zero; the previous code warned and skipped the whole check) and includes the effective `core.bare` in the comparison, so a bare flip is refused even when the local key listing is unchanged. Uses `gitCleanEnvForShell()` for the test spawn and `scripts/lib/repo-integrity.ts` for the snapshot pair. SSOT: `scripts/SCRIPTS.md` registry row (`hooks/pre-push.ts`), spec `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` §11.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-09 | production | production | v1.8.1 (QA follow-up fix, design §11 fail-closed semantics): the pre-run snapshot no longer fails OPEN — an unreadable config before the changed-path test run aborts non-zero with dev-sync's "FATAL — repository config could not be read …" shape plus the repair line and spec reference, instead of a warning that skipped the whole check; the before/after comparison also carries the EFFECTIVE `core.bare`, so a bare flip whose `git config --local --list` key set is unchanged (a global/system-scope flip) is refused. Pinned by `tests/unit/repo-integrity.test.ts` (abort-on-throw; empty-key-diff bare flip still refused). | automation-engineer |
| 2026-11-09 | production | production | v1.8.0 (spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §11): repository-config integrity check around the changed-path test run — snapshot `git config --local --list` before the spawn, re-read after, block the push on any delta. Origin of the 2026-11-09 incident: this hook inherits `GIT_DIR` from `git push`, and the intercepted `bun test` children once wrote into the real repository (rogue commits in mode 1; `core.bare = true` in mode 2). Four `git config` reads, no writes. | automation-engineer |
| 2026-11-09 | production | production | v1.7.3 (P0 correctness fix): the changed-path `bun test` spawn runs under `.env(gitCleanEnvForShell())` instead of the deleted `gitEnvUnset()` — Bun Shell's `.env(obj)` REPLACES the child environment, so the unset map left the child with no PATH. | automation-engineer |
