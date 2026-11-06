# Design: git-aware discovery filter for committed-projection scripts (T-20261103-004)

**Date**: 2026-11-03 (code landed same day; this design doc retro-registered 2026-11-06)
**Status**: implemented
**Scope**: `scripts/lib/git-aware-scan.ts` v1.0.0 (new), `scripts/skill-graph-fleet-report.ts` (defaultProjects), `scripts/generate-skill-graph.ts` (decisions/ADR scans), `tests/unit/git-aware-scan.test.ts` (new), `templates/common/scripts/lib/git-aware-scan.ts` (L1 mirror), both SCRIPTS.md registries
**Tickets**: T-20261103-004
**Landing**: PR #1842 (merged 2026-11-03) — the records-hygiene batch that adopted an orphaned session's implementation, completed and landed under the ticket

> Retro-registration note: this document backfills design paperwork for
> already-landed code per the D8 batch adjudication
> (`docs/reports/2026-11-06-d8-batch-adjudication.md` §B3, retro-backfill
> remedy). No code changes ride this registration.

## Context

Two scripts publish COMMITTED artifacts (the workspace skill-graph projection
and the fleet skill-graph report), so anything their discovery picks up that
is not actually committed corrupts the published output:

1. **Untracked files inside tracked dirs** — `generate-skill-graph.ts`
   enumerated `docs/decisions/` and `docs/adr/` with a filesystem directory
   listing, so a decision record or ADR left uncommitted on a working tree
   (the recurring dead-session pattern) leaked into the committed projection.
2. **Transient PR working checkouts in the fleet projection** —
   `skill-graph-fleet-report.ts` `defaultProjects()` listed every
   `Projects/co-*` directory. A `pr/*` branch checkout is a working copy
   mid-landing: its projection files are branch-state, not the project's
   canonical skill graph, and its inclusion produced false fleet rows.

## Decision

Add one shared discovery helper, `scripts/lib/git-aware-scan.ts` v1.0.0, and
wire the two consumers to it. Five exports:

| Export | Contract |
|---|---|
| `trackedFilesUnder(root, dir)` | One cached `git ls-files -z -- <dir>` query rooted at `root`, NUL-split, backslashes normalized to forward slashes, as a `Set` of repo-root-relative POSIX paths. Returns `null` for a non-git context (no repo / git unavailable). |
| `isTrackedRel(tracked, relPath)` | Fail-open membership test: a `null` set tracks everything, so callers outside a repo keep their historical include-all behavior (SKILL_GRAPH_ROOT fixtures). |
| `checkoutBranch(dir)` | Current branch via `git -C <dir> branch --show-current`; `null` when detached / non-git / git errored — null is "no positive evidence", never an exclusion signal. |
| `isTransientCheckoutBranch(branch)` | `pr/*` prefix = a transient PR working checkout per the landing convention (pinned exactly; `xpr/lookalike` is not transient). |
| `filterTransientCheckouts(projects, branchOf)` | Pure split of candidate checkouts into fleet members vs transient PR copies. Only POSITIVE evidence (a live `pr/*` branch) excludes; main-branch, detached-HEAD and non-git dirs all stay (fail-open). |

Two deliberate semantics:

- **Fail-open on absence of git evidence**: both leak classes are about
  committed-output hygiene, not security; when git cannot answer (fixture
  trees, CI detached HEADs, non-repo roots) the historical behavior survives
  rather than silently emptying the projection.
- **Positive evidence only for exclusion**: a checkout is skipped as a
  transient PR copy only when git actively reports a `pr/*` branch. Detached
  HEAD (CI checkouts) and non-git dirs are never excluded.

## Consumers

- `generate-skill-graph.ts` — the `docs/decisions/` and `docs/adr/` scans use
  `trackedFilesUnder` + `isTrackedRel` at PER-FILE level: an uncommitted
  record inside a tracked directory no longer enters the projection.
- `skill-graph-fleet-report.ts` `defaultProjects()` — `filterTransientCheckouts`
  + `checkoutBranch` at DIRECTORY level; a skipped checkout is reported to
  stderr with its branch (`⚠️ ... transient PR working checkout ... excluded
  from fleet discovery (T-20261103-004)`).

## Tests

`tests/unit/git-aware-scan.test.ts` (6 cases, 2 describes):

- per-file membership: a tracked dir yields committed files and not untracked
  names; non-git context returns `null` and fails open; a real `git init`
  fixture repo end-to-end (committed tracked, untracked not).
- checkout classification: `pr/*` candidates skipped with name+branch while
  main/detached/non-git stay; the `pr/` prefix pinned exactly; a fixture repo
  returns its checked-out branch and `null` on detached HEAD.

Hermeticity: the suite strips `GIT_DIR` / `GIT_WORK_TREE` /
`GIT_INDEX_FILE` / `GIT_OBJECT_DIRECTORY` for its duration (the pre-push hook
runs `bun test` with `GIT_DIR` exported, which would silently redirect every
fixture repo's git spawn at the workspace repo) and restores them after.

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (workspace tooling, platform-neutral bun) | N/A |
| Antigravity (GEMINI.md) | None (workspace tooling, platform-neutral bun) | N/A |
| templates/common | Propagation required — helper mirrored 1:1 to `templates/common/scripts/lib/git-aware-scan.ts`; L1-delivered-helper live-tree pin maintained | `templates/common/scripts/lib/git-aware-scan.ts` |

## Tickets / evidence

- Ticket: `tickets/governance/T-20261103-004` (records-hygiene batch; the
  git-aware-scan helper was its one real-code item)
- Landing PR: #1842 (merged 2026-11-03) — adopted an orphaned session's
  implementation, item-by-item verified against the ticket
- Adjudication: `docs/reports/2026-11-06-d8-batch-adjudication.md` §B3 row 1
