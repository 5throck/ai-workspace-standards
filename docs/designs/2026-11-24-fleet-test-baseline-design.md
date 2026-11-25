# Design: Fleet Test Baseline (common entry point, fail-closed discovery, declared suites, local/CI parity, OS matrix)

- **Spec id**: `2026-11-24-fleet-test-baseline-design`
- **Date**: 2026-11-24
- **Status**: approved (owner approval 2026-11-25, recorded in DEC-20261125-01)
- **Author**: architect dispatch (PM Row 0, Design Gate, ADR-0074)
- **Source**: PM dispatch brief 2026-11-24 (owner requests 1-5, relayed in English). Requests 3 and 4 arrived mid-task. Request 5 and the document-impact ruling followed. The battery audit amendment came from tonight's fleet merges.
- **Related**: designs `2026-10-01-ci-template-unit-test-job-design` and `2026-11-15-windows-ci-test-speedup-design` (both implemented), ADR-0036, ADR-0061, ADR-0074, ADR-0094, ADR-0105, DEC-20261120-01, DEC-20261107-01, U-20261122-001, T-20261123-007, T-20261124-003, T-20261124-010
- **Cut**: root `main` `e989ee748`. Fleet facts are from local checkouts on 2026-11-24 (not fetched).

## 1. Problem

The owner asked for five things (paraphrased from the PM brief):
- R1. Build one test script the fleet shares. Make the specialized parts runnable separately.
- R2. Projects whose CI runs no tests must run tests. This part is urgent.
- R3. Local tests and CI tests should be the same. That should reduce CI test time.
- R4. Split tests into an OS-independent part and an OS-specific part. Test them separately.
- R5. Fleet project CI should support the three-OS matrix (ubuntu, windows, macos), as root CI does. Cost is a first-class constraint: private repositories and a billing outage (F9).

Four defects cause R2: the template job gates on a package.json script name (five members lack `test:unit` and the job is skipped); the job runs one suite, `unit`, and eight members have no `tests/unit` (zero files, exit 0); the three delivered common tests belong to no suite; CI, dev-sync and battery each choose their own command.

**Spec home: NEW.** The 2026-10-01 spec governs how `ci.yml` is delivered. Its two amendments fixed delivery defects. This design changes what the job executes and adds runner, manifest and battery behavior. The earlier spec stays untouched.

## 2. Goals and Non-goals

Goals:
- G1. One fleet entry point runs in CI in every member. It always covers the delivered common tests. It fails when zero tests are discovered. An opt-out is explicit and recorded.
- G2. Specialized suites run separately under declared names, with one selection shared by CI, dev-sync and battery. Every run ends with one summary line.
- G3. Every member that executes zero tests today executes tests after rollout.
- G4. A local run and a CI run use one command and one selection. Tests declare OS applicability.
- G5. Fleet CI supports the three-OS matrix. The OS-independent part runs once. An OS leg exists only for declared OS-specific tests. The per-file reporting invariant of design 2026-11-15 is preserved.

Non-goals:
- N1. No change to `scripts/dev-sync.ts`, `scripts/audit.ts` or `docs/protected-paths.json`.
- N2. No change to root CI or to root package.json aliases. Root already runs the matrix. Root has no `scripts/tests/` directory, so `common` and `all` are not root entry points.
- N3. No template-level or variant-level delivery of `test-suites.json`. No runner selection below file level. In-file `test.skipIf` stays valid.
- N4. No new standing fleet-audit script. `co-abap-plugin` is excluded from the fleet (DEC-20261107-01) and out of scope.

## 3. Current state

Evidence classes: **V** = verified today by scan, run or document read. **P** = stated by the PM (brief). **U** = unverified.

| # | Fact | Class |
|---|---|---|
| F1 | Root and template `scripts/test-runner.ts` are byte-identical at v1.18.0. Suites: `unit` (`tests/unit`), `integration` (`tests`, top level), `scenarios`, `scripts` (L0 E2E). Discovery is flat. | V |
| F2 | An absent suite directory or a zero match prints "No tests found" and exits 0. U-20261122-001 reported this as a defect and asked for fail-closed. It was closed `fixed` by a WARN-only change (v1.17.3, commit `24b48d02b`). That WARN cites T-20261122-003. The governance ticket with that id covers another subject. | V |
| F3 | The template `unit-tests` job runs `bun run test:unit` only when `package.json` has `test:unit`. The repository variable `CI_SKIP_DEFAULT_UNIT_TESTS` can skip the whole job. | V |
| F4 | Every fleet CI job runs on `ubuntu-latest`. No member has an OS matrix. Root CI runs `test` and `test:unit` on ubuntu, windows and macos. Root run 43705458736: unit step 361s on windows, 41s on ubuntu. The ten slowest files are untagged engine-spawn tests. | V, P |
| F5 | Root has no `scripts/tests/` directory. `scripts/battery.ts` v1.0.0 is root-only and a protected path. It runs the project `test` script, or `bun test`. dev-sync step 3.95 runs `bun run test` and only warns. Step 4.85 runs `bun run test:unit` and blocks on a staged version bump. Hook stage is U. | V |
| F6 | The three common tests and their traced imports use only `bun:test` and `node:*`. Two spawned targets were not traced (U). The three files are present in every `co-*` checkout. | V |
| F7 | The four `co-game/projects/*` directories and `co-security/services/assessment-service` have a `package.json` with a `test` script and a lockfile. `vitest run` and `bun test` exit 1 on zero matches (probed). | V |
| F8 | Four members have a PROJECT-JOBS region in `ci.yml`: co-newbiz, co-price, co-utility, co-work. Local `ci.yml` equals the template only in co-architect, co-deck, co-learning and co-security. | V |
| F9 | Billing. T-20261123-007 is `done` and records that billing recovered on 2026-11-23. The dispatch brief says fleet runs currently fail at startup (U). All fleet repositories except co-abap are private (P). | V, P, U |
| F10 | Audit commands diverge. The first battery command is `bun run audit` when the project defines `audit`, else the raw `bun audit`. In 14 members `audit` is `bun scripts/audit.ts`, the documentation audit, which runs no dependency audit. The battery therefore runs no dependency audit in those members. The CI `Dependency Audit` job runs the template-delivered wrapper `scripts/dependency-audit.ts`, present in all 17 members. The wrapper fails on high or critical findings and reports low and moderate ones. It fails closed on empty or unparseable output. It honors waivers in `.github/dependency-waivers.toml` with a mandatory revisit-by date. Expired, stale and drifted waivers fail. A repository without a root `package.json` skips with exit 0. co-price has no `audit` script. There the raw command exits 1 with 11 advisories (1 high, 10 moderate). The wrapper also exits 1 there: 1 high finding, not waived. That raw exit blocked the one-file mirror PR co-price #188 on 2026-11-24. | V (run on co-price `main` `13a5cf6`); #188 is P |

