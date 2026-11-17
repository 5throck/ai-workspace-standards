---
title: "Stray PNGs shipped into new projects came from the deck template's test, not the work variant"
author: SungHyuk
date: 2026-11-17
branch: main
cost: { minutes: 1, tokens: 86643 }
id: l-4fe9214a
scope: repo
status: active
src: agent
touches:
  - templates/co-deck/scripts/co-deck/tests/gen-slides-pdf-render.test.ts
  - scripts/new-project.ts
  - AGENTS.md
  - agents/pm.md
---

## Decided
The report that new co-work projects get PNGs in deliverables was traced to the co-deck template: a test leaked solid-colour background images into the template's deliverables folder and a workspace sync committed them, so scaffolding copied them. Fix targets co-deck (remove the files, make the test clean up after itself), not co-work.

## Tried and ruled out
Reproducing in co-work: its template has no PNGs under deliverables, so there was nothing to fix there.

## Watch out
Test fixtures written to the template's own deliverables root survive aborted runs and get swept up by "workspace sync" commits. Keep test artifacts inside a per-test temp dir that the suite removes.

In the code: templates/co-deck/scripts/co-deck/tests/gen-slides-pdf-render.test.ts (background precedence describe, pool image); scripts/new-project.ts copyDir; leaked in commit 76eeca4b3.
