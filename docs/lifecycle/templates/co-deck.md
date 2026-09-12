# co-deck — Template Lifecycle

## Created

2026-06-17

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-17 | - | review | Initial creation — lecture/presentation variant | pm |
| 2026-07-03 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-08-30 | review | stable | Stable transition recorded in `templates/co-deck/variant.json` | pm |

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 11 deck agents present (pm, version, research, source-verifier, storyline, design, image-curator, diagram-specialist, html-build, measure, pdf-export)
- [x] All 8 skills present
- [x] Pipeline order and optional/skippable agents documented
- [x] Theme manifest with 5 themes + PPT-transformed themes documented
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
- **Last Updated**: 2026-09-12
- **Last Reviewer**: lifecycle-manager
