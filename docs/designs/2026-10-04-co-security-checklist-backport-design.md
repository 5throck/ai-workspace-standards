# Design: co-security Checklist Backport (Project → Template)

- **Spec id**: `2026-10-04-co-security-checklist-backport-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: T-20261003-030 (parent batch; part (c) landed as 605923ba), `templates/co-security/docs/findings/security-checklist.md`, `templates/co-security/docs/external-web-security-checklist.md`, `scripts/propagation-map.json`

## Problem

T-20261003-030 parts (a)/(b): the fleet security checklist lives as evidence-backed
dated files in `Projects/co-security/docs/findings/` while the template carries a
stale template-grade copy; the external-web (black-box) checklist exists only in the
project. Two divergences blocked a naive copy: the template file replaces the
project's References block with a template-note header, and the dated project
filename (`2026-10-01-fleet-security-checklist.md`) maps to an undated template name
(`security-checklist.md`).

## Decision

1. **No new propagation domain.** A propagation-map domain cannot express a
   project→template flow (the engine's direction is workspace→variants), and the
   relationship is one standing file, not a family — automated machinery would
   outlive its subject. The design decision is a **manual curated backport with a
   documented refresh rule**: whenever the project checklist gains derivations or
   items, the template copy is refreshed by hand in the same PR that lands them.
2. **Refresh rule encoded in the template-note** (the divergence is the
   documentation): the template note names the undated↔dated mapping and points
   template readers to the evidence-backed project sources.
3. **Executed backport**:
   - `templates/co-security/docs/findings/security-checklist.md` refreshed from the
     project's `2026-10-01-fleet-security-checklist.md`: derivation list gains the
     2026-10-03 co-workspace deployment review; References block → template-note
     (mapping + source pointers); checklist items byte-carried.
   - `templates/co-security/docs/external-web-security-checklist.md` promoted from
     the project file (118 lines); template-relative links rewritten to the
     template-note style; undated name (a standing checklist, not an engagement
     record).

## Non-goals

- No scaffold-side changes: the findings/ tree is variant-declared and delivered by
  the existing co-security template mechanics.
- No countermeasure-catalog backport: the catalog is evidence (file:line exemplars
  against the deployed workspace) and stays project-side, referenced by the
  template note.
