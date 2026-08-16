# Co-News Promotion Checklist

**Variant:** co-news
**Current Status:** beta (v0.1.0)
**Beta Since:** 2026-08-10
**Phase A Complete:** true

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | `phaseAComplete: true` in variant.json; agent manifest, skill manifest, and documentation present |
| 2 | **Agent roster completeness** | Pending | All 7 agents defined (pm, fact-checker, financial-analyst, legal-researcher, reporter, style-editor, visual-editor). Verify each agent file has substantive content (no TODO stubs). |
| 3 | **Skills coverage** | Pending | 5 variant-specific skills (source-verification-ledger, financial-narrative-brief, financial-journalism-style, ai-tell-reduction, financial-infographic-svg) plus L1 common skills (k-dart, k-law). Verify each SKILL.md is complete and operational. |
| 4 | **Documentation completeness** | Pending | README.md present and accurate; co-news.context.md complete with substantive governance/roster/dispatch sections; AGENTS.md reflects actual roster; variant.json fields accurate. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` passes with 0 errors. No deprecated scripts in SCRIPTS.md. |
| 6 | **Real engagements** | Pending | Minimum 1 successful article production engagement (tip -> research -> draft -> fact-check -> editorial -> publish pipeline end-to-end). |
| 7 | **README accuracy** | Pending | README reflects current agent roster, skills, workflow phases, and domain configuration. No stale references to removed agents or skills. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status (earliest promotion: 2026-11-10). |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical UX/functional complaints. |

## Domain-Specific Validation

| Check | Description | Status |
|-------|-------------|--------|
| Fact-check gate | Citation ledger enforces 2+ independent sources per material claim | Pending |
| Editorial gate | Both fact-checker and style-editor sign-off required before publish | Pending |
| AI-tell reduction | style-editor AI-tell pass produces naturally human-written output | Pending |
| DART integration | financial-analyst successfully queries k-dart for disclosure data | Pending |
| k-law integration | legal-researcher successfully queries k-law for statute/precedent data | Pending |
| Multi-language | Article output works in Korean (default) and at least one other language | Pending |
| Infographic pipeline | visual-editor generates valid SVG infographics from narrative brief | Pending |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
