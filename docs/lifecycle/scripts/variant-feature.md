# variant-feature.ts Script Lifecycle

## Metadata

- **Script**: variant-feature
- **Status**: active
- **Version**: 1.1.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-06-24

## Description

Variant feature scaffolder (`--variant`, `--feature`, `--type`): adds a feature scaffold (e.g. a new agent stub) to an existing L2 variant. Since v1.1.0 (ADR-0102) new agent stubs emit one scalar `tier: medium` line. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.0.0 → v1.1.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): new agent stubs emit ONE scalar `tier: medium` (template extracted to exported agentStubContent(); CLI flow guarded with import.meta.main so tests can import the module). | automation-engineer |
