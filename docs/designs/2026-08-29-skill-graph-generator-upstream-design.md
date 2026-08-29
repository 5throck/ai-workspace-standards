# Design: Upstream co-newbiz Skill-Graph Generator Adaptations (v1.8.3)

- **Date**: 2026-08-29
- **Status**: Implemented
- **Related**: ADR-0060 (base + Amendments 1–6), docs/designs/2026-08-28-skill-graph-template-rollout-design.md, projects/co-newbiz/docs/adr/0073-skill-relationship-graph-and-lifecycle-phase-system.md

## Problem

`projects/co-newbiz` carried a local fork of `scripts/generate-skill-graph.ts`
(v1.8.2 vs L0 v1.7.1) with three adaptations that are not co-newbiz-specific —
they fix latent defects for every scaffolded project:

1. **L0/L3 mis-detection**: the L0 root was detected by `existsSync(templates/)`.
   A scaffolded project with a *content* template directory (co-newbiz ships
   `templates/deliverables/`) was mis-tagged L0 in its own project graph.
2. **Missing project-local manifest edges**: Source 3 read `variant.json` only
   from `templates/co-*` directories, which exist only at the L0 root. A
   scaffolded project's own `variant.json` `skill_manifest` was never read, so
   its `used_by`/`phase` edges never materialized in any project graph.
3. **Phantom agent nodes**: `agents/` discovery counted folder `README*.md` and
   `_*` files as agent nodes in projects that carry them.

## Decision

Upstream all three adaptations into the L0 generator (v1.7.1 → v1.8.3),
propagate to `templates/common/scripts/` (L1), and replace co-newbiz's fork
with the L0 copy so fork maintenance stops. The multi-element graph pilot
(`projects/co-newbiz/scripts/co-newbiz/graph.ts`) is **not** ported: ADR-0060
Amendment 4 designates it a co-newbiz-recognized precedent pending the
three-stage generalization criterion, which is unmet.

## Changes

| File | Change |
|------|--------|
| `scripts/generate-skill-graph.ts` | v1.8.3: `templates/common`-keyed layer detection; Source 3b (project-local `variant.json`); README*/`_` exclusion in agents/ |
| `templates/common/scripts/generate-skill-graph.ts` | Propagated copy (L0→L1 publish) |
| `projects/co-newbiz/scripts/generate-skill-graph.ts` | Fork replaced with L0 v1.8.3 copy (logic diff 0) |
| `scripts/SCRIPTS.md` | Version row 1.7.1 → 1.8.3 |
| `CHANGELOG.md` | [Unreleased] entry |

## Verification

- L0 graph regenerated → byte-identical to committed artifact (0 drift,
  542 nodes / 1,545 edges); `verify-skill-graph.ts` passes.
- All 14 scope graphs (`common` + 13 `co-*`) regenerated and verified OK.
- co-newbiz project graph regenerated and verified: 223 nodes / 661 edges,
  `used_by: 117` / `phase: 71` (manifest edges preserved by upstreamed Source 3b).

## Trade-offs

- Single PR per CONSTITUTION.md §3.3 (sequential branch dependency); no
  parallel branches.
- Project graphs for the other 13 `co-*` projects will pick up Source 3b edges
  on their next project-local regeneration — expected and desirable, but each
  project's graph JSON will change on its next `/sync`.
