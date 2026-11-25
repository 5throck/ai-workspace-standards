# Root-Backfill Invalidation Key — key on the graph commit, not HEAD (fleet-report v2.6.2)

- **Spec id**: `2026-11-24-backfill-invalidation-key-design`
- **Date**: 2026-11-24
- **Status**: implemented (PM-diagnosed defect with the verification recorded below; one small fix dispatch).
- **Author**: automation-engineer (PM-dispatched, Design Gate Row 0, ADR-0074).
- **Tier**: L0 (`scripts/skill-graph-fleet-report.ts`, `memory/skill-graph-metrics/root-backfill.json`, generated pages under `docs/`, registries).
- **Related**: `docs/designs/2026-11-23-skill-graph-observability-design.md` §13 (the v2.6.0 backfill whose staleness policy this supersedes), `scripts/skill-graph-fleet-report.ts` `@version 2.6.2`.

## 0. Summary

The §13 root git-history backfill recorded `headSha` (repo HEAD) and treated the artifact as fresh only when `headSha === git rev-parse HEAD`. That is a **fixed-point violation**: the artifact is committed in the same repository it describes, so merging it advances HEAD, which invalidates it on the next run, which rewrites it, which dirties the tree, which emits another PR. Observed as #2162 → #2164 → #2165.

The fix re-keys invalidation on the **last commit that touched the replayed graph path** (`docs/skill-graph.json`), which is invariant under merges that do not touch that file.

## 1. Defect (verified in code at 2.6.1)

- `backfillIsFresh(file, HEAD)` compared `file.headSha` to `git rev-parse HEAD` (`scripts/skill-graph-fleet-report.ts:825-827`).
- `ensureRootBackfill` recorded that same HEAD (`:934`).
- Since `root-backfill.json` is git-tracked, every landing moved HEAD and forced a rebuild. No run could ever observe a clean tree after a merge: the generating commit is itself an HEAD change.

A second, smaller defect: page provenance printed a HEAD sha that changed even when the graph history did not, so the note's "as of" claim was semantically wrong.

## 2. Decision

| Aspect | v2.6.1 (defect) | v2.6.2 (this design) |
|---|---|---|
| Recorded field | `headSha` | `graphHeadSha` |
| Freshness predicate | `file.headSha === rev-parse HEAD` | `file.graphHeadSha === git log -1 --format=%H -- <pathspec>` |
| Behaviour on unrelated commit | rebuild (spurious) | skip (correct) |
| Behaviour on graph commit | rebuild | rebuild (unchanged) |
| Legacy artifact (only `headSha`) | n/a | stale exactly once, then stable |
| Page provenance | HEAD sha | graph-commit sha |

`readGraphHeadSha(repoDir, gitRelPath)` performs the query and reuses `toGitPath()` for the POSIX-shaped pathspec (the v2.6.1 Windows constraint is preserved). It returns null on failure; `ensureRootBackfill` then throws with a clear message in the same shape as the previous no-HEAD error. No path in the backfill flow reads `rev-parse HEAD`.

## 3. Convergence proof

> **Rule replaced (2026-11-25).** The freshness key is no longer the graph commit. It is the content of the graph at that commit: the artifact records `graphContentSha256`, the SHA-256 of `docs/skill-graph.json` as stored at the graph commit, and `backfillIsFresh` returns true when that hash is equal. `graphHeadSha` stays in the file as information and is compared only when no content hash is available. Decision and tests: `docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md` §4.1 (T-20261124-001, `scripts/skill-graph-fleet-report.ts` v2.7.0).
>
> **Why the v2.6.2 rule was not sufficient.** Step 2 below assumes the landing commit does not touch `docs/skill-graph.json`. dev-sync regenerates that file while landing (step 4.65), so the graph commit `G` moves again after the artifact was written. The next fleet-report run then saw `file.graphHeadSha !== G`, rebuilt the series and dirtied the tree, although the graph content was byte-equal. The content key makes the outcome independent of the order of the two commits.

The original v2.6.2 argument is kept below as the record of what it proved.

Let `G` be the last commit touching `docs/skill-graph.json` and `H` the repo HEAD.

1. Run at HEAD `H₀`: artifact records `graphHeadSha = G`. Tree dirty with pages + backfill.
2. Commit those artifacts (commit `C`, which touches `docs/`, `memory/`, `scripts/`, `tests/` — not `docs/skill-graph.json`). HEAD becomes `H₁ = C(H₀)`; **`G` is unchanged**.
3. Run at `H₁`: `readGraphHeadSha` returns `G`, `backfillIsFresh` is true, no write. Pages are deterministic and also unchanged. **Tree clean.**

The merge of the PR is likewise a commit that does not touch `docs/skill-graph.json`, so step 3 holds after the merge too. This is exactly the property #2165 lacked.

## 4. Verification

- `tests/unit/skill-graph-observability.test.ts` (43 tests) — updated staleness tests plus three new ones: `REGRESSION: an unrelated commit advancing HEAD does NOT invalidate the backfill` (rebuilt=false, bytes unchanged), a graph-touching commit invalidates (rebuilt=true, `graphHeadSha` advances), and a legacy `headSha`-only file is stale exactly once.
- Regeneration: two consecutive `bun scripts/skill-graph-fleet-report.ts` runs produce byte-identical pages and backfill; the second run leaves the tree unchanged.
- `bun scripts/audit.ts` exit 0; `bun scripts/verify-scripts.ts --verify` clean.

## 5. Out of scope

Snapshot emission (date-keyed, owned by the 03:00 runner), the replay algorithm, and the two pages' rendering are untouched apart from the provenance wording.
