---
title: Parallel PRs touching the shared log files show as conflicting on GitHub even though a local merge is clean
author: Mark
date: 2026-11-17
branch: pr/20261117-224500-fix-co-deck-stop-test-leaking-bgpool-png
id: l-9d55e2eb
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - memory/2026-11-17.md
---

## Decided
When a PR is marked conflicting only on the append-only pipeline files, merge main into its branch locally (union merge resolves it) and land that merge through the sync pipeline, because direct commits are blocked by the pre-commit hook.

In the code:
- .gitattributes marks CHANGELOG.md and memory logs as merge=union, which only local git honors; GitHub's server-side merge ignores it.
- Keep the PR's own body when re-running the pipeline: save it with gh pr view --json body into the git dir's sync-pr-body.md and pass it as --body-file, otherwise the PR body is rewritten.

## Tried and ruled out
- gh pr update-branch: fails on exactly these conflicts.
- Committing the local merge directly: the hook allows commits only through the sync pipeline, and bypassing it is forbidden.

## Watch out
- Union merging can resurrect lines that an earlier PR already removed from the memory log, such as list entries naming tickets that never landed, so the ticket-citation gate can fail again after the merge; remove those lines and rerun.
- The pipeline leaves a few auto-generated files (memory index, scripts README) out of the PR by design.
