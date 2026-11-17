# new-project Lifecycle Governance Pre-check: TRACE Pollution, argv Transport, Silent Pass — Design (Row 0)

- **Spec ID**: `2026-11-17-new-project-precheck-argv-design`
- **Date**: 2026-11-17
- **Status**: proposed. Owner decisions O-1..O-6 in §8 are open. Each has a stated default. The defaults apply if the owner does not object.
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074, design only)
- **Input**: PM read-only verification (three claims, §1). No ticket ID was given. PM assigns one at dispatch.
- **Scope**: design only. This document changes no script, template, hook, test, or skill file. All file:line references were measured on `main` @ `1dee7c143`, plus the uncommitted working-tree change to `scripts/validate-templates.ts` (v1.84.0, lifecycle PR-4, design [`2026-11-17-template-lifecycle-batch-design.md`](2026-11-17-template-lifecycle-batch-design.md) Amendment 1). That change does not touch any line this design cites.
- **Related**: [`2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md`](2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md) (format precedent, `variant-common-shadow` live test), [`2026-11-15-windows-ci-test-speedup-design.md`](2026-11-15-windows-ci-test-speedup-design.md) (Windows test budget), commit `cd8a3e496` (TRACE origin), T-20260924-004 (`classifyVariantMirrorCopy`), T-20260912-019 (`main()` returns the exit code).

## 0. Summary

The `scripts/new-project.ts` lifecycle governance pre-check has never worked. It looks like it runs, but it cannot block a scaffold on macOS or Linux. On Windows it is expected to fail with a generic message. Three defects stack:

| # | Defect | Effect |
|---|--------|--------|
| D1 | `validate-templates.ts` prints 260 `TRACE` lines to stdout, even in `--json` mode. | `--json` stdout is not JSON. |
| D2 | `new-project.ts` passes the whole stdout to `validate-output.ts` as one argv element. | About 57 KB of argv. Windows limits a command line to 32,767 characters. |
| D3 | `validate-output.ts` treats a parse failure as a pass. `new-project.ts` never prints the helper's stderr. | macOS/Linux: a silent no-op. Windows: an expected `FAILED` with no cause. |

One PR fixes all three:

1. Delete the two `TRACE` lines (§3.1).
2. Stop sending JSON across argv. `new-project.ts` evaluates the JSON in-process through a pure function exported by `validate-output.ts`. The helper CLI keeps argv input and gains stdin input (§3.2).
3. Report spawn failures honestly. Make the pre-check fail-closed. Scope blocking errors to the target variant plus `common` (§3.3).

**Predicted impact of turning the pre-check on**: 0 newly blocking errors for every one of the 15 variants (§3.3.4). The validator reports 0 errors fleet-wide on the measured tree.

---

## 1. Claims checked

