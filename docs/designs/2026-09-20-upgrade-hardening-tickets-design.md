# Upgrade Hardening — Fleet Ticket Batch (T-20260920-001/-002/-003/-004) Design

| Field | Value |
|-------|-------|
| Date | 2026-09-20 |
| Status | accepted |
| Spec ID | `upgrade-hardening-tickets` |
| Governing anchors | ADR-0073 Amendment 1 (upgrade trio L0-only); ADR-0074 (Design Gate); CONSTITUTION §6.5 |
| Related | `docs/designs/2026-08-28-project-template-backport-design.md`; tickets `tickets/governance/T-20260920-00{1,2,3,4}.yaml` |

## Problem

The 2026-09-20 fleet cycles surfaced four upgrade-pipeline defects:

1. **T-20260920-001 — delivered-script dependency gap.** The upgrader delivers
   template scripts (e.g. `scripts/helpers/pm-md-parser.ts`, imports `js-yaml`)
   but `package.json`/`bun.lock` are `PROJECT_STATE_FILES` and never delivered.
   Projects missing the dependency fail CI with `Cannot find package`
   (co-abap/co-deck; co-architect carried a stale version). The upgrade plan
   says nothing about it.
2. **T-20260920-002 — agents sync misses equal-version content drift.** The
   agents `SYNC_IF_NEWER` pass compares frontmatter `version:` only
   (`semverGt`). The 2026-09-15 `templates/common/agents/i18n-specialist.md`
   update (codex tier line) did not bump `1.0.0`, so six projects keep the
   2026-08-24 copy forever. The scripts pass solved this identical bug with
   equal-version hash reconciliation (v1.17.2).
3. **T-20260920-003 — retired-skill residue survives `--prune-removed`.** The
   2026-09-12 `validate-docs-links` retirement removed root/L1 copies but left
   46 project-side dirs (4 platform mirrors × 11 projects + `skills/` SSOT in
   co-architect/co-deck). `--prune-removed` prunes `scripts/`, `agents/`,
   `skills/` trees but never platform mirror dirs, and `skills/` prune consults
   only variant+common templates (not L0 root `skills/`).
4. **T-20260920-004 — stale variant-template skill forks.** Five variant
   template copies (co-design ×1, co-safety ×4) are old common snapshots
   re-stamped `scope: <variant>`. A blind refresh breaks `validate-templates`
   (variant copies must not reference L0-only tooling such as
   `propagate-to-templates.ts`, and preserve variant-specific frontmatter).

## Design

### D1 — Dependency guard (T-001)

New `scripts/lib/dependency-guard.ts` (L0, imported by `upgrade-project.ts`):

- `barePackageImports(code: string): Set<string>` — extracts bare specifiers
  from `from '<spec>'`, `import '<spec>'`, `require('<spec>')`; skips relative
  (`.`/`..`), `node:`, `bun:` prefixes; collapses `@scope/pkg/sub` →
  `@scope/pkg`.
- `missingDependencies(pkgDeps: Set<string>, imports: Iterable<string>): string[]`
  — sorted imports absent from deps.
- `scanDeliveredScripts(scriptsRoots: string[]): { pkg: string, importedBy: string[] }[]`
  — walks delivered-script roots (variant `scripts/` tree incl.
  `scripts/<variant>/`, `templates/common/scripts`), aggregates imports per
  package with importing files.

`upgrade-project.ts` gains a `--- DEPENDENCY GUARD ---` pass (after the scripts
sync, before branch/commit steps) that loads the project `package.json`
`dependencies` + `devDependencies`, runs the scan, and prints per missing
package:

```
  MISSING  js-yaml  (imported by scripts/helpers/pm-md-parser.ts)
  → run inside the project: bun add js-yaml
```

Report-only by design: auto-adding would require a network `bun install` and
lockfile churn inside the upgrader; the ticket explicitly allows either. The
summary line (`Dependency guard: N missing package(s)`) makes the gap loud in
both dry-run and apply plans.

### D2 — Agents equal-version drift reconciliation (T-002)

