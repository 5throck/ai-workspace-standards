# SWE-Solve Skill — Lifecycle Record

## Metadata
- **Skill**: swe-solve
- **Status**: active
- **Version**: 1.1.1
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-29

## Description
Autonomous 5-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation, pull-request synthesis, and resolution-trajectory logging.

## Changelog
- 2026-08-29: L0 dev-home copy (`skills/swe-solve/`) removed — the skill is variant-exclusive to co-develop; the variant copy (1.1.1, 5-stage) is authoritative; the L0 realignment done earlier the same day is superseded by full removal.
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)
- 2026-08-29: Re-scoped `common` → `co-develop`. The skill had evolved to 1.1.1 (5-stage pipeline with trajectory record) inside `templates/co-develop/skills/` while the common copy remained at 1.0.0 (4-stage), shipping the stale version to every non-co-develop project. L1 common copy and platform mirrors removed.

## Dependencies
- Bun runtime
- test-runner.ts — the workspace-root `scripts/test-runner.ts`. It is a workspace-level tool, not part of the shipped variant, so it is unsatisfiable inside an adopted co-develop project; in adopted projects use the project's own test command (e.g. `bun test`) instead.

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/swe-solve/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Registration scope: variant-scoped; no common-layer registry row is expected for this skill
- [x] Scope: co-develop (variant-exclusive)

## Notes
- Variant-exclusive skill (owner: co-develop) — reaches only co-develop projects via the variant overlay; other variants no longer receive the stale common copy
- Owner: pm
