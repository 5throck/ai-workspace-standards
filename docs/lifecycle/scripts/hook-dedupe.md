# hook-dedupe.ts Script Lifecycle

## Metadata

- **Script**: hook-dedupe (scripts/lib/hook-dedupe.ts)
- **Status**: active
- **Version**: 1.0.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-31 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-10-31

## Description

Hook-entry dedupe + drift analysis for .claude/settings.json (U-20261031-008): dedupeClaudeSettingsHooks collapses exact-duplicate (event, matcher, command) hook entries with first-occurrence-wins (consumed by upgrade-project's JSON_MERGE pass); analyzeClaudeHookDrift reports within-event duplicate pairs and per-event entry counts exceeding the common template (consumed by lifecycle-sync-audit Check I). Dedup is within-event only — cross-event repeats (SessionStart vs WorktreeCreate `git config core.hooksPath`; PostToolUse vs TeammateIdle post-write-lifecycle-check) are intentional and never merged or flagged. L0+L1 delivered. SSOT: `scripts/SCRIPTS.md` registry row (`lib/hook-dedupe.ts`).

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v1.0.0 created (spec docs/designs/2026-10-31-template-security-hardening-design.md R2.6, U-20261031-008): both arms of the hook-dedupe/drift design — the upgrade JSON_MERGE normalization (variant graft installs had accumulated exact-duplicate hook entries; co-consult/co-deck carried 5 SessionStart entries vs the template's 2) and the audit drift check. tests/unit/hook-dedupe.test.ts. | automation-engineer |
