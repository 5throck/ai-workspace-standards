# Scaffold package.json merge + standing validators + nightly surfacing — Design

- **Spec ID**: 2026-10-09-scaffold-package-merge-and-baseline-surfacing-design
- **Date**: 2026-10-09
- **Status**: implemented
- **Tickets**: T-20261009-002 (primary), T-20261009-005 follow-through (node_modules guard)
- **Origin**: 2026-10-09 daily review High-1/High-2 — nightly scaffold E2E red ×3 nights (10-06..10-08): variant `package.json` overlays clobbered the §2.5c-generated file and lost the Tier 2 scripts (`audit`, `dev-sync`, `sync-md`); introduced by #1432/#1433, invisible to every standing battery.

## Problem

1. `scripts/new-project.ts` §2 variant overlay (`copyFileSync` per file, lines ~846-867) copies `templates/<variant>/package.json` over the just-generated root `package.json`. co-consult ships no `scripts` key; co-deck ships only `test*` — both scaffolds lost the Tier 2 trio. `skills/SKILLS.md` has an overlay special-case; `package.json` does not.
2. No standing validator asserts the scaffold package contract; Test 11 lives only in the nightly E2E, whose conclusion nothing surfaces locally (the red streak went unnoticed for 3 days).
3. `upgrade-policy.ts` classifies `package.json` as PROJECT_STATE_FILES ("never template-delivered") while two variants legitimately ship it — comment contradicts reality.
4. `.gitignore`'s dir-only `node_modules/` pattern cannot match a `node_modules` symlink (7b154db3 committed one; cfa72c07 reverted). No tracked-path guard exists.

## Decisions

### D1 — Scaffold-time merge (variant wins per key)

`new-project.ts` §2 overlay gains a `package.json` special-case modeled on the `skills/SKILLS.md` one: instead of `copyFileSync`, deep-merge the variant package.json INTO the generated one — scalar keys variant-wins; object keys (`scripts`, `dependencies`, `devDependencies`, `engines`, `peerDependencies`) merge per-key (variant value wins on collision, generated keys survive otherwise). The generated file is the merge base, so the Tier 2 trio always survives. Log line documents the merge.

### D2 — Standing validator arm (validate-templates 1.53.0 → 1.54.0)

New check **VA-08 scaffold-package-contract** (L0, cheap/static):
- `templates/common/package.json` `scripts` must contain `audit`, `dev-sync`, `sync-md` (SSOT regression guard).
- Every `templates/<variant>/package.json` must parse as JSON; the simulated scaffold merge (`common ∪ variant`, variant wins per key) must contain the trio (documents the contract; catches a future variant file that would defeat the merge, e.g. via non-object `scripts`).
- Upgrade-policy comment amended to state that variants may ship package.json and scaffolds merge it; upgrade-time merge-delivery is an explicit open follow-up (out of scope here).

### D3 — Nightly conclusion surfacing (review-baseline 1.1.0 → 1.2.0)

New battery entry **#8 "nightly E2E conclusion surfacing"**: read the latest `nightly-scaffold-e2e.yml` run conclusion via `gh run list --workflow=nightly-scaffold-e2e.yml --limit 1` (JSON). Failure → the battery reports the validator as **passed-with-WARN note** carrying the failed run id/URL (surfacing must not hard-fail the local battery on a network-dependent signal — the E2E itself gates merges in CI); success → pass note "green as of <date>"; `gh` unavailable → pass note "skipped (gh unavailable)". The WARN text is the daily review's machine-visible hook.

### D4 — Tracked-path guard (audit.ts bump + L1 parity)

New audit check: `git ls-files` output containing any `node_modules` path → FAIL (with the offending paths listed). Closes the recurrence vector mechanically; complements the slash-less `.gitignore` entry landed in #1485. audit.ts is delivered — version bump + `propagate-to-templates` byte parity required.

## Test plan

- `tests/unit/new-project-package-merge.test.ts`: merge semantics (variant wins per key; generated keys survive; non-object `scripts` in variant replaced by guard), exercised via the extracted pure helper.
- `tests/unit/validate-templates-package-contract.test.ts`: induced fixtures — variant package.json missing trio passes (merge covers), common package.json missing trio fails, unparseable variant package.json fails.
- review-baseline + audit arms are exercised by their existing suites/manual battery run; the nightly surfacing is network-dependent and reports SKIP under `gh` unavailability (asserted in the audit test pass).

## Verification

`bun test` green; `review-baseline --quiet` exit 0 with the new entry present; `validate-templates` 0 errors; E2E `--variant co-consult` + `--variant co-deck` ALL PASSED (package.json now carries 5 scripts); propagate byte-parity green; SCRIPTS.md rows cascaded (new-project.ts, validate-templates.ts, review-baseline.ts, audit.ts both sides).
