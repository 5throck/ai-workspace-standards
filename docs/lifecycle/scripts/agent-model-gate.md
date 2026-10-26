# agent-model-gate.ts Script Lifecycle

## Metadata

- **Script**: agent-model-gate
- **Status**: active
- **Version**: 1.3.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-08-15

## Description

Session-start hook (scripts/hooks/agent-model-gate.ts): validates that a dispatched subagent's model satisfies its tier capability floor. Since v1.3.0 (ADR-0102) the tier source is each agents/<name>.md frontmatter (scalar `tier:` with uniform legacy-block fallback), no longer the schema agent_tiers block; models.claude still resolves from the schema. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.2.0 → v1.3.0 (ADR-0102 / T-20261026-018, user ruling 2): tier source moves from schema agent_tiers (removed) to each agents/<name>.md frontmatter — scalar `tier:` with uniform legacy-block fallback during transition; missing/unparseable/mixed tier WARN-and-skips per agent (same fail-open shape as the old missing-agent_tiers case); models.claude still from the schema. | automation-engineer |
