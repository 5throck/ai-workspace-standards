# Project-Resync Skill — Lifecycle Record

## Metadata
- **Skill**: project-resync
- **Status**: active
- **Version**: 1.11.0
- **Created**: 2026-09-06
- **Last Updated**: 2026-11-23 (Version 1.10.0 → 1.11.0, spec docs/designs/2026-11-23-skill-graph-observability-design.md §5.4: Step 2e sub-step 6 also consumes the fleet-report agent/edge diffs and the ≥3-project convergence rollup (fleet-report v2.6.0 Agents tab) — three new report-only candidate classes: new fleet-side agent↔skill relationships absent from root, agents newly referencing root skills, divergent relationship splits; the new classes file `learning:`-prefixed `kind: manual` tickets whose title body MUST contain the literal token `skill-graph` (compound title keeps the `learning:` extraction routing, the fleet-report ticket scan, and analytics-triage greppability all functional); pre-existing sub-step-6 candidates keep the bare `skill-graph:` prefix; report-only / human-judged promotion / no-silence preserved verbatim; step numbers 2d/2e unchanged — the nightly runner reads live numbering (STEP G RULES, runner-v5.snapshot.txt:39), so deployment needs zero runner prompt or prompts.manifest.json change. Previous: 2026-11-20 1.10.0, runner-hardening PR-5: Step 0 verdict legend aligned to resync-audit.ts v1.11.0 — adds the RETENTION-PRUNE (auto-discard-safe memory-retention prune, corroborated by the de-linked memory/MEMORY.md index; spec docs/designs/2026-11-18-resync-audit-retention-prune-design.md), TOMBSTONE-UNCONFIRMED, and TOMBSTONE-VIOLATION rows; the script's report legend is named authoritative over the SKILL.md table when wording diverges. The merge-delivered PRESUME-STALE routing from v1.9.0/T-20261117-010 was already present. Previous: 2026-11-18 1.9.0: Step 0 verdict table updated for resync-audit.ts v1.10.0 merge-delivery routing (T-20261117-010, spec docs/designs/2026-11-18-resync-audit-merge-delivery-routing-design.md) — merge-delivered paths (MERGE_MANAGED incl. DOCS_MERGE / JSON_MERGE / SCHEMA_MERGE, e.g. `.agents/mcp.json`) always route to PRESUME-STALE, never STALE-RESIDUE, even on exact template-source equality, because the wave delivers a union and the project's merge-block edits are authoritative between waves. Previous: 2026-11-07 1.8.0: fleet membership SSOT (DEC-20261107-01, spec docs/designs/2026-11-07-fleet-membership-ssot-design.md) — the project set derives ONLY via `bun scripts/fleet-list.ts --json` (`Projects/co-*` minus `docs/fleet-membership.json` exclusions; co-abap-plugin out); raw-glob fallback banned, helper/registry failure = STOP + urgent ticket. SSOT + platform mirrors hash-synced. Previous: 2026-10-27 1.7.0: Step 2 delta source widened to non-mechanical merged-window PRs; new Step 2f per-project review cadence; Step 2e learning cross-reference user directive 2026-10-27 — Step 2 delta source widened to non-mechanical merged-window PRs (session-landed work now gets the promote/stays-project judgment it previously bypassed); new Step 2f per-project review cadence (battery-always + scoped-on-landing + rotation safety net, shared ≤4-agent cap); Step 2e gains the skill-graph learning cross-reference (new-skill candidates, ≥3-project convergence and delivery-gap ticket rows); stale backport-diff "never implemented" note corrected (v1.0.2 shipped via T-20261009-003). Design: 2026-10-27-project-resync-coverage-design. Previous: 2026-10-26 1.6.2: Step 4 `--prune-removed` rationale corrected for ADR-0073 Amendment 4)

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

- 2026-11-23: 1.11.0 — Step 2e sub-step 6 extended with the fleet-report agent/edge diffs and the ≥3-project convergence rollup (fleet-report v2.6.0 Agents tab): three report-only candidate classes (new fleet-side agent↔skill relationships absent from root; agents newly referencing root skills; divergent relationship splits) filed as `learning:`-prefixed tickets whose title body must contain the token `skill-graph`; report-only/no-silence preserved; step numbers untouched (spec docs/designs/2026-11-23-skill-graph-observability-design.md §5.4)
- 2026-11-18: 1.9.0 — Step 0 verdict table updated for resync-audit.ts v1.10.0 merge-delivery routing (T-20261117-010, spec docs/designs/2026-11-18-resync-audit-merge-delivery-routing-design.md): merge-delivered paths (MERGE_MANAGED incl. DOCS_MERGE / JSON_MERGE / SCHEMA_MERGE, e.g. `.agents/mcp.json`) always route to PRESUME-STALE, never STALE-RESIDUE, even on exact template-source equality (union delivery; project merge-block edits authoritative between waves)
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
