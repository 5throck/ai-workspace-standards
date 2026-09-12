# Project Resync Report — 2026-09-12 — excluding co-newbiz

## Scope

- Workspace: `C:\git\ai_workspace`
- Included projects: `co-abap`, `co-abap-plugin`, `co-architect`, `co-consult`, `co-deck`, `co-develop`, `co-safety`
- Excluded project: `co-newbiz`

## Step 0 — Provenance audit

- Ran `bun scripts/resync-audit.ts` with an explicit project allowlist excluding `Projects/co-newbiz`.
- Snapshot directory: `.tmp/resync-snapshots-2026-09-12`
- Result: no `STALE-RESIDUE` verdicts were applied.
- Dirty at audit time: `co-abap`, `co-abap-plugin`, `co-consult`, `co-deck`, `co-safety`.
- Clean at audit time: `co-architect`, `co-develop`.

## Step 1 — Project GitHub sync

| Project | Result | PR |
|---|---:|---|
| co-abap | Already synchronized by upstream main; local accidental stale PR was closed and branch deleted. | closed superseded PR #127 |
| co-abap-plugin | Synced and merged. | https://github.com/5throck/co-abap-plugin/pull/91 |
| co-architect | No local resync work; fast-forwarded to origin/main. | — |
| co-consult | Synced and merged after regenerating skill graph and reconciling with latest main. | https://github.com/5throck/co-consult/pull/39 |
| co-deck | Synced and merged after regenerating skill graph and reconciling with latest main. | https://github.com/5throck/co-deck/pull/77 |
| co-develop | No local resync work; fast-forwarded; default branch is now `main`. | — |
| co-safety | Synced and merged after regenerating skill graph, fixing stale VERSION_MANIFEST entry, and making CI tolerate repos without package.json. | https://github.com/5throck/co-safety/pull/142 |

## Validation notes

- Regenerated `docs/skill-graph.json` / `docs/skill-graph.md` where variant audits detected the new `project-review -> validate-docs-links` relationship.
- Used the project dev-sync pathway and `--spec-exempt=E5` for sync-only lifecycle finalization; did not use `--no-verify`.
- co-safety CI initially failed because common CI ran `bun install --frozen-lockfile` even when a project has no `package.json`; the project PR fixed this and passed all required checks.

## Step 2 — Selective backport judgment

| Candidate | Judgment | Destination / Reason |
|---|---|---|
| co-safety CI `Install dependencies` package manifest guard | Promoted | Backported to `templates/common/.github/workflows/ci.yml`; reusable for projects that intentionally do not carry a package manifest. |
| Project memory / skill-session-review outputs | Stays project | Session/provenance outputs are project-local evidence, not template content. |
| Generated skill graphs | Stays project | Projection artifacts reflect each project's current installed skill/agent graph. |
| `project-review` mirror updates | Already template/root-driven | These were propagated from workspace/template work and do not create a new project-origin backport. |

## Final fleet state after Step 1 cleanup

- All included project working trees were clean.
- All included projects had zero unpushed commits.
- All included project resync PRs were merged or intentionally closed.
- Remote PR branches for merged resync PRs were deleted/pruned; local merged `pr/*` branches were removed.

## Deferred

- Root repository remains intentionally dirty from the preceding project-review/template remediation work; this report and the CI backport should be included in the root sync batch.
- Full Step 4 upgrade-project cycle is deferred until the root template changes are synced/merged, per project-resync sequencing.
