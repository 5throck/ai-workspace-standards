# Upgrade Project Script Lifecycle

## Metadata

- **Script**: upgrade-project
- **Status**: active
- **Version**: 1.77.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-27 (T-20261027-004 sync-overwrite-policy: provenance baselines, disposition matrix, unified decision log)

## Description

Fleet upgrade engine: template sync passes (LOCKED/MERGE/SYNC_IF_NEWER/TREE
SYNC/PRUNE...), readiness gate, delivery manifest (v2: baselines + decisions),
preflight, and post-upgrade regenerations. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-28 | production | production | v1.77.0 (T-20261028-002, spec docs/designs/2026-10-28-ticket-runner-mechanical-batch-design.md §3): POST-DELIVERY RE-STAMP scope — the last_updated re-stamp walks deliveredRels (expanded to files, same recursion as the manifest baseline expansion) intersected with git status instead of every dirty worktree file, so pre-existing user changes open during an upgrade keep their dates; directory-delivered skill roots keep full coverage via the expansion. | automation-engineer |
| 2026-10-27 | production | production | v1.76.0 (T-20261027-004, spec docs/designs/2026-10-27-sync-overwrite-policy-design.md §4–§7): sync/overwrite policy — (D1) delivery manifest v2 gains per-file delivered baselines (hash keyed by baselineKeyFor: raw bytes for plain files, lifecycleless bytes for agents/) so committed project divergence is classified mechanically (UNTOUCHED / IN_SYNC / PROJECT_EVOLVED / NO_BASELINE degrade) instead of via git-dirty state; (D2) disposition matrix — PROJECT_EVOLVED + template-changed under the version-gated whole-content passes escalates to CONFLICT severity ERROR with default SKIP (project copy preserved, decision recorded, non-zero exit naming the §6 adjudicated-port procedure), `--disposition adopt-template[=glob]` delivers + re-baselines, template-unchanged evolution delivers as EVOLVED (WARN); (D3) unified decision log persisted in the manifest (SEED_SKIP / STUB_SKIP / SKELETON_COLLISION / CONTEXT_PRESERVE / DRIFT_PRESERVE / DRIFT_RESTORED / MERGE / SKIP + delivery verdicts), PR body Decisions section, agents/ equal-version evolution reclassified to ERROR. Dry-run classifies + logs without writing. lib/upgrade-policy.ts v1.25.0 (types + pure helpers, no classification change); dev-sync 1.32.0 D3.1 ERROR block. | automation-engineer |
| 2026-10-27 | production | production | v1.75.0 (T-20261027-005): ADR-0102 legacy agent tier normalization in two delivery passes — (a) MERGE pass normalizes the project agents/pm.md legacy per-platform tier frontmatter block to the template's scalar tier (tier block ONLY; scalar-differs = deliberate divergence, logged and untouched); (b) agents/ pass processes a variant extends-stub's `extends:` target instead of dead-ending (MERGE_MANAGED files excluded — v1.49.0 clobber class) and the equal-version drift reconcile emits a focused TIER DRIFT verdict for tier-block-only drift before delivering the template copy. Normalizer: lib/upgrade-policy.ts v1.24.0. | automation-engineer |
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
