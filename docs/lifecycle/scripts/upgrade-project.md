# Upgrade Project Script Lifecycle

## Metadata

- **Script**: upgrade-project
- **Status**: active
- **Version**: 1.70.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-12

## Description

Fleet upgrade engine: template sync passes (LOCKED/MERGE/SYNC_IF_NEWER/TREE
SYNC/PRUNE...), readiness gate, delivery manifest, preflight, and
post-upgrade regenerations. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-12 | production | production | v1.70.1 (T-20261012-001): VARIANT SCRIPTS SYNC appends registry rows for delivered variant scripts missing from the project scripts/SCRIPTS.md (co-abap sap-mcp-proxy class). | governance-runner |

## Metadata

- **Current Phase**: production
- **Version**: 1.70.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-12
