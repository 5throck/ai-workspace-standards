# Upgrade Project Script Lifecycle

## Metadata

- **Script**: upgrade-project
- **Status**: active
- **Version**: 1.74.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-27 (U-20261026-009 post-delivery re-stamp)

## Description

Fleet upgrade engine: template sync passes (LOCKED/MERGE/SYNC_IF_NEWER/TREE
SYNC/PRUNE...), readiness gate, delivery manifest, preflight, and
post-upgrade regenerations. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-27 | production | production | v1.74.0 (U-20261026-009): POST-DELIVERY RE-STAMP — after every content pass and before the delivery manifest, changed files get their top-level frontmatter `last_updated` advanced to the delivery date (helpers/upgrade-versions.ts bumpFrontmatterLastUpdated); upgrade deliveries mechanically rewrote agent bodies without advancing the date, so agent-lifecycle-audit emitted stale-date warnings after every wave (8/9 agent files warned 2026-10-26). Non-fatal; version-touch-only writes and lifecycle-block dates untouched. | automation-engineer |
| 2026-10-26 | production | production | Delivery layer L0+L1 → L0 (T-20261026-001, spec docs/designs/2026-10-26-project-review-remediation-design.md R1, ADR-0073 Amendments 3 and 4): L1 mirror templates/common/scripts/upgrade-project.ts removed and scripts/SCRIPTS.md row flipped back to L0-only — engine code unchanged at v1.73.0. Undocumented reversal of Amendment 3 corrected as Amendment 4; the delivered tree carries validate-templates.ts + lib/ leaf modules (upgrade-policy.ts, skills-registry.ts, platform-skeleton-merge.ts), no engine copy. | automation-engineer |
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
