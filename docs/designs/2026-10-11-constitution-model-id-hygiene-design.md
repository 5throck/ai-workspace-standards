# CONSTITUTION §6 / context.md — Model-ID Hygiene in Skills — Design

- **Date**: 2026-10-11
- **Status**: implemented
- **Spec id**: `2026-10-11-constitution-model-id-hygiene-design`
- **Affected**: CONSTITUTION.md §6 (new COMMON-CONSTITUTION marker zone), templates/common/docs/context.md (matching projected zone)

## Decision

User directive: the "skills must not contain model names" principle (machine-enforced
since skill-lifecycle-audit 1.8.0 Check MM, spec 2026-10-11-backlog-batch-2-design)
becomes constitution text.

- CONSTITUTION.md §6 gains a marker-wrapped subsection **"Model-ID Hygiene in
  Skills"**: skills (SKILL.md + references) MUST NOT hardcode literal model IDs;
  registry IDs live only in docs/workspace-schema.json `models.*` and the
  CLAUDE.md §6 / AGENTS.md §3.6 prose; derived skill documents reference models
  by TIER plus a registry pointer; enforcement via Check MM; model changes go
  through the `model-migration` skill.
- templates/common/docs/context.md receives the matching COMMON-CONSTITUTION
  zone (same heading) so scaffolded projects carry the principle; the
  constitution-context marker-inject domain keeps it scrubbed and in sync with
  the CONSTITUTION slice on every publish.
- Placement: end of §6 Skill Lifecycle Management (before the §6.5 separator) —
  the skills-content-hygiene cluster next to Cross-Platform Availability and the
  Skill Relationship Graph rules.

## Verification

- `bun scripts/validate-templates.ts` — 0 FAILs (no stale-promoted/marker findings)
- `bun scripts/audit.ts` — All checks passed
- Zone parity: context.md zone content matches the CONSTITUTION slice (scrub-neutral
  — no docs/constitution/ links in the section)
