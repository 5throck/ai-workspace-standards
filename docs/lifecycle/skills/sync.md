# Sync Skill — Lifecycle Record

## Metadata
- **Skill**: sync
- **Status**: active
- **Version**: 1.1.0
- **Created**: 2026-07-08
- **Last Updated**: 2026-07-10

## Description
Full project sync pipeline covering lifecycle update, audit, L0→L1 publish, commit, push, and PR creation.

## Changelog
- 2026-07-10: v1.1.0 — pipeline documentation expanded to full 16-step table; sync-skills.ts Step 4.8 integration; sync-skills.ts called in dev-sync.ts pipeline; CHANGELOG description corrected ("blocks if empty"); .agents/commands/sync.md created for platform parity; owner updated to lifecycle-manager
- 2026-07-10: SKILL.md documentation expanded; sync-skills.ts integration added to dev-sync.ts pipeline
- 2026-07-08: Skill extracted from inline /sync command to standalone SKILL.md

## Dependencies
- `scripts/dev-sync.ts` — main pipeline implementation
- `scripts/sync-skills.ts` — platform skill distribution
- `scripts/audit.ts` — audit gate
- `scripts/propagate-to-templates.ts` — L0→L1 publish
- `scripts/lifecycle-sync-audit.ts` — lifecycle drift detection

## Notes
- SKILL.md is distributed to `.claude/skills/sync/` and `.gemini/skills/` via sync-skills.ts Phase 1
- Pipeline is idempotent: re-running /sync on the same branch updates the existing PR
- sync-skills.ts is now called as Step 4.8 in the pipeline (non-fatal)
