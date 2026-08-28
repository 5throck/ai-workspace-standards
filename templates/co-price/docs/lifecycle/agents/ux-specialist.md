# Dashboard & Visual Specialist (ux-specialist) Agent Lifecycle

## Created

2026-08-25

## Phase History

| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-08-25 | - | production | v10.1 governance normalization: schema-compliant frontmatter and golden seven-section structure adopted | pm |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: interface
- [x] Tier assignment recorded across all four platforms in frontmatter
- [x] Golden section structure present (Role / Responsibilities / Output Format / Non-Negotiable Boundaries / Three-Stage Review / PM-ONLY INVOCATION / Constraints)
- [x] PM-only invocation boundary documented
- [x] Validated by workspace validate-agents.ts (0 errors)

## Dependencies

- pm (sole dispatcher per flat PM Gateway)

## Domain

**Dashboard & Visual Specialist** — interface subdomain of the co-price variant ecosystem.

The authoritative runtime definition lives in [`agents/ux-specialist.md`](../../../agents/ux-specialist.md);
this record tracks lifecycle only.