The agents pass gains the scripts pass's third branch: when `tplVer ===
projVer` and the lifecycle-stripped contents differ, log
`⚠️  DRIFT agents/<file> (content differs at same version)` and deliver via the
existing `writeAgentWithLifecycle` (project `lifecycle:` frontmatter preserved —
L3 governance records). Comparison strips the `lifecycle:` block from both
sides (`lifecyclelessText()` exported from `upgrade-policy.ts`) so the
preserved-block rewrite does not re-log DRIFT on every subsequent run. G05
local-modification warning semantics unchanged (drift is logged after it, same
as the scripts pass).

### D3 — Prune scope extension (T-003)

Two changes inside the `--prune-removed` block:

1. `skills/` prune category gains L0 root `skills/` as an upstream source, so
   root-only SSOT skills can never be pruned from projects ("absent from all
   upstream sources" rule).
2. New platform-mirror sweep: for `.claude/skills`, `.gemini/skills`,
   `.agents/skills`, `.codex/skills` — any `<name>/SKILL.md` dir whose name is
   absent from the upstream name set (root `skills/` + root platform mirrors +
   variant `skills/` + variant platform mirrors + `templates/common/skills/` +
   L1 platform mirrors) is pruned with the existing `git rm -rf` → `rmSync`
   fallback pattern and counted as `PRUNE  <mirror>/<name>/ (no upstream — retired skill)`.

Variant-owned skills stay protected: their names resolve through
`templates/<variant>/skills/` and the variant.json asset gate, both included
in the upstream set.

### D4 — Adaptation-aware variant fork refresh (T-004)

Five variant-template `SKILL.md` files refreshed from their root counterparts
with a fixed recipe (mechanical, then human-checked against
`validate-templates`):

- root body + root `version`/`last_reviewed`;
- frontmatter `scope` re-stamped to the variant;
- variant-only frontmatter preserved (`lang`, `lang_reason`, `tier`,
  `lifecycle` — co-safety translate's Korean legal exception);
- L0-only tooling references stripped from the body (root `sync` SKILL.md
  references `propagate-to-templates.ts`, which does not exist in projects);
- the Safety OS `audit_exception` note preserved where present;
- variant `skills/SKILLS.md` registry rows updated to the refreshed versions.

Deliberate forks untouched: co-safety `meeting-facilitation` 1.5.0, co-price
`i18n-audit` 2.1.0.

## Registration

| File | Change |
|------|--------|
| `scripts/lib/dependency-guard.ts` | added (L0) |
| `scripts/upgrade-project.ts` | 1.34.0 → 1.35.0: dependency-guard pass, agents drift reconciliation, prune scope extension |
| `scripts/lib/upgrade-policy.ts` | 1.8.0 → 1.9.0: `lifecyclelessText()` |
| `scripts/SCRIPTS.md` | rows updated |
| `templates/co-design/skills/accessibility-audit/SKILL.md` | refreshed 1.0.0 → 1.1.0 (scope: co-design) |
| `templates/co-safety/skills/{agent-lifecycle-manager,skill-lifecycle-manager,sync,translate}/SKILL.md` | refreshed to root versions |
| `templates/{co-design,co-safety}/skills/SKILLS.md` | rows updated |
| `tests/unit/dependency-guard.test.ts` | added |

## Verification

| Check | Expected |
|-------|----------|
| `bun test` | all pass (new dependency-guard suite) |
| `bun scripts/validate-templates.ts` | 0 errors |
| `bun scripts/typecheck.ts` | 0 new errors |
| E2E fleet upgrade | i18n-specialist delivered to the 6 stale projects (`DRIFT` → update); dependency guard section prints; prune stays 0 on the clean fleet |
| Accessibility | n/a — backend/non-UI change (ADR-0065 exemption statement) |
| Preview verification | n/a — non-UI (ADR-0070 exemption statement) |

### D3 refinement (E2E, same day)

The fleet E2E split the orphan-mirror class in two. Co-newbiz (standalone
track, 100+ project-authored skills with no upstream) would have lost 177
mirror files whose names simply never existed upstream — mirrors of
project-authored skills whose `skills/` SSOT rows were removed earlier. The
sweep now prunes a mirror only when the name has no upstream source, no
project `skills/` SSOT, AND an explicit retirement marker (root lifecycle
record retired/deprecated, or the mirror SKILL.md's own `status:`).
Project-authored orphans without a retirement decision are kept for human
review (KEEP-uncertain rule). Shipped as upgrade-project 1.36.0.

## Out of Scope

- Auto-installing dependencies during upgrade (network + lockfile churn).
- co-newbiz's forked generator 1.9.0 (separate promote-variant track).
- Root CHANGELOG of the fleet-delivery runs (logged per project).
