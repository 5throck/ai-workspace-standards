# schema-validator.ts Script Lifecycle

## Metadata

- **Script**: schema-validator
- **Status**: active
- **Version**: 1.5.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-26
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-26 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-08-01

## Description

Shared frontmatter/schema validators under scripts/validators/ (validateAgentFrontmatter and related field checks) consumed by the agent and skill validation gates. Since v1.5.0 (ADR-0102) validateAgentFrontmatter accepts the scalar `tier: high/medium/low` declaration as the canonical shape. SSOT: `scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-26 | production | production | v1.4.0 → v1.5.0 (ADR-0102 scalar tier / T-20261026-018, design docs/designs/2026-10-26-model-registry-platform-coverage-design.md §7): validateAgentFrontmatter accepts the scalar `tier: high/medium/low` declaration as the canonical shape (invalid scalar value errors); the legacy per-platform map branch stays as transition tolerance. | automation-engineer |
