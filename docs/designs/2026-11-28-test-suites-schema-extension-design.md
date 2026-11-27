# Design: test-suites.json schema extension — `sequential` and `timeout` on declared suites

- **Spec id**: 2026-11-28-test-suites-schema-extension
- **Date**: 2026-11-28
- **Ticket**: T-20261128-002 (approval authority: owner standing instruction "process all tickets" — status `approved` recorded at registration)
- **Status**: approved
- **Affected**: `scripts/test-runner.ts` v1.23.0 → v1.24.0 (+ byte-identical twin `templates/common/scripts/test-runner.ts`), `tests/unit/test-runner-declared-flags.test.ts` (new)
- **Supersession note**: Projects/co-newbiz carries a LOCAL patch on its delivered `scripts/test-runner.ts` that hardcodes a built-in `visual` suite (`{ name: "visual", pattern: "*.test.ts", timeout: 900000, dir: "tests/e2e-visual", ext: ".test.ts", sequential: true }` — patch predates test-suites.json, v1.13.0-era runner with no manifest parsing). This design makes the same use case expressible through the official, project-owned manifest, so adopting the current delivered test-runner supersedes that local patch. co-newbiz adopts by upgrading its delivered test-runner in the next upgrade wave and declaring the suite in its own `test-suites.json`; the local patch is then evicted as unsupported standing state (ADR-0097), not ported.

## 1. Problem

Declared `bun-test` suites in `test-suites.json` cannot express two things fleet projects need:

1. **Sequential file execution.** `addDeclared` hardcodes `sequential: false` for `bun-test` suites (only the built-in `scripts` suite can be sequential, via its built-in definition). A visual e2e suite where every member boots its own Next.js server + browser (~66s walk per member) races itself under the default parallel dispatch — port collisions, resource contention, and cross-member flake.
2. **A wall other than 120000ms.** The per-file kill budget is hardcoded at the bun-test default 120000. co-newbiz's stage-visual-smoke members legitimately run up to 900s.

The `command`-type workaround is lossy: test counts report `-1`, the whole suite gets one 300s process wall, and no per-file budgets compose.

## 2. Schema extension

Two new OPTIONAL keys on a declared suite (any type), unknown keys remain rejected:

```json
{
  "version": 1,
  "include": [],
  "suites": [
    {
      "name": "visual",
      "type": "bun-test",
      "dirs": ["tests/e2e-visual"],
      "sequential": true,
      "timeout": 900000
    }
  ],
  "quarantine": []
}
```

- **`sequential`** (boolean, default `false`): run the suite's files one at a time, in sorted order, instead of the parallel pool.
  - Valid **only on `bun-test` suites**. A `sequential` key on a `command` or `workspace` suite is a VALIDATION ERROR, not a silent no-op: those types always run one target at a time by construction (`sequential: true` is hardcoded in their steps), so declaring the flag there is a config smell — fail loudly per the FC4 spirit.
- **`timeout`** (positive integer, milliseconds, no default change): the kill budget the runner applies to each target of the suite.
  - `bun-test`: the per-file kill budget default (replaces the hardcoded `120000` when present).
  - `command` / `workspace`: the single-process kill budget (replaces the hardcoded `300000` when present).

### 2.1 Semantic precision: what "suite wall" means here

This runner has NEVER had an aggregate suite wall: a suite's `timeout` (built-in `timeout` field, `FILE_TIME_BUDGETS.suite`, and now the declared `timeout` key alike) is the kill timer applied **to each file/process of the suite individually** (e.g. the "120s unit-suite wall" in v1.11.0 lore killed the admin-console FILE at 120000ms). The declared `timeout` key follows that established semantics exactly: it is a per-target wall, not a sum wall. An aggregate wall would be a different mechanism (and would need its own interaction rules with per-file budgets); it is out of scope. Aggregate walls in CI remain the job-level `timeout-minutes`. For co-newbiz this is exactly the need: "stage-visual-smoke 900s walls" = each visual test file may run up to 900s → `timeout: 900000`.

### 2.2 Sequential execution semantics (stop-vs-continue choice)

When `sequential: true`, the runner dispatches the suite through the existing sequential path of `executeFileStep` (concurrency 1, sorted order, one child `bun test` process per file at a time).

**Choice: failures CONTINUE — the suite runs every file and reports all results, failing once at the end.** Reasoning: co-newbiz's use case is visual-diff reporting — one broken page must not hide the other pages' diffs; a stop-on-first-failure sequential suite would degrade into the flaky single-signal behavior the parallel pool already has. Continue-and-report maximizes diagnostic value per (expensive) run and is exactly what the existing sequential branch already does for the built-in `scripts` suite; no new stop semantics are introduced. `--parallel` CLI still overrides for manual runs (unchanged behavior).

No new execution machinery is required: `executeFileStep` already implements per-file child processes, ordered dispatch, continue-and-report aggregation, per-file verdict lines, and quarantine handling; the extension only plumbs the flag into the declared-suite step.

