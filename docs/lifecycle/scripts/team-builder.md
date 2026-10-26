# team-builder.ts Script Lifecycle

## Metadata

- **Script**: team-builder
- **Status**: active
- **Version**: 1.5.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-06-03

## Description

Team assembly generator: renders proposed agents into agents/*.md files and updates the AGENTS.md roster (the `team-builder` skill's backing script; the skill lifecycle record is docs/lifecycle/skills/team-builder.md). Since v1.5.0 (ADR-0102) generated agent files emit one scalar `tier:` line. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.4.1 → v1.5.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): scalar tier — generated agent files emit ONE `tier: <value>` line and the AGENTS.md roster row reads the resolved tier (resolveAgentTier); proposal JSON keeps the legacy per-platform map-block fallback during transition (claude value, design D5). | automation-engineer |
