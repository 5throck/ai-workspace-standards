# Sync Skill — Lifecycle Record

## Metadata
- **Skill**: sync
- **Status**: active
- **Version**: 1.5.0
- **Owner**: pm
- **Created**: 2026-07-08
- **Last Updated**: 2026-09-12

## Description
Full project sync pipeline covering lifecycle update, audit, L0→L1 publish, commit, push, and PR creation.

## Changelog
- 2026-09-12: v1.5.0 — Universal Design Gate (ADR-0074) phase B: pipeline step 3.9 Spec Registry Check (`audit.ts --spec-check --lifecycle-only`) documented as FATAL at L0 — blocks on a code diff with no spec activity; escape hatch `--spec-exempt=E1-E5`; missing `docs/specs/registry.json` is a loud WARN (gate INACTIVE) (commit 7170c3d8)
- 2026-09-12: v1.4.0 — scoped staging: step 0 documents task-staged-file discipline, `SYNC_SCOPED_STAGING=1` / `--scoped-staging` preview, and dev-sync v1.11.0 WARN-phase residual reporting for `git add -A` sweeps (commit 20b534a9)
- 2026-09-06: v1.3.0 — session-evidence skill review loop (SkillHone-inspired): step 3.96c row added to pipeline table; `## Skills Used` session evidence recording duty documented (design doc docs/designs/2026-09-06-skill-session-review-design.md)
- 2026-08-16: v1.2.0 — version drift fix: aligned lifecycle doc to v1.2.0 per SKILL.md
- 2026-07-10: v1.1.0 — pipeline documentation expanded to full 16-step table; sync-skills.ts Step 4.8 integration; sync-skills.ts called in dev-sync.ts pipeline; CHANGELOG description corrected ("blocks if empty"); .agents/commands/sync.md created for platform parity; owner updated to lifecycle-manager
- 2026-07-10: SKILL.md documentation expanded; sync-skills.ts integration added to dev-sync.ts pipeline
- 2026-07-08: Skill extracted from inline /sync command to standalone SKILL.md

## Dependencies
- `scripts/dev-sync.ts` — main pipeline implementation
- `scripts/sync-skills.ts` — platform skill distribution
- `scripts/audit.ts` — audit gate
- `scripts/propagate-to-templates.ts` — L0→L1 publish
- `scripts/lifecycle-sync-audit.ts` — lifecycle drift detection

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-08 | - | production | Skill extracted from inline /sync command to standalone SKILL.md | pm |
| 2026-07-19 | production | production | Reassigned owner to pm and updated pipeline sync steps | pm |
| 2026-09-12 | production | production | v1.4.x → v1.5.0 design-gate work: Universal Design Gate (ADR-0074) phase B — spec-check step 3.9 documented in the pipeline table; scoped-staging discipline documented in step 0; lifecycle record refreshed to match SKILL.md v1.5.0 (T-20260912-010) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/sync/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Full pipeline sync tests pass via `dev-sync.ts`
- [x] Idempotent PR update verified

## Notes
- SKILL.md is distributed to `.claude/skills/sync/` and `.gemini/skills/` via sync-skills.ts Phase 1
- Pipeline is idempotent: re-running /sync on the same branch updates the existing PR
- sync-skills.ts is now called as Step 4.8 in the pipeline (non-fatal)
