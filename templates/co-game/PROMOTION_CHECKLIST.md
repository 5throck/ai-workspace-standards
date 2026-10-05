# co-game Promotion Checklist

**Variant:** co-game
**Current Status:** stable
**Beta Since:** 2026-07-08
**Phase A Complete:** true

> **Post-promotion ratification record.** co-game was created on 2026-07-08 as a
> generation-1 migration from a proven game project — the variant ships four
> complete game implementations (pacman, bubble-bobble, donkey-kong, portal)
> with comprehensive test suites, recorded in `variant.json`
> `stablePromotionSummary` — three days before the beta-lifecycle engagement
> machinery shipped (2026-07-11). It entered review on its creation date and
> was promoted stable on 2026-08-12. Its stable status is admitted under the
> migration fast-track policy, **ADR-0099**
> (`docs/adr/0099-template-migration-admission-policy.md`): the beta-window
> criteria (6, 8, 10) are explicitly waived rather than claimed as met, and the
> remaining criteria are verified against the 2026-10-06 remediation
> verification runs. `variant.json` → `promotionChecklist` points here as the
> governance record; the `lifecycle` history in `variant.json` is retained as
> recorded.

## Promotion Criteria (beta -> stable) — reconciled 2026-10-06 per ADR-0099

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | Phase A artifacts present in `variant.json`: `agents[]` (14 agents), `skills[]` (5 skills), `script_manifest.local` (2 scripts), documentation set (README.md/README_ko.md, user-guide.md/_ko, phase-definitions.md, context), and the process/governance/decisions manifests. |
| 2 | **Agent roster completeness** | Done | All 14 agents defined with substantive content; per-agent lifecycle records complete (14/14, including i18n-specialist) in `docs/lifecycle/agents/`. |
| 3 | **Skills coverage** | Done | 5 variant-specific skills registered in `variant.json` `skills[]`; registry three-way consistency (`skills[]` = `skills/` directories = SKILLS.md index, all active at 1.0.0) verified 2026-10-06. |
| 4 | **Documentation completeness** | Done | README.md/README_ko.md, docs/co-game.context.md, docs/user-guide.md/_ko, docs/phase-definitions.md, docs/handoff-spec.md/_ko, AGENTS.md, and HERMES.md present and maintained; roster/boilerplate drift cleared in the 2026-10-06 remediation (`bun scripts/validate-variant-claims.ts`). |
| 5 | **Audit pass rate** | Done | Variant-level audit green as of 2026-10-06: `bun scripts/validate-variant-claims.ts --template co-game` PASS with 0 findings; `bun scripts/verify-skill-graph.ts --scope co-game` PASS; no co-game findings in `bun scripts/validate-templates.ts` (its workspace-level L0↔L1 script-parity errors are pre-existing and outside this variant's scope). |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | The variant template ships four complete, tested game implementations (recorded in `variant.json` `stablePromotionSummary`); under the migration fast-track this recorded source-project evidence replaces the beta-engagement attestation. |
| 7 | **README accuracy** | Done | README.md / README_ko.md carry the ✅ Stable v1.0.0 badge; roster and skills inventories reconciled 2026-10-06 (i18n-specialist row added to all three README surfaces, arcade-physics added to the skills lists). |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | co-game entered review on its creation date (2026-07-08) and was promoted 2026-08-12; no 3-month beta window applies under the migration fast-track. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports recorded at promotion (2026-08-12). |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | Not separately logged; under the migration fast-track the recorded source-project evidence replaces beta-user feedback. |

## Review History

| Date | Outcome | Status | Notes | Reviewer |
|------|---------|--------|-------|----------|
| 2026-08-12 | beta → stable promotion | stable | 1.0.0 stable promotion recorded in `variant.json` `stablePromotionSummary` | auditor |
| 2026-10-06 | stable (ratified) | stable | Migration admission ratified per ADR-0099; criteria 6/8/10 waived; remainder verified in the 2026-10-06 remediation verification runs | pm |
