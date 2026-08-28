# Nested-Layout-Aware Skill Registry Cross-Check + context-md-schema Scope Fix

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted (hotfix follow-through to the template rollout roadmap, Phase 5) |
| Spec ID | `skillgraph` (amendment; same spec family as 2026-08-28-skill-graph-template-rollout-design.md) |
| Governing anchor | ADR-0060 Amendment 2; co-safety nested skill layout (CHANGELOG 2026-08-28) |
| Related | `docs/designs/2026-08-28-agpl-license-template-rollout-design.md`; roadmap Phase 5 |

## Problem

Two defects surfaced while running the Phase 5 upgrade pass across `Projects/co-*`:

1. **`audit.ts` 2.26.0's Skills registry cross-check is single-level.** Variants using the
   nested skill layout (co-safety: `skills/{daily,investigation,emergency}/…`,
   `skills/domains/{functional,industry}/<domain>/<skill>/`) fail with
   `skill directory missing SKILL.md` for every category directory — the same class of
   false positive already fixed for `validate-templates.ts` WS-06/B-09 and
   `helpers/layer-filter.ts` earlier this cycle, but missed in `audit.ts`'s own check.
   The upgrade delivered audit 2.26.0 to co-safety and immediately blocked its `/sync`.
2. **`lib/context-md-schema.ts` registry row scope said `L0` while the file ships via
   `templates/common/scripts/lib/`.** In L3 contexts `verify-scripts.ts` ignores
   L0-scoped registry rows, so every upgraded project reported
   `Unregistered script: lib/context-md-schema.ts` (reconcileScriptRegistry copied the
   wrong scope from the L0 row), and each project needed a manual row flip.

## Change Design

- **D1** — `scripts/audit.ts` 2.26.0 → 2.26.1: the Skills registry cross-check now
  treats a directory with no direct `SKILL.md` whose subtree contains one as a
  **skill category directory** (PASS as `skill category directory`), matching the
  nested layouts already shipped by co-safety (template + project). Truly empty
  directories still FAIL.
- **D2** — `scripts/SCRIPTS.md` + `templates/common/scripts/SCRIPTS.md` (manual L1
  mirror): `lib/context-md-schema.ts` scope `L0` → `L0+L1`, reflecting where the file
  actually lives and propagates. Future `reconcileScriptRegistry` calls copy the
  correct scope into projects.

## Registrations

| File | Change |
|------|--------|
| `scripts/audit.ts` | 2.26.1 — nested-layout-aware category-directory branch |
| `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md` | audit 2.26.1 row; context-md-schema scope L0+L1 |
| `templates/common/scripts/audit.ts` | L1 mirror (propagate step) |
| `docs/designs/2026-08-28-nested-skill-dir-check-design.md` | this document |

## Verification

| Check | Expected |
|-------|----------|
| `bun scripts/audit.ts` (L0) | all checks passed (flat L0 layout unaffected) |
| co-safety project audit after re-upgrade | category directories PASS; `/sync` proceeds |
| `bun scripts/validate-templates.ts` | 0 errors |
| `lifecycle-sync-audit.ts` | all pass (2.26.1 registered both tiers) |

## Out of Scope

- Backfilling `docs/lifecycle/agents/i18n-specialist.md` governance records for
  variants other than co-news (handled per-project where the validator requires them).
- co-price legacy content remediation beyond what its own gates required (done inline
  in co-price#69).

## References

- Phase 5 upgrade session log: `memory/2026-08-28.md` (2026-08-28).
- co-safety nested skill restructuring: CHANGELOG 2026-08-28 (`fix(co-safety)` entries).
