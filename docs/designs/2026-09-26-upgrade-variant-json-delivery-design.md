# upgrade-project 1.53.0 — Deliver `.json` Variant Config Files

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented |
| Spec ID | `upgrade-variant-json-delivery` |
| Governing anchor | ADR-0073 (engine-only scope, L0); ADR-0031 (fork model) |
| Related | `scripts/upgrade-project.ts` 1.52.0 → 1.53.0 (VARIANT SCRIPTS pass); found via the 2026-09-26 fresh-scaffold drift comparison (`Projects/e2e-co-abap` vs `Projects/co-abap`) |

## Problem

The VARIANT SCRIPTS pass (`syncVariantScripts`) delivered only `.ts`/`.mjs` files from
`templates/<variant>/scripts/<variant>/`. Variant config files — `co-abap`'s
`atc-rulepack.json` and `tsconfig.json` — are copied to projects at scaffold time (whole-dir
copy) but had **no upgrade delivery path**: post-scaffold template updates to those files never
reached any live project, and the fresh-vs-existing comparison flagged both as missing from
`Projects/co-abap` entirely.

## Change

Extend both file predicates in the VARIANT SCRIPTS pass (`syncVariantScripts` and its
`preserveVariantScripts` reporting twin) to include `.json`. Unversioned `.json` files flow
through the existing content-hash branch (NEW / UPDATE / OK by hash; local-modification CONFLICT
warning preserved), so no new comparison semantics are introduced. `SCRIPTS.md` registry sync is
untouched (`.md`, handled separately). L0-only engine change (ADR-0073).

## Verification

| Check | Expected |
|-------|----------|
| `upgrade-project Projects/co-abap --dry-run --prune-removed` | `atc-rulepack.json (hash match)` + `tsconfig.json (hash match)` listed in VARIANT SCRIPTS |
| `bun scripts/check-upgrade-coverage.ts --strict` | No violations |
| `bun scripts/test-runner.ts scripts` | 7/7 test files pass |
| `scripts/SCRIPTS.md` | upgrade-project row 1.52.0 → 1.53.0 |