Per-project state. CI run logs were not inspected. Classification rests on committed workflow text, `package.json` scripts, directory layout and the runner's code path. `skipped` = no `test:unit`. `0-run` = the job runs `test-runner unit`, finds zero files, exits 0. `runs N` = the job executes N files. Windows and macos have no CI job in every row.

| Project | Test files by location | `unit-tests` today | Other CI test jobs | Ubuntu CI executes | Cl. | `all` on linux after rollout |
|---|---|---|---|---|---|---|
| co-abap | `scripts/tests` 12 | runs (`bun test scripts`) | none | 12 files | V | baseline 12, aliases |
| co-architect | `scripts/tests` 3 | skipped | none | zero | V | baseline 3 (canary) |
| co-consult | `scripts/tests` 3 | 0-run | none | zero | P | baseline 3 |
| co-deck | `scripts/co-deck` 30, `scripts/helpers` 1, `scripts/tests` 3 | skipped | none | zero | V, failures P | baseline 3, `deck` (2 files quarantined) |
| co-design | `tests/unit` 2, `tests` 1, `scripts/tests` 3 | runs 2 | none | 2 files | V | baseline, `unit`, `integration` |
| co-develop | `tests/unit` 1, `scripts/tests` 3 | runs 1 | none | 1 file | V | baseline, `unit` |
| co-export | `scripts/tests` 3 | 0-run | none | zero | P | baseline 3 |
| co-game | `projects/pacman` 11, `projects/bubble-bobble` 8, `projects/donkey-kong` 3, `projects/portal` 2, `tests` 3, `scripts/tests` 3 | 0-run | none | zero | V | baseline 3, `games` |
| co-hr | `scripts/tests` 3 | 0-run | none | zero | V, P | baseline 3 |
| co-learning | `tests` 5, `scripts/tests` 3 | 0-run | none | zero | V (run) | baseline 3, `integration` 5 |
| co-newbiz | `tests/unit` 548, `tests/scenarios` 15, `scripts/humanize` 5, `packages` 1, `tests/e2e-visual` 1, `scripts/tests` 3 | runs 548 | project job `test` (`test:scripts`) | 548 files | V (delivery branch) | baseline 3, `unit` 548 |
| co-news | `scripts/tests` 3 | 0-run | none | zero | P | baseline 3 |
| co-price | `src/__tests__` 22, `src/lib` 4, `scripts/tests` 3 | skipped | none (`migration-drift` is a check) | zero | V | baseline 3, `vitest` |
| co-safety | `scripts/tests` 3 | skipped (no package.json) | `safety-audit.yml` `test-suite` (5 scripts) | 5 scripts | V | baseline 3 |
| co-security | `services/assessment-service` 27, `scripts/tests` 4 | 0-run | `assessment-service.yml` `test` (`bun test`) | 27 files | V | baseline 4 |
| co-utility | `scripts/tests` 3 | skipped | project job `test` (`pytest`) | pytest | V (detached HEAD) | baseline 3 (Q5) |
| co-work | `scripts/hwp` 2, `scripts/office` 1, `scripts/tests` 3 | 0-run | `deck-openability` (validation script) | zero test files | P | baseline 3 |

**CI executes zero tests in 10 members (counted by script).** Job skipped: co-architect, co-deck, co-price. Zero-test run: co-consult, co-export, co-game, co-hr, co-learning, co-news, co-work. co-work runs one validation job, which is a check and not a test suite.

