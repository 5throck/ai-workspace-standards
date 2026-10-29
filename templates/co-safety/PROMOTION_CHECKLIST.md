# co-safety Promotion Checklist

> **Authored snapshot — machine state is variant.json.** This checklist records
> the promotion review at its time; the authoritative status/phase state lives
> in `variant.json` (the Phase A flag is cross-checked by
> `scripts/validate-variant-claims.ts` check u — U-20261028-022).

**Variant:** co-safety
**Current Status:** beta
**Beta Since:** 2026-06-04
**Phase A Complete:** true

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Complete | `phaseAComplete` in variant.json; agent manifest registers 4 top-level roster entries (40 agent definition files ship in total, incl. the nested `_shared/` and `domains/` trees per `agents/README.md` manifest-scope note); skill manifest (60), documentation present. |
| 2 | **Agent roster completeness** | Pending | All 40 agent definition files present (41 agent-tree markdown files: 4 top-level + 12 `_shared/` + 3 functional + 22 industry; the common-delivered `i18n-specialist.md` extends stub is excluded from the definition count per the roster calibration); verify each agent file has substantive content. |
| 3 | **Skills coverage** | Pending | 60 skills registered in `skills[]`; `skill_manifest.variant_specific` designates 4 (risk-assessment, permit-to-work, emergency-response, compliance-gap) as the variant-specific core workflow set; verify each SKILL.md is complete and operational. |
| 4 | **Documentation completeness** | Pending | README.md present and accurate; AGENTS.md reflects the actual roster; variant.json fields accurate. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` passes with 0 errors. |
| 6 | **Real engagements** | Pending | Minimum 1 successful end-to-end engagement. |
| 7 | **README accuracy** | Pending | README reflects current capability set and agent roster. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status. |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical complaints. |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
