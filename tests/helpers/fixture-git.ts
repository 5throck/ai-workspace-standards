// @version 1.3.0
// v1.3.0 (2026-11-09, PR #1941 CI follow-up round 3 — terminal-pass design): the
//          `--show-toplevel` EQUALITY check now runs through `path.relative` (=== '')
//          like containment already did, instead of string `===`. Same result on POSIX
//          (exact); on win32 it inherits the platform's case-insensitive comparison, drive
//          letter included, so `C:/...` (one authority) vs `c:/...` (another) for the same
//          volume can never refuse a safe fixture. Chosen over a lowercasing transform in
//          the default canonicalizer: that would have changed canonicalizePath() OUTPUT on
//          Windows (`c:/Users/...`) and broken the round-2 message pins, which compare it
//          against git's raw `C:/Users/...` text. The default canonicalizer is factored as
//          defaultCanonicalize() (OS-native realpath, case-faithful output). POSIX
//          behavior byte-identical.
// v1.2.0 (2026-11-09, PR #1941 CI follow-up round 2): export canonicalizePath() — the
//          default canonical comparison form (OS-native realpath + separator
//          normalization) — so tests can compute the same form the probes compare
//          against when pinning refusal-MESSAGE content: the FM1/FM2 messages carry the
//          git-reported paths, which on Windows 8.3 runners are the LONG forward-slash
//          form (git resolves GIT_DIR/GIT_WORK_TREE itself), not the SHORT-form mkdtemp
//          input. Probes and messages unchanged — this export is read-only test
//          machinery for the pins.
// v1.1.0 (2026-11-09, PR #1941 CI follow-up — windows-latest FM2 false positive):
//          Windows runners hand mkdtemp'd fixture roots in 8.3 SHORT-NAME form
//          (`C:\Users\RUNNER~1\AppData\Local\Temp\...`) while git resolves the SAME
//          directory to the LONG form (`C:/Users/runneradmin/AppData/Local/Temp/...`).
//          The v1.0.0 containment comparison was a raw path-prefix/segment check, so
//          the FM2 probe refused a SAFE fixture ("--absolute-git-dir resolves OUTSIDE
//          the fixture root") and the suites failed on CI. Fix: both sides of every
//          containment comparison are CANONICALIZED first — fs.realpathSync.native
//          (the OS call: expands 8.3 short names AND symlinks; the plain JS
//          realpathSync does not expand short names) with a documented plain-path
//          fallback when the OS call throws, then `path.sep` → `/` separator
//          normalization (git prints forward slashes on Windows). Injectable via
//          FixtureGitProbeOptions.canonicalize / the exported isGitPathInsideFixture
//          seam so the aliasing is unit-pinned without a real 8.3 filesystem
//          (tests/unit/fixture-git-identity.test.ts). Fail-closed semantics UNCHANGED:
//          a canonicalization fallback can only over-REFUSE under exotic aliasing,
//          never pass a real leak. Refusal messages still carry the RAW paths as git
//          reported them (diagnostics), so wording is stable across platforms.
// v1.0.0 (2026-11-09): fixture-suite git self-assertion probes (spec
//          docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5,
//          T-20261109-002).
//
// Threat model: a direct `bun test` run inherits whatever GIT_DIR the calling shell
// exported (hooks export it; agent sessions sometimes carry it). A suite whose fixture
// harness lost (or never had) its scripts/lib/git-env.ts wrapper then redirects its
// `git init`/`add`/`commit` into the OUTER repository — the 2026-11-09 incident's
// mechanism (10 rogue `Test <test@example.com>` commits, ~393 files, three L1 core
// scripts deleted on the PR branch). Both gates (dev-sync step 4.88, pre-push) only see
// such corruption AFTER it exists; these probes convert the precondition into a LOUD
// fixture-setup failure BEFORE any write happens.
//
// Two independent failure conditions, two probes:
//   FM1 — assertCallerEnvSafeForGitFixtures(): the CALLER's environment redirects git
//         (raw-env probe, run first, before any fixture git call);
//   FM2 — assertFixtureGitIdentity(): the suite's own SANITIZED spawn machinery still
//         resolves inside the fixture root (end-to-end proof the gitCleanEnv() wrapper
//         is present and effective; call right after `git init`).
//
// Semantics decision (design §3.5): the FM1 probe is a HARD failure, not a warning. If
// wrappers are intact the suite would still be safe, but the contract "fixture suites
// refuse to run in a redirected environment" (a) converts silent exposure into a loud
// setup failure, (b) guarantees the FM2 probe remains meaningful, and (c) surfaces
// hostile shells (agent sessions inside hooks) immediately.
//
// Adoption: every git-spawning fixture suite calls BOTH probes in its fixture harness
// (the adopted-suite registry lives in tests/unit/fixture-git-identity.test.ts and is
// checked against deriveFixtureGitCensus() below — a new git-spawning suite cannot land
// without adopting the probes).

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { GIT_REDIRECT_ENV_KEYS, gitCleanEnv } from '../../scripts/lib/git-env.ts';

