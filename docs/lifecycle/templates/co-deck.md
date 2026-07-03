# co-deck — Template Lifecycle

## Created

2026-06-17

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-17 | - | review | Initial creation — lecture/presentation variant | pm |
| 2026-07-03 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 11 deck agents present (pm, version, research, source-verifier, storyline, design, image-curator, diagram-specialist, html-build, measure, pdf-export)
- [x] All 8 skills present
- [x] Pipeline order and optional/skippable agents documented
- [x] Theme manifest with 5 themes + PPT-transformed themes documented
- [x] Script manifest with local scripts documented
- [x] Trust score thresholds configured
- [ ] Stable promotion pending — currently beta

### Production Phase

- [ ] All review phase criteria met
- [ ] Successfully tested in real scenario
- [ ] Documentation complete
- [ ] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — lecture)
- **Current Phase**: review
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: lifecycle-manager
