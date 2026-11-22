# generate-skill-lifecycle-records.ts Script Lifecycle

## Metadata

- **Script**: generate-skill-lifecycle-records
- **Status**: active
- **Version**: 1.4.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-22
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-11-12

## Description

Generates the governance records (`docs/lifecycle/skills/<name>.md`) that template delivery ships with each delivered skill, so projects stop warning in Check LC for template skills. Projection of the L0 record for common skills (sanitized, version-free), derivation from SKILL.md frontmatter for variant-own and project-local skills (`--project <path>`), owner resolution (frontmatter, then `scripts/data/skill-owner-map.json`, else failure), `--check` byte parity, `--write`. Its SLR evaluation core backs the `validate-templates.ts` check SLR, gated by `scripts/skill-record-enforcement.json`. Design: `docs/designs/2026-11-12-skill-lifecycle-record-delivery-design.md`. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-22 | production | production | v1.4.0 (T-20261122-003 / U-20261122-008, spec docs/designs/2026-11-22-skill-record-variant-notes-design.md): variant-notes preservation — a `<!-- variant-notes:start -->` … `<!-- variant-notes:end -->` block in an existing generated record is re-emitted verbatim after the title (between the H1 and ## Metadata). extractVariantNotes() pure + exported (absent = null/no warning; empty = absent/no warning; malformed = WARN + drop, first well-formed pair wins, never a crash); main() applies it at the single --write/--check choke point for existing generated targets, so --check parity stays exact for annotated records and the L0 records hook, template regeneration, and --project runs all inherit it; injected AFTER finalizeClean — verbatim means verbatim (internal-ref filter and Hangul wrapping never touch the author's lines). WARNs never change the exit code. Pinned by tests/unit/generate-skill-lifecycle-records.test.ts v1.1.0. | automation-engineer |
| 2026-11-12 | - | production | v1.0.0 (U-20261112-005 PR-1): initial. No records are generated into templates/ yet (PR-2); SLR ships report-only. | automation-engineer |
| 2026-11-12 | production | production | v1.1.0 (common-agents CA-1): SLR owner-agent rule strict for common skills (owner must be in templates/common/agents); report-only while enforce is false. | automation-engineer |
| 2026-11-12 | production | production | v1.2.0 (U-20261112-005 PR-1b): Korean text in generated records is wrapped in backticks so the language gate accepts them. | automation-engineer |
| 2026-11-12 | production | production | v1.3.0 (U-20261112-005 PR-3): recordHookVerdict for the dev-sync step 4.505 hook; SLR enforcement flag flipped to true. | automation-engineer |
