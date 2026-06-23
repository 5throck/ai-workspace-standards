# new-project.ts Script Lifecycle

## Created

2026-06-01

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-01 | - | production | Initial project scaffolding script | automation-engineer |
| 2026-06-23 | production | production | v1.1.8: Fixed scaffolding leak — added `docs/variant.context.template.md` to cleanupFiles array. Template file was copied but never cleaned up after `applyContextTemplate()` consumed it. | lifecycle-manager |

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

## Metadata

- **Current Phase**: production
- **Owner**: automation-engineer
- **Last Updated**: 2026-06-23
- **Last Reviewer**: lifecycle-manager
