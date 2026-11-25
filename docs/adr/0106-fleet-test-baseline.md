---
status: Accepted
date: 2026-11-25
author: automation-engineer
lang: ko
lang_reason: proper-noun
---

# ADR-0106: Fleet Test Baseline — One Fail-Closed Test Entry Point and a Declared-Only OS Matrix

## Context

The owner asked for one shared test script with separately runnable parts, for projects
whose CI runs no tests to run tests, for local and CI runs to execute the same selection,
and for fleet CI to support the three-OS matrix root CI already runs (design
`2026-11-24-fleet-test-baseline-design` §1, R1–R5; approval in DEC-20261125-01).

Four defects stood in the way, each verified on 2026-11-24:

1. The template `unit-tests` job gated on a `test:unit` script in `package.json`
   (a `Detect test:unit script` step plus two `if:` conditions). Five members have no
   such script, so the job was skipped and CI ran nothing.
2. Even where the job ran, it ran one suite, `unit`. Eight members have no `tests/unit`,
   so the runner discovered zero files and exited 0 — the job passed with zero tests.
   The three delivered common tests belong to no suite, so no CI job ran them.
3. CI, `dev-sync` and `scripts/battery.ts` each chose their own command: CI ran
   `test:unit`, dev-sync step 3.95 ran `test`, battery ran the project `test` script or a
   bare `bun test`. A local pass predicted nothing about CI.
4. Every fleet job ran on `ubuntu-latest`, and no member had an OS matrix.

**CI executed zero tests in 10 of 17 members** (three skipped, seven zero-test runs).
`U-20261122-001` reported the fail-open behaviour as a defect and asked for fail-closed;
it was closed `fixed` by a WARN-only change (runner v1.17.3) whose message cites a ticket
about a different subject, so the behaviour never actually changed. The battery had drifted
the other way: in 14 members its first command resolved to `bun run audit`, which is the
**documentation** audit, so those members ran no dependency audit at all while the CI
`Dependency Audit` job ran the waiver-aware wrapper `scripts/dependency-audit.ts`.

## Decision

**1. Empty suites fail closed; absent built-ins stay neutral.** `test-runner.ts` v1.19.0
gains `all` and `common`. `all` runs the baseline `common` (flat `*.test.ts` directly in
`scripts/tests`), then `unit` when `tests/unit` exists, then the built-in suites named in
the project's `test-suites.json` `include`, then the project's declared suites. These
exceptions are fatal, each exiting 1 with `result=no-tests`:

- FC1 a zero baseline, in `common` alone or inside `all` — and inside `all` the run stops
  before any other suite starts;
- FC2 a declared suite, or a built-in suite listed in `include`, that resolves to zero
  targets;
- FC3 a baseline whose parsed test total is zero;
- FC4 an invalid `test-suites.json`, for every entry point;
- FC5 a baseline file carrying an OS tag (the baseline is OS-independent by definition).

A built-in **specialized** suite (`unit`, `integration`, `scenarios`, `scripts`) invoked
directly keeps its v1.18.0 verdict: absent directory, a notice, exit 0. That asymmetry is
deliberate — it keeps the v1.19.0 template delivery neutral for the aliases existing fleet
members already carry. The sanctioned opt-out is a recorded `optOut` block
(`reason`, `ticket`, `review`) in `test-suites.json`, which prints `result=opt-out`; the
repository variable `CI_SKIP_DEFAULT_UNIT_TESTS` survives as an emergency switch only.

**2. One entry point, one selection, local and CI parity.** `all` is the command used by
CI, by the fleet `package.json` aliases (`test` and `test:unit` → `all`, `test:common` →
`common`) and by `battery.ts`. `dev-sync` is unchanged (its steps 3.95 and 4.85 call
`bun run test` and `bun run test:unit`, which now resolve to the same entry point). The
selection is a single definition: the suite table in `scripts/test-runner.ts`, the
project's `test-suites.json`, and OS tags in file names. The parity claim is about
**predictability** — a local pass on the same commit and platform now executes the set CI
executes on that platform, so fewer CI runs are spent discovering a red suite — not about
CI running less than local. Every run ends with exactly one `TEST-RUN-SUMMARY` line; the
exit code remains the verdict, the line is evidence.

