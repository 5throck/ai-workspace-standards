chore: upgrade template delivery (0.20.1 tree sync + ADR-0102 agent tier delivery)

- Ran scripts/upgrade-project.ts (common-only sync: co-architect self-declares
  variant identity via variant.json; no templates/co-architect directory).
- Locked 7 / merged 8 / synced 13 files; 1 tree-sync delivery; 0 local patches;
  0 conflicts; 1 country skill pruned; security checks PASSED.
- Brings delivered scripts and skills in line with ADR-0102 scalar-tier
  normalization landed in the workspace root (PR #1625).
- Memory log for 2026-10-26 already landed via PR #378 (richer merged version
  kept; stale duplicate from the pre-merge branch discarded on reconciliation).