**Corrections to the dispatch brief (V).** co-abap has `test:unit` on `main` since 2026-10-10 (#194), so its job runs. co-utility has no `test:unit`; its project job runs pytest. co-safety and co-security run tests through project-owned workflows. co-game and co-learning are zero-test runs (co-learning confirmed by a local run, exit 0).

## 4. Proposed design

### 4.1 Entry points (`test-runner.ts` v1.19.0)

| Command | Runs | Zero tests |
|---|---|---|
| `all` | `common`, then `unit` when its directory exists, then built-ins listed in `include`, then declared suites | fatal |
| `common` | flat `*.test.ts` directly in `scripts/tests`. The three delivered files are its core. Project files added there run with it | fatal |
| `unit`, `integration`, `scenarios`, `scripts` | unchanged built-in suites | notice, exit 0 (unchanged) |
| `<declared>` | one suite from `test-suites.json` | fatal |

- `all` is the only entry point that CI, the dev-sync aliases and battery use. Existing flags are unchanged. New flags: `--dry-run`, `--os` and `--os-scope` (4.8), `--plan-os` (4.9). `--dry-run` prints the selection and the summary line and executes nothing.

### 4.2 Fail-closed rules

- FC1. `all` evaluates `common` first. A zero baseline, in `common` alone or inside `all`, exits 1 with `result=no-tests`. A zero baseline inside `all` stops the run before any other suite starts.
- FC2. A declared suite, or a built-in listed in `include`, resolves to zero targets. Exit 1.
- FC3. The parsed test total of the baseline equals zero. Exit 1.
- FC4. `test-suites.json` fails validation. Exit 1 for every entry point.
- FC5. A baseline file carries an OS tag. Exit 1. The baseline is OS-independent by definition.
- An absent built-in specialized suite keeps exit 0 and prints a WARN row. This keeps the v1.19.0 fleet delivery neutral for existing aliases.

### 4.3 Declared suites: `test-suites.json`

```json
{ "version": 1, "include": ["integration"],
  "suites": [ { "name": "deck", "type": "bun-test", "dirs": ["scripts/co-deck/tests", "scripts/helpers"] },
              { "name": "price", "type": "command", "command": ["bunx", "vitest", "run"] },
              { "name": "games", "type": "workspace", "dirs": ["projects/*"] } ],
  "quarantine": [ { "path": "<file or workspace dir>", "ticket": "T-...", "reason": "...", "expires": "YYYY-MM-DD" } ] }
```

- Location and validation. Project root. The project owns it. No new directories. The template does not deliver it (N3). INFERRED: the upgrade engine leaves project-only files untouched. Confirm in the canary dry run. Suite names MUST NOT shadow a built-in or `all`. Unknown keys and types are validation errors. `include` accepts built-in specialized names only.
- `bun-test`: flat `*.test.ts` in each listed directory. One process per file. Same budgets and report lines as the built-ins.
- `command`: argv array, no shell, project root as cwd. The exit code is the verdict (F7). Counts print as `-1`.
- `workspace`: each directory matching a glob that has `package.json` with a `test` script (F7). The runner runs `bun run test` there. A directory without `test` is skipped with a notice.
- Quarantine and opt-out. Quarantine: `path`, `ticket`, `reason` and `expires` are all required. `expires` is at most 60 days after the run date. The target still runs. Its failure is reported and does not fail the run. An expired entry is not honored. Opt-out: `"optOut": { "reason", "ticket", "review" }` makes `common` and `all` skip the baseline and print `result=opt-out`. No member receives an opt-out at rollout.

### 4.4 Summary line

The last stdout line of every run. One token per field:

`TEST-RUN-SUMMARY schema=1 entry=<name> os=<platform> scope=<independent|specific|both> suites=<ran>/<resolved> files=<n> files_failed=<n> tests=<n|-1> tests_failed=<n|-1> not_applicable=<n> quarantined_failed=<n|-1> result=<pass|fail|no-tests|opt-out|selected>`

- `files` counts discovered applicable files. It is exact and runner-owned. `tests` and `tests_failed` are parsed from bun's `N pass` and `N fail` rows, or from the junit XML with batching on. `-1` means unknown.
- Exit code: 0 for `pass`, `selected`, non-fatal `no-tests` and `opt-out`. Exit 1 otherwise. The exit code stays the verdict for every gate. The line is evidence (the battery v1.0.0 principle).

### 4.5 One source of truth

- Definition: the suite table in `scripts/test-runner.ts` (L0, published byte-identical), the project `test-suites.json`, and OS tags in file names.
- Callers. CI runs `bun scripts/test-runner.ts all` (4.6, 4.9). dev-sync is unchanged (N1): step 3.95 calls `bun run test`, step 4.85 calls `bun run test:unit`. battery v1.1.0 runs `all` with the project as cwd. It drops the `bun run test` and `bun test` fallbacks. A missing runner records an exit-1 row.
- battery audit commands (v1.1.0): decision (a). The dependency audit runs `bun scripts/dependency-audit.ts` when that file exists. It runs the raw `bun audit` only when the file does not exist. This is exactly what the CI `Dependency Audit` job runs (F10). Reason: the battery substitutes for CI. Option (b) would drop the gate whenever Actions cannot start. Option (c) is stricter than CI and has no waiver channel, so it blocks what CI accepts.
- Consequences of decision (a). The documentation audit becomes its own command: `bun scripts/audit.ts` when the file exists, as the CI `audit` job runs it. The `hasScript("audit")` branch is removed. Today 14 members reach the documentation audit only through that branch (F10). A waived advisory passes the battery on the same terms as CI: the same waiver file, revisit-by date, stale-waiver guard and version-drift guard. Residual: the version-drift guard reads local `node_modules`, so a stale local install can fail a waiver that CI passes. co-price is not unblocked by this change alone. Its high finding needs a fix or a reviewed waiver.
- Fleet alias standard, for every member with a root `package.json`: `test` and `test:unit` run `bun scripts/test-runner.ts all`. `test:common` runs `bun scripts/test-runner.ts common`. `test:unit` keeps its legacy name. dev-sync step 4.85 and the template `sync` skill text key on it.
- `all` MUST cover every built-in suite the old `test` script ran. List those suites in `include` (Appendix A). The runner prints a WARN when an alias differs from the standard lines.

### 4.6 Template CI job: the ubuntu leg (`unit-tests`)

- Keep the job key and the display name `Unit Tests`. Branch protection may reference them.
- Keep the job-level `if:` unchanged. The variable is an emergency switch only. The recorded opt-out is the sanctioned path.
- Remove the `Detect test:unit script` step and the two `if:` conditions that depend on it. Mirror both job bodies in `templates/co-abap/.github/workflows/ci.yml`, a full overlay of the common file (V).
- Install step: test for the root manifest in the shell, so a scripts-scoped manifest (co-safety) installs too. Use a `for` loop, so a failed nested install fails the step.

```
        if [ -f package.json ]; then bun install --frozen-lockfile; fi
        for lock in $(find . -mindepth 2 -maxdepth 4 \( -name 'bun.lock' -o -name 'bun.lockb' \) -not -path '*/node_modules/*'); do (cd "$(dirname "$lock")" && bun install --frozen-lockfile); done
        bun scripts/test-runner.ts all    # then: echo "os-legs=$(bun scripts/test-runner.ts all --plan-os)" >> "$GITHUB_OUTPUT"
```

### 4.7 Local and CI parity (request 3)

One definition, one command. The entry point is `all` for a developer, for the dev-sync steps, for battery and for CI. The selection rules are the same everywhere: baseline first, `unit` when present, `include`, declared suites, OS selection by the running platform. A local run on the same commit and OS executes the set that CI executes on that OS.

**Reading adopted.** Parity reduces CI time through fewer failed CI runs and reruns. Today the local `test` script and the CI `test:unit` script run different suites in most members. A local pass does not predict CI. Each red CI run costs a queue wait, a job run and a rerun. Parity makes a local pass predictive.

**The second reading (CI runs no more than local) is not the saving mechanism.** CI will run more than before in the members that ran zero tests. That is the goal of R2. R4 and R5 save time only where an OS leg would otherwise exist (4.9).

Residual differences. A macOS developer runs the darwin selection while fleet CI runs the linux selection; the sets are equal while no file is tagged. CI installs with `--frozen-lockfile` and has no local state. dev-sync step 3.95 only warns, and step 4.85 blocks only with a staged version bump. A local pass before push is a convention here. A blocking pre-push gate needs a dev-sync change (N1).

### 4.8 OS applicability (request 4)

- Declaration, file level: a suffix before `.test.ts`. `<name>.<os>.test.ts`, with `<os>` in `win32`, `darwin` or `linux`. These are the `process.platform` values in use. No tag means OS-independent. One tag per file. The name still ends with `.test.ts`, so plain `bun test` discovery is unchanged.
- Declaration, suite level: an optional `"os"` key on a declared suite. Built-in suites apply to every OS. In-file `test.skipIf` stays valid for individual tests inside a file.
- Selection. Default platform: `process.platform` of the running machine. Applicable set: untagged files plus files tagged with the selected platform. `--os <platform>` evaluates the selection for another platform. Use it with `--dry-run`. `--os-scope independent` runs untagged files only and keeps the baseline rules. `--os-scope specific` runs files tagged for the selected platform only. It is exempt from the baseline rules and exits 0 with `result=no-tests` when nothing applies. `--os-scope both` is the default.
- Default local run on a developer machine: `all` with scope `both` for the machine's platform. It executes the OS-independent part and the part specific to that OS. Composition A, verify everywhere: every leg runs `both`. Composition B, independent once: an ubuntu leg runs `independent`, and each OS leg runs `specific`. The fleet uses B (4.9). Root keeps A unless Q2 rules otherwise.

| Usual cause of OS specificity | How the design handles it | How a test declares it |
|---|---|---|
| Path separators | Tests that build paths with `join` stay independent. A test that asserts a platform-specific separator takes a tag. | `<name>.win32.test.ts` |
| Line endings | `templates/common/.gitattributes` pins `eol=lf` for `*.sh` and `*.html` (V). Other files follow the runner's git defaults. | A tag, when the test depends on raw CRLF or LF |
| Shell differences | The runner spawns argv arrays without a shell. A test that needs `sh` has no tag in the fleet: it runs on ubuntu only (4.9). At root it uses in-file `skipIf`. | No tag in the fleet. `skipIf` at root |
| Dependency installs per OS | Each leg runs the same install under bash. A dependency that fails on an OS turns that declared leg red. A test that needs an OS-only tool takes a tag. | A tag, or `"os"` on a declared suite |

Reporting invariant (design 2026-11-15, Goal 2): preserved, not replaced. Every dispatched file keeps its per-file pass/fail line (`path (NNms)` with its prefix), its verdict and its duration. The BUDGET-HEADROOM WARN, the QA gate and the version-bump gate read them unchanged. The suite exit code reflects any dispatched failure. An excluded file is not dispatched. It prints one line prefixed `  - ` and never a pass or fail mark. OS selection runs at discovery, before `orderLongestFirst`. Batching is unaffected.

### 4.9 Fleet CI matrix and cost (request 5)

| Job | Runs-on | Exists when | Runs |
|---|---|---|---|
| `unit-tests` (`Unit Tests`) | `ubuntu-latest` | always, unless opted out or the emergency variable is set | `all`: the OS-independent part plus linux-tagged tests. Then `--plan-os` |
| `unit-tests-os` (`Unit Tests (os)`) | `matrix.os` | `unit-tests` succeeded and its `os-legs` output is not `[]` | `all --os-scope specific` |

- The invariant "run only when there is something to run" holds per leg. The ubuntu leg always has the baseline. An OS leg exists only when the repository declares OS-specific tests, by file tag or by a suite `"os"` key. `--plan-os` prints a JSON array of the platforms (other than linux) that have at least one OS-specific target in the `all` selection, for example `["win32"]`. The ubuntu job writes it to the `os-legs` output.
- `unit-tests-os` carries `if: ${{ needs.unit-tests.outputs.os-legs != '[]' && vars.CI_SKIP_DEFAULT_UNIT_TESTS != 'true' }}`. A job-level `if` is evaluated before a runner starts, so an undeclared OS costs nothing. The matrix is `os: ${{ fromJSON(needs.unit-tests.outputs.os-legs) }}` with `fail-fast: false`. `runs-on` is `${{ matrix.os == 'win32' && 'windows-latest' || 'macos-latest' }}`. `needs` is an allowed context for `jobs.<job_id>.if` and for `jobs.<job_id>.strategy` (V) [Source: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts].
- The OS legs run after a green ubuntu leg, so a red baseline spends nothing on them. Their timeout is 15 minutes. Their install and test steps set `shell: bash`. U: confirm the install loop under Git Bash in the first windows leg.
- Concurrency, workflow level: `group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}` and `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Superseded PR runs are cancelled. Pushes to `main` are never cancelled.
- Path filters: none justified. `check-structure.test.ts` validates documentation structure, so a docs-only change can change the baseline result. The windows leg runs only `.win32.test.ts` files and win32 suites. Never tag a file to dodge slowness. Slow independent tests use `FILE_TIME_BUDGETS`. `unit-tests-os` joins `CI_RESERVED_JOBS` in `scripts/lib/ci-workflow-merge.ts`.

Cost model, computed by script. Rerun it with canary timings. Rates per minute from GitHub's billing page, fetched 2026-11-24 [Source: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions]: Linux 0.006 USD, Windows 0.010 USD, macOS 0.062 USD, which is 1.67 and 10.33 times the Linux rate. Standard runners in public repositories are free. ASSUMED and unmeasured: leg overhead (checkout and setup-bun) 30 s ubuntu, 60 s windows, 40 s macos; install 20 s; the three baseline files 5 s; an OS-specific set of 60 s. ASSUMED (U): each job bills at least one whole minute. The page shows rates, not minute multipliers for included minutes (U).

| Scenario, one workflow run | Billed minutes before | after | Added USD | Added Linux-minute equivalents |
|---|---|---|---|---|
| a. Typical member, job runs today (co-consult class) | 1 | 1 | 0.000 | 0.00 |
| b. Typical member, job skipped today (co-architect class) | 0 | 1 | 0.006 | 1.00 |
| c. a plus a declared win32 leg (windows job 140 s) | 1 | 4 | 0.030 | 5.00 |
| d. a plus a declared darwin leg (macos job 120 s) | 1 | 3 | 0.124 | 20.67 |
| e. Heaviest member (co-newbiz, 548 unit files): 5 s added to an existing ubuntu job | n | n or n+1 | 0.000 or 0.006 | 0.00 or 1.00 |

Row e depends on where the job falls in the rounding grid. Its duration is U. One push causes one run. A merged PR causes two (the PR push and the merge push). Cancellation saves the unfinished part of superseded PR runs; it is not quantified here. No member declares OS-specific tests in v1, so rows c and d are zero for the fleet today.

### 4.10 Files to change

| Scope | File | Action | Content |
|---|---|---|---|
| root, PR-A | `scripts/test-runner.ts` | modify | v1.19.0: 4.1-4.5, 4.8, and `--plan-os` |
| root, PR-A | `scripts/battery.ts` | modify | v1.1.0: 4.5. Protected path: human merge |
| root, PR-A | `scripts/lib/ci-workflow-merge.ts` | modify | add `unit-tests-os` to `CI_RESERVED_JOBS` |
| root, PR-A | `tests/unit/test-runner-{baseline,manifest,os,summary}.test.ts`, `battery.test.ts`, `ci-workflow-merge.test.ts`; `scripts/SCRIPTS.md`, `scripts/README.md`, `docs/adr/0106-fleet-test-baseline.md` | create, modify | sections 9 and 12 |
| template, PR-B1 | `templates/common/.github/workflows/ci.yml`, `templates/common/scripts/test-runner.ts`, `templates/CHANGELOG.md` | modify | 4.6, 4.9. Byte-identical mirror of v1.19.0. Minor bump after 0.30.0 |
| template, PR-B2 | `templates/co-abap/.github/workflows/ci.yml` | modify | same job bodies |
| template, PR-B3 | `templates/common/package.json`, `templates/common/scripts/SCRIPTS.md`, `scripts/README.md`, `scripts/README_ko.md` | modify | alias lines, registry rows, testing section |
| fleet | `package.json`, `test-suites.json` per Appendix A | modify, create | 4.3, 4.5 |

- Template files: three in PR-B1, one in PR-B2, four in PR-B3. `agents/architect.md` requires explicit owner confirmation above three per change. The set touches eight template files in total and is flagged for that confirmation.
- Approved template file set (2026-11-25, DEC-20261125-01). The owner approved the change to eight template files, as listed in the table above: `templates/common/.github/workflows/ci.yml`, `templates/common/scripts/test-runner.ts`, `templates/CHANGELOG.md`, `templates/co-abap/.github/workflows/ci.yml`, `templates/common/package.json`, `templates/common/scripts/SCRIPTS.md`, `templates/common/scripts/README.md`, `templates/common/scripts/README_ko.md`. The table writes the last two without the `templates/common/` prefix.
- Governance. ADR-0036: script changes are TypeScript under `scripts/`, versioned by the `@version` header and its changelog block. ADR-0074: this document is the Row 0 design. The PM registers it. ADR-0094: template-owned jobs stay authoritative. Cross-platform: the runner spawns argv arrays without a shell, and tag values follow `process.platform`. No Windows-specific code is needed.

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | None. No instruction file changes. | N/A |
| Antigravity (GEMINI.md) | None. Justified: the change touches no platform instruction file or dispatch rule. | N/A |
| templates/common | Propagation required. | 4.10, PR-B1 and PR-B3 |

## 5. Alternatives considered

| Option | Con | Decision |
|---|---|---|
| Keep `bun run test:unit` and add the script to five manifests. Fail closed for every named suite | package.json is project-owned, so drift returns and the zero-test run stays. The strict runner alone turns CI red in eight members before their aliases change | Rejected |
| Manifest only. Manifest inside `package.json`. Recursive `common` discovery | Every member needs a file, or the baseline can be narrowed. co-safety has no package.json. Recursion may pick fixtures | Rejected |
| Separate CI job for the baseline. Repository variable as the only opt-out. Non-gating suites. Quarantine skips the target | Two summary lines and a double checkout. Not recorded in the repository. Drifts back to green-with-red. Hides the failure | Rejected |
| OS tag by path, by frontmatter, or `skipIf` only | Path breaks flat discovery. Frontmatter needs a parser. `skipIf` cannot be selected or counted by the runner | Rejected. Suffix for files, `skipIf` for tests |
| Static three-OS matrix. Separate plan job. Repository variable selects the OS legs. Path filters that exclude docs | Two costlier legs with nothing to run. One more billed job per push. A variable drifts from the tags. `check-structure.test.ts` validates docs | Rejected. Legs derive from repository content |
| battery keeps the raw `bun audit` (option c). battery drops the dependency audit (option b) | Option c is stricter than CI and has no waiver channel. Option b loses the gate whenever Actions cannot start | Rejected. Decision (a), 4.5 |

## 6. Rollout (canary first)

Precondition: tonight's template 0.30.0 merges are confirmed on every member. Two template versions in flight would break the carve-out byte test.

1. Owner approves this design. The PM records the gate-moment decision and registers the spec. PR-A lands: root only, no template change, held for human merge (`scripts/battery.ts`). Root CI is unaffected.
2. Pre-delivery check, read-only: run the root copy of the new runner with each member as cwd. `all --dry-run` must show `files>=3` and `result=selected`. `all --plan-os` must print `[]`. Then `all`. A red member gets a fix or a recorded quarantine before its delivery.
3. PR-B1, PR-B2, PR-B3 (4.10).
4. Canary: co-architect. It has only the three common tests, no aliases to preserve, and a `ci.yml` equal to the template. Evidence is the battery ledger when Actions cannot start (F9), and the `Unit Tests` run on `main` when they can.
5. Matrix proof: one throwaway PR in co-abap, a public repository, with a trivial `.win32.test.ts` file and a trivial `.darwin.test.ts` file. Observe one windows leg and one macos leg. Close without merge. It follows co-abap's overlay delivery (PR-B2).
6. Wave 1, no declaration: co-consult, co-export, co-hr, co-news, co-work. Alias PR, then wave delivery.
7. Wave 2, with a declaration (Appendix A): co-learning, co-game, co-price, co-deck. co-deck goes last, after T-20261124-010 is adjudicated. Declare `deck` now. Quarantine `gen-slides-pdf-render.test.ts` and `theme-visual-regression.test.ts` with a ticket and a 30-day expiry. Every other file gates immediately. The 12 failures stay visible in every summary line.
8. Wave 3, CI already runs tests: co-abap, co-design, co-develop (alias parity), co-safety (baseline only), co-security (baseline only). Human merges: co-newbiz, co-price, co-utility and co-work have a PROJECT-JOBS region (F8), so their `ci.yml` blob is never byte-identical to the template.

Protected path. `.github/workflows/**` is hold-for-human in any root-repo PR that touches it. This design edits only `templates/**/.github/workflows/ci.yml`. INFERRED: the anchored pattern does not match those paths, so PR-B1 to PR-B3 are not held by it. In fleet repositories the delivered `ci.yml` reaches `main` only through the `fleetParityCarveOut`. The runner may merge an upgrade-wave PR that passed the STEP I gates, whose blob is byte-identical to the template source at the delivered version, and for which `verify-delivered-versions` exits 0. The four members with a PROJECT-JOBS region cannot satisfy the byte test. The carve-out needs no membership change.

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| K1 | A newly unskipped job goes red on its first run (baseline on ubuntu, frozen install) | Rollout step 2. Canary. Fix forward. Never revert the template job |
| K2 | The repository variable silences a red job | Unsanctioned. AC10 compares job state with recorded opt-outs |
| K3 | Quarantine becomes permanent | Ticket required. Expiry at most 60 days. Counted in every summary line |
| K4 | Aliases drift. An OS-tag rename orphans a `FILE_TIME_BUDGETS` key. A parsed test count is wrong | Runner WARN in every `all` run. Keys are basename-keyed (test plan item 4). The count never decides the exit code alone |
| K5 | CI minutes. Billing fails again, so fleet legs cannot be verified live | No OS leg without a declaration. Cancellation. Cost table (4.9). Battery evidence. AC10 keeps the CI evidence pending under T-20261123-007 |
| K6 | `cancel-in-progress` leaves superseded PR runs `cancelled`. The runner prompt has no handling for it (grep, V). Local checkouts are stale | Read the head commit's run only. Add one prompt clause if needed, and re-ratify `prompts.manifest.json`. Re-run rollout step 2 before each wave |
| K7 | Members now get a real dependency gate in the battery (F10). co-price stays red until its high finding is fixed or waived | Fix or review-waive, as in CI. A stale local `node_modules` failure is an environment gap: the runner never installs |

## 8. Acceptance criteria

- AC1. In a member with the three delivered files, `common` prints `files=3` and `result=pass`. Exit 0.
- AC2. Zero tests is fatal with `result=no-tests` and exit 1: `common` or `all` without `scripts/tests/*.test.ts`; a declared suite or a built-in in `include` with zero targets; a baseline whose parsed test total is 0. An invalid `test-suites.json` exits 1 for every entry point.
- AC3. On the root `unit` suite, v1.19.0 prints the same per-file lines and verdicts as v1.18.0. Only the summary line is added.
- AC4. Every run ends with exactly one `TEST-RUN-SUMMARY` line. One regex extracts every field.
- AC5. A `.win32.test.ts` file is not dispatched on linux or darwin. It is counted in `not_applicable`. `--os win32 --dry-run` lists it.
- AC6. The template `unit-tests` job has no detect step and runs `all`. Job key and name are unchanged. `unit-tests-os` is reserved. Root and template runner blobs are identical. The `ci-template` and `ci-workflow-merge` tests pass.
- AC7. With no OS-specific target, `--plan-os` prints `[]` and `unit-tests-os` is skipped before a runner starts. With one `.win32.test.ts` file, `--plan-os` prints `["win32"]` and one windows leg runs that file only.
- AC8. The canary records its job durations. For a member without OS-specific tests, the added billed minutes match row a or b of the cost table.
- AC9. battery runs `bun scripts/test-runner.ts all`. A project without the runner records an exit-1 row.
- AC10. Per member, the latest `Unit Tests` run on `main` shows `files>=3` and `result=pass`. While Actions cannot start, the battery ledger records `all` exit 0 with `files>=3`, and the CI evidence stays pending under T-20261123-007. Exceptions are recorded only: co-utility (Q5) and co-newbiz pending human merge. No other member has a skipped job without a recorded opt-out.
- AC11. In co-deck, every non-quarantined `deck` file gates. The two quarantined files report `quarantined_failed=12`. SCRIPTS.md and README show the new versions. `bun scripts/audit.ts` passes. ADR-0106 is merged.
- AC12. The battery's dependency command is `bun scripts/dependency-audit.ts` when that file exists, and `bun audit` otherwise. The documentation audit is a separate command. Each command writes one ledger row.

## 9. Test plan

Root unit tests, one file per concern (4.10). Each case uses a fixture project and a spawned CLI, and asserts exit code and summary line. Fleet: rollout step 2 per member, then AC10.
1. Baseline. `common` discovers flat `*.test.ts` in `scripts/tests`. `all` runs in the stated order. Built-in suites are unchanged.
2. Fail-closed. One case per rule FC1 to FC5. An absent built-in suite keeps exit 0 and prints `result=no-tests`. An invalid manifest exits 1.
3. Manifest and quarantine. Unknown key, unknown type, shadowing name, zero-match declaration, bad `include`. Missing quarantine field, expiry past 60 days, expired entry not honored.
4. Summary, OS and battery. Counts on a passing and a failing fixture. `-1` for a `command` suite. Tag parsing, selection per platform, both scopes, `--plan-os`. Every `FILE_TIME_BUDGETS` key still names a dispatched file on linux. Ledger row with the summary. Exit-1 row when the runner is missing.
5. Workflow text. The new job bodies, the concurrency block, the `unit-tests-os` expressions and `shell: bash`. `unit-tests-os` is reserved. No test pins the detect step today (grep, V).
6. battery audit commands. Three fixture projects: wrapper present (the wrapper runs and the raw command never does), wrapper absent (the raw command runs), and `scripts/audit.ts` present (the documentation audit runs as its own command). No member carries an effective waiver today (F10), so the waived-advisory path is covered by the wrapper's own tests.

## 10. Accessibility

Not applicable: non-UI change.

## 11. Preview verification

Not applicable.

## 12. Document impact

| Layer | Documents and records this change touches |
|---|---|
| Workspace root (L0) | This design document is the single source of truth. Status flip and amendments follow approval. `docs/specs/registry.json` gets the entry for `2026-11-24-fleet-test-baseline-design`. The gate-moment decision record follows ADR-0061, with the PM memory log. One new ADR (below). `scripts/SCRIPTS.md` and `scripts/README.md` rows for `test-runner.ts`, `battery.ts` and `lib/ci-workflow-merge.ts`. Root `CHANGELOG.md` and the generated `docs/VERSION_MANIFEST.md`. Nightly-runner documents, because battery semantics change: both runner snapshots under `docs/governance/automation-prompts/` mention battery (grep, V). Their STEP E wording was not read (U). `prompts.manifest.json` needs re-ratification if a prompt text changes. |
| Templates (L1) | Delivered artifacts only: the runner mirror `templates/common/scripts/test-runner.ts`, the `package.json` scripts in `templates/common/package.json`, the workflows `templates/common/.github/workflows/ci.yml` and `templates/co-abap/.github/workflows/ci.yml`, the registry rows in `templates/common/scripts/SCRIPTS.md` and `README.md` with the `README_ko.md` twin, and `templates/CHANGELOG.md`. Plus one short template-managed testing section in `templates/common/scripts/README.md` and its twin: entry points, alias lines, how to declare a suite, OS tags. No separate design document at L1. |
| Projects (L3) | No design documents of their own. Each member receives the delivery and lands its alias lines and its `test-suites.json`. Variant-specific suites are listed in Appendix A of this document, not in per-project documents. co-safety: no dependencies are installed locally (T-20261124-003). It declares nothing and runs the baseline with the CI install. co-utility: adoption-only. No wave delivers to it (Q5). |

**ADR: exactly one, at the workspace root (PM ruling).** Working title: "ADR-0106 Fleet test baseline: one fail-closed test entry point and a declared-only OS matrix". Next free number is 0106 (highest existing: 0105, V). Format: Context, Decision, Consequences. It relates to ADR-0094 (template-owned CI jobs), ADR-0105 (protected paths and the carve-out that carries the delivery), ADR-0036 and ADR-0074. It amends none by number.

Provenance, for the ADR author (V). Local records do not show a decision in favor of fail-open. U-20261122-001 reported the fail-open as a defect and asked for fail-closed. It was closed `fixed` by the WARN-only change in F2. The runner message cites T-20261122-003, a ticket about another subject. The ADR should cite U-20261122-001. Candidate ruling points:
1. Empty suites. `common`, `all` and declared suites fail closed. An absent built-in suite stays exit 0.
2. Fleet standard. One entry point, `all`. Local and CI parity. Standard alias lines. battery runs it.
3. OS applicability and matrix. Suffix tags. Fleet CI runs the independent part once on ubuntu. An OS leg exists only for declared OS-specific tests. Root keeps its full matrix.
4. Exceptions. `test-suites.json` is extend-only. Opt-out is recorded. Quarantine is ticketed and time-boxed.

U, for the PM. Alias and manifest PRs in member repositories may meet the project-side spec-check. Project design documents are ruled out above. The implementer confirms how the check is satisfied. The "unit-pinned" registry wording that U-20261122-001 flagged is out of scope here.

## 13. Open questions for the owner

1. Request 3 reading. Adopt "fewer failed CI runs and reruns" as the claimed saving? Recommended default: yes. Measure failed `Unit Tests` runs per member, 14 days before and after.
2. Root OS composition. A (verify everywhere) or B (independent once)? Recommended default: A. The ten slowest windows files are untagged engine tests (F4). B would remove them from the windows leg, where they fail most often (`FILE_TIME_BUDGETS`). Choose B only from a `--dry-run --os win32` listing.
3. co-deck. Quarantine the two failing files for 30 days, or fix first? Recommended default: quarantine under a ticket.
   - 2026-11-25: approved on the recommended default, "quarantine under a ticket": a ticketed 30-day quarantine of the two failing files, with T-20261124-016 as the fix ticket. The co-deck delivery of 2026-11-25 (co-deck PR #260) already reduced the failing tests from 12 to 3.
4. Matrix proof. Run the throwaway PR in co-abap (rollout step 5)? Recommended default: yes, after its overlay delivery. No fleet member declares an OS-specific test in v1, so this is the only live evidence for an OS leg, and a public repository makes it free.
5. co-utility and co-security. Adopt the template job in co-utility in v1? Declare the co-security service suite? Recommended default: defer both. co-utility's pytest job and co-security's `assessment-service.yml` already run tests.

## Appendix A. Declared suites per member (L3)

| Member | Declaration | Aliases | `all` on linux |
|---|---|---|---|
| co-deck | `deck`: `bun-test`, dirs `scripts/co-deck/tests` (30 files) and `scripts/helpers` (1 file). Quarantine: the two failing files, 30-day expiry | yes | baseline, then `deck` |
| co-price | `price`: `command`, `bunx vitest run` (`src/__tests__` 22, `src/lib` 4) | yes | baseline, then `price` |
| co-game | `games`: `workspace`, dirs `projects/*` | yes | baseline, then the four nested `test` scripts |
| co-learning | `include`: `integration` | yes | baseline, then `integration` (5 files) |
| co-design | `include`: `integration`, for parity with its current `test` script | yes | baseline, `unit`, `integration` |
| co-abap, co-architect, co-consult, co-develop, co-export, co-hr, co-news, co-security, co-work | none | yes | baseline only |
| co-safety | none | not applicable (no package.json) | baseline. The CI install covers `scripts/` dependencies |
| co-newbiz | none in v1 | yes | baseline, then `unit`. Human merge |
| co-utility | none | deferred | adoption-only (Q5) |
| All members | No OS-specific test declared in v1. No opt-out granted. | | |