**3. OS applicability is declared, and the matrix derives from it.** A test declares an
OS dependency with a suffix before `.test.ts` (`<name>.win32.test.ts`,
`.darwin.test.ts`, `.linux.test.ts` — the `process.platform` values); no tag means
OS-independent. A declared suite may carry an `os` key. `--os <platform>` evaluates
another platform's selection, `--os-scope independent|specific|both` selects the part
(default `both`), and `--plan-os` prints the non-linux platforms that have an OS-specific
target (`["win32"]`). Fleet CI runs the OS-independent part **once** on ubuntu and adds a
`unit-tests-os` leg only when `--plan-os` is not `[]`; the job-level `if:` is evaluated
before a runner starts, so an undeclared OS costs nothing. Root CI keeps its full
three-OS matrix. In-file `test.skipIf` stays valid for individual tests.

**4. Exceptions are recorded, never silent.** `test-suites.json` is extend-only and
project-owned — the template does not deliver it. Quarantine requires `path`, `ticket`,
`reason` and an `expires` date at most 60 days out; the target still runs, its failure is
printed in full and counted in `quarantined_failed`, and it does not fail the run. An
expired entry is not honored. No member receives an opt-out or an OS declaration at
rollout. `battery.ts` v1.1.0 runs the CI command set: `bun scripts/test-runner.ts all`, the
dependency audit through `scripts/dependency-audit.ts` when that file exists (the same
wrapper, waivers and stale-waiver guard as the CI job) and the raw `bun audit` only when it
does not, plus the documentation audit as its own command.

## Consequences

- Ten members that executed zero tests now execute the three delivered common tests at
  minimum (12 in co-abap, 4 in co-security); the five "job skipped" members get a job that
  runs. A newly unskipped job can go red on its first run — the rollout is canary-first
  (co-architect), fix forward, and the template job is never reverted.
- The battery now applies a real dependency gate to the fleet. co-price stays red until
  its high-severity advisory is fixed or review-waived; a waiver's version-drift guard
  reads local `node_modules`, so a stale local install can fail a waiver CI passes.
- One new template job and a workflow-level concurrency block mean
  `scripts/lib/ci-workflow-merge.ts` v1.1.0 reserves `unit-tests-os` and accepts a
  `concurrency` top-level key; a project copy written by a merge must not be rejected on
  the next merge.
- `templates/common/.github/workflows/ci.yml` and the co-abap overlay carry both job
  bodies; the eight template files changed are listed in design §4.10 and were approved on
  2026-11-25 (DEC-20261125-01).
- Root CI is unaffected: root has no `scripts/tests/`, so `common` and `all` are not root
  entry points and no root alias changes. `dev-sync`, `audit` and
  `docs/protected-paths.json` are untouched.
- Quarantine can rot into a permanent exemption; the ticket requirement, the 60-day cap
  and the per-run count are the guard. The first entry is the two co-deck files
  (T-20261124-016, 30 days).
- Fleet-repository CI execution could not be verified live: private repositories are
  billing-walled (T-20261123-007, T-20261124-014). The evidence is the root pull request's
  own three-OS CI plus contained battery runs in the affected projects.

## References

- Design: `docs/designs/2026-11-24-fleet-test-baseline-design.md`; approval
  `docs/decisions/DEC-20261125-01.md`.
- Related: ADR-0094 (template-owned CI jobs), ADR-0105 (protected paths and the fleet
  carve-out that carries the `ci.yml` delivery), ADR-0036 (TypeScript scripts, versioned
  by `@version`), ADR-0074 (Design Gate), ADR-0078 (agent-mediated work),
  design `2026-11-15-windows-ci-test-speedup-design` (the per-file reporting invariant
  this change preserves).
- Provenance: `U-20261122-001` (fail-open reported as a defect, closed `fixed` by a
  WARN-only change that never changed the behaviour).
