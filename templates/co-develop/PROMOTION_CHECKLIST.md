# co-develop Promotion Checklist

**Variant:** co-develop
**Current Status:** stable
**Beta Since:** 2026-06-09 (variant creation — migrated to stable 2026-06-13, four days later, from the co-develop project)
**Phase A Complete:** true

> **Post-promotion ratification record.** co-develop was created on 2026-06-09
> and entered review → production (stable) on 2026-06-13 as a generation-1
> migration from a proven development project, before the beta-lifecycle
> machinery existed and without a promotion ADR. Its stable status is admitted
> under the migration fast-track policy, **ADR-0099**
> (`docs/adr/0099-template-migration-admission-policy.md`): the beta-window
> criteria (6, 8, 10) are explicitly waived rather than claimed as met, and the
> remaining criteria are verified against the 2026-10-05 scoped review
> (`docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md`).
> `variant.json` → `promotionChecklist` points here as the governance record;
> the `lifecycle` history in `variant.json` is retained as recorded.

## Promotion Criteria (beta -> stable) — reconciled 2026-10-06 per ADR-0099

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | Phase A artifacts present in `variant.json`: `agents[]` (8 agents incl. pm and i18n-specialist), `skills[]` (4 skills), documentation set (README, README_ko, AGENTS.md, HERMES.md, user-guide, phase-definitions, context), and the process manifest. No `script_manifest` — co-develop's zero-script posture is deliberate (4 stable siblings share it; every runnable `scripts/` path resolves in common per the 2026-10-05 scoped review). |
| 2 | **Agent roster completeness** | Done | All 8 agents defined with substantive content, including the PM orchestrator and the i18n-specialist common extends-stub; per-agent lifecycle records complete (8/8) per the 2026-10-05 scoped review (Strengths: "Per-agent lifecycle records complete in co-develop (8/8)"). |
| 3 | **Skills coverage** | Done | 4 variant-specific skills registered in `variant.json` `skills[]` (`code-review`, `refactoring`, `swe-solve`, `test-driven-development`) and listed in `skills/SKILLS.md`; per-skill `SKILL.md` present in `skills/` and mirrored to all four platform config dirs. |
| 4 | **Documentation completeness** | Done | README.md, docs/co-develop.context.md, docs/user-guide.md, docs/phase-definitions.md, and AGENTS.md present and maintained. The 2026-10-05 scoped review logged descriptive-claim drift (phase model, handoff chain, stale commands); remediation is tracked via T-20261005-033/-034. |
| 5 | **Audit pass rate** | Done | `bun scripts/audit.ts` runs with 0 errors as of 2026-10-05 (`bun scripts/review-baseline.ts`, machine baseline 7/7 green). The contract-truth validator findings from the 2026-10-05 scoped review are remediated under T-20261005-033/-034. |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | Variant migrated from a conversion-eligible source project (tested in 2+ engagements per `skills/project-to-variant`); the migration basis replaces the beta-engagement attestation. |
| 7 | **README accuracy** | Done | README.md / README_ko.md carry the ✅ Stable v1.0.0 badge and current inventories (8 agents, 4 skills); roster/phase-model drift found by the 2026-10-05 scoped review fixed 2026-10-06 (T-20261005-033/-034). |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | co-develop went review → production in 4 days (2026-06-09 → 2026-06-13); no beta window applies under the migration fast-track. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports recorded at promotion (2026-06-13). Defects surfaced by the 2026-10-05 scoped review (phase-model drift, handoff chain, settings hygiene) are remediation tickets (T-20261005-033/-034), not unresolved promotion bugs. |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | Not separately logged; under the migration fast-track the source project's conversion-eligibility bar (2+ engagements) replaces beta-user feedback. |

## Review History

| Date | Outcome | Status | Notes | Reviewer |
|------|---------|--------|-------|----------|
| 2026-10-06 | stable (ratified) | stable | Migration admission ratified per ADR-0099; criteria 6/8/10 waived; remainder verified against the 2026-10-05 scoped review | pm |
