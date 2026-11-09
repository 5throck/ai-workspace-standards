# Repository Integrity — Corruption Mode 1 Detector and Snapshot Coverage — Design (Row 0)

- **Spec id**: `2026-11-09-repo-integrity-mode1-detector-design`
- **Date**: 2026-11-09
- **Status**: implemented (spec registered via spec-register at implementation; Design Gate ruling DEC-20261109-01)
- **Author**: architect (PM-dispatched)
- **Tracking ticket**: T-20261109-002
- **Related**: `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` §11 (the mode-2 config-integrity guard this design extends), `scripts/lib/repo-integrity.ts` v1.0.0, `scripts/lib/git-env.ts` v1.2.0, `scripts/dev-sync.ts` step 4.88, `scripts/hooks/pre-push.ts` v1.8.1, PR #1935 (env sanitizer) + PR #1936 (config-integrity gate)

## 1. Problem statement

The 2026-11-09 repository-config corruption incident had two corruption modes, both caused by a spawned test child inheriting a git hook's `GIT_DIR` (`scripts/lib/git-env.ts` header records the chain). Mode 2 — `git config` writes landing on the real repository (`core.bare = true`) — is now mechanically detected by the config-integrity snapshot/compare gate (dev-sync step 4.88, pre-push snapshot pair). Mode 1 is not:

