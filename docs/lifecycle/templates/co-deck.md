# co-deck — Template Lifecycle

## Created

2026-06-17

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-17 | - | review | Initial creation — lecture/presentation variant | pm |
| 2026-07-03 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-08-30 | review | stable | Stable transition recorded in `templates/co-deck/variant.json` | pm |
| 2026-09-28 | stable | stable | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 14 deck agents present (1 PM + 10 slide-pipeline + 2 handbook + 1 i18n-specialist: pm, version, research, source-verifier, storyline, design, image-curator, diagram-specialist, html-build, measure, pdf-export, handbook-writer, handbook-reviewer, i18n-specialist)
- [x] All 10 variant skills present (version, research, storyline, design, html-build, prep-pdf, pdf-export, slide-layout-gate, theme-authoring, presenter-mode; common provides handbook + handbook-sync-audit)
- [x] Pipeline order and optional/skippable agents documented
- [x] Theme manifest with 6 themes + 6 styles documented (incl. outlook, white-bubble)
- [x] Script manifest with local scripts documented
- [x] Trust score thresholds configured
- [x] Stable promotion completed

### Production Phase

- [x] All review phase criteria met
- [x] Successfully tested in real scenario
- [x] Documentation complete
- [x] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — lecture)
- **Version**: 0.2.3
- **Current Phase**: stable
- **Owner**: pm
- **Last Updated**: 2026-09-28
- **Last Reviewer**: governance-ticket-runner
