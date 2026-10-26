# generate-version-manifest.ts Script Lifecycle

## Metadata

- **Script**: generate-version-manifest
- **Status**: active
- **Version**: 1.10.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-06-01

## Description

Regenerates docs/VERSION_MANIFEST.md (the declared skill/version SSOT) from the tracked SSOT surfaces: workspace skills, agents, scripts, platform skills, and the template contract. Since v1.10.1 (ADR-0102) parseAgentFrontmatter resolves the normalized scalar `tier:` form so the Agents table keeps real tier values. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.10.0 → v1.10.1 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): parseAgentFrontmatter resolves the normalized scalar `tier:` form (one of high/medium/low) (legacy per-platform block still parsed during transition) so the VERSION_MANIFEST Agents table keeps real tier values after the fleet normalizes. | automation-engineer |