| # | PM claim | Finding |
|---|----------|---------|
| 1a | `validate-templates.ts:3795` and `:3805` print `TRACE mirror-check:` / `TRACE verdict:` unconditionally, also with `--json`. | **Correct.** Both are bare `console.log` calls with no `JSON_MODE` guard. The L1 copy `templates/common/scripts/validate-templates.ts` carries the same two lines at the same line numbers. |
| 1b | First introduced in `cd8a3e496`. | **Correct.** `git log -S'TRACE mirror-check'` returns only `cd8a3e496` (2026-09-25, "fix(scripts): land remaining C1-C4 detector fixes"). |
| 1c | 260 lines. stdout is about 57 KB and does not parse as JSON. | **Correct.** `--variant co-consult --json`: 894 stdout lines, 56,858 bytes, 260 `TRACE` lines. The first byte is `T`. `JSON.parse` fails with `Unexpected identifier "TRACE"`. |
| 1d | The loop ignores the `--variant` filter. | **Correct, but incomplete.** `checkVariantMirrorParity()` is called at `:8788`, outside the per-variant loop (`:8795-8822`). About 40 other checks are also fleet-wide by design (`:8769-8792`, `:8824-8846`, `:9043-9074`). The `--variant` flag only filters the per-variant loop and the checks at `:1321`, `:7996`, `:8433`. So the JSON for `--variant co-consult` also carries findings for other variants. Measured: the co-consult run includes `co-design` warnings. |
| 2a | `new-project.ts:864-897` passes `validateResult.stdout` as an argv element. `validate-output.ts` re-joins `args.slice(1)`. | **Correct.** The spawn is at `:883-887`. The re-join is at `validate-output.ts:16`. |
| 2b | On Windows the about 32K limit makes `spawnSync` fail (status `null`), reported as a generic FAILED. | **Plausible, not reproduced.** The code path is exactly as described: `:888` tests only `status !== 0`, and `null !== 0` is true. It never reads `validateCheck.error`. **Addition**: removing `TRACE` alone does **not** fix Windows. The JSON part alone is 37,087-38,356 bytes per variant, which is still above 32,767. No CI job reaches this code on Windows. The scripts E2E suite is ubuntu-only (`.github/workflows/test.yml:206`). The only Windows unit test that spawns `new-project.ts` (`tests/unit/project-target-guards.test.ts`) exits at the target guards (`new-project.ts:457-530`), long before `:864`. |
| 3a | `validate-output.ts` catches the parse failure, prints WARN, exits 0. | **Correct** (`validate-output.ts:49-55`). Reproduced: feeding the real co-consult stdout prints `WARN: Could not parse validation output: SyntaxError: JSON Parse error: Unexpected identifier "TRACE"` to stderr and exits 0. |
| 3b | `new-project.ts` never prints `validateCheck.stderr`, so the pre-check is a silent no-op on macOS/Linux. | **Correct.** The WARN goes to the discarded stderr. `:896` then prints `✅ Lifecycle governance pre-check passed`, which is false. |

**New finding (not in the PM brief)**: `validate-output.ts` filters by check-name substring only (`check.includes(domain)`, `:32-35`). It never reads `err.variant`. Once parsing works, any mandatory-domain error in **any** variant would block a scaffold of **every** variant. The substring match is also loose. `"agent"` matches `agents-md-pointer-integrity`, and `"variant"` matches almost every variant check. §3.3.3 handles the variant scope. The substring semantics stay as they are (§9).

**Side observation (out of scope)**: with `--tag`, the scaffold reads templates from the tag archive (`new-project.ts:615-646`). The pre-check still validates the working-tree templates. Filed as a follow-up in §9.

## 2. Caller and consumer inventory

Searched `scripts/`, `tests/`, `.github/`, `.githooks/`, `templates/common/scripts`, `templates/common/tests`, `docs/`, and `package.json`.

### 2.1 `scripts/helpers/validate-output.ts` (L0-only, v1.0.1, `scripts/SCRIPTS.md:180`)

| Reference | Kind | Impact |
|-----------|------|--------|
| `scripts/new-project.ts:885` | **Only runtime caller** | Changed by this design. |
| `scripts/fix-script-versions.ts:52` | Static list of files that need an `@version` header | None. The header stays. |
| `scripts/SCRIPTS.md:180` | Registry row | Version and changelog cell update. |
| `docs/adr/0001-scripts-type-column.md:91` | Type table (`library`) | None. |

No test, workflow, hook, or L1 copy uses it. A CLI backward-compatibility promise is therefore cheap. The design keeps the argv form anyway (§3.2).

### 2.2 `scripts/validate-templates.ts --json` consumers

| Consumer | How it parses stdout | Impact of deleting TRACE |
|----------|----------------------|--------------------------|
| `scripts/new-project.ts:875-879` | Via `validate-output.ts` (broken) | Fixed. |
| `tests/unit/validate-templates-variant-shadow.test.ts:114-119` | `out.slice(out.indexOf('{\n  "variantsScanned"'))`. This is a workaround for the TRACE prefix. | Still works: the index becomes 0. A follow-up may simplify it (§9). |
| `tests/unit/validate-templates-cv02.test.ts:61-65` | Substring `not.toContain(...)` | None. |
| `tests/unit/script-registry-audit.test.ts:65-75` | Plain `JSON.parse`. Uses the no-`templates/common` early return (`:8759-8767`), which never reaches the TRACE site. | None. |
| `tests/unit/validate-templates-l3-skip.test.ts:30-38` | Substring `toContain` on the early-return summary | None. |
| `.github/workflows/test.yml:115` (`bun run validate-templates`) | Human mode, not `--json` | None. The CI log loses 260 noise lines. |

