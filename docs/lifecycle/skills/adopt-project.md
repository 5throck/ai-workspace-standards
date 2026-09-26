# Adopt-Project Skill — Lifecycle Record

## Metadata
- **Skill**: adopt-project
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-09-23
- **Last Updated**: 2026-09-25 (Version 1.1.0: the settling pass generalizes extends-stub resolution from pm.md-only to EVERY agents/*.md carrying `extends:` frontmatter — the 13 variant i18n-specialist.md stubs resolve here too; pm.md keeps the H12 canonical-prose check and the L1-B metadata strip. T-20260924-003, spec `2026-09-25-inventory-decisions-batch-design` R2.3. Previous: 1.0.0 initial — in-place conversion of an external project into the workspace standard, spec `2026-09-23-adopt-project-conversion-design`)

## Description
In-place conversion of an external project (created with other tools) into a
workspace-standard project, as if delivered by new-project.ts: subprocess
delivery via upgrade-project (files-only contract), full delivered-path
collision scan with outside-repo backup + `scripts/_legacy/` archival,
foreign-skill manifest seed, refusal-grade pre-flight (secrets / hook managers
/ gitleaks), settling pass (extends-stub resolution, seeds, scoped
substitution, package.json merge, bun install + hooksPath, graft, audit
smoke). No auto-commit. Operator-level skill (workspace root);
`l2_propagate: false`.

## Changelog
- 2026-09-25: 1.1.0 — settling pass resolves extends-stubs in every agents/*.md (T-20260924-003)
- 2026-09-23: 1.0.0 — created (spec docs/designs/2026-09-23-adopt-project-conversion-design.md)

## Dependencies
- Composes with `migrate-project` (which wraps this skill with verification); subprocess-delivers via `upgrade-project`

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-23 | - | active | Created with the skill (adopt-project conversion design) | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/adopt-project/SKILL.md`
- [x] Frontmatter valid; scope: common; l2_propagate: false
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
- [x] Refusal-grade pre-flight encoded (secrets / hook managers / gitleaks); no auto-commit
