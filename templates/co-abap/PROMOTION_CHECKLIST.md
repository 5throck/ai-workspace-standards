# co-abap Promotion Checklist

**Variant:** co-abap
**Current Status:** stable
**Beta Since:** 2026-08-15 (variant creation — migrated same-day from the co-abap project)
**Phase A Complete:** true

> **Migration-admission record (ADR-0099).** co-abap entered the registry directly at
> stable on 2026-08-15 as a generation-1 migration from the proven co-abap project
> (conversion-eligible per `skills/project-to-variant` — tested in 2+ engagements). No
> beta phase was ever run, so the beta-window criteria are explicitly waived — marked
> "N/A per ADR-0099 — migration fast-track", not "met" — and the remaining criteria are
> verified against the 2026-10-05 scoped review evidence. Governing policy:
> `docs/adr/0099-template-migration-admission-policy.md`. ADR-0051's statements that
> "the promotion checklist criteria have been met" and that the lifecycle is "defined in
> CONSTITUTION.md" are incorrect and superseded by ADR-0099 §3. <!-- intentional-duplicate: ADR-0051 quotation inside the ADR-0099 ratification record — quotes the superseded text verbatim; source: docs/adr/0051-co-abap-stable-promotion.md -->

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | `phaseAComplete: true` in variant.json; agent manifest (21), skill manifest (13), documentation present. |
| 2 | **Agent roster completeness** | Done | All 21 agents defined with substantive content (agent files verified in the 2026-10-05 scoped review; roster-surface drift for i18n-specialist found and remediated under T-20261005-025). |
| 3 | **Skills coverage** | Done | 13 variant-specific skills registered in variant.json `skills[]`, each with a shipped SKILL.md (`abap-code-review` included — added post-README and reconciled under T-20261005-032); validator phantom-skill check green. |
| 4 | **Documentation completeness** | Done | README.md, docs/co-abap.context.md, AGENTS.md, user-guide, phase-definitions, and variant.json present. The 2026-10-05 scoped review logged doc drift (phase-model contradictions, phantom commands, stale rosters); remediated in the same wave (T-20261005-021..032). |
| 5 | **Audit pass rate** | Done | 2026-10-05 scoped review ran the contract-truth validator suite; residual findings were remediated in the same wave (T-20261005-021..032). The 4 `bun` import findings are confirmed false positives (runtime builtin). No recorded audit run exists at the 2026-08-15 promotion date itself — this review-based attestation governs per ADR-0099. |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | Source project was conversion-eligible per `skills/project-to-variant` (tested in 2+ engagements); no separate beta engagement log exists for the variant. |
| 7 | **README accuracy** | Done | Verified against manifests in the 2026-10-05 scoped review; roster/tier/skill-list drift (i18n-specialist row, abap-code-review entry, PM/devops-admin tiers) found and remediated (T-20261005-025, T-20261005-032). |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | Same-day migration (created and admitted at stable 2026-08-15); no beta window applies to a migrated variant. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports on record. Defects found by the 2026-10-05 scoped review are ticketed (T-20261005-021..034) and remediated in the same wave, not left open. |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | No beta user cohort existed; admission rests on the source project's engagement record, not variant beta feedback. |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| 2026-10-05 | pm | Stable (ratified) | Migration admission ratified per ADR-0099; ADR-0051's criteria-met claim corrected. Evidence: `docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md`; remediation T-20261005-021..032. |