### 2.3 FILE_TIME_BUDGETS composition

Composes unchanged — resolution order per file (in `executeFileStep.resolveBudgets`):

1. Explicit `--timeout` CLI flag → both suite and test slots (unchanged, wins over everything).
2. `FILE_TIME_BUDGETS[basename(file)]` row → per-file suite/test override (project-local table; a variant like co-newbiz maintains its own rows in its own delivered copy's table).
3. Declared suite `timeout` → suite slot for files without a row (NEW; was hardcoded 120000).
4. Hardcoded defaults → bun-test 120000 / command+workspace 300000 (unchanged fallbacks).

The bun per-test ceiling slot (`test`) keeps `DEFAULT_TEST_TIMEOUT_MS` (15000) unless a budget row sets it — the declared `timeout` does not touch per-test ceilings. So a declared visual suite at 900000 with one engine-heavy member needing a higher per-test ceiling adds one `FILE_TIME_BUDGETS` row for that basename; nothing else changes.

### 2.4 Validation rules

Added to `validateTestSuitesManifest` (errors keep the existing `test-suites.json: suite "<name>": ...` shape):

- `sequential` present but not a boolean → `"sequential" must be a boolean`.
- `timeout` present but not an integer > 0 → `"timeout" must be a positive integer (milliseconds)`.
- `sequential` present on a non-`bun-test` suite → `"sequential" applies to "bun-test" suites only (... always run one target at a time)`.
- `SUITE_KEYS` grows to `["name", "type", "dirs", "command", "os", "sequential", "timeout"]`; every other key is still rejected (unknown-key rule unchanged).
- **Backward compatibility**: both fields optional; a manifest without them parses and validates byte-identically to v1.23.0 (golden-compared in the unit tests). Defaults preserve today's behavior exactly: bun-test declared suites run parallel with 120000 walls; command/workspace stay sequential with 300000 walls.

## 3. Acceptance criteria

1. co-newbiz's visual suite is expressible exactly as the §2 example (validated in the unit tests, including the 900000 value) and behaves correctly against a fixture: files run in order, a failing file does not stop the rest, and the declared wall kills an overrunning file (`Test timed out after <timeout>ms`). The real 900s run is NOT required — short fixture times prove the same mechanics.
2. All pre-extension manifest shapes validate and parse identically (golden compare against pinned v1.23.0 results).
3. Unit tests cover: schema validation (valid / invalid types / unknown key / sequential-on-command), sequential execution order with continue-and-report, timeout enforcement, budget composition, backward-compat golden.
4. `bun test tests/unit` green, typecheck clean, audit + lifecycle-sync-audit clean, registry rows + lifecycle record + VERSION_MANIFEST updated, twin byte-identical.

## 4. Test plan

New file `tests/unit/test-runner-declared-flags.test.ts`, following the harness patterns of `test-runner-manifest.test.ts` (tmp fixtures + spawning the runner):

- **Validation**: valid sequential+timeout entry (co-newbiz shape, 900000); `sequential: "yes"` → boolean error; `timeout: 0 / -1 / 1.5 / "900000"` → positive-integer error; `sequential` on `command` → type-gate error; `shell` unknown key still rejected; unknown key `wall` rejected.
- **Sequential order + continue-and-report**: fixture suite, 3 files each appending to a shared log then (file 2) failing; assert log order a→b→c, all 3 ran (`files=3 files_failed=1 result=fail`), and both pass lines and the failure block are printed.
- **Timeout enforcement**: declared suite `timeout: 1500`, one file sleeping 10s → killed with `Test timed out after 1500ms` in the failure block, `files_failed=1`.
- **Budget composition**: a `FILE_TIME_BUDGETS` basename row overrides the declared suite wall downward for one file (assert its kill message cites the row's budget, not the suite's) — verified via the same spawn harness; and the sibling file without a row is killed at the declared wall.
- **Backward-compat golden**: every manifest shape from the existing suite (design example, minimal, command, workspace, quarantine, opt-out) → `validateTestSuitesManifest` output exactly `[]` and `parseTestSuitesManifest` manifest fields exactly as pinned; unknown keys still rejected with the same message; declared bun-test suite without new fields still runs parallel with a 120000 wall (behavioral: two slow-ish files complete, no order guarantee asserted, no sequential marker in output).

## 5. Implementation sketch

- `DeclaredSuite` interface: `sequential?: boolean; timeout?: number`.
- `SUITE_KEYS` += `"sequential"`, `"timeout"`.
- `validateTestSuitesManifest`: §2.4 rules after the existing per-suite checks.
- `addDeclared`: command branch `timeout: s.timeout ?? 300000`; workspace branch `timeout: s.timeout ?? 300000`; bun-test branch passes `{ timeout: s.timeout ?? 120000, sequential: Boolean(s.sequential) }` as the `fileStep` extra (the mechanism `fileStep` already exposes for built-ins).
- Header changelog v1.24.0 entry citing this spec; registry rows, lifecycle record, VERSION_MANIFEST regenerated in the same change set.
