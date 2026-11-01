# Design: Template upgrade to 0.8.3 (2026-10-01 fleet resync)

- **Spec ID**: 2026-10-01-template-upgrade-083
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (upgrade-project fleet resync)

## Problem

The project held template revision 0.8.1 while the workspace published
template-v0.8.3 (fleet HERMES.md upkeep + tier-semantics delivery chain).

## Decision

Upgrade via the workspace-side L0 tooling
(`bun ../../scripts/upgrade-project.ts .`, ADR-0073 Amendment 1):
locked deliverables + WORKSPACE-MANAGED merges, project exclusions preserved.
Follows this project's template-upgrade spec-registration convention.

## Accessibility

Non-UI infrastructure change — no accessibility impact (explicit statement per
ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (explicit statement
per ADR-0070).

## Verification

- `bun scripts/audit.ts` — exit 0 post-upgrade.
- `bun scripts/verify-scripts.ts --verify` — clean post-upgrade.
