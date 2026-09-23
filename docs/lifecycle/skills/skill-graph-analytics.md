# skill-graph-analytics Skill — Lifecycle Record

## Metadata
- **Skill**: skill-graph-analytics
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-09-22
- **Last Updated**: 2026-09-23

## Description
Weekly fleet analytics over the per-project skill-graph projections: consolidate root + Projects/<co-x> graphs into a dated snapshot, triage skill convergence (consolidation/promotion candidates), delivery drift (root skills missing from projects), and root-graph orphans (4-way cross-check: definition+registry+mirror+reference). Triage only — tickets, no auto-modification.

## Changelog
- 2026-09-23: v1.1.0 — root-graph orphan cross-check added to the cadence (fleet-report v1.1.0 `rootOrphans` section): graph-isolated root skills/agents crossed with registry/mirror/doc-reference axes; triage rules per the 2026-09-23 orphan audit (T-20260923-001).
- 2026-09-22: Created v1.0.0 with `scripts/skill-graph-fleet-report.ts` 1.0.0 and the `skill-graph-analyst` agent (docs/designs/2026-09-22-skill-graph-fleet-analytics-design.md; ADR-0080 hiring decision recorded there).

## Dependencies
- `scripts/skill-graph-fleet-report.ts` (L0-only report + snapshot writer)
- `bun scripts/ticket.ts` (triage ticket filing, §3.7.5 governance backlog)
- `bun scripts/generate-skill-graph.ts` (remedy when graph projections are stale/missing)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-22 | - | production | New recurring work type (weekly fleet skill-graph analytics); design implemented and verified | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/skill-graph-analytics/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner, last_reviewed populated
- [x] Scope: workspace (L0-only; l2_propagate: false)
- [x] Registered in skills/SKILLS.md (VERSION_MANIFEST regenerates via dev-sync)
- [x] Companion script registered in scripts/SCRIPTS.md and verified read-only
- [x] Triangulated procedure verified: report run produces first snapshot (2026-09-22 baseline)

## Notes
- Owner: pm (dispatches the skill-graph-analyst agent for the weekly cadence)
