# generate-skill-lifecycle-records.ts Script Lifecycle

## Metadata

- **Script**: generate-skill-lifecycle-records
- **Status**: active
- **Version**: 1.2.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-12
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-11-12

## Description

Generates the governance records (`docs/lifecycle/skills/<name>.md`) that template delivery ships with each delivered skill, so projects stop warning in Check LC for template skills. Projection of the L0 record for common skills (sanitized, version-free), derivation from SKILL.md frontmatter for variant-own and project-local skills (`--project <path>`), owner resolution (frontmatter, then `scripts/data/skill-owner-map.json`, else failure), `--check` byte parity, `--write`. Its SLR evaluation core backs the `validate-templates.ts` check SLR, gated by `scripts/skill-record-enforcement.json`. Design: `docs/designs/2026-11-12-skill-lifecycle-record-delivery-design.md`. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-12 | - | production | v1.0.0 (U-20261112-005 PR-1): initial. No records are generated into templates/ yet (PR-2); SLR ships report-only. | automation-engineer |
| 2026-11-12 | production | production | v1.1.0 (common-agents CA-1): SLR owner-agent rule strict for common skills (owner must be in templates/common/agents); report-only while enforce is false. | automation-engineer |
| 2026-11-12 | production | production | v1.2.0 (U-20261112-005 PR-1b): Korean text in generated records is wrapped in backticks so the language gate accepts them. | automation-engineer |
