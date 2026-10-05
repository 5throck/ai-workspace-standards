# co-design Promotion Checklist

**Variant:** co-design
**Current Status:** stable
**Beta Since:** 2026-05-28
**Phase A Complete:** true

> **Post-promotion ratification record.** co-design was created and entered
> stable the same day (2026-05-28) as a generation-1 same-day promotion,
> predating the beta-lifecycle machinery (shipped 2026-07-11) and the
> beta-first admission convention. Its stable status is ratified under the
> migration fast-track admission policy, **ADR-0099**
> (`docs/adr/0099-template-migration-admission-policy.md`), which names the
> same-day co-work/co-design promotions as ratifiable in a follow-up: the
> beta-window criteria (6, 8, 10) are explicitly waived rather than claimed as
> met, and the remaining criteria are verified against the 2026-10-06
> remediation pass. `variant.json` → `promotionChecklist` points here as the
> governance record; the `lifecycle` history in `variant.json` is retained as
> recorded.

## Promotion Criteria (beta -> stable) — reconciled 2026-10-06 per ADR-0099

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | Phase A artifacts present in `variant.json`: `agents[]` (9 agents), `skills[]` (4 skills), documentation set (README, user-guide, phase-definitions, context), and the process/governance/decisions manifests (`process/stages.yaml`, `governance/raci.yaml`, `decisions/gates.yaml`). |
| 2 | **Agent roster completeness** | Done | All 9 agents defined with substantive content, including `pm` and `i18n-specialist`; roster rows present on README.md / README_ko.md / agents/README.md (i18n-specialist rows added 2026-10-06); `validate-variant-claims` roster checks green. |
| 3 | **Skills coverage** | Done | 4 variant-specific skills registered in `variant.json` `skills[]` (accessibility-audit, service-design, token-usage-lint, ui-ux-design-intelligence), mirrored into `.claude/skills/` and `.gemini/skills/`; token-usage-lint added to the README skill inventory 2026-10-06. |
| 4 | **Documentation completeness** | Done | README.md, docs/co-design.context.md, docs/user-guide.md, docs/phase-definitions.md, and AGENTS.md present and maintained; AGENTS.md regenerated onto the common thin-dispatcher skeleton 2026-10-06 (ADR-0099 ratification remediation). |
| 5 | **Audit pass rate** | Done | Machine verification green as of 2026-10-06: `bun scripts/validate-variant-claims.ts --template co-design` PASS with 0 findings; `bun scripts/validate-templates.ts` no new failures. |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | Variant is a generation-1 same-day promotion (created 2026-05-28, stable 2026-05-28); under ADR-0099 the beta-engagement attestation is waived rather than simulated. |
| 7 | **README accuracy** | Done | README.md / README_ko.md carry the ✅ Stable v1.0.0 badge and current inventories (9 agents incl. i18n-specialist, 4 skills incl. token-usage-lint); hash pair re-verified 2026-10-06 via `bun scripts/verify-readme-sync.ts`. |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | co-design entered directly at stable on its creation date (2026-05-28); no beta window applies under the migration fast-track. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports recorded at promotion (2026-05-28). Claim drift found by the 2026-10-06 remediation pass (stage/gate scaffold residue, count claims, missing roster rows) is fixed in this wave; `validate-variant-claims` reports 0 findings. |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | Not separately logged; under the migration fast-track no beta-user feedback record exists to claim. |

## Review History

| Date | Outcome | Status | Notes | Reviewer |
|------|---------|--------|-------|----------|
| 2026-10-06 | stable (ratified) | stable | Migration admission ratified per ADR-0099; criteria 6/8/10 waived; remainder verified in the 2026-10-06 remediation pass | pm |
