# skill-graph-analytics Skill — Lifecycle Record

## Metadata
- **Skill**: skill-graph-analytics
- **Status**: active
- **Version**: 1.5.0
- **Created**: 2026-09-22
- **Last Updated**: 2026-11-23 (SKILL.md 1.4.0 → 1.5.0, spec docs/designs/2026-11-23-skill-graph-history-report-design.md §5.4: When-to-Run cadence refreshed to the unified 03:00 batch runner reality — SECTION R1 carries the daily orphan sweep and the FRIDAY FULL weekly consolidation triage; the 01:30 fleet runner was merged into the unified runner 2026-11-12 and hardened 2026-11-20; as-deployed record docs/governance/automation-prompts/runner-v5.snapshot.txt line 58; "run it manually" standby phrasing dropped, on-demand triggers and triage-only framing unchanged. Previous: 2026-11-07 SKILL.md 1.3.1 → 1.4.0, DEC-20261107-01: fleet membership SSOT — Step 1 records that the report's project set comes from lib/fleet.ts (`Projects/co-*` minus `docs/fleet-membership.json` exclusions; convergence denominators count members only; never a raw glob). Earlier: 2026-11-04 SKILL.md 1.3.0 → 1.3.1, T-20261101-004 / DEC-20261103-04: When to Run weekly-cadence note records the decided revival home — the 01:30 fleet runner's FRIDAY FULL OVERRIDE — replacing the "pending adjudication" phrasing)

## Description
Weekly fleet analytics over the per-project skill-graph projections: consolidate root + Projects/<co-x> graphs into a dated snapshot, triage skill convergence (consolidation/promotion candidates), delivery drift (root skills missing from projects), and root-graph orphans (4-way cross-check: definition+registry+mirror+reference). Triage only — tickets, no auto-modification.

## Changelog
- 2026-10-08: v1.2.0 — capability-based convergence (skill-graph v2, ADR-0060 Amendment 11, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md): presence/convergence keyed by `capability` (v1 graphs derive it from the bare id); fleet report classifies capabilities carried by >= 3 projects as converged / convergence-with-divergence / hash-unknown; new §3.4 divergence triage (fork / drift / rename) and `--impact` pointer. fleet-report v2.0.0.
- 2026-09-23: v1.1.0 — root-graph orphan cross-check added to the cadence (fleet-report v1.1.0 `rootOrphans` section): graph-isolated root skills/agents crossed with registry/mirror/doc-reference axes; triage rules per the 2026-09-23 orphan audit (T-20260923-001).
- 2026-09-22: Created v1.0.0 with `scripts/skill-graph-fleet-report.ts` 1.0.0 and the `skill-graph-analyst` agent (docs/designs/2026-09-22-skill-graph-fleet-analytics-design.md; ADR-0080 hiring decision recorded there).

## Dependencies
- `scripts/skill-graph-fleet-report.ts` (L0-only report + snapshot writer)
- `scripts/lib/skill-graph-compat.ts` (v1/v2 graph loader + `capabilityOf`; capability is the convergence grouping key)
- `bun scripts/ticket.ts` (triage ticket filing, §3.7.5 governance backlog)
- `bun scripts/generate-skill-graph.ts` (remedy when graph projections are stale/missing)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-11-23 | production | production | v1.5.0 (spec 2026-11-23-skill-graph-history-report-design §5.4): cadence refresh — When to Run now records the unified 03:00 batch runner SECTION R1 (daily orphan sweep + FRIDAY FULL weekly consolidation; 01:30 runner merged 2026-11-12, hardened 2026-11-20; runner-v5.snapshot.txt:58 cited as as-deployed record), "run it manually" standby phrasing dropped, on-demand triggers + triage-only framing preserved | pm |
| 2026-11-03 | production | production | v1.3.0 (T-20261101-004): cadence-note repair — the stale "02:30 ticket runner" trigger reference replaced with the live automation roster (01:30 fleet-review+resync, 04:00 governance-ticket; neither carries the weekly consolidation), the weekly triage marked manual-run pending the revival-home adjudication (recommended: fleet-runner Friday full override), rot-proofed by naming the roster rather than a runner time | pm |
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
