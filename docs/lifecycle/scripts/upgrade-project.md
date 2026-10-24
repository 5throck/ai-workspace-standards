# Upgrade Project Script Lifecycle

## Metadata

- **Script**: upgrade-project
- **Status**: active
- **Version**: 1.73.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-25

## Description

Fleet upgrade engine: template sync passes (LOCKED/MERGE/SYNC_IF_NEWER/TREE
SYNC/PRUNE...), readiness gate, delivery manifest, preflight, and
post-upgrade regenerations. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-25 | production | production | v1.73.0 (spec 2026-10-25-managed-platform-skeleton-design, ADR-0101): MERGE pass delivers the out-of-zone CLAUDE/GEMINI skeleton via lib/platform-skeleton-merge.ts (insert + guarded replace, .pre-skeleton.bak fail-closed). | automation-engineer |
| 2026-10-17 | production | production | v1.71.0 (T-20261017-001 canary): VARIANT SCRIPTS SYNC gains the variant overlay top-level walk. | governance-runner |
| 2026-10-14 | production | production | v1.70.6 (T-20261014-002): reconcileScriptRegistry's append arm delegates the boundary scan to helpers/registry-append.ts registryAppendIndex — retires the second inline registry-append implementation. | governance-runner |
| 2026-10-24 | production | production | v1.72.0 (T-20261024-001): Upgrade Complete emits the copy-safe /sync landing command (--body-file as a separate argument). | governance-runner |
| 2026-10-14 | production | production | v1.71.0 (T-20261017-001 canary): overlay top-level variant scripts join the upgrade delivery. | governance-runner |
| 2026-10-14 | production | production | v1.70.5 (T-20261013-009 phase 2): COMMANDS_SYNC delivers the .gemini surface's rendered toml. | governance-runner |
| 2026-10-13 | production | production | v1.70.4 (T-20261013-001): registry-append mechanics extracted to helpers/registry-append.ts. | governance-runner |
| 2026-10-13 | production | production | v1.70.3 (T-20261013-010): mergeGitleaksToml extracted to helpers/gitleaks-merge.ts; replacer-function merge keeps `$''`-anchored entries literal. | governance-runner |
| 2026-10-13 | production | production | v1.70.2 (T-20261013-006): VARIANT SCRIPTS SYNC rows carry the <variant>/-prefixed key — bare basenames duplicated nested rows as 15 ghost entries (co-safety 0.18.0 canary). | governance-runner |
| 2026-10-12 | production | production | v1.70.1 (T-20261012-001): VARIANT SCRIPTS SYNC appends registry rows for delivered variant scripts missing from the project scripts/SCRIPTS.md (co-abap sap-mcp-proxy class). | governance-runner |

## Metadata

- **Current Phase**: production
- **Version**: 1.70.6
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-14
