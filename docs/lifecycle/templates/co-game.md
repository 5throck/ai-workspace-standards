# co-game — Template Lifecycle

## Created

2026-07-08

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-08 | - | review | Initial creation — game development variant (HTML5 Canvas, Vanilla TypeScript) | pm |
| 2026-08-12 | review | production | beta → 1.0.0 stable promotion | auditor |
| 2026-09-10 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |
| 2026-10-06 | production | production | Record refreshed: roster reconciled to 14 agents (i18n-specialist added); PROMOTION_CHECKLIST ratified per ADR-0099 (migration fast-track; beta-window criteria 6/8/10 waived); validate-variant-claims PASS 0 findings; phase unchanged | pm |

## Summary

Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design (arcade/puzzle genres), visual art, sound, engine implementation, debugging, and testing, plus architecture planning, security monitoring, and tech-stack setup.

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 14 agents present (arcade-designer, architect, designer, game-debugger, game-designer, game-developer, i18n-specialist, pm, puzzle-designer, security-monitor, sound-designer, stack-setup, test-runner, visual-artist)
- [x] All 5 game skills present (arcade-physics, code-review, refactoring, sound-synth, test-driven-development)
- [x] inherits_common correctly points to templates/common
- [x] Stable promotion completed 2026-08-12

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — game development)
- **Current Phase**: production
- **Version**: 1.0.0
- **Owner**: pm
- **Last Updated**: 2026-10-06
- **Last Reviewer**: pm
