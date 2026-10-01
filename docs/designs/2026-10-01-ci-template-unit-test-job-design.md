# CI Template Unit-Test Job - Design

- Ticket: T-20260930-026 (deferred D8 from co-newbiz 2026-09-22 full project review)
- Date: 2026-10-01 | Author: architect | Status: Proposed, amended per binding security review
  (APPROVE-WITH-CHANGES). Design Gate row 0 (ADR-0074). Implementation landed 2026-10-01
  (ADR-0094 Accepted; registry status `implemented`).
- Scope: L0 `templates/common/.github/workflows/ci.yml`, `scripts/lib/upgrade-policy.ts`,
  `scripts/lib/managed-block-merge.ts`, `scripts/upgrade-project.ts`

## 1. Problem and root cause

The L0 CI template has no live test job, only commented stubs. co-newbiz added a "Unit + Script Tests"
job (PR #427); a fleet resync removed it (6fcaf043) and it was hand re-added on 2026-09-30.
`resolveClaim('.github/workflows/ci.yml')` matches no earlier claim and falls to the final
`{ policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS }` - a whole-file overwrite. No project content survives.

## 2. Code verification (review claims checked against source)

| Claim | Verified fact | Correction |
|---|---|---|
| `MANAGED_PATTERNS` ~84-114 | `scripts/lib/managed-block-merge.ts` L89-99; 9 patterns, ALL HTML comments (`<!-- ... -->`), regex `open [\s\S]*? close`, non-greedy | Earlier draft said `.gitignore` uses `#`-style markers: WRONG, it uses `<!-- WORKSPACE-MANAGED: ... -->`. No `#`-comment pattern exists; YAML needs a new, separate matcher |
| `mergeManagedBlocks` body (not read by reviewer) | L266-377. Pure (returns `{content, merged, log, snapshots}`, never throws, never touches fs). Failure modes: (1) an open marker with no close simply does not match, so the block is treated as ABSENT and the template block is INSERTED/APPENDED - silent duplication, no error; (2) unlabeled count mismatch replaces the whole first..last span (destructive, snapshot returned); (3) no parse/validation of the result | The lib has no fail-closed path; the new YAML path must not reuse its absent-means-append semantics |
| Atomic write | `mergeWorkspaceManaged` (`upgrade-project.ts` L1128-1177) writes `.pre-reconcile.bak` then `writeFileSync(projectFile, ...)` directly - NOT atomic (no temp + rename, no post-write validation) | New path must do temp, validate, rename |
| MERGE pass ~1362-1380 | L1362-1380: a HARDCODED list (platform md files + `.gitignore`, `agents/pm.md`), not derived from `MERGE_MANAGED_FILES` | Adding ci.yml to the policy set alone does nothing; the pass list must be edited too (and a test must assert set/list agreement) |
| `resolveClaim` / `MERGE_MANAGED_FILES` | `upgrade-policy.ts` L265 set; L295 `resolveClaim`, MERGE_MANAGED hit at L332 after LOCKED | Confirmed; ci.yml must not collide with LOCKED (it does not) |
| Fleet ci.yml drift (reviewer count errored) | Measured `cmp` of 13 `Projects/co-*/.github/workflows/ci.yml` vs template: 12 byte-identical, 1 differs (co-newbiz, 33 diff lines: one extra job `test`) | Earlier draft named the fixture job `unit-and-script-tests`; real key is `test` |
| Variant overrides | No `templates/co-*/.github/workflows/ci.yml` exists | No variant mirror work needed |

## 3. Decision: C (preserve project jobs + default job), shipped in TWO releases

- Preservation (B) is the actual data-loss fix; the default job (A) gives the other 12 projects CI.
- Lesson of reverted PR #1268 (a pipeline change rewrote project files against the fork model): a
  change that touches every project's ci.yml must not also change CI behaviour in the same release.
- Release 1: claim change to MERGE_MANAGED + markers + fail-closed validator + legacy migration.
  The template either has no `unit-tests` job or has it gated behind a per-project opt-in
  (`vars.CI_ENABLE_DEFAULT_UNIT_TESTS == 'true'`). Chosen: opt-in gate (lets co-newbiz-alone rollout
  exercise the real job).
- Release 2: flip to default-on (skip variable `CI_SKIP_DEFAULT_UNIT_TESTS`) only after Release 1 has
  landed across the fleet with clean dry runs.
- MERGE_MANAGED keeps template-owned jobs authoritative: a project cannot downgrade or lock out
  `audit` / `secret-scan` / `unit-tests`; only the PROJECT-JOBS region is project-owned.

## 4. PR split (strict order; each merged before the next is opened, CLAUDE.md sequential rule)

| Order | PR | Content | L0/L1 mirror implications |
|---|---|---|---|
| 1 | PR-A | `scripts/lib/ci-workflow-merge.ts` (new: validator + region splice + migration), `upgrade-policy.ts` (ci.yml into `MERGE_MANAGED_FILES`), `upgrade-project.ts` (ci.yml into MERGE pass list, routed to the new lib, atomic write), tests, ADR-0094, SCRIPTS.md, CHANGELOG. NO template change | Root scripts only. The scripts are delivered to projects by the normal scripts SYNC, so projects receive the new logic but, with an unchanged template (no markers), the validator runs in migration mode; dry-run across all 13 must show 12 "no change" and co-newbiz "migrate `test`". Workspace-root only - no `templates/` edits (CLAUDE.md s.9) |
| 2 | PR-B | `templates/common/.github/workflows/ci.yml`: add PROJECT-JOBS markers, add `unit-tests` job gated by opt-in var, `persist-credentials: false`, pinned bun-version; `templates/CHANGELOG.md`; release-template minor bump | Template-only session (CWD `templates/common`). Root `.github/workflows/ci.yml` is L0-own and unchanged. No variant overrides exist. Rollout: resync co-newbiz ALONE, set its opt-in, verify, then the other 12 |
| 3 | PR-C | Template: switch gate from opt-in to default-on with `CI_SKIP_DEFAULT_UNIT_TESTS` skip; template release bump | Template-only. Only after PR-B fleet rollout is clean. Projects without `test:unit` no-op via the detect step |

## 5. Template YAML (end state after PR-C; PR-B differs only in the `if:`)

```yaml
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    if: ${{ vars.CI_SKIP_DEFAULT_UNIT_TESTS != 'true' }}   # PR-B: vars.CI_ENABLE_DEFAULT_UNIT_TESTS == 'true'
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<40-hex> # v4
        with: { fetch-depth: 1, persist-credentials: false }
      - uses: oven-sh/setup-bun@<40-hex> # v2.2.0
        with: { bun-version: "1.3.x" }   # pinned; exact value chosen in PR-B to match root
      - name: Detect test:unit script
        id: detect
        run: |   # sets has_unit=true/false; prints "::notice::unit-tests skipped: no test:unit" when false
      - { name: Install dependencies, if: "steps.detect.outputs.has_unit == 'true'", run: bun install --frozen-lockfile }
      - { name: Run unit tests,      if: "steps.detect.outputs.has_unit == 'true'", run: bun run test:unit }

  # PROJECT-JOBS-BEGIN
  # Project-local jobs go here. upgrade-project preserves this region; it is validated, not trusted.
  # PROJECT-JOBS-END
```

- Job-level `hashFiles()` removed (not available in job-level `if:`); the detect step is the gate.
- The skip/opt-in variable is unit-tests only; `audit` and `secret-scan` carry no `vars.*` and no
  job-level `if:` (tested). When skipped, the job-level `if:` suppresses the job; the workflow prints
  the reason via a notice in the detect step when it runs with no script.
- Workflow `permissions` stays `contents: read`; no `secrets.` references; no `pull_request_target`.

## 6. Fail-closed validation contract (implementer builds exactly this)

Module `scripts/lib/ci-workflow-merge.ts` (pure; no fs):

```ts
export type CiMergeErrorCode =
  | 'MARKER_COUNT'          // not exactly one BEGIN and one END
  | 'MARKER_ORDER'          // END before BEGIN
  | 'MARKER_INDENT'         // marker not at jobs-level indent (2 spaces) or inside a block scalar
  | 'REGION_INDENT'         // region lines not at jobs-level child indentation
  | 'YAML_PARSE'            // merged text does not parse
  | 'DUPLICATE_KEY'         // duplicate mapping key at any level
  | 'RESERVED_JOB'          // region job key in {audit, secret-scan, unit-tests}
  | 'REGION_JOB_PRIVILEGE'  // region job has permissions / environment / secrets
  | 'REGION_TOP_LEVEL'      // region introduces top-level on / permissions / env
  | 'FORBIDDEN_TRIGGER'     // pull_request_target or workflow_run anywhere in the file
  | 'TEMPLATE_JOB_DRIFT'    // a template-owned job is not byte-identical to the template
  | 'MIGRATION_UNSAFE';     // legacy file has anchors/aliases/multi-doc/extra top-level keys

export interface CiMergeResult {
  ok: boolean;
  content: string | null;       // merged text (LF or original EOL); null when !ok
  errors: { code: CiMergeErrorCode; detail: string }[];
  warnings: string[];           // e.g. TEMPLATE_JOB_CHANGED during migration, notice text
  migrated: string[];           // job keys moved into the region (legacy path)
  diff: string | null;          // printed when project on/permissions differ from template
}

export function mergeCiWorkflow(
  projectText: string, templateText: string,
  opts: { allowTriggerPermDiff: boolean },   // CLI flag --accept-ci-perm-diff
): CiMergeResult;

export function validateCiWorkflow(mergedText: string, templateText: string): CiMergeResult['errors'];
```

Rules: markers matched line-wise on CRLF-normalized text (`\r\n` tolerated, original EOL restored on
output); a marker line inside a `run: |` block scalar is not a marker. Parse with `yaml` using
`uniqueKeys: true` and `parseDocument` (so duplicates surface as errors). `mergeCiWorkflow` always
calls `validateCiWorkflow` on its own output; `ok` is true only with zero errors.

Caller contract (`upgrade-project.ts`): on `!ok` print every `code: detail`, write NOTHING, exit
non-zero (after the pass, the whole run fails). On `ok`: write to `<file>.tmp-<pid>`, re-read, re-run
`validateCiWorkflow`, then `renameSync` over the original. Dry run prints result, diff, warnings.

Legacy migration (no markers): never re-serialize. Refuse (`MIGRATION_UNSAFE`, "manual migration
needed") on anchors, aliases, more than one document, or top-level keys outside
{name, on, permissions, env, jobs}. Otherwise take the template text, and copy the ORIGINAL text slice
of each project-only job (from its key line to the next jobs-level key) into the region. If project
`on` or `permissions` differ from the template: print the diff and fail unless
`--accept-ci-perm-diff` is passed. Warn (`TEMPLATE_JOB_CHANGED`) when a template-owned job's content
differed (the project edit is dropped, by design).

## 7. ADR amendment outline

ADR-0074 is the Universal Design Gate (process), not upgrade policy, so it is the wrong owner. New
**ADR-0094 "CI workflow as a MERGE_MANAGED file with a validated project region"** (next free number;
0093 is the latest). Owner: architect; reviewer: security-expert. Sections:
1. Context: SYNC overwrite of ci.yml, co-newbiz loss, PR #1268 lesson.
2. Decision: ci.yml claim SYNC -> MERGE_MANAGED; template-owned jobs authoritative (no downgrade or
   lock-out of audit/secret-scan/unit-tests); PROJECT-JOBS region is UNTRUSTED input, validated after
   parsing the whole file; fail closed, atomic write.
3. Validation rules (section 6 error codes) and reserved deny-list.
4. Migration policy: text-slice copy, refusal conditions, perm/trigger diff flag.
5. Two-release rollout, co-newbiz first, dry-run evidence attached to T-20260930-026.
6. Consequences: projects can no longer edit template jobs; set/list agreement test for MERGE pass.
Cross-link from ADR-0074 is not required (this design already cites it as its gate).

## 8. Test plan (local; no remote CI dependency)

- `tests/unit/ci-template.test.ts`: parse template; every `uses:` 40-hex SHA; checkout has
  `persist-credentials: false`; `bun-version` not `latest`; top-level `permissions` equals
  `{contents: read}`; no `pull_request_target`/`workflow_run`; no `secrets.` in file; `audit` and
  `secret-scan` have no `if:` and no `vars.`; markers exactly once, in order, at jobs indent.
- Detect step: run its script via `Bun.spawn` in temp dirs (no scripts key / no test:unit / present):
  exit 1/1/0 and notice text printed on skip.
- `tests/unit/ci-workflow-merge.test.ts`, one case per error code, plus: region preserved while
  template jobs update; second merge byte-identical (plain AND migrated case); CRLF input round-trips
  with CRLF; marker text inside a `run: |` scalar ignored; nested markers, duplicate BEGIN, missing
  END rejected; injected bad region (e.g. job `audit`, or `permissions: write-all`) returns !ok.
- Migration: co-newbiz fixture (real file copy, job `test`) migrates into the region with original
  text slice byte-for-byte; fixture with anchors -> MIGRATION_UNSAFE; perm diff without flag -> fail.
- Atomic write (upgrade-project integration, temp project dir): injected bad region -> exit non-zero,
  original file byte-identical, no leftover tmp file.
- Policy: `resolveClaim('.github/workflows/ci.yml')` is MERGE_MANAGED/MERGE; every
  `MERGE_MANAGED_FILES` member except platform-gated ones appears in the MERGE pass list.
- Fleet: `bun scripts/upgrade-project.ts --dry-run` on all 13 Projects; attach per-project summary to
  the ticket. `bun scripts/audit.ts` clean.

## 9. Per-project dry-run measurement (pre-implementation baseline, 2026-10-01)

`cmp` of each `Projects/co-*/.github/workflows/ci.yml` against `templates/common/.github/workflows/ci.yml`:
co-abap, co-architect, co-consult, co-deck, co-design, co-develop, co-export, co-game, co-price,
co-safety, co-security, co-work: identical (expected post-PR-A result: no change; post-PR-B: markers +
gated job added, no project content). co-newbiz: differs, 33 diff lines, exactly one extra job `test`
(web-next deps, python venv, `test:scripts`; also uses `bun-version: latest` and step-level
`hashFiles`). Expected PR-A dry run: MIGRATED PROJECT-JOBS: test. The real `upgrade-project --dry-run`
across all 13 is still required after PR-A lands (the new code does not exist yet).

## 10. Rollback and residual risks

- Rollback of PR-C: revert the `if:` only. Rollback of PR-B: revert template; regions stay in projects
  and remain valid. Rollback of PR-A would return ci.yml to SYNC and lose regions - avoid; fix forward.
- Validator strictness may block an upgrade for a project with an exotic ci.yml; that is intended
  (manual migration, reported with an error code).
- Runner behaviour unobservable until Actions minutes return (T-20260927-016); follow-up ticket to
  confirm first green runs, then opt into required checks.