### 2.3 Who depends on TRACE lines

Nobody. No test, script, or doc asserts on `TRACE mirror-check` or `TRACE verdict`. No test pins `classifyVariantMirrorCopy` (`:3871`) or the `fail-stale-orphan` verdict either. The TRACE lines were the only observability for that classifier. §4 adds a table test to replace them.

### 2.4 House conventions for large payloads

| Convention | Where | Fit |
|------------|-------|-----|
| In-process import of a pure helper | `new-project.ts` already imports about 15 helpers (`:24-46`, for example `helpers/template-utils.ts`, `helpers/scaffold-markers.ts`). | Best fit for a pure JSON filter. |
| Parent sends via `spawnSync(..., { input })` | `scripts/lib/template-vintage.ts:99-103` (`git cat-file --batch`) | Good fit for the CLI. |
| Child reads stdin with `readFileSync(0, "utf-8")` | Every hook: `scripts/hooks/gateguard-fact-force.ts:187`, `pm-dispatch-gate.ts:177`, `delete-guard.ts:510`, and others. Tests drive them with `input:` (`tests/unit/delete-guard.test.ts`). | Same. |
| Temp file handoff | No precedent for an inter-script payload. `mkdtempSync` is used for scratch trees only (`new-project.ts:626`). | Poor fit. |
| Debug output gated by an env var (`DEBUG`, `TRACE`, `VERBOSE`) | **None** in `scripts/`. | Would be a new one-off convention. |

## 3. Design

### 3.1 (a) TRACE output — delete it

**Decision**: delete both `console.log` calls (`:3794-3796` and `:3805`). Keep `const verdict = classifyVariantMirrorCopy(...)` and the branch on it unchanged.

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| **Delete** | Removes the defect at the source. No new convention. Fixes the CI log noise too. | The classifier loses its ad-hoc trace. | **Chosen.** A unit table test replaces it (§4, T7). |
| Move to stderr | `--json` stdout parses. | 260 lines of noise on every run: CI, new-project, `/sync` audits. Debug leftovers stay in production code. | Rejected. |
| Gate by env var (`VALIDATE_TRACE=1`) | Keeps the trace on demand. | No such convention exists (§2.4). It is one site, and the classifier is an exported pure function that a test can drive directly. | Rejected. |
| Guard with `!JSON_MODE` | Smallest diff. | Human mode keeps 260 noise lines. | Rejected. |

**Should the mirror-check honor `--variant`?** **No** (recommended default; see O-2).

- It is one of about 40 fleet-wide checks. Filtering only this one would be inconsistent. `variantsScanned` already counts only the per-variant loop.
- The verdict for variant X depends on other variants. `peerCount` comes from the fleet-wide census `mirrorCarriers` (`:3735-3759`). So the census must scan every variant anyway.
- Filtering it would barely shrink the payload. After deleting TRACE, the check emits nothing in JSON mode unless it finds an issue.
- The real need is consumer-side relevance. The pre-check must not block a co-consult scaffold on a co-deck problem. §3.3.3 does that with `err.variant` scoping, which covers all fleet-wide checks at once.

### 3.2 (b) Transport — evaluate in-process, keep the CLI and add stdin

**Decision**: `new-project.ts` no longer spawns `validate-output.ts`. It imports the evaluation logic. The CLI stays for manual use and gains stdin input.

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| argv (today) | — | Windows 32,767-char limit. The payload grows with every new warning. | Rejected. |
| **In-process pure function** | No transport, so no size limit and no second spawn that can fail. Matches the 15 existing in-process helper imports. Directly unit-testable. | `validate-output.ts` must stop doing work at import time. | **Chosen for `new-project.ts`.** |
| stdin (`spawnSync(..., { input })` + `readFileSync(0)`) | House pattern (§2.4). No size limit. Keeps process isolation. | Still a spawn that can fail. Isolation buys nothing for a pure filter. | **Chosen for the CLI** (`-` or no JSON argument). |
| Temp file (`--file <path>`) | No size limit. | Cleanup paths, Windows file locks, no precedent. | Rejected. |

