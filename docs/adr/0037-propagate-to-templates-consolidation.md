# ADR-0037: Consolidate publish-to-template.ts into propagate-to-templates.ts v2.0.0

**Status**: Accepted  
**Date**: 2026-06-13  
**Deciders**: PM, automation-engineer, lifecycle-manager

## Context

`publish-to-template.ts` (L0+L1) and `propagate-to-templates.ts` (L0) had overlapping responsibilities for L0→L1 file propagation. `publish-to-template.ts` was a legacy script that predated the config-driven propagation-map.json approach.

## Decision

Consolidate all propagation logic into `propagate-to-templates.ts` v2.0.0, which:
- Is config-driven via `propagation-map.json` (SSOT for exclusions and domains)  
- Supports `--apply`, `--dry-run`, `--prune`, `--check-drift`, `--governance-l1`, `--docs` flags
- Correctly applies `exclude_prefixes` in `collectDiffs()` (bug fixed in v2.0.1)
- Removes L0-only orphan scripts from L1 via `--prune` flag (added in v2.0.1)

`publish-to-template.ts` is deleted. The `bun run propagate:apply` alias replaces all previous `publish-to-template` invocations.

## Consequences

- All docs/constitution references to `publish-to-template` must use `bun run propagate:apply`
- SCRIPTS.md, SKILLS.md, and ADR-0001 references updated accordingly
- `propagation-map.json` is the single source of truth for what gets propagated and what is excluded
