# Service-Design Skill — Lifecycle Record

## Metadata
- **Skill**: service-design
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-07-19 (co-design variant)
- **Last Updated**: 2026-09-27

## Description
End-to-end service design procedure: stakeholder discovery, customer journey mapping
(with the ADR-0068 mandatory diversity-profile review), service blueprinting
(frontstage/backstage), touchpoint design, process optimization, and service
validation with output contracts. Promoted from the co-design variant to L0
(scope common, l2_propagate) per the PM propagation ruling of 2026-09-27
(ADR-0080 decision, P7 of the design-asset advancement meeting) so that every
scaffolded project receives it via L0→L1 propagation — co-architect (the only
other holder, at v1.0.0) reconciles to v1.1.0 on its next upgrade.

## Changelog
- 2026-07-19: 1.0.0 — created in co-design
- 2026-09-27: 1.1.0 — co-design batch update (body current as of promotion)
- 2026-09-27: promoted to L0 (scope common, l2_propagate true); body unchanged
  except defect cleanup (stray trailing `",` artifact removed from the body tail)

## Dependencies
- Composes with `ui-ux-design-intelligence` (follows), `accessibility-audit`
  (follows), `token-usage-lint` (follows); ADR-0068 diversity-profile review is
  embedded as a mandatory journey-mapping step

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-19 | - | active | Created in co-design variant | pm |
| 2026-09-27 | active (co-design) | active (common) | Promoted to L0 per PM ruling (meeting P7, ADR-0080); upgrade-path propagation to co-architect | pm |

## Acceptance Criteria

### Active Phase
- SKILL.md frontmatter: scope common, l2_propagate true, English-only body
- Registry lockstep: SKILLS.md row, this record, VERSION_MANIFEST, skill-graph,
  L1 mirror (templates/common/skills/), platform mirrors — all regenerated this batch
- Validators: verify-skills / validate-skills / verify-skill-graph pass

## Handoff
- templates/co-design/skills/service-design removed (single-location rule — L0 is
  now the sole source); project copies reconcile via the upgrade path
  (`--prune-removed` removes stale L2 copies, common delivery re-adds at 1.1.0)
- co-architect's local v1.0.0 copy is superseded by common v1.1.0 at its next upgrade
