# Design: script-registry provenance normalization (fossil L0 stamps, fleet tool + upgrade hook)

- **Spec ID**: 2026-10-07-registry-provenance-normalization
- **Date**: 2026-10-07
- **Status**: implemented
- **Scope**: `scripts/normalize-registry-provenance.ts` (new L0 tool), `scripts/upgrade-project.ts` v1.66.0, L0 `scripts/SCRIPTS.md`

## Problem

`lifecycle-sync-audit` Check A surfaced a co-deck row reading `co-deck/lib/theme-builder.ts | L0 | … | common |`, inviting the question: *theme-builder is an L2 (variant-template) script — why does the registry say L0?*

Investigation (2026-10-07 fleet inspection):

- On 2026-07-02 the workspace L0/L1 registries still listed variant scripts; a sync from L1 (workspace PR #361) carried those rows into project registries.
- The workspace later restructured: variant scripts moved to `templates/co-*/scripts/` and the true L0/L1 registries dropped all variant rows (0 rows today at L0 and L1 for co-deck). Project registries never received that pruning — fossil rows kept `source=L0 | layer=common`.
- Harm was latent (row versions matched the frozen project files, so Check A stayed silent) until the theme-builder template reconciliation made one row visible.

Fleet dry-run across all 16 `Projects/*` registries: co-deck 60, co-safety 33, co-consult 9, co-architect 6 (over-stamped L2 for now-project-local files), co-game 3, co-price 2, co-design 1, co-abap 1; co-newbiz (~57 rows) uses a nonstandard row format needing separate review; co-develop, co-export, co-learning, co-security, co-work clean. All 14 `templates/co-*` variant templates are clean — none ships a root-level scripts registry.

## Decision

**Relabel, not prune** — `verify-scripts` Check 1 requires a registry row per script file and the rows carry real version data; only the provenance columns lie.

New L0 tool `scripts/normalize-registry-provenance.ts` (ADR-0054 error handling; idempotent; `--dry` / `--root` / `--strict`). Truth rules (fleet conventions already in use — co-architect `L2 | L2-only`, co-abap `L3 | L3`):

1. Script exists in `templates/common/scripts/` → leave untouched (L0/L0+L1 provenance is correct).
2. Variant-overlay path (`co-<variant>/...`) whose file exists in `templates/<variant>/scripts/` → `source=L2, layer=L2-only`.
3. File exists only in the project → `source=L3, layer=L3`.
4. File exists nowhere → reported as ghost; no auto-edit (`--strict` fails on ghosts).

**Recurrence prevention**: `upgrade-project.ts` v1.66.0 gains a POST-UPGRADE PROVENANCE NORMALIZE pass (after the scripts-snapshot regeneration, before Summary) that runs the normalizer against the project registry — non-fatal, dry-run aware, same contract as the neighboring regeneration blocks. Future template deliveries can no longer leave stale stamps behind: every upgrade reconciles provenance.

## Alternatives considered

- **Prune variant rows and rely on variant registries** — rejected: Check 1 would immediately fail (unregistered scripts); teaching it a variant-registry fallback is a core-tool change to L0 `verify-scripts.ts` with fleet-wide blast radius, disproportionate to a metadata fix.
- **Check-A-side detection only** (warn on provenance contradiction) — useful signal, but it would nag on every sync without fixing anything; the upgrade hook fixes the root cause and the tool remains available for one-shot fleet remediation.
- **One-off hand edits** — rejected: 113 rows across 8 projects is exactly the shape of work that drifts back; the hook keeps it convergent.

## Consequences

- Registry provenance reads truthfully; Check A semantics unchanged (it keys on file↔row version, not provenance).
- New scaffolds are immune (they inherit the clean L1 registry); existing projects converge via the next upgrade or a one-shot run.
- co-newbiz needs a format review before the tool can touch it (its rows use a nonstandard source value and column shape); deliberately left untouched.

## Verification

- L0 `verify-scripts --verify` — 220 registered scripts, 0 warnings; `typecheck` — 0 errors (baseline 0).
- Tool dry-runs match the manual survey exactly on every project (co-safety 33, co-consult 9, co-architect 6, co-game 3, co-price 2, co-design 1, co-abap 1; 0 ghosts fleet-wide).
- co-deck applied run: 60 rows relabeled (55 → `L2|L2-only`, 5 → `L3|L3`), second run reports 0 (idempotent), project gates green (landed in co-deck PR #168).
- `upgrade-project.ts --dry-run` prints the new pass under `[DRY RUN]` without writing.