type FixtureEnv = Record<string, string | undefined>;

/** Injectable seam for the probes and the containment check (see isGitPathInsideFixture). */
export interface FixtureGitProbeOptions {
  /**
   * Path canonicalizer applied to BOTH sides of every containment comparison.
   * Default: `fs.realpathSync.native` (the OS call — resolves symlinks AND Windows 8.3
   * short names like `RUNNER~1` → `runneradmin`, which the plain JS realpathSync does
   * NOT) + separator normalization. Tests inject doubles to pin the aliasing behavior
   * deterministically on every platform (PR #1941 CI follow-up).
   */
  canonicalize?: (p: string) => string;
}

/**
 * OS-native realpath, feature-detected: runtimes without `realpathSync.native`
 * fall back to the JS realpath (still symlink-correct; only 8.3 expansion is lost —
 * the separator normalization below still applies).
 */
const OS_NATIVE_REALPATH = (p: string): string =>
  typeof realpathSync.native === 'function' ? realpathSync.native(p) : realpathSync(p);

/**
 * DEFAULT canonicalizer for the probes and containment checks: the OS-native realpath
 * (8.3 short-name + symlink resolution). Case is deliberately NOT transformed here: on
 * win32 BOTH comparisons (containment and `--show-toplevel` equality) run through
 * `path.relative`, which compares case-insensitively — drive letter included — so
 * `C:/...` vs `c:/...` from two Windows authorities (git vs libuv) is tolerated by
 * construction, while POSIX stays exact. Keeping the OUTPUT case-faithful means
 * canonicalizePath() and refusal messages stay byte-identical to git-reported text (the
 * round-2 message pins depend on that; a lowercasing transform would have broken them).
 */
function defaultCanonicalize(p: string): string {
  return OS_NATIVE_REALPATH(p);
}

/**
 * Canonical comparison form of one path: the injectable canonicalizer (default: OS
 * native realpath, best-effort) then `path.sep` → `/` so git's forward-slash output on
 * Windows compares equal to platform paths.
 *
 * Documented fallback: when the canonicalizer throws (path does not exist yet, exotic
 * filesystem), the comparison runs on the separator-normalized plain path — FAIL-CLOSED,
 * because a failed expansion can only make equal-truth paths textually differ (over-
 * REFUSAL), never make different directories textually equal (that would pass a leak).
 */
function canonicalForm(p: string, canonicalize: (p: string) => string): string {
  let resolved = p;
  try {
    resolved = canonicalize(p);
  } catch {
    // fall back to the plain path (see doc comment — fail-closed direction)
  }
  return resolved.split(sep).join('/');
}

interface GitLocation {
  /** `git rev-parse --absolute-git-dir` output, or null when the read failed. */
  gitDir: string | null;
  /** `git rev-parse --show-toplevel` output, or null when the read failed. */
  toplevel: string | null;
  /** Combined stderr of both reads (empty when both succeeded). */
  stderr: string;
}

/**
 * Two independent rev-parse reads (NOT one combined spawn): with GIT_DIR aimed at a
 * BARE outer repository, `--show-toplevel` errors ("this operation must be run in a
 * work tree") and a combined spawn would discard the git-dir leak signal. Two reads
 * keep each signal alive independently. `cwd` is the RAW fixture root input — the OS
 * resolves it; only the COMPARISON canonicalizes.
 */
function readGitLocation(fixtureRoot: string, env: FixtureEnv): GitLocation {
  const gitDirRes = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env,
  });
  const toplevelRes = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env,
  });
  return {
    gitDir: gitDirRes.status === 0 ? (gitDirRes.stdout ?? '').trim() || null : null,
    toplevel: toplevelRes.status === 0 ? (toplevelRes.stdout ?? '').trim() || null : null,
    stderr: [gitDirRes.stderr, toplevelRes.stderr].filter(Boolean).join('; ').trim(),
  };
}

