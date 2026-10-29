# agent-lifecycle-audit.ts Script Lifecycle

## Metadata

- **Script**: agent-lifecycle-audit
- **Status**: active
- **Version**: 1.9.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-29
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-05-29

## Description

Agent health checker run at the workspace root and inside delivered projects: orphaned agents, missing frontmatter, status vocabulary, AGENTS.md roster registration, deprecated-agent skill references, handoff integrity, removal-review deadlines, stale `last_updated` vs git history (sync-only and metadata-only commits skipped; since v1.9.0, wave-delivered files whose bytes hash-match the recorded delivered baseline suppress to an INFO line), skill `owner:` existence (L0 authoring surface), and — since v1.8.0 — tier-declaration validation in the ADR-0102 scalar form (`tier: high|medium|low`, shared `parseTierDeclaration()` from lifecycle-sync-audit; legacy uniform map blocks tolerated during the transition). SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-29 | production | production | v1.8.0 → v1.9.0 (spec docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A2, DEC-20261029-01 — PR2): Check 11 gains the baseline-hash-equality tolerance — a flagged staleness warning is suppressed to an INFO line when the file's current bytes hash-match the delivered baseline recorded in the in-project `.claude/last-upgrade-delivery.json` manifest (shared `loadDeliveryBaselineManifest` — read once per audit run, lazy, cached, warning-path-only — plus `isDeliveredBaselineEqual` via `baselineKeyFor`, consumed by skill-lifecycle-audit Check SD too). Absent/corrupt/v1-shaped manifest degrades to the pre-tolerance behavior (never a false suppression); at the workspace root (no manifest) the tolerance is inert so template-side audits stay strict; genuine project edits break the hash and re-arm the warning (self-expiring). | automation-engineer |
| 2026-10-26 | production | production | v1.7.0 → v1.8.0 (ADR-0102 / T-20261026-018, design 2026-10-26-model-registry-platform-coverage-design §7): Checks 8-10 parse the scalar `tier: high\|medium\|low` declaration as the canonical shape via the shared `parseTierDeclaration()` (lifecycle-sync-audit 1.19.0) — a scalar tier previously tripped three false "Missing tier.*" ERRORs per file; a legacy uniform per-platform map block stays tolerated during the transition with the original per-platform checks (uniform passes; mixed/unknown keep the Missing/Invalid error paths). Extends-stub chain resolution (T-20261001-004) is preserved on the TierDecl resolver. | automation-engineer |