**`scripts/helpers/validate-output.ts` v1.1.0 contract** (signatures only; implementation belongs to the implementer):

```ts
export interface PrecheckIssue { variant?: string; check?: string; message?: string }
export type PrecheckVerdict =
  | { kind: "pass"; blocking: []; outOfScope: PrecheckIssue[] }
  | { kind: "blocked"; blocking: PrecheckIssue[]; outOfScope: PrecheckIssue[] }
  | { kind: "unparsable"; reason: string; preview: string };

/** Pure. Parses validate-templates --json text and partitions mandatory-domain errors. */
export function evaluateValidationOutput(
  jsonText: string,
  opts: { mandatoryDomains: string[]; variant?: string },
): PrecheckVerdict;

/** Pure. Returns a one-paragraph failure description, or null when the spawn ran normally. */
export function describeSpawnFailure(label: string, result: SpawnSyncReturns<string>): string | null;

/** Runs the whole pre-check (moved out of new-project.ts:864-897). spawn is injectable for tests. */
export function runGovernancePrecheck(opts: {
  workspaceRoot: string;
  variant: string;
  spawn?: typeof spawnSync;
}): { ok: boolean; mandatoryDomains: string; lines: string[] };
```

- All top-level work moves into a `main()` that runs only under `import.meta.main`. Importing the module must have no side effects. Today `:14-25` parses `process.argv` at import time.
- **Why move the pre-check into the helper**: `new-project.ts` is top-level imperative code and cannot be unit-tested. `tests/unit/new-project-rollback.test.ts:3-8` documents the same reason for an earlier extraction. A function in the existing helper avoids a new file, a new `SCRIPTS.md` row, and a new lifecycle record. `new-project.ts` keeps only the call, the printing, and the exit.
- **CLI (backward compatible)**: `bun scripts/helpers/validate-output.ts <domains> [<json> | -] [--variant <name>]`.
  - A JSON argument works as today.
  - `-` or no JSON argument reads stdin. Example: `bun scripts/validate-templates.ts --variant co-develop --json | bun scripts/helpers/validate-output.ts variant,agent,skill - --variant co-develop`.
  - Without `--variant`, no scoping applies. That is today's behavior.
  - Exit codes: 0 pass, 1 blocked, 2 unparsable (changed from 0; see O-4).

### 3.3 (c) Honest error reporting and the fail-open question

#### 3.3.1 Spawn failure reporting

`runGovernancePrecheck` checks both remaining spawns (`lifecycle-governance.ts` and `validate-templates.ts`) with `describeSpawnFailure`. A spawn has failed when any of these is true:

| Condition | Message content |
|-----------|-----------------|
| `result.error` is set | `<label> could not start: <error.code> (<error.message>)`. Examples: `ENAMETOOLONG`, `ENOENT`, `E2BIG`, `ENOBUFS`. |
| `result.status === null` | `<label> was terminated by signal <result.signal ?? "unknown">` |
| stdout is empty | `<label> exited <status> with no output`, plus the last 20 lines of stderr |

- The `validate-templates.ts` spawn gets an explicit `maxBuffer` of 16 MiB. The default is 1 MiB, and an `ENOBUFS` would otherwise block every scaffold once the output grows.
- The `validate-templates.ts` exit code is **not** used as a verdict. It exits 1 on any error in any domain or variant (`:9112`). The parsed JSON is the verdict.
- `lifecycle-governance.ts` failure keeps today's fallback (`variant,agent,skill`). It now prints one visible WARN with the reason instead of falling back silently.

#### 3.3.2 Parse failure: fail-closed (recommended) versus fail-open

