# Design: Backlog trio — registry-append extraction, co-export checklist pollination, variant-authoring wiring requirement

- **Spec ID**: 2026-10-13-backlog-trio-design
- **Date**: 2026-10-13
- **Status**: implemented
- **Tickets**: T-20261013-001, T-20261013-003, T-20261013-004 (user-directed)

## D1 — registry-append extraction (T-20261013-001)

`new-project.ts` §6.6 and `upgrade-project.ts` VARIANT SCRIPTS SYNC each carried the same
insertion mechanics (find the first `## Registry` table, splice rows after its last row,
write). Extracted to `scripts/helpers/registry-append.ts` (new L0+L1 helper, mirror span
154): `appendRegistryRows(regPath, rows: string[]) → boolean` — row formats stay at the
call sites (top-level vs variant-prefixed keys); only the mechanics are shared. Unit tests
cover insertion order, missing-section/missing-table false returns without writes, and the
empty-rows no-op. Version bumps: new-project 1.36.2, upgrade-project 1.70.4.

## D2 — co-export checklist pollination (T-20261013-003)

Second instance of the co-abap country-profile quartet pattern, scoped to the variant the
ticket named as awaiting:
- `templates/co-export/docs/export-engagement-checklist.md` — 7 pass/fail gates in workflow
  order (screening → HS classification → FTA origin → duty/drawback → landed cost →
  documents → jurisdiction context), each mapped to the owning specialist skill.
- `templates/co-export/docs/countries/US.md` — second jurisdiction profile, `status: draft`,
  `last_verified` blank per the skeleton's drafting rules.
- `variant.json` `country_config.supported`: `["KR", "US"]`.
- Agent wiring per D3's pattern: `market-entry-strategist.md` gains the report-format line
  (`Export Engagement Check: …`) and a Constraints rule naming the checklist file.

## D3 — domain-checklist wiring requirement (T-20261013-004)

`skills/create-variant/SKILL.md` Step 8 now requires every variant domain checklist to ship
with three hooks (co-abap first instance, co-export second): an agent report-format line, a
numbered mandatory Constraints rule naming the checklist file, and a QA gate row in the
verifying skill/workflow. A checklist added unwired is a promotion-review finding.

## Verification

- `tests/unit/registry-append.test.ts` — 3 tests (insertion position, missing-section false,
  empty no-op).
- Root battery: `audit.ts` green, `validate-templates.ts` 0 errors, `validate-variant-claims`
  + `validate-variant-readiness` green for co-export, mirror-span pin 154.
