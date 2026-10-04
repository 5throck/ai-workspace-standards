# Dependency-Audit Manifest-Skip — Design

- **Date**: 2026-10-05
- **Status**: implemented
- **Spec id**: `2026-10-05-dependency-audit-manifest-skip-design`
- **Ticket**: T-20261004-029 (urgent)
- **Owner**: automation-engineer scope, implemented by the 03:00 governance-ticket runner
- **Related**: `scripts/dependency-audit.ts` (+ L1 mirror), `templates/common/.github/workflows/ci.yml` (fleet CI, read-only here), `2026-10-03-dependency-audit-waiver-design.md` (predecessor), co-safety repo PR #197 (symptom site)

## R1 — Problem

The v0.12.0 template delivery (workspace PR #1413) shipped the hardened
dependency-audit gate (v1.0.0, T-20261003-011) to the fleet. Docs-only
projects with no npm dependencies — co-safety is the live case: no root
package.json, no declared deps — now fail the CI `dependency-audit` job:
`bun audit --json` exits 1 with `error: No package.json was found` on stderr
and empty stdout, which the gate's infrastructure guard treats as a loud
failure. co-safety's PR #197 went red on exactly this; `main` only stayed
green because the pre-v0.12.0 inline severity grep tolerated the same input.

A gate that hard-fails "there is nothing to audit" is a false positive: the
gate's purpose is auditing *declared npm dependencies*, and an absent
manifest proves there are none.

## R2 — Decision

Add a deterministic manifest-skip to `scripts/dependency-audit.ts` (1.0.0 →
1.1.0, L0 + byte-identical L1 mirror): after argument parsing and before
running `bun audit`, if `package.json` does not exist at the repo root (the
gate's working directory, same cwd `bun audit` itself would use), print
`[SKIP] no package.json at repo root — no declared npm dependencies to
audit; gate not applicable (passing with notice)` and exit 0.

Properties:

1. **Pre-flight, not stderr-matching.** The skip decision is a filesystem
   check, not a parse of bun's human error text — deterministic, testable,
   and immune to bun message rewording. The empty-stdout infrastructure
   guard keeps its full force for repos that *do* have a manifest.
2. **Not a bypass.** A repo with a root package.json takes the old path
   unchanged (waiver channel, severity gate, fail-closed guards all intact).
   Only the truly inapplicable case skips, and it skips loudly in the log.
3. **Same release vehicle as the break.** The fix lands at L0/L1; the next
   template auto-release (v0.12.1-lineage) delivers it fleet-wide, after
   which co-safety's upgrade is re-run (follow-up, outside this checkout —
   the co-safety repo is not cloned here).

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| Treat `No package.json was found` in stderr as a skip | Couples the gate to bun's error-copy wording; a registry outage with similar stderr could be misread as skip. The filesystem check is the causal test. |
| Relax the CI job to `|| true` / continue-on-error | Disarms the gate for real findings in every project; the fix belongs in the tool, not the workflow (which this batch must not modify per runner safety rules). |
| Require every docs-only project to add an empty package.json | Pushes the workaround to eight fleet repos forever instead of one fix at the source; empty manifests also invite accidental dependency declarations. |

## R4 — Verification

- `bun test tests/unit/dependency-audit.test.ts` — 36 pass, including two new
  spawn-based tests: bare temp repo exits 0 with the `[SKIP]` notice;
  repo with a package.json never prints `[SKIP]`.
- L0 ↔ L1 mirror identity test stays green (`cp`-synced).
- Full gates (`audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`,
  `bun test`) run at PR landing.