| Option | Behavior | Risk |
|--------|----------|------|
| **Fail-closed** (recommended, O-3) | An unparsable payload blocks the scaffold. The message shows the reason, the first 200 characters of stdout, and the repro command. | A validator crash on the local tree blocks scaffolding until it is fixed. That is the right moment to find out: the validator is a CI gate on 3 OSes (`test.yml:29`, `:115`), so a crash on `main` is unlikely. A crash on a dirty local tree is a real defect in the operator's in-flight work. |
| Fail-open with a visible WARN | An unparsable payload prints a yellow WARN and continues. | This repeats the failure mode that hid D1 for 53 days (2026-09-25 to 2026-11-17). A WARN in the middle of a long scaffold log scrolls away. |

**Recommendation: fail-closed**, with no bypass flag (O-5). The three defects show that a fail-open gate decays without anyone noticing. Measured risk is zero today (§3.3.4).

#### 3.3.3 Blocking scope

An error blocks the scaffold when both of these are true:

1. Its `check` contains a mandatory domain (unchanged substring semantics).
2. Its `variant` is the target variant or `"common"` (new; O-1).

- `common` errors block because every scaffold delivers `templates/common`.
- Errors labelled with another variant or with `"root"` (L0 workspace concerns, never delivered) do not block. They are counted as `outOfScope` and printed as one line: `N finding(s) outside co-x/common — not blocking; run bun scripts/validate-templates.ts`.
- `fail()` labels issues with a variant name, `"common"`, or `"root"` (measured on the call sites). There is no unlabelled case to handle.

Printed output, in order: each blocking error with its `check`, `message`, and `fix`. Then the repro command `bun scripts/validate-templates.ts --variant <v>`. On a pass, the existing `✅` line gains the out-of-scope count.

#### 3.3.4 Predicted impact (measured, not estimated)

Method: run `bun scripts/validate-templates.ts --variant <v> --json` for each variant, strip the `TRACE` lines (simulating §3.1), parse the JSON, and apply both the current filter and the scoped filter with the real mandatory domains (`lifecycle-governance.ts` prints `variant,agent,skill`). The script ran from `/tmp`. The working tree was byte-identical before and after (B-07 `VERSION_REGISTRY.json` sync is idempotent).

| Variant | Raw stdout (bytes) | JSON only (bytes) | Errors (all) | Newly blocking, current filter | Newly blocking, scoped filter (§3.3.3) | Warnings |
|---|---:|---:|---:|---:|---:|---:|
| co-abap | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-architect | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-consult | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-deck | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-design | 57,880 | 38,356 | 0 | 0 | 0 | 43 |
| co-develop | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-export | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-game | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-hr | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-learning | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-news | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-price | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-safety | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-security | 56,611 | 37,087 | 0 | 0 | 0 | 40 |
| co-work | 56,611 | 37,087 | 0 | 0 | 0 | 40 |

Notes:

- Every JSON-only payload exceeds 32,767 bytes. This confirms that §3.2 is required even after §3.1.
- Warnings never block. The co-design run has 3 extra per-variant warnings.
- The result holds for a CI-green `main`. The validator runs on every PR, so `main` normally has 0 errors. The residual risk is a dirty local checkout. In-flight edits that create a mandatory-domain error in the target variant or `common` would now block a local scaffold. That is the intended behavior.
- CV-02 (`same-version-content-change`) depends on local git state, but its check name matches no mandatory domain, so it cannot block.

### 3.4 Resulting `new-project.ts` block (behavior, not code)

1. If `scripts/validate-templates.ts` or `docs/templates/lifecycle-governance.json` is missing, skip, as today (`:866`).
2. Call `runGovernancePrecheck({ workspaceRoot, variant })`.
3. Print `lines`. If `ok` is false, print the `FAILED` header and exit 1 under `import.meta.main`, as today (`:888-895`).
4. Otherwise print the pass line with the mandatory domains and the out-of-scope count.

## 4. (d) Test plan

New file `tests/unit/validate-output.test.ts`, plus one assertion added to an existing live test. Every test below runs in `bun run test:unit`, which runs on `windows-latest` (`test.yml:29`, `:199`).

