# Sarif-Exporter Skill — Lifecycle Record

## Metadata
- **Skill**: sarif-exporter
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Exports security scan results, threat matrices, and vulnerability findings into standard SARIF v2.1.0 (Static Analysis Results Interchange Format) JSON reports.

## Changelog
- 2026-08-29: L0 dev-home copy (`skills/sarif-exporter/`) removed per DEC-20260829-02 — the skill is variant-exclusive to co-security; the variant copy is authoritative (1.0.1); L0 drift resolved by removal. Registered in `variant_scoped_skills` (docs/workspace-schema.json 1.5.0).
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- Security scan findings, threat matrix assessments, or raw vulnerability objects

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/sarif-exporter/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: co-security

## Notes
- Propagates to L2 variants (`l2_propagate: true`)
- Owner: security-expert
