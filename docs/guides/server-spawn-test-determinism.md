# Server-Spawning Test Determinism

From co-learning's flaky order-test post-mortem (T-20261007-020; source:
Projects/co-learning PR #13 D1, `tests/works-admin-api.test.mjs`, prior art
`run-pilot.mjs`). A test that boots a real HTTP server inherits every
environment hazard; this bundle removes them.

## The bundle

1. **Free-port scan with a retry cap.** Bind port 0 (or scan upward) and give
   the chosen port to the server; on bind failure, retry with the next port,
   capped (a stuck port must fail loudly, not spin).
2. **Identity guard.** Before driving the server, probe a status endpoint and
   refuse to continue if the response matches a PREVIOUS run's state — a
   leftover server from an earlier test run on the same port poisons every
   assertion after it (the co-learning flake: a fixed port + an orphaned
   mutated server absorbed cross-run state).
3. **HTTP readiness poll instead of a fixed sleep.** Poll a readiness endpoint
   until 200 (bounded); `setTimeout(2000)` is both slow and non-deterministic
   on loaded runners.
4. **`process.on(exit)` cleanup.** Kill the child and remove temp files on
   every exit path — an orphaned server is the root cause of hazard 2.
5. **Derive expected state from the seed.** Assert against the state the seed
   data implies, never hardcoded strings from a prior run's output.

## Discovery-naming debt

The runner's glob only picks up `*.test.*` — co-learning's
`works-admin-api-test.mjs` was invisible to `bun test` and never ran in CI.
Name test files `*.test.mjs`/`*.test.ts`, and verify the CI runner's glob
matches the naming convention.

## Residual hazard

`tests/harness-assessment-flow.test.mjs:16` still hardcodes port 8891 — the
pattern should be applied there too (flagged in T-20261007-020).