1. **Rogue commits have no detector.** In the incident, the `git push` pre-push hook's `bun test` child inherited `GIT_DIR`; the `upgrade-project` fixtures' `git init`/`add`/`commit` ran against the checkout instead of their tmpdir, producing 10 commits authored `Test <test@example.com>` (~393 files, three L1 core scripts deleted) on the PR branch. Today nothing mechanically refuses a branch that carries such commits: the config snapshot/compare cannot see commits, and the corruption was found manually. A same-class incident would be pushed and discovered downstream in CI again.
2. **Per-worktree config is outside the snapshot.** With `extensions.worktreeConfig` enabled, per-worktree configuration lives at `.git/worktrees/<name>/config.worktree` and is consulted by git on every command. `snapshotRepoConfig()` reads `git config --local --list` only — a child write under `--worktree` scope would pass the step-4.88 compare untouched while changing real repository behavior.
3. **Direct `bun test` runs are covered by neither gate.** The env sanitizer (PR #1935) and the snapshot/compare gates both protect *pipeline-driven* runs (dev-sync, pre-push). An agent or operator running `bun test <suite>` directly inherits whatever `GIT_DIR` the calling shell exports; if a suite's fixture spawn has lost (or never had) its `gitCleanEnv()` wrapper, the corruption happens with no gate in the path. Defense currently rests entirely on every suite remembering the wrapper.

## 2. Goals and non-goals

**Goals**

- G1: A mechanical, fail-closed detector for rogue-author commits (`Test <test@example.com>` class) reachable from HEAD but not from a resolved base ref — wired into the same dev-sync step 4.88 gate that carries the config-integrity guard, and into pre-push over the exact range being pushed.
- G2: Snapshot/compare coverage for the per-worktree config scope (`config.worktree`) in both callers, with the same any-delta-is-FATAL semantics.
- G3: Fixture-suite self-assertion so a suite run directly under a redirected environment fails loudly at fixture setup instead of silently corrupting the outer repository.

**Non-goals**

- No automatic repair of any kind — the detectors report and block; removing rogue commits (`rebase`/`reset`) and config repair stay manual, per the §11 "reports, does not edit" discipline.
- No generalized author-policy lint (e.g. forbidding bot identities, enforcing CODEMINT authors). The blocklist covers the known fixture-identity class only; broadening it is a separate decision.
- No detection of rogue *working-tree* mutations that were never committed (the incident's file deletions rode the rogue commits; uncommitted residue is out of scope).
- No new sanitizer keys or changes to `scripts/lib/git-env.ts` — the sanitizer stays as shipped in PR #1935.
- No history-wide scan of already-pushed commits (the base-resolution design in §3.2 scopes every scan to "since the branch point / since the last push").

## 3. Design

### 3.1 D1 — Rogue-author commit detector (primitives, in `scripts/lib/repo-integrity.ts`)

One new derivation, three pieces, following the module's existing "one derivation, many callers" discipline. Module bumps to **v1.1.0** with a header rationale comment citing this design and T-20261109-002.

**Blocklist.** `ROGUE_IDENTITY_EMAIL_PATTERNS: RegExp[]` — seeded with `/^test@example\.com$/i`. The *email* is the stable half of the incident identity (the fixture sets name/email per repo; the observed author string was `Test <test@example.com>`, but a name alone is not durable). Patterns match against author email **and** committer email, case-insensitively. Extending the list means adding one literal regex with a comment naming where the identity came from — never a skip env (§11 stance carries over).

**Scan primitives.**

```ts
export interface RogueCommitRecord { sha: string; field: 'author' | 'committer';
  identity: string; subject: string; }
export interface RogueScanResult =
  | { ok: true; commits: RogueCommitRecord[] }   // commits.length === 0 means clean
  | { ok: false; reason: string };               // unresolvable base / git failure — fail-closed

/** Pure filter over one `git log` stream — unit-testable without any git spawn.
 *  Input lines are `sha\x1fan\x1fae\x1fcn\x1fce\x1fsubject` records. */
export function filterRogueCommits(logOutput: string, patterns?: RegExp[]): RogueCommitRecord[];

/** Spawn + filter: `git -C <root> log <base>..HEAD --format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s`
 *  under gitCleanEnv() (same rule as every read in this module: a redirected read would
 *  scan the wrong repository and report clean). Non-zero git exit → { ok:false }. */
export function scanRogueCommits(base: string, root?: string): RogueScanResult;

/** Base resolution, in order (see §3.2). Returns { ok:true, base } | { ok:false, reason }. */
export function resolveRogueScanBase(root?: string): { ok: true; base: string } | { ok: false; reason: string };
```

**Why filter in TS instead of `git log --author=<pattern>`**: the TS filter (a) returns SHAs + identities + subjects for the refusal message, (b) checks both author and committer fields in one spawn, (c) is purely unit-testable — no fixture repo needed to pin the matching rules. One git spawn per scan either way.

### 3.2 D1a — Base-ref resolution

The scan window is `base..HEAD`. Resolution order (first success wins), all probes under `gitCleanEnv()`:

1. **`HEAD@{upstream}`** — `git rev-parse --abbrev-ref HEAD@{upstream}`. On a PR branch (the incident's surface), this is the remote PR branch tip: the window is exactly "commits made since the last successful push", which covers both a rogue commit produced during *this* run's test steps and one left over from an earlier gate-less session.
2. **`origin/main`** — `git rev-parse --verify origin/main` (the workspace's protected default branch; pre-push blocks direct pushes to it, so it is a trustworthy known-good boundary). Used when HEAD has no upstream (first dev-sync run on a brand-new branch, local-only branches). The window is the whole branch — cheap and still exact, because legitimate branch commits carry operator/bot identities that the blocklist never matches.
3. **Neither resolvable → `{ ok:false }`** and the caller aborts. *Fail-closed on purpose*: this repository always has `origin/main` in practice (dev-sync's whole purpose ends in push/PR), and an integrity gate that cannot establish a comparison base must not silently pass. The refusal message states the missing refs and cites this design.

Known acceptable limitation (documented, not designed around): a shallow clone or a detached HEAD in a repo without `origin/main` refuses to sync with an actionable message; this workspace does not operate in that mode.

### 3.3 D1b — Gate wiring (same step, second arm)

**dev-sync (v1.45.0 → v1.46.0).** Step 4.88 becomes the *spawned-child integrity gate* with two arms, in this order, inside the same `if (configSnapshotAtStart)` block:

- **Arm 1 (existing)**: config snapshot/compare — unchanged, now also comparing the worktree-scope section (§3.4).
- **Arm 2 (new)**: `resolveRogueScanBase()` + `scanRogueCommits()`. `ok:false` (unresolvable base or git failure) → FATAL with the reason. Non-empty commit list → FATAL listing one line per commit (`sha field identity — subject`), followed by the remedy block: the commits were authored by a known fixture identity, the branch must not be pushed or staged; repair is manual history surgery (`git rebase` drop / `git reset` while unpushed) after confirming no legitimate work is discarded, then re-run `/sync`; the spawning test must run under `scripts/lib/git-env.ts`. Both arms must pass before the 4.9 audit gate — placement rationale is inherited from §11: a run that corrupted the repository must never reach staging/commit.

Placement cost: one extra `git log` over the scan window per dev-sync run. PR branches carry single-digit to low-double-digit commits; the spawn is milliseconds against a gate battery that runs full test suites.

**pre-push (v1.8.1 → v1.9.0).** New check immediately after the pure-deletion early-exit and before the gitleaks scan: for each ref update with a valid (non-zero, hex-shaped — the `collectPushedChangedFiles` validation) `localOid`, scan the exact range the push would transfer — `remoteOid..localOid` for existing remote refs, `localOid --not --remotes` for new branches (the same scoping `collectPushedChangedFiles` uses today, so no new range math). Any hit → refuse the push listing the commits. Rationale: dev-sync's arm catches corruption before commit; pre-push's arm is the last line before corrupted history reaches the remote — including corruption produced outside any pipeline (direct `bun test` + manual push). Cost: one `git log` per pushed ref; pushes carry 1-2 refs.

**Interplay with the existing snapshot guard**: none of the new reads or writes conflict. The config snapshot/compare continues to guard configuration; the rogue-author scan guards history. The pre-push hook keeps its fail-closed snapshot phases exactly as v1.8.1 shipped them.

### 3.4 D2 — Worktree-config coverage in the snapshot

`snapshotRepoConfig()` (repo-integrity.ts) gains a second section:

- Probe `git config --type=bool --get extensions.worktreeConfig` (one extra read, under `gitCleanEnv()`).
- When the probe returns `true`: read `git config --worktree --list` (one more read) → `worktreeEntries: string[]` (sorted, same normalization as `entries`).
- When unset/false/non-boolean: `worktreeEntries: []` — git consults no worktree config in that mode, so an empty list is the truthful snapshot (no nullable third state; `[]` and "feature off" are behaviorally identical for diffing).

`RepoConfigSnapshot.worktreeEntries` is compared by both callers with the existing pure `diffRepoConfig()` (it already handles arbitrary key=value line lists). Delta rows from the worktree section are printed with a `wt: ` prefix so the operator can see which scope moved. FATAL semantics unchanged: any delta in either scope aborts.

Edge cases, all covered by the same two reads:

- **Extension flips ON mid-run**: the enabling key `extensions.worktreeConfig=true` lives in the common config → Arm 1's local delta reports it; the worktree section additionally appears in the post snapshot and diffs against an empty pre list. Both reported; one FATAL.
- **Extension flips OFF mid-run**: local delta reports the removed key. (Leftover `config.worktree` files become git-inert when the extension is off — the gate follows git's own resolution semantics, which is the contract: "snapshot what git consults".)
- **Extension on at both ends, `config.worktree` content changed**: caught by the worktree-section diff alone.
- **Effective `core.bare`**: the existing `git config --bool --get core.bare` probe takes no scope flag, so it already resolves across the worktree scope when the extension is enabled — no change needed there.

Cost: +1 read per snapshot when the extension is off (probe only — this repo's steady state), +2 when on. Both callers inherit the extension via the shared snapshot function.

### 3.5 D3 — Fixture-suite self-assertion

**Threat model**: a direct `bun test` run inherits the caller's exported `GIT_DIR` (hooks export it; agents' shells sometimes carry it). A suite whose fixture harness lost its `gitCleanEnv()` wrapper then redirects its `git init`/`add`/`commit` into the outer repository. Two independent failure conditions must each be detected: hostile caller environment (FM1) and a regressed wrapper inside the harness (FM2 — observable only under FM1).

**New helper — `tests/helpers/fixture-git.ts`** (the existing shared-helpers directory; header comment cites this design). Two probes, both taking an injectable `baseEnv` (default `process.env`) so the helper itself is unit-testable:

```ts
/** FM1 probe: runs `git rev-parse --absolute-git-dir` and `git rev-parse --show-toplevel`
 *  with cwd = fixtureRoot under the RAW inherited env (no sanitization). If either resolves
 *  outside realpath(fixtureRoot), the caller's environment redirects git — throw with the
 *  leaked target path, the fixture root, and the remedy (wrap spawns in scripts/lib/git-env.ts
 *  gitCleanEnv()/gitCleanEnvForShell(); see the 2026-11-09 incident). Suites call this at
 *  fixture setup: a hostile environment fails the suite LOUDLY at the top, before any write. */
export function assertCallerEnvSafeForGitFixtures(fixtureRoot: string, baseEnv?): void;

/** FM2 probe: the same two rev-parse reads under gitCleanEnv(baseEnv) — verifies the
 *  suite's own sanitized spawn machinery resolves INSIDE the fixture root (end-to-end
 *  proof the wrapper is present and effective). Cheap; call right after `git init`. */
export function assertFixtureGitIdentity(fixtureRoot: string, baseEnv?): void;
```

Resolution checks: `--absolute-git-dir` must equal `realpath(<fixtureRoot>/.git)` or resolve strictly inside `realpath(fixtureRoot)`; `--show-toplevel` must equal `realpath(fixtureRoot)` (catches `GIT_WORK_TREE`-only leaks, which the git-dir probe cannot see). Fixtures are non-bare, so `--show-toplevel` is always valid there.

**Adoption.** The suites whose fixtures spawn git (2026-11-09 census: `tests/unit/workspace-hygiene.test.ts`, `tests/unit/mcp-upstream-tenant-identity.test.ts`, `tests/unit/external-deps-cli.test.ts`, `tests/unit/external-deps.test.ts`, `tests/unit/upgrade-decision-log.test.ts`, `tests/unit/upgrade-project-tenant-guard.test.ts`, `tests/unit/generator-manifest.test.ts`, `tests/unit/project-target-guards.test.ts`, `tests/unit/generate-scripts-mirror.test.ts`, `tests/unit/repo-integrity.test.ts`) call **both probes** in their fixture harness: the FM1 probe first (fails fast on hostile caller env), the FM2 probe immediately after `git init`. The implementation PR re-runs the census grep (`git init|gitCleanEnv` across `tests/`) and completes the list; no suite is grandfathered.

**Structural pin — `tests/unit/fixture-git-identity.test.ts`** (new): a registry list naming every adopted suite file; the test asserts each file imports from `tests/helpers/fixture-git.ts`, and re-derives the census (grep-equivalent scan over `tests/unit/*.test.ts` for fixture git usage) failing if a git-spawning suite is missing from the registry — the same maintenance shape as the existing routing/registry pins, so a future git-spawning suite cannot land without adopting the probes.

**Semantics decision**: the FM1 probe is a hard failure, not a warning. If wrappers are intact the suite would still be *safe*, but the contract "fixture suites refuse to run in a redirected environment" (a) converts silent exposure into a loud setup failure, (b) guarantees the FM2 probe remains meaningful, and (c) surfaces hostile shells (agent sessions inside hooks) immediately. The refusal message explains that wrapping is intact-by-construction only while every suite keeps the probes.

## 4. Failure semantics (summary)

| Surface | Condition | Behavior |
|---|---|---|
| dev-sync step 4.88 Arm 2 | base unresolvable / git log fails | FATAL, run aborts before audit/staging (§3.3) |
| dev-sync step 4.88 Arm 2 | any blocklisted identity in `base..HEAD` (author or committer) | FATAL listing SHAs + manual-repair guidance; no auto-repair |
| pre-push | any blocklisted identity in a pushed range | push refused with the commit list (§3.3) |
| Snapshot compare (both callers) | delta in local or worktree config scope | FATAL; worktree rows prefixed `wt: ` (§3.4) |
| `snapshotRepoConfig` | worktree extension off | `worktreeEntries: []` — feature-inactive, not a failure |
| Fixture suite (FM1 probe) | caller env redirects git | suite fails at setup with leak target + remedy (§3.5) |
| Fixture suite (FM2 probe) | harness wrapper regressed (under hostile env) | suite fails at `git init` with inside/outside proof (§3.5) |

## 5. False-positive analysis (D1)

The blocklist must never reject a legitimate commit. Evidence and reasoning:

- **Census (2026-11-09, `git log --all --format='%an <%ae>'`)**: every identity in this repository's full history is an operator identity (SungHyuk Park / 5throck / Mark Park over `techcross@gmail.com` and GitHub noreply addresses, with one historical `techcross@gamil.com` typo), dependabot, or Claude bot identities (`claude[bot]`, `Claude <noreply@anthropic.com>`, `webbrain-one`, `jaydo77`). Zero commits carry `test@example.com` (the incident's commits were removed during recovery).
- **Producer of the identity**: `Test <test@example.com>` is set by test fixtures for their *own* tmpdir repositories. A commit authored by it in the workspace checkout is by definition a redirected fixture write — the exact hazard. No sanctioned pipeline (dev-sync commits, agent commits, dependabot) uses it.
- **Case/space variations**: matching is on the email, case-insensitive and exact (`/^test@example\.com$/i`) — not a substring match, so `test@example.com.evil.example` or `test@example-com` cannot collide; and not name-based, so an unrelated human named "Test" with a different email passes.
- **Escape hatch**: none via environment (§11 discipline). If a legitimate commit ever carries a blocklisted identity (operator misconfigured `user.email`), the FATAL message says so explicitly and the remedy is fixing `git config user.email` + `git commit --amend --reset-author` — a one-command, auditable correction, not a permanent bypass.

## 6. Test plan

All unit tests in `tests/unit/`, mkdtemp fixtures with absolute roots, every fixture git spawn under `gitCleanEnv()` — the incident's own lessons.

### 6.1 `tests/unit/repo-integrity.test.ts` extensions

- **Pure filter pins**: `filterRogueCommits` matches author-email and committer-email hits independently (records name the matched field); case-insensitive `TEST@EXAMPLE.COM` matches; near-misses do not (`test@example.com.evil`, `test@example-com`, `tests@example.com`, a legitimate author named "Test" with another email); malformed/empty input yields empty; multi-commit streams return every hit in order.
- **Base resolution**: fixture repo with upstream set → upstream tip; upstream unset + `origin/main` present → `origin/main`; neither → `{ok:false}` with a reason naming both probes; detached HEAD exercises the fallback path.
- **Scan integration**: fixture repo with a legit commit + a rogue commit (`git -c user.name=Test -c user.email=test@example.com commit` against the *fixture* — env-scoped identity on fixture-local config, sanctioned) → scan finds exactly the rogue SHA; clean range → `{ok:true, commits:[]}`; non-repository root → `{ok:false}`.
- **Worktree snapshot**: fixture with `extensions.worktreeConfig=true` + a `--worktree` write between snapshots → both callers' verdict functions refuse with `wt: ` rows; extension off → `worktreeEntries === []`; extension flips on mid-run → local delta carries the enabling key.
- **Structural pins**: the Arm-2 scan sits inside the step-4.88 block after the config compare and before the 4.9 audit gate (source-order assertions, extending the existing §11 pins); pre-push performs the rogue scan per pushed range before the gitleaks stage; the hook has no fail-open path for the new check.

### 6.2 `tests/unit/fixture-git-identity.test.ts` (new)

- Helper probes with injected `baseEnv`: clean env → both probes pass on a fixture repo; env with `GIT_DIR` pointed at an outer repo → FM1 probe throws naming the leaked target; env with `GIT_WORK_TREE` only → FM1 probe throws via the toplevel check; sanitized re-probe (FM2) passes under the same hostile env when the harness wrapper is applied, and the raw probe still throws — pinning that the two probes measure different things.
- Registry pin: every adopted suite imports the helper; the census re-derivation fails on an unregistered git-spawning suite (tested by planting a temp `*.test.ts` fixture file with a `git init` string in a scratch dir passed to the census function — the census must be a pure, injectable-root function like the fleet helpers).

### 6.3 Regression battery

`bun run test` / `bun run test:unit` green; `bun scripts/typecheck.ts` green; `bun scripts/audit.ts` green; a manual `GIT_DIR=$(git rev-parse --git-dir) bun test tests/unit/workspace-hygiene.test.ts` run now fails at the FM1 probe (documented reproduction of the incident precondition turning into a loud failure), and dev-sync + pre-push behavior verified by the structural pins.

## 7. Rollout and acceptance

One implementation PR (automation-engineer dispatch): repo-integrity.ts v1.1.0 (+ delivered mirror regeneration via the existing sync machinery — the module is already an L0+L1 delivered file per the mirror registry, and its delivered consumers — dev-sync, pre-push — pick the extension up byte-identically; no new registry row, only a rationale comment update in `tests/unit/generate-scripts-mirror.test.ts`), dev-sync v1.46.0, pre-push v1.9.0, `tests/helpers/fixture-git.ts` + suite adoption + new tests, version-header bumps with rationale comments on every touched script.

**Acceptance criteria** (each verifiable):

- [ ] `filterRogueCommits` pure pins pass, including the near-miss table of §6.1.
- [ ] Fixture integration: a rogue commit in `base..HEAD` is found and reported with SHA + identity + subject; a clean range passes; base resolution order (upstream → origin/main → refuse) is pinned.
- [ ] dev-sync step 4.88 aborts a run when a planted rogue commit exists on the branch (structural pin + integration proof) and passes a clean branch; the config arm's behavior is byte-for-byte unchanged.
- [ ] pre-push refuses a push whose range contains a blocklisted identity and passes a clean range; pure-deletion pushes keep short-circuiting before the scan.
- [ ] `snapshotRepoConfig` captures the worktree scope when `extensions.worktreeConfig=true` and both callers refuse a mid-run `--worktree` write with `wt: ` rows; extension-off cost is +1 probe read.
- [ ] Every git-spawning fixture suite calls both probes; the FM1 probe fails a suite run under a deliberately exported `GIT_DIR` at setup (reproduction of the §6.3 manual case); the census pin fails when a new git-spawning suite skips adoption.
- [ ] No env-var skip path exists for any new detector (grep-verifiable in the three touched files).

## 8. Rollback

All additions are additive to existing gates. Rollback = revert the single PR: step 4.88 returns to its config-only arm, pre-push to v1.8.1 behavior, `snapshotRepoConfig` to local-only scope, suites drop the probe calls (helper file becomes inert). No data migration, no persisted state (the detector is stateless — it reads refs, it records nothing), no schema or config file changes.

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no SKILL.md, command, or settings change; the detectors are pipeline/scripts assets | None |
| Antigravity (GEMINI.md) | None — the gates live in repo scripts shared by every platform's sync flow; no platform-specific wiring exists or is needed | None |
| templates/common | **Propagation required via existing machinery only**: `scripts/lib/repo-integrity.ts` (already a delivered L0+L1 file), `scripts/dev-sync.ts`, and `scripts/hooks/pre-push.ts` regenerate their delivered copies byte-identically through the mirror sync (dev-sync steps 4.x); the mirror registry gains only rationale-comment updates, no row-count change. `tests/helpers/fixture-git.ts` and all test files are L0-only and must NOT enter any propagation map | 3 delivered scripts, 0 registry rows |

## 10. Accessibility note

Backend/non-UI work only — git integrity gates, pipeline scripts, and test infrastructure. No user-facing interface, document layout, or content is produced; the accessibility audit is exempt for this design.

## 11. Open questions

None blocking. Non-blocking notes: (1) the exact FATAL message wording for the Arm-2 refusal is finalized at edit time following the §11 message shape; (2) if a second fixture identity ever appears in the wild, extending `ROGUE_IDENTITY_EMAIL_PATTERNS` is a one-line change with a census re-run — no design change; (3) the adoption census list in §3.5 is re-derived at implementation time; suites created between this design and the PR are added by the same grep, not by hand.

## 12. References

- `scripts/lib/repo-integrity.ts` v1.0.0 (snapshot/diff/health primitives, gitCleanEnv discipline, sanctioned-writer analysis)
- `scripts/lib/git-env.ts` v1.2.0 (incident chain, `GIT_REDIRECT_ENV_KEYS`, `gitCleanEnv`/`gitCleanEnvForShell` semantics)
- `scripts/dev-sync.ts` step 4.88 (config-integrity gate, lines 1734-1780; run-start baseline, lines 484-496) and start-of-run `assertWorkTreeHealthy` (lines 470-482)
- `scripts/hooks/pre-push.ts` v1.8.1 (fail-closed snapshot phases, `repoConfigGuardVerdict`, changed-path spawn under `gitCleanEnvForShell`)
- `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` §11 (mode-2 guard this design extends; format exemplar)
- `tests/unit/repo-integrity.test.ts` (existing pure/fixture/structural pin structure)
- `tests/unit/generate-scripts-mirror.test.ts` (mirror registry; repo-integrity.ts + git-env.ts delivery rows)
- T-20261109-002 (tracking ticket), PR #1935 + PR #1936 (incident fixes)
