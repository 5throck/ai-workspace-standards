# validate-model-registry.ts Script Lifecycle

## Metadata

- **Script**: validate-model-registry
- **Status**: active
- **Version**: 2.2.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-28
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-31

## Description

Tier-1 SSOT gate for agent model/tier declarations: validates each agent's tier declaration against the `models` registry in docs/workspace-schema.json. Since v2.1.0 (ADR-0102 post-soak flip, T-20261027-003) every tier-coverage finding is a FAIL: legacy per-platform map blocks (uniform and mixed) FAIL in both contexts and a missing declaration FAILs in delivered contexts too — the transition WARN classes and the TIER COVERAGE WARN summary are retired. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-27 | production | production | v2.0.0 → v2.1.0 (T-20261027-003, ADR-0102 §5 post-soak transition, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §8.3 step 11): legacy per-platform tier blocks (uniform AND mixed) FAIL in both contexts (kind `legacy-block`); missing tier declaration FAILs in delivered contexts too (kind `missing-tier`; L0 keeps `missing-tier-l0`); TIER COVERAGE WARN summary and coverageWarns/legacyBlockCount/missingTierCount report fields retired. Precondition verified: zero map-form tier files under templates/ (T-20261027-001 remediated co-safety's nested agents/domains/** + agents/_shared/** trees). Induced-fixture tests updated to assert FAIL (22 pass). | automation-engineer |
| 2026-10-26 | production | production | v1.5.0 → v2.0.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §9): scalar tier declaration + transition matrix — agents/*.md declare ONE `tier: high/medium/low`; platform→model resolves from schema `models` at validation time. Legacy per-platform blocks WARN loudly ("normalize to `tier: <value>`"; mixed blocks WARN without picking a value); unknown platform key in a legacy block FAILs; missing tier FAILs at L0 / WARNs in delivered contexts (transition); both silent skips deleted; legacy `# model-id` comments still checked against models; exit 1 only on FAIL. Refactored import-safe (classifyAgentTier / runModelRegistryValidation) for unit tests. No agent_tiers anywhere (user ruling 2 — schema block removed; the former L0 parity row is retired). | automation-engineer |
