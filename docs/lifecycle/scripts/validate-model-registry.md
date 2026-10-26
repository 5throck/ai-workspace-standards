# validate-model-registry.ts Script Lifecycle

## Metadata

- **Script**: validate-model-registry
- **Status**: active
- **Version**: 2.0.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-31

## Description

Tier-1 SSOT gate for agent model/tier declarations: validates each agent's tier declaration against the `models` registry in docs/workspace-schema.json. Since v2.0.0 (ADR-0102) the canonical declaration is one scalar `tier: high/medium/low` per agent file; legacy per-platform map blocks WARN loudly during the transition. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.5.0 → v2.0.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §9): scalar tier declaration + transition matrix — agents/*.md declare ONE `tier: high/medium/low`; platform→model resolves from schema `models` at validation time. Legacy per-platform blocks WARN loudly ("normalize to `tier: <value>`"; mixed blocks WARN without picking a value); unknown platform key in a legacy block FAILs; missing tier FAILs at L0 / WARNs in delivered contexts (transition); both silent skips deleted; legacy `# model-id` comments still checked against models; exit 1 only on FAIL. Refactored import-safe (classifyAgentTier / runModelRegistryValidation) for unit tests. No agent_tiers anywhere (user ruling 2 — schema block removed; the former L0 parity row is retired). | automation-engineer |
