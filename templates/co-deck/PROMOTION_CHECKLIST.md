# Co-Deck Promotion Checklist

**Variant:** co-deck
**Current Status:** stable (v0.2.3)
**Beta Since:** 2026-06-17 (per the beta-era checklist record — pre-dates the beta-lifecycle machinery shipped 2026-07-11)
**Stable Since:** 2026-08-30
**Phase A Complete:** true

> **Post-promotion ratification record.** This file originally described the
> beta-era variant (v0.2.1, all criteria Pending). co-deck was promoted to
> stable on 2026-08-30 after a 74-day beta window (2026-06-17 → 2026-08-30),
> below the 3-month criterion the beta-era checklist had estimated
> (2026-09-17). Its stable status is ratified under the migration fast-track
> admission policy, **ADR-0099**
> (`docs/adr/0099-template-migration-admission-policy.md`), in the
> 2026-10-07 follow-up that extends the ratification to co-deck: the
> beta-window criteria (6, 8, 10) are explicitly waived rather than claimed
> as met, and the remaining criteria are verified against review evidence.
> `variant.json` → `promotionChecklist` points here as the governance record.
> No tool maintains beta lifecycle metadata after promotion
> (`variant.json` → `betaLifecycleSummary` is `null`).

## Promotion Criteria (beta → stable) — met at the 2026-08-30 promotion

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | `phaseAComplete: true` in variant.json; agent manifest, skill manifest, script manifest, and documentation present. |
| 2 | **Agent roster completeness** | Done | All agents defined at promotion were present with substantive content (13 at the time). Roster has since grown to 14 (i18n-specialist added 2026-09-25): 1 PM + 10 slide-pipeline + 2 handbook + 1 i18n-specialist — see variant.json `agents[]`. |
| 3 | **Skills coverage** | Done | 10 variant-specific skills currently registered in variant.json `skills[]` (version, research, storyline, design, html-build, prep-pdf, pdf-export, slide-layout-gate, theme-authoring, presenter-mode); common provides `handbook` + `handbook-sync-audit` via `inherits_common` (promoted from this variant 2026-08-30). |
| 4 | **Documentation completeness** | Done | README.md, docs/co-deck.context.md, AGENTS.md, and variant.json present and maintained. The 2026-10-05 scoped review logged descriptive-claim drift; remediation is tracked via T-20261005-006..018. |
| 5 | **Audit pass rate** | Done | Machine baseline 7/7 green as of 2026-10-07 (`bun scripts/review-baseline.ts --template co-deck`, incl. `validate-variant-claims.ts` — the 7th baseline entry added 2026-10-05 — with 0 findings). Deprecated script (measure-layout) documented and excluded from the active pipeline. |
| 6 | **Real engagements** | N/A per ADR-0099 — migration fast-track | `variant.json` → `lifecycle.betaEngagements` is empty — engagement logs are not separately maintained; under the ratified admission the beta-engagement attestation is waived rather than simulated. The PM-approved promotion (root lifecycle record 2026-08-30) remains the governing record. |
| 7 | **README accuracy** | Done | README.md / README_ko.md carry the ✅ Stable v0.2.3 badge and current inventories (14 agents, 10 skills, 6 themes / 6 styles); beta-era status blocks removed 2026-10-05 (T-20261005-009). |
| 8 | **Minimum beta duration** | N/A per ADR-0099 — migration fast-track | Beta window 2026-06-17 → 2026-08-30 = 74 days, below the 3-month criterion (the beta-era checklist had estimated 2026-09-17). The recorded promotion decision governs; the shortfall is waived per ADR-0099, not claimed as met. |
| 9 | **Zero unresolved bugs** | Done | No open bug reports recorded at promotion; per-engagement/bug detail lived in gitignored local lifecycle state. |
| 10 | **User feedback** | N/A per ADR-0099 — migration fast-track | Not separately logged; under the ratified admission no beta-user feedback record exists to claim. The PM-approved promotion decision (root lifecycle record 2026-08-30) is the governing evidence. |

## Domain-Specific Validation

| Check | Description | Status |
|-------|-------------|--------|
| 11-stage slide pipeline | Full pipeline (version → research → source-verifier → storyline → design → image-curator → diagram-specialist → html-build → measure → pdf-export) completes end-to-end | Done |
| Theme system | All registered themes × styles (authoritative registry: docs/html-themes/THEMES.md) build; validate-theme-styles.ts passes (themes=6, styles=6 as of 2026-10-05) | Done |
| PDF export | gen-slides-pdf.ts produces valid PDF with correct layout across registered theme × style combinations | Done |
| Handbook pipeline | H-Stage pipeline (H-0 through H-7) produces valid handbook output; validate-nav, check-authoring, handbook-doctor all pass | Done |
| Source verification | source-verifier trust_score gate (>= 0.9 pass) and retry policy function correctly | Done |
| Image curation | image-curator handles image_role: none skip and pre-supplied images correctly | Done |
| Diagram generation | diagram-specialist produces valid diagrams when visual_spec fields present; skips correctly when absent | Done |
| Presenter mode | Presenter-mode skill syncs slide index, speaker notes, and timer across dual windows | Done |
| Layout measurement | estimate-layout.ts produces accurate measurements without Playwright dependency | Done |
| Region-based layout | 4-layer deepMerge (shared → theme → style → project) resolves correctly; required null regions throw as expected | Done |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| 2026-08-30 | pm | Stable promotion approved | Root lifecycle record `docs/lifecycle/templates/co-deck.md` (2026-08-30 row: review → stable) |
| 2026-10-05 | Scoped project review (slots A–D) | Stable status affirmed; descriptive-claim drift logged | `docs/reports/2026-10-05-project-review-scoped-co-deck.md`; remediation T-20261005-006..018 |
| 2026-10-07 | pm | Stable promotion ratified (ADR-0099) | Migration admission ratified per ADR-0099 follow-up; criteria 6/8/10 waived (74-day beta window below the 3-month criterion; engagement/feedback records not separately maintained); machine baseline 7/7 green (T-20261006-005) |
