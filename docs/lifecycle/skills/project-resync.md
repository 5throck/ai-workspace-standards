# Project-Resync Skill — Lifecycle Record

## Metadata
- **Skill**: project-resync
- **Status**: active
- **Version**: 1.7.0
- **Created**: 2026-09-06
- **Last Updated**: 2026-10-27 (Version 1.6.2 → 1.7.0: user directive 2026-10-27 — Step 2 delta source widened to non-mechanical merged-window PRs (session-landed work now gets the promote/stays-project judgment it previously bypassed); new Step 2f per-project review cadence (battery-always + scoped-on-landing + rotation safety net, shared ≤4-agent cap); Step 2e gains the skill-graph learning cross-reference (new-skill candidates, ≥3-project convergence and delivery-gap ticket rows); stale backport-diff "never implemented" note corrected (v1.0.2 shipped via T-20261009-003). Design: 2026-10-27-project-resync-coverage-design. Previous: 2026-10-26 1.6.2: Step 4 `--prune-removed` rationale corrected for ADR-0073 Amendment 4)

## Description
Whole-fleet bidirectional sync cycle for Projects/co-*: provenance audit
(`scripts/resync-audit.ts` Step 0 — COMMIT/DISCARD/KEEP verdicts over
uncommitted content, never pushing unverified work), per-project GitHub sync
via each project's dev-sync (remote bootstrap for remote-less repos, private),
selective backport review into templates (5-surface method over LOCAL-WORK
plus non-mechanical merged-window PRs), per-project review cadence (Step 2f),
root /sync, upgrade-project per project, and upgrade PR landing.
Operator-level skill (workspace root); `l2_propagate: false`.

## Changelog

- 2026-10-27: 1.7.0 — Step 2 delta source widened to non-mechanical merged-window PRs; new Step 2f per-project review cadence (battery-always, scoped-on-landing, rotation safety net); Step 2e skill-graph learning cross-reference; backport-diff stale note corrected (design 2026-10-27-project-resync-coverage-design)
- 2026-10-26: 1.6.2 — Step 4 `--prune-removed` rationale corrected for ADR-0073 Amendment 4 (no engine copy delivered; delivered tree = validate-templates.ts + lib/ leaf modules; Amendments 1, 3 and 4)
- 2026-10-08: 1.6.1 — renumber Steps 2e/2f → 2d/2e; Output Format ledger + learning bullets (backfilled from the Metadata history — was missing from this list)
- 2026-10-07: 1.6.0 — Steps 2e (upstream request ledger) + 2f (daily learning extraction); AC-5 dry-run passed (T-20261007-007..014)
- 2026-09-23: 1.5.1 — Step 4 `--prune-removed` rationale rewrite (ADR-0073 Amendment 3)
- 2026-09-22: 1.5.0 — added Step 2c fleet echo check (grep-based sibling drift reporting, report-only per ADR-0031 Principle 5); Step 0 verdict table gains PRESUME-STALE (resync-audit.ts v1.1.0 mtime/order corroboration buffer); Step 2 documents the `scripts/backport-diff.ts` v1.0.0 support tool
- 2026-09-12: 1.3.1 — removed stale co-develop master branch exception; PR base must always be the repository default branch
- 2026-09-07: 1.2.0 — added Step 4 proof-check (commit `9d187b5a`)
- 2026-09-06: 1.1.0 — added Step 6 (fleet branch cleanup + root final sync + final state table) from first-cycle lessons
- 2026-09-06: 1.0.0 — created from the first full cycle (audit-first design per
  user diligence requirement: stale sync-wave residue must never reach a remote)

## Dependencies
- Composes with `sync` and `project-review` (Step 2f); follows `upgrade-project`; relates to `project-to-variant`
- Runtime companions: `scripts/resync-audit.ts`, `scripts/backport-diff.ts` (v1.0.2), `scripts/skill-graph-fleet-report.ts` (Phase-I snapshot input)

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
