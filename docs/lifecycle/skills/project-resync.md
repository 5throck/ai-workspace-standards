# Project-Resync Skill — Lifecycle Record

## Metadata
- **Skill**: project-resync
- **Status**: active
- **Version**: 1.5.0
- **Created**: 2026-09-06
- **Last Updated**: 2026-09-22 (Version 1.4.0 → 1.5.0 adds Step 2c fleet echo check — report-only cross-project drift reporting per ADR-0031 Principle 5 — plus Step 0 PRESUME-STALE verdict from resync-audit.ts v1.1.0 and the `scripts/backport-diff.ts` v1.0.0 Step 2 support tool; previous: 2026-09-19 Version 1.3.1 → 1.4.0 adds Step 2b Evidence plane review, running `scripts/evidence-backport-scan.ts` per design §4.8 / ADR-0084 Decision 6)

## Description
Whole-fleet bidirectional sync cycle for Projects/co-*: provenance audit
(`scripts/resync-audit.ts` Step 0 — COMMIT/DISCARD/KEEP verdicts over
uncommitted content, never pushing unverified work), per-project GitHub sync
via each project's dev-sync (remote bootstrap for remote-less repos, private),
selective backport review into templates (5-surface method), root /sync,
upgrade-project per project, and upgrade PR landing. Operator-level skill
(workspace root); `l2_propagate: false`.

## Changelog
- 2026-09-22: 1.5.0 — added Step 2c fleet echo check (grep-based sibling drift reporting, report-only per ADR-0031 Principle 5); Step 0 verdict table gains PRESUME-STALE (resync-audit.ts v1.1.0 mtime/order corroboration buffer); Step 2 documents the `scripts/backport-diff.ts` v1.0.0 support tool
- 2026-09-12: 1.3.1 — removed stale co-develop master branch exception; PR base must always be the repository default branch
- 2026-09-07: 1.2.0 — added Step 4 proof-check (commit `9d187b5a`)
- 2026-09-06: 1.1.0 — added Step 6 (fleet branch cleanup + root final sync + final state table) from first-cycle lessons
- 2026-09-06: 1.0.0 — created from the first full cycle (audit-first design per
  user diligence requirement: stale sync-wave residue must never reach a remote)

## Dependencies
- Composes with `sync`; follows `upgrade-project`; relates to `project-to-variant`
- Runtime companion: `scripts/resync-audit.ts`

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-06 | - | active | First live cycle as shakedown | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/project-resync/SKILL.md`
- [x] Frontmatter valid; scope: common; l2_propagate: false
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
- [x] Safety rules encoded (audit-before-push, snapshot-before-discard, no gate bypass)
