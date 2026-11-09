// @version 1.0.0
// fixture-git.ts — fixture-suite git self-assertion probes (spec
// docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5, T-20261109-002).
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
import { isAbsolute, join, relative } from 'node:path';
import { GIT_REDIRECT_ENV_KEYS, gitCleanEnv } from '../../scripts/lib/git-env.ts';

type FixtureEnv = Record<string, string | undefined>;

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
 * keep each signal alive independently.
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

/** realpath best-effort: the resolved path may not exist yet — fall back to the raw value. */
function realpathSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** True when `child` equals `parent` or lives strictly inside it (path-relative form). */
function isInsideOrEqual(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
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
 * read resolve outside realpath(fixtureRoot), or when a redirect variable is present
 * but the reads cannot resolve at all (fail-closed: a hostile env we cannot resolve is
 * a hostile env). Suites call this FIRST in their fixture harness, before any fixture
 * git call: a hostile environment fails the suite LOUDLY at the top, before any write.
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
 * `baseEnv` is injectable (default `process.env`) so the probe itself is unit-testable.
 * Both reads failing with a CLEAN env is not a leak — a plain directory before
 * `git init` resolves nothing and redirects nothing, so the probe passes.
 */
export function assertCallerEnvSafeForGitFixtures(fixtureRoot: string, baseEnv: FixtureEnv = process.env as FixtureEnv): void {
  const root = realpathSync(fixtureRoot);
  const raw = readGitLocation(root, baseEnv);

  const leaks: string[] = [];
  const rawOutside: string[] = [];
  if (raw.gitDir !== null && !isInsideOrEqual(realpathSafe(raw.gitDir), root)) {
    rawOutside.push(`git rev-parse --absolute-git-dir resolves OUTSIDE the fixture root: ${raw.gitDir}`);
  }
  if (raw.toplevel !== null && realpathSafe(raw.toplevel) !== root) {
    // The toplevel check is what catches GIT_WORK_TREE-only leaks, which the
    // git-dir probe cannot see.
    rawOutside.push(`git rev-parse --show-toplevel resolves OUTSIDE the fixture root: ${raw.toplevel}`);
  }
  if (rawOutside.length > 0) {
    // Attribute the outside resolution: discovery (sanitized reference) vs redirect.
    const reference = readGitLocation(root, gitCleanEnv(baseEnv));
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
      `fixture-git: the CALLER's environment redirects git away from the fixture root ${root}: `
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
 * reads fail (the fixture is not a repository) or resolve outside the fixture root.
 *
 * `baseEnv` is injectable (default `process.env`) so the probe itself is unit-testable.
 * FM1 and FM2 measure different things: under a hostile env, FM2 PASSES (the wrapper
 * neutralizes the redirect) while the raw FM1 probe still throws — both behaviors are
 * pinned in tests/unit/fixture-git-identity.test.ts.
 */
export function assertFixtureGitIdentity(fixtureRoot: string, baseEnv: FixtureEnv = process.env as FixtureEnv): void {
  const root = realpathSync(fixtureRoot);
  const { gitDir, toplevel, stderr } = readGitLocation(root, gitCleanEnv(baseEnv));

  const problems: string[] = [];
  if (gitDir === null) {
    problems.push(`git rev-parse --absolute-git-dir failed under the sanitized environment (${stderr || 'git returned no detail'})`);
  } else if (!isInsideOrEqual(realpathSafe(gitDir), root)) {
    problems.push(`--absolute-git-dir resolves OUTSIDE the fixture root: ${gitDir}`);
  }
  if (toplevel === null) {
    problems.push(`git rev-parse --show-toplevel failed under the sanitized environment (${stderr || 'git returned no detail'})`);
  } else if (realpathSafe(toplevel) !== root) {
    problems.push(`--show-toplevel resolves OUTSIDE the fixture root: ${toplevel}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `fixture-git: the suite's SANITIZED git machinery does not resolve inside the fixture root ${root}: `
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
