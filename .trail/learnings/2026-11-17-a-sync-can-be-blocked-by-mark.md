---
title: A sync can be blocked by memory-log citations of tickets that never landed
author: Mark
date: 2026-11-17
branch: pr/20261117-co-work-svg-check-utf8
id: l-7585fc86
scope: repo
status: active
src: agent
touches:
  - memory/2026-11-17.md
---

## Decided
When the sync pipeline's ticket-store drift gate fails on ids that exist nowhere in the repo, correct the citations in the memory log inside the same PR rather than recreating tickets. The gate fails every sync from main until the dangling citations are fixed, so it is not caused by the change being landed.

In the code:
- memory/2026-11-17.md: reword the prose mention and drop the auto-generated 'modified' list lines that name the missing ticket files.

## Tried and ruled out
- Recreating the missing ticket files: their content lived only in another session's untracked work, so any recreation would be invented.

## Watch out
- A failed pipeline run has already appended its session block to the memory log; a same-branch rerun replaces that block.
- After landing from a worktree, the shared copy of a registry row differs from the PR copy by the Last Updated date the pipeline refreshes, so compare before restoring.
