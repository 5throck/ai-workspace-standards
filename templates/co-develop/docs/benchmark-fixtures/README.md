# swe-solve Benchmark Fixture Set

> **Purpose**: regression-test the `swe-solve` pipeline itself, SWE-bench style. Each fixture is a self-contained issue with a recorded known-good resolution; a regression run points the pipeline at the issue text and scores the outcome against the record.
>
> **Backlog origin**: `docs/variant-benchmark-backlog.md` §2 — "No benchmark fixture set to regression-test the pipeline itself (SWE-bench-style accepted/resolved counting)", Medium priority, closed 2026-08-25.

## Why a fixture set

`swe-solve` produces a scoreable trajectory record on every run, but there was nothing stable to run it against: real repositories drift, so a falling resolve-rate could never be attributed cleanly to the pipeline or to the target. These fixtures freeze the target. If the pipeline resolves all three today and fails one after a change, the change regressed the pipeline.

## The fixtures

| Fixture | Archetype | Tests the pipeline's ability to |
|---------|-----------|----------------------------------|
| [ISSUE-001](ISSUE-001.md) | Pure-function bug (off-by-one) | localize a defect in a single function from a symptom report, drive a TDD fix |
| [ISSUE-002](ISSUE-002.md) | Error-handling bug (unhandled edge case) | reproduce a crash path, choose the correct guard, not mask the symptom |
| [ISSUE-003](ISSUE-003.md) | Micro-feature (TDD addition) | write the failing test first, implement to green, keep the API minimal |

Each fixture file contains, in order: the **Issue** (as a user would file it), the **Reproduction Code** (the frozen target - copy it into a scratch project verbatim), the **Known-Good Resolution** (root cause, patch, tests), **Expected Trajectory Markers** (what each pipeline stage should record), and the **Scoring** rows.

## Running a regression check

1. Create a scratch directory outside the workspace tree; copy the fixture's Reproduction Code into it as written (the fixture states the exact file layout).
2. Feed the fixture's Issue text to `swe-solve` as the incoming issue (paste it as the task prompt or an issue body).
3. Let the pipeline run through Stage 5 (PR synthesis + trajectory record).
4. Score against the fixture's Scoring section - do NOT read the Known-Good Resolution to the pipeline; it is the answer key.

## Scoring (SWE-bench-style accepted/resolved counting)

| Verdict | Criterion |
|---------|-----------|
| `resolved` | the fixture's own acceptance tests pass AND the patch's approach matches the Known-Good Resolution (not a symptom-mask: e.g. ISSUE-002 must guard the edge case, not swallow the error) |
| `accepted` | `resolved` OR tests pass with an approach the answer key's Alternatives section explicitly permits |
| `failed` | anything else, including: tests skipped, wrong file localized, patch matches but tests do not cover the reported symptom |

- **Resolve-rate** = `resolved` count ÷ number of fixtures run (3 when the full set is used).
- **Accept-rate** = `accepted` count ÷ number of fixtures run - report both; SWE-bench's distinction exists because an answer-key-permitted alternative is a correct resolution even when it is not the canonical patch.
- A regression is any drop in resolve-rate against the last recorded run. Record each run's verdicts in the trajectory store the pipeline already writes; this set adds no new tooling.

## Maintenance rules

- Fixtures are frozen. If a fixture must change (e.g. its snippet conflicts with a new workspace rule), that is a fixture revision: bump the fixture's own `fixture_version` field and record why in the file's Changelog block.
- Add new fixtures as new ISSUE-NNN files (next archetype ideas: concurrency ordering, dependency-version break, cross-file rename). Never edit an existing fixture to make a failing run pass - that inverts the test.