| ID | Test | Proves |
|----|------|--------|
| T1 | Live: `validate-templates.ts --variant co-develop --json`. `JSON.parse(stdout)` succeeds without slicing. No stdout line starts with `TRACE`. | D1 fixed. Add it to `validate-templates-variant-shadow.test.ts` to reuse its live run and its 120 s budget, rather than adding a second live run. |
| T2 | CLI over stdin: build a JSON payload above 100,000 bytes (padded `warnings`) with one mandatory error for `co-x` last in `errors`. Run `validate-output.ts variant,agent,skill - --variant co-x` with `input:`. Expect exit 1 and the error message on stderr. | A payload above 32K is delivered on every OS (D2). |
| T3 | Same payload passed to `evaluateValidationOutput` in-process. Expect `kind: "blocked"` with exactly one blocking issue. | The in-process path has no size dependence. |
| T4 | `describeSpawnFailure` with `{ error: Object.assign(new Error("spawnSync ENAMETOOLONG"), { code: "ENAMETOOLONG" }), status: null, stdout: "" }`. The message contains `could not start` and `ENAMETOOLONG`. Also: the signal case, the empty-stdout case with a stderr tail, and `null` for a normal result. | Honest spawn reporting (D3). |
| T5 | `runGovernancePrecheck` with an injected `spawn` that returns the T4 failure for the validator. Expect `ok: false`, and `lines` contain the code. Also: injected garbage stdout gives `ok: false` with an `unparsable` reason. | Fail-closed wiring. |
| T6 | Scoping: errors labelled `co-x`, `common`, `co-y`, and `root` with target `co-x`. Expect 2 blocking (`co-x`, `common`) and 2 out of scope. Without `variant`, expect all 4 blocking (legacy). | §3.3.3 and CLI backward compatibility. |
| T7 | Table test for `classifyVariantMirrorCopy` (exported, `:3871`). Cover each verdict, including `fail-stale-orphan`. | Replaces the deleted TRACE observability. |
| T8 | Import side-effect guard: `import("../../scripts/helpers/validate-output.ts")` with an unrelated `process.argv` writes nothing to stderr and does not exit. | The module is import-safe. |
| T9 | Live, end to end: `runGovernancePrecheck({ workspaceRoot: ROOT, variant: "co-develop" })` returns `ok: true`. Timeout 120 s. | The real Windows path (§5.3). |

Regression: `validate-templates-variant-shadow`, `validate-templates-cv02`, `script-registry-audit`, `validate-templates-l3-skip`, `project-target-guards`, and `new-project-rollback` stay green. The scripts E2E suite (`bun scripts/test-runner.ts scripts`, which runs `scripts/test-new-project.ts`) stays green on ubuntu. It now executes a working pre-check, which is itself a check.

## 5. (e) Rollout

### 5.1 Versions

| File | From | To | Reason |
|------|------|----|--------|
| `scripts/validate-templates.ts` | 1.84.0 (uncommitted, PR-4) | next free **patch** on `main` at implementation time (O-6) | Bug fix, no check semantics change. PR-5 has reserved 1.85.0 (`validate-templates.ts:11`). So this is 1.84.1 if it lands before PR-5, otherwise 1.85.1. |
| `scripts/helpers/validate-output.ts` | 1.0.1 | 1.1.0 | New exports, stdin input, `--variant` option, exit 2 on unparsable. |
| `scripts/new-project.ts` | 1.44.0 | 1.45.0 | Behavior change: the pre-check is now real and fail-closed. |

Update the matching `scripts/SCRIPTS.md` rows and `docs/lifecycle/scripts/new-project.md` and `docs/lifecycle/scripts/validate-templates.md` through the normal `/sync` lifecycle step. `validate-output.ts` has no lifecycle record today; this design does not add one.

### 5.2 Layer mirrors

- `validate-templates.ts` is L0+L1 (`SCRIPTS.md:331`). Edit only `scripts/validate-templates.ts`. The `/sync` publish step refreshes `templates/common/scripts/validate-templates.ts`, including the CONSTITUTION.md to context.md scrub. **Never hand-edit `templates/`.**
- `validate-output.ts` and `new-project.ts` are L0-only. They have no mirror.
- No template, skill, command, or agent file changes.

### 5.3 Windows verification plan

