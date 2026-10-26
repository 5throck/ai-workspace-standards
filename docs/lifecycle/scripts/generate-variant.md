# generate-variant.ts Script Lifecycle

## Metadata

- **Script**: generate-variant
- **Status**: active
- **Version**: 1.20.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row. Subject: scripts/helpers/generate-variant.ts (shared pure helpers of the L3→variant generation pipeline).

## Created

2026-06-03

## Description

Shared pure helpers for the L3 scaffold → variant generation pipeline (scripts/helpers/generate-variant.ts): frontmatter normalization, L0 common-skill delivery with WS-05a adaptation, platform-mirror copying. Since v1.20.0 (ADR-0102) normalizeAgentFrontmatter collapses a uniform legacy per-platform tier map to the scalar form. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.19.0 → v1.20.0 (ADR-0102 / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): normalizeAgentFrontmatter (fn v1.2.0) replaces the stale platform-inheritance block (gemini/antigravity/gemini-cli only — never codex/hermes/zai) with a scalar tier collapse: uniform map → scalar, mixed map → left as-is with a loud WARN (the one-shot tests/apply-tier-normalization.ts applier owns the D5 claude-value collapse), scalar → unchanged. | automation-engineer |
