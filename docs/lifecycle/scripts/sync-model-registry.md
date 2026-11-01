# sync-model-registry.ts Script Lifecycle

## Metadata

- **Script**: sync-model-registry
- **Status**: active
- **Version**: 1.3.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-01
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-10-11

## Description

Registry model-ID migration sweep: when a `models.*` registry ID changes in docs/workspace-schema.json, rewrites the sanctioned prose surfaces listed in SURFACES (tier→model mapping tables, model-ID comments) so the validate-model-registry prose gate keeps passing. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-01 | production | production | v1.2.0 → v1.3.0 (spec docs/designs/2026-11-01-hub-consolidation-design.md Phase 1 batch E5): SURFACES gains templates/co-architect/CODEX.md (gpt-6.1 tier table, same class as templates/common/CODEX.md) and templates/co-architect/docs/workspace-schema.json (only variant shipping its own registry copy) — the co-architect template addition put model-ID literals outside the sweep; completeness test caught them. | automation-engineer |
| 2026-10-26 | production | production | v1.1.1 → v1.2.0 (ADR-0102 scalar tier / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): SURFACES drops the 9 root agents/*.md entries — root agents declare one scalar `tier:` with no model-ID comments, so the entries were no-ops; the 2 L1 agent entries stay until PR-2 normalizes templates/common/agents. | automation-engineer |