1. **CI (required)**: T2-T6, T8, and T9 run on `windows-latest` in `bun run test:unit`. T9 runs the real validator spawn and evaluation on Windows. T2 shows that a payload of 100 KB or more crosses the process boundary there.
2. **Root-cause probe (optional, owner-run on Windows)**: confirms the original failure mode without scaffolding.

   ```powershell
   bun -e "const r=require('node:child_process').spawnSync(process.execPath,['-e','0','x'.repeat(40000)],{encoding:'utf8'});console.log(r.status, r.error && r.error.code)"
   ```

   Expected on Windows: `null` plus an error code (expected `ENAMETOOLONG`). macOS prints `0 undefined`; this was checked on 2026-11-17. The output fills the "not reproduced" gap in §1 (claim 2b).
3. **Scaffold smoke (optional, owner-run on Windows after merge)**:

   ```powershell
   bun scripts/new-project.ts tests/.temp/precheck-win --variant co-develop --yes
   Remove-Item -Recurse -Force tests\.temp\precheck-win
   ```

   Expected: `✅ Lifecycle governance pre-check passed (mandatory domains: variant,agent,skill …)`.
4. T9 adds one validator run to the Windows unit job (about 1.5 s on macOS; Windows is slower). If it strains the budget from [`2026-11-15-windows-ci-test-speedup-design.md`](2026-11-15-windows-ci-test-speedup-design.md), merge T1 and T9 into one live run.

### 5.4 Sequencing

- The working tree holds lifecycle PR-4 (validate-templates v1.84.0, uncommitted). Per the Sequential Branch Dependency Rule (CONSTITUTION.md §3.3), this PR branches **after** PR-4 merges.
- This PR is independent of PR-5 (zone override). Whichever merges second takes the next version.

## 6. Platform impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | `new-project.ts` behavior: the pre-check is now real, fail-closed, and variant-scoped. No command or skill text changes. `skills/new-project/SKILL.md` does not describe the pre-check internals. | `scripts/new-project.ts`, `scripts/helpers/validate-output.ts`, `scripts/validate-templates.ts` |
| Antigravity (GEMINI.md) | Same scripts. No GEMINI.md text change, because it does not restate the pre-check. **None** for platform text; behavior changes identically. | None beyond the scripts |
| Codex, Hermes, other surfaces | Same as Antigravity. | None beyond the scripts |
| templates/common | Pipeline-propagated `scripts/validate-templates.ts` only (TRACE deletion). No hand edits. | `templates/common/scripts/validate-templates.ts` via `/sync` |

Cross-platform: the design removes the only argv payload. All spawns keep argv arrays (`spawnSync(process.execPath, [...])`), with no shell strings. stdin uses `readFileSync(0, "utf-8")`, which works on Windows (the hooks already rely on it). No `> nul` redirection.

**Accessibility statement**: backend and tooling changes only (CLI scripts and unit tests). No UI, rendered page, or style change. Exempt from ADR-0065 by this explicit statement.

**Preview Verification statement**: non-UI change. Nothing to preview in a browser. Exempt. Verification is by unit tests, the live validator test, and the Windows CI matrix (§4, §5.3).

## 7. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Fail-closed blocks a local scaffold when the operator's dirty tree has a validator error. | Intended. The message names the check, the fix, and the repro command. Measured fleet impact today: 0 (§3.3.4). |
| R2 | A future validator crash blocks every scaffold. | The validator runs on every PR on 3 OSes. The failure message shows the stderr tail, so the cause is visible at once. O-5 records the bypass choice. |
| R3 | The loose substring match (`"agent"` matches `agents-md-*`) blocks on a check outside the intended domain. | Scoping removes cross-variant cases. In-scope cases are real errors in delivered content. Tightening the match is a follow-up (§9). |
| R4 | A new `fail()` site uses a label other than a variant, `common`, or `root`, and is silently treated as out of scope. | T6 pins the partition. Follow-up option: treat unknown labels as blocking. This is not proposed now, because no such label exists. |
| R5 | T9 lengthens the Windows unit job. | §5.3 item 4: merge it with T1 if needed. |
| R6 | Version collision with PR-4 or PR-5 on `validate-templates.ts`. | §5.1 and §5.4: branch after PR-4, take the next free patch. CV-02 catches an unbumped edit. |
| R7 | Removing the trace hides a future `classifyVariantMirrorCopy` bug. | T7 table test. The function is exported and pure. |

