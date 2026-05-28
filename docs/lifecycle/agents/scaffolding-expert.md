# Scaffolding-Expert Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial scaffolding-expert agent established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Project scaffolding specialist
- [x] Tier assignment: Low-tier (claude-haiku-4-5) for scaffolding tasks
- [x] Scaffolding responsibilities specified: New project setup, template synchronization
- [x] UTF-8 enforcement documented
- [x] Successfully validated in scaffolding workflows

## Dependencies

- pm (for scaffolding dispatch)
- docs-writer (for README creation)

## Domain

**Project Setup Specialist** - New project scaffolding and template synchronization

**Phases Supported**: 0 (Team Assembly), 4 (Implementation - setup)

**Key Responsibilities**:
- New project scaffolding
- Template synchronization
- UTF-8 enforcement across files
- Initial project structure creation
- README generation

## Dispatch Protocol

**Can Lead Phases**: [0, 4]
**Can Support In**: [6]
**Tier**: low (for scaffolding tasks)
**Communication Style**: async (can work independently on setup)

## Scaffolding Tasks

1. **New Project Creation**:
   - Create folder structure
   - Generate initial files
   - Set up configuration
   - Initialize git repository

2. **Template Synchronization**:
   - Update templates from workspace root
   - Apply variant-specific customizations
   - Ensure cross-platform compatibility

3. **UTF-8 Enforcement**:
   - Convert files to UTF-8
   - Add BOM if needed for emoji/Unicode
   - Verify encoding consistency

## Metadata

- **Current Phase**: production
- **Owner**: scaffolding-expert
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
