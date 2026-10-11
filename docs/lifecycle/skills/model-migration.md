# Model-Migration Skill — Lifecycle Record

## Metadata
- **Skill**: model-migration
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-10-11
- **Last Updated**: 2026-10-11

## Description
Guided registry model-ID migration: edit `docs/workspace-schema.json` `models.*`, sweep the sanctioned prose surfaces with `scripts/sync-model-registry.ts`, verify with `scripts/validate-model-registry.ts` and the managed-block-parity test, then record and sync. Companion to skill-lifecycle-audit Check MM, which bans model-ID literals from skill trees (workspace directive 2026-10-11).

## Changelog

- **1.0.0** (2026-10-11): initial release — user directive two-part rollout: (1) model-ID literals removed from the explain-me PLATFORM_HARNESS reference and machine-enforced via Check MM; (2) this skill assigned to lifecycle-manager makes model changes convenient.

## Dependencies
- `scripts/sync-model-registry.ts` — curated-surface sweep tool
- `scripts/validate-model-registry.ts` — post-sweep verification
- `scripts/lib/model-literal-patterns.ts` — shared model-ID detection patterns
- skill-lifecycle-audit Check MM — skills-tree literal ban

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-11 | - | production | Created with the model-migration directive rollout (literal ban + migration skill) | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/model-migration/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Owner agent exists (lifecycle-manager) and lists the skill
- [x] Companion script registered (scripts/sync-model-registry.ts, L0-only) and unit-tested
- [x] Workspace-root operator only (`l2_propagate: false`) — projects receive no copy

## Usage Statistics
- **First Used**: 2026-10-11 (creation rollout)
- **Last Used**: —
- **Total Invocations**: 0

## Metadata
- **Current Phase**: production
- **Version**: 1.0.0
- **Owner**: lifecycle-manager
- **Last Updated**: 2026-10-11
- **Last Reviewer**: pm
