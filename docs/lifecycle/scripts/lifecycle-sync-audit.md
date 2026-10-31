# lifecycle-sync-audit.ts Script Lifecycle

## Metadata

- **Script**: lifecycle-sync-audit
- **Status**: active
- **Version**: 1.20.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-31

## Description

Cross-surface lifecycle sync audit (Checks A–I): script @version vs SCRIPTS.md (A), SCRIPTS.md mirror parity (B), skills/ vs templates/common/skills/ content (C), intentional-duplicate registry (D), skill lifecycle records vs SKILL.md frontmatter (E), agent tier cross-surface parity anchored on frontmatter (F), .githooks mirror parity (G), script lifecycle record versions (H), and .claude/settings.json hook drift (I). SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v1.20.0 → v1.20.1 (design docs/designs/2026-10-31-graft-trail-migration-design.md R2.5/R2.6 annotation, U-20261031-009): Check I docstring annotation only — arm-(b) findings whose excess commands reference graft-era helpers are EXPECTED standing WARNs on pre-migration roots (the L0 surface flip is deferred to each root's own `trail init` visit, design R2.5); no check behavior change. | automation-engineer |
| 2026-10-31 | production | production | v1.19.0 → v1.20.0 (spec docs/designs/2026-10-31-template-security-hardening-design.md R2.6 arm 2, U-20261031-008): new Check I — .claude/settings.json hook drift: WARNs when an event carries an exact-duplicate (matcher, command) pair or an entry count exceeding templates/common/.claude/settings.json (arm (b) skipped where the template is absent — L1 context); runs in both L0 and L1 contexts, WARN-first per ADR-0055; drift semantics shared with the upgrade JSON_MERGE dedupe via lib/hook-dedupe.ts (analyzeClaudeHookDrift); dedup is within-event only (cross-event repeats are intentional). | automation-engineer |
| 2026-10-26 | production | production | v1.18.1 → v1.19.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7 row 2 + user ruling 2): Check F re-anchored — the agents/<name>.md frontmatter tier declaration is the source (schema agent_tiers REMOVED); scalar form + legacy uniform block (WARN + compare) accepted, mixed block WARNs with parity skipped; (b) L1 stubs now compare to their L0 counterpart; "5 platforms"/"Declare all N platforms" completeness arm and wording retired; all other checks untouched. | automation-engineer |
