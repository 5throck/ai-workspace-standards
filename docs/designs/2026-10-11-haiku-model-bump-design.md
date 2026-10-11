# Claude Low-Tier Model Bump: claude-haiku-4-5 → claude-haiku-5-5 — Design

- **Date**: 2026-10-11
- **Status**: implemented
- **Spec id**: `2026-10-11-haiku-model-bump-design`
- **Affected**: 41 live files — docs/workspace-schema.json (SSOT `models.claude.low`), CONSTITUTION.md, AGENTS.md §3.6, CLAUDE.md §6, docs/constitution/05-multi-agent-architecture.md, skills/explain-me references + 5 platform mirrors, templates/common (AGENTS/CLAUDE/workspace-schema/context/pm-yaml-schema/PLATFORM_HARNESS), 13 co-* AGENTS.md + co-game ×2 + co-safety + co-abap ×3 docs

## Decision

User-directed: the Low tier's Claude model moves from `claude-haiku-4-5` to
`claude-haiku-5-5`. The `Agent()` alias `haiku` is unchanged — only the
registry ID behind it moves (CLAUDE.md §6 translation prose updates itself in
the same replace).

Deliberately NOT updated (historical records, not live surfaces):
CHANGELOG.md entries and docs/designs/governance-docs-consolidation-design.md.
Projects/** are also untouched — they converge via the standard upgrade
pipeline (AGENTS.md is MERGE_MANAGED; new scaffolds get the new mapping
immediately).

## Verification

- `bun scripts/validate-model-registry.ts` — agents/*.md model comments + tier
  prose match the registry ✓
- `bun scripts/audit.ts` — All checks passed (incl. model registry gate)
- `bun scripts/validate-templates.ts` — 0 FAILs
- Residual grep: 0 live `claude-haiku-4-5` occurrences outside historical records
