# Co-Deck Promotion Checklist

**Variant:** co-deck
**Current Status:** beta (v0.2.1)
**Beta Since:** 2026-06-17
**Phase A Complete:** true

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Done | `phaseAComplete: true` in variant.json; agent manifest, skill manifest, script manifest, and documentation present. |
| 2 | **Agent roster completeness** | Pending | All 13 agents defined (pm, version, research, source-verifier, storyline, design, image-curator, diagram-specialist, html-build, measure, pdf-export, handbook-writer, handbook-reviewer). Verify each agent file has substantive content. |
| 3 | **Skills coverage** | Pending | 9 variant-specific skills (version, research, storyline, design, html-build, prep-pdf, pdf-export, theme-authoring, presenter-mode) + 2 common skills from templates/common (handbook, handbook-sync-audit — promoted 2026-08-30). Verify each SKILL.md is complete and operational. |
| 4 | **Documentation completeness** | Pending | README.md present and accurate; context.md complete; AGENTS.md reflects actual 13-agent roster; variant.json fields accurate; theme_manifest and lecture_profile documented. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` passes with 0 errors. Deprecated scripts (measure-layout) documented and not in active pipeline use. |
| 6 | **Real engagements** | Pending | Minimum 1 successful slide pipeline engagement (research -> storyline -> design -> html-build -> measure -> pdf-export end-to-end). |
| 7 | **README accuracy** | Pending | README reflects current 11-stage slide pipeline, H-stage handbook pipeline, theme system (5 themes, 5 styles), and agent roster. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status (earliest promotion: 2026-09-17). |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical UX/functional complaints. |

## Domain-Specific Validation

| Check | Description | Status |
|-------|-------------|--------|
| 11-stage slide pipeline | Full pipeline (version -> research -> source-verifier -> storyline -> design -> image-curator -> diagram-specialist -> html-build -> measure -> pdf-export) completes end-to-end | Pending |
| Theme system | All 5 themes (premium-dark, classic, minimal, visual-heavy, academic) build without errors; validate-theme-styles.ts passes | Pending |
| PDF export | gen-slides-pdf.ts produces valid PDF with correct layout across all themes | Pending |
| Handbook pipeline | H-Stage pipeline (H-0 through H-7) produces valid handbook output; validate-nav, check-authoring, handbook-doctor all pass | Pending |
| Source verification | source-verifier trust_score gate (>= 0.9 pass) and retry policy function correctly | Pending |
| Image curation | image-curator handles image_role: none skip and pre-supplied images correctly | Pending |
| Diagram generation | diagram-specialist produces valid diagrams when visual_spec fields present; skips correctly when absent | Pending |
| Presenter mode | Presenter-mode skill syncs slide index, speaker notes, and timer across dual windows | Pending |
| Layout measurement | estimate-layout.ts produces accurate measurements without Playwright dependency | Pending |
| Region-based layout | 4-layer deepMerge (shared -> theme -> style -> project) resolves correctly; required null regions throw as expected | Pending |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
