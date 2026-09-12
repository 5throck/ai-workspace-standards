---
status: "Accepted"
---

# ADR-0075: Flat Skill Directory Layout + Frontmatter Categories

**Status**: Accepted
**Date**: 2026-09-12
**Deciders**: pm (user-approved skill-layout convergence)

## Context

The co-safety variant template historically grouped its variant skills into
category subdirectories (`skills/daily/`, `skills/investigation/`, `skills/emergency/`,
`skills/domains/{functional,industry}/<domain>/<skill>/`). The 2026-09-12 skill-layout
review measured the cost of this outlier layout against every consumer that assumes the
fleet-standard flat layout (`skills/<name>/SKILL.md`):

1. **upgrade-project delivery gap** — the variant skills sync pass iterates only direct
   children of `templates/<variant>/skills/`; nested category directories carry no
   SKILL.md and are skipped, so ~52 nested skills never received template updates.
2. **Skill-graph projection gap** — `generate-skill-graph.ts` discoverNodes() likewise
   scans direct children only; 31 of 81 skills were projected.
3. **Index categorization failure** — `skills/SKILLS.md` groups by `metadata.type`
   frontmatter; skills without it landed under "## Unknown".
4. **Path-coupled references** — procedure `skill_key` values encoded layout paths
   (`daily/risk-assessment`), raising the cost of every future move.

## Decision

1. **Flat is the fleet standard**: skill directories live at `skills/<name>/` with the
   frontmatter `name` matching the directory name. Variant templates ship flat.
2. **Grouping is metadata, not directories**: skills declare `metadata.type`
   (`workflow`, `domain`, `process`, …) which the generated skills index renders as
   sections. Domain skills additionally carry `mirror: false`.
3. **`mirror: false`** (sync-skills v1.6.0) excludes agent-dispatched fleet skills from
   the `.claude/.gemini/.agents` platform mirrors — the PM-gateway dispatch model keeps
   them out of the directly-invocable platform surface without requiring nested
   directories.
4. Template-first migration: the variant template flattens before inheriting projects so
   the upgrade skill pass sees matching flat paths (otherwise it re-copies flattened
   names as new skills).

## Consequences

- `templates/co-safety/skills/` flattened (60 skills, dirs renamed to frontmatter names:
  `loto`→`psm-loto`, `moc`→`psm-moc`, `change-control`→`gmp-change-control`,
  `deviation-capa`→`gmp-deviation-capa`, `qrm`→`gmp-qrm`); inheriting projects follow.
- Nested variant skills become visible to the upgrade skill pass — update delivery
  resumes for skills that had been frozen since scaffold.
- Skill-graph projection covers the full flat set; procedure `skill_key` values drop
  their layout-path prefixes.
- `sync-skills.ts` v1.6.0 adds the `mirror: false` skip (Phase 1) with the
  `security-gate: true` precedent pattern.

## References

- co-safety PR #135/#136 — governance fixes and documentation-consistency remediation
- 2026-09-12 skill-layout review — measured costs 1–4 above
- `scripts/sync-skills.ts` v1.6.0 — mirror opt-out
