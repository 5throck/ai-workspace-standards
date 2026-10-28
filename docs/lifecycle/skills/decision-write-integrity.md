# Decision-Write-Integrity Skill — Lifecycle Record

## Metadata
- **Skill**: decision-write-integrity
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-10-28
- **Last Updated**: 2026-10-28 (Version 1.0.0 initial — fleet-level process skill distilled from Projects/co-newbiz ADR-0186 gate-integrity, merged PR #743. T-20261028-008.)

## Description
Design and operating guidance for integrity gates around human decision
writes (approvals, ticket transitions, ADR acceptances, waivers, state
transitions). Carries the domain-neutral distillation of the co-newbiz
gate-integrity pattern: the HARD BLOCK / ACK / DISPLAY enforcement
taxonomy, off|shadow|enforce staged rollout with per-family soak criteria,
server-recomputed snapshot-hash propose-then-confirm flow (409 on stale),
deterministic script-aware rationale substance checks, maker/checker
countersign with deny-by-default grants, and AI-recommendation divergence
recording. Process guidance only — no code, no project-specific predicates.
Operator-level skill (workspace root); `l2_propagate: false` — fleet
propagation is a later, separate governance decision through the standard
sync pipeline.

## Changelog
- 1.0.0 (2026-10-28): initial.

## Dependencies
- Source pattern: Projects/co-newbiz/docs/adr/0186-gate-integrity.md (PR #743) and docs/designs/2026-10-26-gate-integrity-design.md (project-gitignored evidence)
- Related skill: meeting-facilitation (shared human-decides philosophy, frontmatter `relates_to`)

## Phase History
- Production (2026-10-28): skill created from learning ticket T-20261028-008 (extracted by project-resync Step 2f, 2026-10-28); registry row added to `skills/SKILLS.md`; verified absent from `templates/common` and `.agents/skills` before authoring.

## Acceptance Criteria
- `bun scripts/validate-skills.ts` green with the new skill present
- `bun scripts/audit.ts` green (skill-graph projection, VERSION_MANIFEST regenerated)
- `bun scripts/verify-scripts.ts --verify` and `bun test` unaffected (docs-only skill, no script surface)
- Domain-neutral: no co-newbiz business specifics (predicates, policy clause numbers, discount-rate semantics) in the skill body
