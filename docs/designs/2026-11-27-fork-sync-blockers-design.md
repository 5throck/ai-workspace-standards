# Design: fork-sync blockers 3-6 from issue #2192 (T-20261127-003)

- **Spec id**: 2026-11-27-fork-sync-blockers
- **Date**: 2026-11-27
- **Tickets**: T-20261127-003 (all four fixes)
- **Status**: implemented
- **Owner**: automation-engineer (dispatched per PM Gateway; ticket filed from the 2026-11-27 issue-triage run)
- **Source**: issue #2192 (fork maintainer report, 2026-11-26; blockers 1-2 dispositioned separately — blocker 1 resolved by S1 SYNC_TEMPLATE_ADVANCE PR #2189, blocker 2 open as T-20261127-001)

## 1. Problem

A fork maintainer merging upstream `main` into a private Windows fork names six
fork-sync blockers (issue #2192). Blockers 3-6 are root-side code/doc defects that
also affect standalone CI clones; none involve fork-specific code:

3. `tests/unit/meeting-command-retirement.test.ts` copy-discipline leg asserts
   `existsSync(Projects)).toBe(false)` in the absent-`Projects/co-safety` branch —
   a fork that keeps its own gitignored `Projects/` tree without co-safety always
   fails the leg.
4. `tests/unit/validate-templates-cv02.test.ts` "CV-02 end to end" forces
   `CV02_BASE: "HEAD"`, discarding any caller-provided base — during dev-sync step
   4.85 (staged-but-uncommitted merge) the tree differs from HEAD and every unbumped
   upstream file is falsely reported — and runs the full `validate-templates.ts`
   under the default per-test timeout (~55s measured on a typical Windows laptop).
5. Windows prerequisites for the unit suite are undocumented (Developer Mode for
   symlink; Git `usr\bin` on PATH for bash/`true` spawns).
6. `scripts/list-template-versions.ts` sorts `template-v*` tags lexically — with
   `template-v0.30.0` present it reports `template-v0.9.0` as latest and prints a
   false VERSION-mismatch warning.

## 2. Non-goals

- No test deleted or loosened: every leg's actual protection is preserved (the
  copy-discipline byte-identity, the CV-02 assertion text, the comparator output
  contract for well-formed tags).
- No change to the CV-02 validator semantics (`scripts/validate-templates.ts`
  base-resolution chain is untouched); the test change is budgets and scheduling
  only, per the issue's own request.
- No capability guards added to symlink-using tests (the issue offers "document OR
  guard"; this delivery documents — guarding 33 call sites across 10+ files is a
  separate, larger scope).
- Blockers 1-2 are out of scope (dispositioned per the ticket description).

## 3. Fix (blocker 3): fork-hostile `Projects/` assertion

The leg's actual protection is the byte-identity of `Projects/co-safety/
skills/meeting-facilitation/SKILL.md` against the template copy when both exist.
The `Projects/`-absence assertion in the absent branch is an environment
meta-assertion, not part of that protection — and it fails exactly the forks the
issue describes (a gitignored `Projects/` tree without co-safety). A tempdir-based
REPO_ROOT fixture was considered and rejected: the leg's entire value comes from
comparing the REAL workspace copies, so a fixture would test only the test's own
comparison code (a weakening, not a strengthening).

Fix: the absent-`Projects/co-safety` branch returns with a named-reason comment;
the meta-assertion is removed; the byte-identity assertions in the present branch
are byte-identical to before. Test name updated to name the actual skip condition
(`Projects/co-safety`, not `Projects/`).

## 4. Fix (blocker 4): CV02_BASE + explicit budget

The validator's own base chain (validate-templates.ts CV-02 section):
`CV02_BASE` env when set, else `git merge-base HEAD origin/main`, else `HEAD`.

- The test stops overriding `CV02_BASE`: the child environment is inherited, so a
  caller-provided `CV02_BASE` (dev-sync step 4.85) is honored and the validator's
  default chain decides otherwise. On a bare CI clone, merge-base == HEAD → clean
  pass, same as today.
- Explicit in-test budget `60_000` (third `test()` argument) vs bun's default
  5s per-test ceiling — budgets and scheduling only; the assertion is unchanged.
- `scripts/test-runner.ts` v1.22.0: first-time FILE_TIME_BUDGETS row
  `validate-templates-cv02.test.ts { suite: 300000, test: 60000 }` at the
  engine-spawn family budget (preventive pin, same shape as the v1.21.0
  upgrade-prune-removed entry; evidence = the ~55s Windows measurement reported
  in the issue). SCRIPTS.md row updated in lockstep.

## 5. Fix (blocker 5): Windows prerequisites documentation

README.md "Prerequisites" section gains a "Windows Prerequisites (running the
test suite)" subsection. Every row is verified against the repo, not the issue's
claims:

- Developer Mode: 33 `symlinkSync` call sites across 10+ unit test files, called
  directly with no capability guard → EPERM without Developer Mode.
- Git `usr\bin` on PATH: `tests/unit/commit-msg-hook.test.ts` spawns `bash`;
  `tests/unit/automation-lock.test.ts` `deadPid()` spawns `true`; the Git for
  Windows installer adds only the main `Git\bin`.
- Bun: CI pins `bun-version: 1.4.4` (test.yml; "matches local dev"); package.json
  engines `bun >= 1.0.0`. Node is NOT required for the suite — the CI
  `node-version: 18.x` matrix value exists only to name branch-protection check
  contexts (the workflow comment says so explicitly; there is no setup-node step).

## 6. Fix (blocker 6): template-version-aware tag sort

`scripts/list-template-versions.ts` v1.2.0:

- Exported pure comparator `compareTemplateTags(a, b)`: parses the
  `template-vX.Y.Z` shape (`/^template-v(\d+)\.(\d+)\.(\d+)$/`), compares
  major/minor/patch numerically (v0.9.0 < v0.30.0); a known shape sorts before an
  unknown shape; two unknown shapes (and equal versions) compare 0 —
  `Array.prototype.sort` is stable, so input order is preserved.
- The tag list sorts with the comparator; the latest-tag computation
  (`tags[tags.length - 1]`) is unchanged and now reads the true latest.
- The CLI body moves behind an `import.meta.main` guard (house convention) so the
  unit test imports the comparator without executing the CLI. CLI stdout is
  unchanged for every input.
- New `tests/unit/list-template-versions.test.ts` pins the issue's evidence case
  (v0.9.0 vs v0.30.0), the lexical `0.10.0 < 0.2.0` trap, a full-list sort,
  unknown-shapes-last, and stability. SCRIPTS.md row updated in lockstep.

## 7. Verification

- `bun test tests/unit` green locally (all new + existing pins).
- `bun scripts/test-runner.ts unit` green (budget row accepted by the runner's
  own order/registry gate).
- `bun scripts/list-template-versions.ts` output spot-checked against the real
  tag set (known tags only in this repo → output identical to the pre-fix order
  requirement: ascending semver).
- Gates at landing: typecheck, audit, validate-templates, lifecycle-sync via
  dev-sync.