/** True when `child` equals `parent` or lives strictly inside it (path-relative form). */
function isInsideOrEqual(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Containment check for a git-resolved path against the fixture root, CANONICALIZED on
 * both sides first (PR #1941: Windows 8.3 short-name aliasing — `RUNNER~1` vs
 * `runneradmin` — is the same directory under two names and must compare EQUAL).
 * Exported so the aliasing behavior is pinnable with a fake normalizer and synthetic
 * Windows-styled strings, deterministically on every platform.
 */
export function isGitPathInsideFixture(
  childPath: string,
  fixtureRoot: string,
  canonicalize: (p: string) => string = defaultCanonicalize,
): boolean {
  return isInsideOrEqual(canonicalForm(childPath, canonicalize), canonicalForm(fixtureRoot, canonicalize));
}

/**
 * Canonical path EQUALITY (the `--show-toplevel` contract: must BE the fixture root).
 * Runs through `path.relative` like containment does, instead of `===`: identical
 * semantics on POSIX (exact), and on win32 the platform's case-insensitive comparison
 * (drive letter included) — one comparison engine for both checks (round 3).
 */
function isSameCanonicalPath(a: string, b: string, canonicalize: (p: string) => string): boolean {
  return relative(canonicalForm(b, canonicalize), canonicalForm(a, canonicalize)) === '';
}

/**
 * Canonical comparison form of one path under the DEFAULT canonicalizer (OS-native
 * realpath — expands Windows 8.3 short names like `RUNNER~1` — win32 drive-prefix case
 * normalization, plus `path.sep` → `/`). Exported so tests can compute the same form
 * the probes compare against: refusal messages carry the git-reported paths, which on
 * Windows runners are the LONG forward-slash form (git resolves GIT_DIR/GIT_WORK_TREE
 * itself), so message-content pins must assert against this canonical form, not the
 * raw mkdtemp input (PR #1941 CI follow-up). Never throws — same documented fallback
 * as the comparison path (plain separator-normalized text when the OS realpath fails).
 */
export function canonicalizePath(p: string): string {
  return canonicalForm(p, defaultCanonicalize);
}

const FIXTURE_GIT_REMEDY =
  'Remedy: run every fixture git spawn under scripts/lib/git-env.ts '
  + '(gitCleanEnv() for spawnSync/Bun.spawn, gitCleanEnvForShell() for Bun Shell) and call '
  + 'tests/helpers/fixture-git.ts probes at fixture setup. '
  + 'Ref: docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5 '
  + '(2026-11-09 rogue-commit incident).';

/**
 * FM1 probe — the CALLER's environment must not redirect git out of the fixture root.
 * Runs `git rev-parse --absolute-git-dir` and `git rev-parse --show-toplevel` with
 * cwd = fixtureRoot under the RAW inherited env (no sanitization). Throws — naming the
 * leaked target path, the fixture root, and the remedy — when the ENVIRONMENT makes a
 * read resolve outside the fixture root, or when a redirect variable is present but the
 * reads cannot resolve at all (fail-closed: a hostile env we cannot resolve is a
 * hostile env). Suites call this FIRST in their fixture harness, before any fixture git
 * call: a hostile environment fails the suite LOUDLY at the top, before any write.
 *
 * Attribution (false-positive guard, verified against the live tree): a fixture root
 * may legitimately sit INSIDE an enclosing repository (e.g. a fixture under
 * `tests/.temp/` in the workspace checkout). Pre-`git init`, plain cwd DISCOVERY from
 * that location walks up to the enclosing repo — that is git working as designed, not
 * an environment redirect. So an outside raw resolution only throws when a SANITIZED
 * reference read (gitCleanEnv(baseEnv), same cwd) resolves DIFFERENTLY: if sanitized
 * and raw agree, the environment contributed nothing and the fixture is safe until its
 * own `git init` takes discovery over.
 *
 * `baseEnv` is injectable (default `process.env`) and `opts.canonicalize` is injectable
 * (default: OS-native realpath + separator normalization) so the probe is unit-testable
 * without a hostile shell or a real 8.3 filesystem. Both reads failing with a CLEAN env
 * is not a leak — a plain directory before `git init` resolves nothing and redirects
 * nothing, so the probe passes.
 */
export function assertCallerEnvSafeForGitFixtures(
  fixtureRoot: string,
  baseEnv: FixtureEnv = process.env as FixtureEnv,
  opts: FixtureGitProbeOptions = {},
): void {
  const canonicalize = opts.canonicalize ?? defaultCanonicalize;
  const raw = readGitLocation(fixtureRoot, baseEnv);

  const leaks: string[] = [];
  const rawOutside: string[] = [];
  if (raw.gitDir !== null && !isGitPathInsideFixture(raw.gitDir, fixtureRoot, canonicalize)) {
    rawOutside.push(`git rev-parse --absolute-git-dir resolves OUTSIDE the fixture root: ${raw.gitDir}`);
  }
  if (raw.toplevel !== null && !isSameCanonicalPath(raw.toplevel, fixtureRoot, canonicalize)) {
    // The toplevel check is what catches GIT_WORK_TREE-only leaks, which the
    // git-dir probe cannot see.
    rawOutside.push(`git rev-parse --show-toplevel resolves OUTSIDE the fixture root: ${raw.toplevel}`);
  }
  if (rawOutside.length > 0) {
    // Attribute the outside resolution: discovery (sanitized reference) vs redirect.
    const reference = readGitLocation(fixtureRoot, gitCleanEnv(baseEnv));
    const sameAsDiscovery = reference.gitDir === raw.gitDir && reference.toplevel === raw.toplevel;
    if (!sameAsDiscovery) {
      leaks.push(...rawOutside);
    }
  }
  const hostileEnv = GIT_REDIRECT_ENV_KEYS.some((key) => baseEnv?.[key] !== undefined);
  if (leaks.length === 0 && hostileEnv && (raw.gitDir === null || raw.toplevel === null)) {
    leaks.push(
      `a git-redirect variable is set in the caller's environment `
      + `(${GIT_REDIRECT_ENV_KEYS.filter((key) => baseEnv?.[key] !== undefined).join(', ')}) `
      + `but the fixture repository could not be resolved under it (${raw.stderr || 'git returned no detail'})`,
    );
  }
  if (leaks.length > 0) {
    throw new Error(
      `fixture-git: the CALLER's environment redirects git away from the fixture root ${fixtureRoot}: `
      + `${leaks.join('; ')}. Any fixture git spawn would write into that repository `
      + `(2026-11-09 incident: 10 rogue 'Test <test@example.com>' commits on the PR branch). ${FIXTURE_GIT_REMEDY}`,
    );
  }
}

/**
 * FM2 probe — the suite's own SANITIZED git machinery must resolve INSIDE the fixture
 * root. Same two rev-parse reads as the FM1 probe, but under `gitCleanEnv(baseEnv)`:
 * this is the end-to-end proof that the suite's wrapper is present and effective (call
 * it right after `git init`). Throws with the inside/outside proof when the sanitized
 * reads fail (the fixture is not a repository) or resolve outside the fixture root —
 * compared on CANONICALIZED forms, so Windows 8.3 short-name aliasing
 * (`C:\Users\RUNNER~1\...` fixture root vs `C:/Users/runneradmin/...` git output) does
 * not false-positive (PR #1941 CI follow-up).
 *
 * `baseEnv` is injectable (default `process.env`) and `opts.canonicalize` is injectable
 * so the probe itself is unit-testable. FM1 and FM2 measure different things: under a
 * hostile env, FM2 PASSES (the wrapper neutralizes the redirect) while the raw FM1
 * probe still throws — both behaviors are pinned in tests/unit/fixture-git-identity.test.ts.
 */
export function assertFixtureGitIdentity(
  fixtureRoot: string,
  baseEnv: FixtureEnv = process.env as FixtureEnv,
  opts: FixtureGitProbeOptions = {},
): void {
  const canonicalize = opts.canonicalize ?? defaultCanonicalize;
  const { gitDir, toplevel, stderr } = readGitLocation(fixtureRoot, gitCleanEnv(baseEnv));

  const problems: string[] = [];
  if (gitDir === null) {
    problems.push(`git rev-parse --absolute-git-dir failed under the sanitized environment (${stderr || 'git returned no detail'})`);
  } else if (!isGitPathInsideFixture(gitDir, fixtureRoot, canonicalize)) {
    problems.push(`--absolute-git-dir resolves OUTSIDE the fixture root: ${gitDir}`);
  }
  if (toplevel === null) {
    problems.push(`git rev-parse --show-toplevel failed under the sanitized environment (${stderr || 'git returned no detail'})`);
  } else if (!isSameCanonicalPath(toplevel, fixtureRoot, canonicalize)) {
    problems.push(`--show-toplevel resolves OUTSIDE the fixture root: ${toplevel}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `fixture-git: the suite's SANITIZED git machinery does not resolve inside the fixture root ${fixtureRoot}: `
      + `${problems.join('; ')}. This suite's gitCleanEnv() wrapper is missing or ineffective — `
      + `every fixture spawn would still write into another repository. ${FIXTURE_GIT_REMEDY}`,
    );
  }
}

/**
 * Grep-equivalent re-derivation of the git-spawning-fixture-suite census (design §3.5):
 * every `*.test.ts` directly under `root` whose text mentions `git init` or
 * `gitCleanEnv` is a git-spawning suite and must adopt the probes. Pure and
 * injectable-root so the registry pin can prove it fails on an unregistered suite by
 * planting a temp `*.test.ts` file in a scratch dir (tests/unit/fixture-git-identity.test.ts).
 */
export function deriveFixtureGitCensus(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    if (!entry.endsWith('.test.ts')) continue;
    let text = '';
    try {
      text = readFileSync(join(root, entry), 'utf8');
    } catch {
      continue; // unreadable entries are not census evidence
    }
    if (text.includes('git init') || text.includes('gitCleanEnv')) out.push(entry);
  }
  return out;
}
