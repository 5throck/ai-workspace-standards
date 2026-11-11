---
title: "co-deck agent phases use the 11 lecture-workflow stage numbers, not the 0-6 delivery phases"
author: SungHyuk
date: 2026-11-11
branch: main
cost: { minutes: 14, tokens: 89151 }
id: l-40af9e6f
scope: repo
status: active
src: agent
touches:
  - scripts/procedure-coverage.ts
  - scripts/validate-process.ts
  - scripts/regenerate-agents-md.ts
  - templates/co-deck/docs/phase-definitions.md
---

## Decided
The user chose option A: co-deck agent frontmatter `phases` holds the co-deck lecture-workflow stage numbers (1-11). Reason given: there is no reason to compress an 11-stage workflow into delivery phases 0-6. This needs a new ADR that supersedes the frozen phase semantics, plus renumbering of the procedures and template docs. The design and ADR draft are written; implementation is not started.

## Tried and ruled out
- Keep delivery phases 0-6 and relabel the template columns (the design's recommended option C): rejected by the user as an artificial squeeze.
- Add a separate `stages` field next to `phases` (option B): offered as the lower-blast-radius choice, the user picked A instead.

## Watch out
Several workspace checks assume phases are whole numbers 0-6 and that phase and stage stay separate axes, so they must change together with the ADR. The co-deck project's four renumbered agents currently raise upgrade CONFLICT rows until the template follows.

In the code: docs/designs/2026-11-11-co-deck-phase-doctrine-design.md, ADR-0083, scripts/procedure-coverage.ts, scripts/validate-process.ts (DEG-P-01), scripts/regenerate-agents-md.ts, templates/co-deck/docs/phase-definitions.md.
