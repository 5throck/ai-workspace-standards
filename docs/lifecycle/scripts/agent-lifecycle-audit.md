# agent-lifecycle-audit.ts Script Lifecycle

## Metadata

- **Script**: agent-lifecycle-audit
- **Status**: active
- **Version**: 1.8.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-29

## Description

Agent health checker run at the workspace root and inside delivered projects: orphaned agents, missing frontmatter, status vocabulary, AGENTS.md roster registration, deprecated-agent skill references, handoff integrity, removal-review deadlines, stale `last_updated` vs git history (sync-only and metadata-only commits skipped), skill `owner:` existence (L0 authoring surface), and — since v1.8.0 — tier-declaration validation in the ADR-0102 scalar form (`tier: high|medium|low`, shared `parseTierDeclaration()` from lifecycle-sync-audit; legacy uniform map blocks tolerated during the transition). SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.7.0 → v1.8.0 (ADR-0102 / T-20261026-018, design 2026-10-26-model-registry-platform-coverage-design §7): Checks 8-10 parse the scalar `tier: high\|medium\|low` declaration as the canonical shape via the shared `parseTierDeclaration()` (lifecycle-sync-audit 1.19.0) — a scalar tier previously tripped three false "Missing tier.*" ERRORs per file; a legacy uniform per-platform map block stays tolerated during the transition with the original per-platform checks (uniform passes; mixed/unknown keep the Missing/Invalid error paths). Extends-stub chain resolution (T-20261001-004) is preserved on the TierDecl resolver. | automation-engineer |
