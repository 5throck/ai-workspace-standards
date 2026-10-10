# New-Project Skill — Lifecycle Record

## Metadata
- **Skill**: new-project
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-09-27
- **Last Updated**: 2026-09-27 (Version 1.0.0 initial — L0 dispatch skill for the variant project scaffolding engine `scripts/new-project.ts`; non-interactive tenant/L3 creation from `templates/<variant>` with platform profiles, identity flags, and post-scaffold verification. Design: `docs/designs/2026-09-27-new-project-skill-design.md`)

## Description
Scaffolds a fresh project instance from an existing variant template
(`templates/<variant>`) via the E2E-tested engine `scripts/new-project.ts`
(subprocess dispatch, `--platform` takes `all`, one profile, or a comma list of `claude|antigravity|codex|hermes` per ADR-0100, `--country`/
`--description`/`--type` identity flags, pre-flight variant-readiness gates,
automatic rollback on failure). Fills the dispatch gap left when the README
`/new-project` shortcut references were removed as dead (T-20260927-011): the
engine existed since the L3 pipeline but had no skill surface. Boundaries:
new variant TEMPLATE authoring → `create-variant`; external-repo conversion →
`adopt-project`; template refresh of an existing project → `upgrade-project`.
Operator-level skill (workspace root); `l2_propagate: false`.

## Changelog
- 1.0.0 (2026-09-27): initial.

## Dependencies
- `scripts/new-project.ts` (engine, subprocess boundary)
- `templates/VERSION` + `template-v*` tags (ADR-0089 release cadence)
- Upstream: T-20260927-019 — `--version` pinned scaffolding is defective on main; the skill documents the flag as unavailable until fixed

## Phase History
- Production (2026-09-27): skill created; registry row added to `skills/SKILLS.md`; platform mirrors delivered by `sync-skills.ts` on next sync.

## Acceptance Criteria
- `bun scripts/validate-skills.ts` and `bun scripts/verify-skills.ts` green with the new skill present
- `bun scripts/skill-lifecycle-audit.ts` green (lifecycle record + registry row + frontmatter versions agree)
- Scaffold invocation documented in the skill matches `scripts/new-project.ts` usage (flags verified against source)
