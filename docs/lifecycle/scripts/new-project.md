# new-project.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.21.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-09-17
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort. The duplicate Metadata section (a v1.10.0-era leftover) was merged into this single section on 2026-09-16.

## Created

2026-06-01

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-01 | - | production | Initial project scaffolding script | automation-engineer |
| 2026-06-23 | production | production | v1.1.8: Fixed scaffolding leak — added `docs/variant.context.template.md` to cleanupFiles array. Template file was copied but never cleaned up after `applyContextTemplate()` consumed it. | lifecycle-manager |
| 2026-09-08 | production | production | v1.10.0 catch-up (record backfilled at 2026-09-08 review; versions 1.2.0–1.9.0 landed without record updates): pm.md extends-stub resolution against L1 body (v1.10.0, PR #822), L1-B metadata stripping, lifecycle regeneration, overlay skip list, rollback safety. Registry SSOT: scripts/SCRIPTS.md | pm |
| 2026-09-16 | production | production | Version sync gate landed (lifecycle-sync-audit Check H); record caught up to SCRIPTS.md SSOT v1.18.0 | pm |
| 2026-09-16 | production | production | v1.19.0 (T-20260916-010): §7.8 generates the project's full docs/VERSION_MANIFEST.md post-delivery (variant stub class retired); record synced to SCRIPTS.md SSOT | automation-engineer |
| 2026-09-16 | production | production | v1.20.0 (T-20260916-002): scaffold provenance fallback is fail-loud via the templates/VERSION SSOT (resolveProvenanceVersion, pre-flight) — the silent "unknown" tail is removed; explicit --version still wins as-is. Spec: docs/designs/2026-09-16-new-project-provenance-alignment-design.md | automation-engineer |
| 2026-09-17 | production | production | v1.21.0 (T-20260917-009): VARIANT_OVERLAY_SKIP derives from the upgrade-policy SCAFFOLD_COMMON_OWNED_FILES classification (hand list removed). Spec: docs/designs/2026-09-17-governance-backlog-batch-design.md | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Scaffolds new projects from variant templates
- [x] Cross-platform compatible (Windows, macOS, Linux)
- [x] Idempotent execution
- [x] Cleans up scaffolding-only artifacts after generation
- [x] Cleans up `docs/variant.context.template.md` (v1.1.8)

## Dependencies

- `templates/common/` (template source)
- `docs/variant.context.template.md` (consumed and cleaned up)

## Domain

**Project Scaffolding** — Creates new projects from variant templates with cross-platform support.

**Key Responsibilities**:
- Copy variant template to new project directory
- Apply context template for variant-specific documentation
- Clean up scaffolding-only artifacts (templates, examples, `variant.context.template.md`)
- Cross-platform path handling and encoding enforcement
