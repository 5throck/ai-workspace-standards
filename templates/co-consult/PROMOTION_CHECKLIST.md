# co-consult Promotion Checklist

**Variant:** co-consult
**Current Status:** stable
**Beta Since:** 2026-06-03 (variant creation — migrated same-day from the co-consult project)
**Phase A Complete:** true

> **Post-promotion ratification record.** co-consult was created and entered
> stable on 2026-06-03 as a generation-1 migration from a proven consulting
> project, before the beta-lifecycle machinery existed. Its stable status is
> admitted under the migration fast-track policy, **ADR-0099**
> (`docs/adr/0099-template-migration-admission-policy.md`): the beta-window
> criteria (6, 8, 10) are explicitly waived rather than claimed as met, and the
> remaining criteria are verified against the 2026-10-05 scoped review.
> `variant.json` → `promotionChecklist` points here as the governance record;
> the `lifecycle` history in `variant.json` is retained as recorded.

## Promotion Criteria (beta -> stable) — reconciled 2026-10-05 per ADR-0099

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | Phase A artifacts present in `variant.json`: `agents[]` (12 agents), `skills[]` (19 skills), `script_manifest.local` (9 scripts), documentation set (README, user-guide, phase-definitions, context), and the process/governance/decisions manifests. Verified in the 2026-10-05 scoped review (`docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md`, machine baseline 7/7 green); `skills[]` reconciled 18→19 for the industry-research-pack restore (2026-10-09, T-20261009-009). |
| 2 | **Agent roster completeness** | Done | All 12 agents defined with substantive content; per-agent lifecycle records complete (12/12) per the 2026-10-05 scoped review (Strengths: "Per-agent lifecycle records complete in co-consult (12/12)"). |
| 3 | **Skills coverage** | Done | 19 variant-specific skills registered in `variant.json` `skills[]`; registry three-way consistency (`skills[]` = skill directories = SKILLS.md, matching @versions) verified in the 2026-10-05 scoped review and re-verified after the 2026-10-09 industry-research-pack restore (T-20261009-009). |
| 4 | **Documentation completeness** | Done | README.md, docs/co-consult.context.md, docs/user-guide.md, docs/phase-definitions.md, and AGENTS.md present and maintained. The 2026-10-05 scoped review logged descriptive-claim drift; remediation is tracked via T-20261005-021..028. |
| 5 | **Audit pass rate** | Done | Machine baseline 7/7 green as of 2026-10-05 (`bun scripts/review-baseline.ts`, incl. `audit.ts` with 0 errors). |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | Variant migrated from a conversion-eligible source project (tested in 2+ engagements per `skills/project-to-variant`); the migration basis replaces the beta-engagement attestation. |
| 7 | **README accuracy** | Done | README.md / README_ko.md carry the ✅ Stable v1.0.0 badge and current inventories (12 agents, 19 skills); tier/roster drift found by the 2026-10-05 scoped review fixed 2026-10-05 (T-20261005-025/-028); skills count reconciled 2026-10-09 (T-20261009-009). |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | co-consult entered directly at stable on its creation date (2026-06-03); no beta window applies under the migration fast-track. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports recorded at promotion (2026-06-03). Defects surfaced by the 2026-10-05 scoped review (report chain, HWP pipeline) are remediation tickets (T-20261005-026/-027), not unresolved promotion bugs. |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | Not separately logged; under the migration fast-track the source project's conversion-eligibility bar (2+ engagements) replaces beta-user feedback. |

## Review History

| Date | Outcome | Status | Notes | Reviewer |
|------|---------|--------|-------|----------|
| 2026-10-05 | stable (ratified) | stable | Migration admission ratified per ADR-0099; criteria 6/8/10 waived; remainder verified in the 2026-10-05 scoped review | pm |