## 8. Owner decisions (open; defaults apply unless the owner objects)

- **O-1 — Blocking scope.** **Default: target variant plus `common`.** Alternative: target only, which would let a broken `common` ship. Alternative: today's unscoped filter, which blocks every scaffold on any variant's error.
- **O-2 — Mirror-check and `--variant`.** **Default: keep the check fleet-wide and scope at the consumer.** Alternative: filter this one check by `--variant`. That is inconsistent with about 40 sibling checks, and the peer census still needs the whole fleet.
- **O-3 — Unparsable validator output.** **Default: fail-closed** with a reason, a stdout preview, and the repro command. Alternative: fail-open with a visible WARN.
- **O-4 — CLI exit code for unparsable input.** **Default: exit 2** (distinct from 1 = blocked). Alternative: keep exit 0. No caller would depend on either after this PR.
- **O-5 — Bypass for the pre-check.** **Default: none.** Alternative: a `--skip-governance-precheck` flag that prints a loud WARN. The workspace forbids gate bypasses in other places (`--no-verify`), and the measured risk is zero.
- **O-6 — validate-templates version.** **Default: next free patch** (1.84.1 or 1.85.1, §5.1). Alternative: a minor bump. That is not warranted: no check changes semantics.

## 9. Single-PR plan

**One PR, root-only, after lifecycle PR-4 merges.**

| File | Action | Description |
|------|--------|-------------|
| `scripts/validate-templates.ts` | modify | Delete the 2 TRACE `console.log` calls. Bump the patch version (O-6). |
| `scripts/helpers/validate-output.ts` | modify | Import-safe module. Export `evaluateValidationOutput`, `describeSpawnFailure`, `runGovernancePrecheck`. CLI: stdin, `--variant`, exit 2. Version 1.1.0. |
| `scripts/new-project.ts` | modify | Replace `:864-897` with the `runGovernancePrecheck` call and its printing. Version 1.45.0. |
| `tests/unit/validate-output.test.ts` | create | T2-T9. |
| `tests/unit/validate-templates-variant-shadow.test.ts` | modify | Add T1 (parse without slicing, no TRACE line). |
| `scripts/SCRIPTS.md`, `docs/lifecycle/scripts/*.md` | modify | Through the `/sync` lifecycle step. |
| `templates/common/scripts/validate-templates.ts` | pipeline output | Refreshed by `/sync` publish. Never hand-edited. |

Three root scripts plus two test files. Zero hand-edited template files. Run `bun run test:unit` before `/sync`, because script versions are bumped.

**Follow-up tickets to file (not in this PR):**

1. With `--tag`, the pre-check validates working-tree templates, not the tagged ones (`new-project.ts:615-646` versus `:875-879`).
2. Tighten the domain match in `evaluateValidationOutput` from substring to a declared check-to-domain map.
3. Simplify the TRACE-era slice in `validate-templates-variant-shadow.test.ts:119` to a plain `JSON.parse`.

## 10. Acceptance criteria

- [ ] `validate-templates.ts --json` stdout parses with `JSON.parse` for every variant.
- [ ] No `validate-templates.ts` run prints a line that starts with `TRACE`, in either mode.
- [ ] `new-project.ts` passes no validator output through argv.
- [ ] The `validate-output.ts` CLI accepts a JSON argument, `-`, or stdin, and a payload above 100,000 bytes is evaluated correctly on Linux, macOS, and Windows CI.
- [ ] A spawn failure prints the label, the error code or signal, and the stderr tail.
- [ ] Unparsable validator output blocks the scaffold with a reason and a repro command.
- [ ] An error in another variant or in `root` does not block. An error in the target variant or in `common` does.
- [ ] The pre-check passes for all 15 variants on `main`.
- [ ] Importing `validate-output.ts` has no side effects.
- [ ] `classifyVariantMirrorCopy` is pinned by a table test.
- [ ] `templates/common/scripts/validate-templates.ts` changes only through `/sync` publish.
- [ ] The existing tests listed in §4 stay green.
