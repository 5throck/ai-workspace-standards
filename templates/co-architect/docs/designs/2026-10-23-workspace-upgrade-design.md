# Workspace Upgrade Delivery — zai/hermes tier registry + L1 catch-up

- **Date**: 2026-10-23
- **Status**: implemented
- **Spec id**: `2026-10-23-workspace-upgrade`
- **Owner**: pm (delivery receipt for the scaffolded L3 project)

## R1 — What arrived

The workspace root landed design `2026-10-23-zai-tier-floor-support` (PR #1586/#1587/#1588): Z.AI (GLM) tiers registered in the 3-Tier model registry, hermes promoted to a validated platform, validator v1.5.0 (PLATFORMS 5→7). As a scaffolded L3 project this repo receives the delivery through the sanctioned upgrade flow (`scripts/upgrade-project.ts`): AGENTS.md §3.6 tier-model-mapping managed blocks (GLM column + note), `docs/workspace-schema.json` zai block, `scripts/validate-model-registry.ts` 1.5.0 + SCRIPTS.md pair, and general L1 catch-up (design-lint wiring, governance docs).

## R2 — Decision

Absorb the delivery as-is via the upgrade flow. No project-local divergence; tier frontmatter for project-owned agent files follows the upgrade flow's own rules.

## R3 — Verification

`bun scripts/validate-model-registry.ts` (✓), `bun scripts/validate-templates.ts` (0 errors), `bun scripts/audit.ts` (green).

## R4-R7 — Exempt

Backend/docs-only delivery receipt. No UI, no accessibility or preview surface.
