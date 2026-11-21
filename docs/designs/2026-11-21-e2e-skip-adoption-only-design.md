# Nightly Scaffold E2E: skip adoption-only variants in the all-variants loop — design

- **Spec ID**: 2026-11-21-e2e-skip-adoption-only-design
- **Status**: Implemented (2026-11-21)
- **Ticket**: T-20261121-005
- **Date**: 2026-11-21
- **Scope**: L0 (`scripts/test-new-project.ts` v1.12.0 → v1.13.0, all-variants mode block only). No L1 payload — the script is workspace-root-only (not in the propagation manifest); no template or delivered surface changes.

## 1. Problem and evidence

The Nightly Scaffold E2E (`--all-variants` mode of `scripts/test-new-project.ts`) enumerates
every `templates/co-*` variant and runs the single-variant harness on each. Since the
co-utility promotion (U-20261119-002, QuickDL doctrine), that set includes an
**adoption-only** variant: `templates/co-utility/variant.json` carries
`"consumption": "adoption-only"`, and `new-project.ts` correctly refuses to scaffold it
("Variant 'co-utility' is adoption-only (variant.json consumption: adoption-only) —
new-project cannot scaffold it"). The harness counted that correct refusal as a variant
failure: nightly run 44885736677 (2026-11-21) reports **15/16 passed, FAILED: co-utility**,
exit 1. The 2026-11-20 run passed only because co-utility did not exist yet — the failure
is a harness-accounting defect, not a scaffold defect.

## 2. Decisions

1. **Skip, don't special-case the failure**: the loop reads each variant's
   `variant.json` `consumption` field **before** invoking new-project. A variant with
   `consumption === "adoption-only"` is skipped entirely — no project directory is
   created, no scaffold run, no spawn. This treats the refusal as expected-by-design
   (which it is: `upgrade-project`/`adopt-project` are the curated path for
   adoption-only variants, per DEC-20261121-02 and the PR #2137 docs) rather than
   pattern-matching new-project's error text after the fact, which would couple the
   harness to a refusal message and still waste a full failed scaffold run.
2. **Accounting**: skipped variants are counted in a dedicated list. The summary line
   becomes `N passed, M skipped (adoption-only)` (e.g. `15 passed, 1 skipped
   (adoption-only)`) plus a `SKIPPED (adoption-only): <names>` line naming the skipped
   variants — names stay visible so a future wrong-flag promotion is diagnosable from
   the nightly log alone. **Exit code stays 0 when only skips occur** (a skip is not a
   failure); any real variant failure still exits 1 with the existing `FAILED:` line.
3. **Missing/broken variant.json is not a skip**: if `variant.json` is absent or
   unparseable for a variant, the field read resolves to `undefined` and the variant is
   treated as scaffoldable — current behavior, no skip. A silently-corrupt manifest must
   surface as a real scaffold failure, not as an unexplained skip.
4. **Field name pinned to the observed source of truth**: `consumption` (string value
   `adoption-only`) read directly from `templates/<variant>/variant.json` — the same
   field new-project.ts itself consults; no new manifest surface is introduced.
   Strict string equality; future consumption values (e.g. `scaffoldable`) keep the
   default scaffold path until explicitly handled.

## 3. Alternatives considered

- **Filter the variant list upstream** (drop adoption-only variants at enumeration):
  hides them from the mode's variant count and header line entirely; rejected — the
  header should keep reporting the full template set, and the skip must be visible in
  the summary to catch accounting drift.
- **Treat a "cannot scaffold adoption-only" refusal as pass**: still runs (and
  half-executes) a scaffold that is guaranteed to be refused, and couples the harness
  to new-project's stderr text. Rejected.

## 4. Test and verification plan

- No pre-existing unit test pins the all-variants loop (verified: `tests/unit/` has
  `new-project-platform-subset` / `new-project-rollback` for the scaffold engine, none
  for this harness mode); verification is the real E2E invocation:
  `bun scripts/test-new-project.ts AutoSkip --all-variants` → co-utility prints
  `skipped (adoption-only: co-utility)`, summary reads `15 passed, 1 skipped
  (adoption-only)`, exit 0.
- Battery: `bun run test:unit`, `bun run verify:scripts` (harness changed → drift
  check), `bun scripts/audit.ts`.
- Post-merge: the next Nightly Scaffold E2E run should pass with co-utility skipped.
