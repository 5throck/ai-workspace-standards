/**
 * Fixture-git self-assertion probes + adoption registry pin (spec
 * docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5/§6.2,
 * T-20261109-002).
 *
 * Two layers:
 *   1. Helper probe pins with INJECTED baseEnv (never process.env mutation):
 *      a clean env lets both probes pass on a fixture repo; a GIT_DIR aimed at an
 *      outer repository makes the FM1 probe throw naming the leaked target; a
 *      GIT_WORK_TREE-only env makes it throw via the toplevel check; under the SAME
 *      hostile env the sanitized FM2 probe passes while the raw FM1 probe still throws
 *      — the two probes measure different things (caller environment vs harness
 *      wrapper). The census function is pure and injectable-root: planting a temp
 *      *.test.ts with a `git init` string in a scratch dir proves an unregistered
 *      git-spawning suite fails the pin.
 *   2. Registry pin: FIXTURE_GIT_ADOPTED_SUITES names EVERY adopted suite file; the
 *      census re-derivation (deriveFixtureGitCensus over tests/unit) must match it
 *      exactly, and every registered file must import tests/helpers/fixture-git.ts.
 *      This is the same maintenance shape as the routing/registry pins: a future
 *      git-spawning suite cannot land without adopting the probes.
 *
 * This suite itself spawns git for its fixtures (git init) and is therefore IN the
 * census — registered below like every other git-spawning suite, no grandfathering.
 *
 * Every fixture git spawn runs under gitCleanEnv() (the 2026-11-09 incident's own
 * mechanism: an inherited GIT_DIR redirects fixture writes into the outer checkout).
 *
 * @version 1.0.0
 */
import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import {
  assertCallerEnvSafeForGitFixtures,
  assertFixtureGitIdentity,
  deriveFixtureGitCensus,
} from "../helpers/fixture-git.ts";

const REPO_ROOT = realpathSync(join(import.meta.dir, "..", ".."));
const TESTS_UNIT_DIR = join(REPO_ROOT, "tests", "unit");

/**
 * The adoption registry (design §3.5): every git-spawning fixture suite, per the
 * 2026-11-09 census re-derivation (`git init|gitCleanEnv` across tests/ — matches the
 * design's §3.5 list exactly, plus this suite). generate-scripts-mirror.test.ts is a
 * census match via rationale-comment text only (it spawns NO git) and adopts the FM1
 * probe alone — documented in its adoption comment. Order is alphabetical.
 */
const FIXTURE_GIT_ADOPTED_SUITES: string[] = [
  "external-deps-cli.test.ts",
  "external-deps.test.ts",
  "fixture-git-identity.test.ts",
  "generate-scripts-mirror.test.ts",
  "generator-manifest.test.ts",
  "mcp-upstream-tenant-identity.test.ts",
  "project-target-guards.test.ts",
  "repo-integrity.test.ts",
  "upgrade-decision-log.test.ts",
  "upgrade-project-tenant-guard.test.ts",
  "workspace-hygiene.test.ts",
];

/** The pin, factored so the planted-file test can run it against a scratch root. */
function assertRegistryCoversCensus(censusRoot: string, registry: string[]): void {
  const census = deriveFixtureGitCensus(censusRoot);
  const missing = census.filter((f) => !registry.includes(f));
  const stale = registry.filter((f) => !census.includes(f));
  if (missing.length > 0) {
    throw new Error(
      `fixture-git adoption: git-spawning suite(s) present in ${censusRoot} but missing from `
      + `FIXTURE_GIT_ADOPTED_SUITES: ${missing.join(", ")}. Every git-spawning fixture suite must `
      + `import tests/helpers/fixture-git.ts and call BOTH probes in its fixture harness `
      + `(FM1 at setup, FM2 right after git init). `
      + `Ref: docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5.`,
    );
  }
  if (stale.length > 0) {
    throw new Error(
      `fixture-git adoption: registry entries that no longer match the census (no 'git init' `
      + `or 'gitCleanEnv' mention): ${stale.join(", ")}. Remove them from the registry or restore `
      + `the adoption.`,
    );
  }
}

function git(cwd: string, args: string[]): { status: number; stdout: string } {
  const res = spawnSync("git", args, { cwd, encoding: "utf8", env: gitCleanEnv() });
  return { status: res.status ?? 1, stdout: res.stdout ?? "" };
}

const tmpRoots: string[] = [];

/** A plain absolute mkdtemp dir (not a repository). */
function makePlainDir(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  tmpRoots.push(dir);
  return dir;
}

/** An initialized fixture repository. */
function makeFixtureRepo(prefix: string): string {
  const dir = makePlainDir(prefix);
  expect(git(dir, ["init", "-q", "."]).status).toBe(0);
  return dir;
}

afterAll(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop()!;
    if (dir.startsWith(realpathSync(tmpdir()))) rmSync(dir, { recursive: true, force: true });
  }
});

// ── 1. Probe pins (injected baseEnv — design §6.2) ──────────────────────────

describe("assertCallerEnvSafeForGitFixtures / assertFixtureGitIdentity (FM1/FM2)", () => {
  const cleanEnv = gitCleanEnv(process.env);

  test("a clean env lets both probes pass on a fixture repo", () => {
    const fixture = makeFixtureRepo("fixture-git-clean-");
    expect(() => assertCallerEnvSafeForGitFixtures(fixture, cleanEnv)).not.toThrow();
    expect(() => assertFixtureGitIdentity(fixture, cleanEnv)).not.toThrow();
  });

  test("FM1 passes on a plain directory under a clean env (pre-git-init is not a leak)", () => {
    const dir = makePlainDir("fixture-git-plain-");
    expect(() => assertCallerEnvSafeForGitFixtures(dir, cleanEnv)).not.toThrow();
  });

  test("a fixture INSIDE an enclosing repo: cwd discovery is attributed, not flagged (tests/.temp shape)", () => {
    // The project-target-guards shape: the fixture root lives under tests/.temp/ —
    // INSIDE the workspace checkout. Pre-init, raw and sanitized discovery both walk
    // up to the enclosing repo; that agreement means the environment contributed
    // nothing, so FM1 must pass. Only a hostile env that CHANGES the resolution throws.
    const enclosing = makeFixtureRepo("fixture-git-enclosing-");
    const nested = join(enclosing, "tests", ".temp", "guard-fixture");
    mkdirSync(nested, { recursive: true });
    expect(() => assertCallerEnvSafeForGitFixtures(nested, cleanEnv)).not.toThrow();
    // After `git init`, the nearest repo is the fixture itself — still clean.
    expect(git(nested, ["init", "-q", "."]).status).toBe(0);
    expect(() => assertCallerEnvSafeForGitFixtures(nested, cleanEnv)).not.toThrow();
    expect(() => assertFixtureGitIdentity(nested, cleanEnv)).not.toThrow();
    // And a hostile env aimed ELSEWHERE (not at the enclosing repo) still throws.
    const other = makeFixtureRepo("fixture-git-other-outer-");
    expect(() => assertCallerEnvSafeForGitFixtures(nested, { ...cleanEnv, GIT_DIR: join(other, ".git") })).toThrow();
  });

  test("GIT_DIR aimed at an outer repository → FM1 throws naming the leaked target", () => {
    const outer = makeFixtureRepo("fixture-git-outer-");
    const fixture = makeFixtureRepo("fixture-git-inner-");
    const hostileEnv = { ...cleanEnv, GIT_DIR: join(outer, ".git") };
    let message = "";
    try {
      assertCallerEnvSafeForGitFixtures(fixture, hostileEnv);
      throw new Error("FM1 must have thrown");
    } catch (err) {
      message = String((err as Error).message);
    }
    expect(message).toContain("CALLER");
    expect(message).toContain(outer);
    expect(message).toContain(fixture);
    expect(message).toContain("git-env.ts");
    expect(message).toContain("2026-11-09");
  });

  test("GIT_WORK_TREE only → FM1 throws via the toplevel check (git-dir probe cannot see it)", () => {
    const outer = makeFixtureRepo("fixture-git-wtouter-");
    const fixture = makeFixtureRepo("fixture-git-wtinner-");
    const hostileEnv = { ...cleanEnv, GIT_WORK_TREE: outer };
    let message = "";
    try {
      assertCallerEnvSafeForGitFixtures(fixture, hostileEnv);
      throw new Error("FM1 must have thrown");
    } catch (err) {
      message = String((err as Error).message);
    }
    expect(message).toContain("show-toplevel");
    expect(message).toContain(outer);
    expect(message).not.toContain("absolute-git-dir resolves OUTSIDE");
  });

  test("under the SAME hostile env FM2 passes while raw FM1 still throws (different probes)", () => {
    const outer = makeFixtureRepo("fixture-git-both-outer-");
    const fixture = makeFixtureRepo("fixture-git-both-inner-");
    const hostileEnv = { ...cleanEnv, GIT_DIR: join(outer, ".git") };
    // The sanitized machinery resolves INSIDE the fixture root: the wrapper works.
    expect(() => assertFixtureGitIdentity(fixture, hostileEnv)).not.toThrow();
    // ...while the RAW environment leaks: the FM1 probe still fires.
    expect(() => assertCallerEnvSafeForGitFixtures(fixture, hostileEnv)).toThrow();
  });

  test("FM2 throws with the inside/outside proof when the fixture is not a repository", () => {
    const dir = makePlainDir("fixture-git-nogit-");
    let message = "";
    try {
      assertFixtureGitIdentity(dir, cleanEnv);
      throw new Error("FM2 must have thrown");
    } catch (err) {
      message = String((err as Error).message);
    }
    expect(message).toContain("SANITIZED");
    expect(message).toContain(dir);
    expect(message).toContain("gitCleanEnv()");
  });

  test("FM1 fails closed when a redirect var is present but git cannot resolve at all", () => {
    const dir = makePlainDir("fixture-git-bogus-");
    const hostileEnv = { ...cleanEnv, GIT_DIR: join(dir, "no-such-gitdir") };
    expect(() => assertCallerEnvSafeForGitFixtures(dir, hostileEnv)).toThrow(/redirect var/i);
  });
});

// ── 2. Registry + census pin (design §6.2) ──────────────────────────────────

describe("fixture-git adoption registry", () => {
  test("the census over tests/unit matches the registry exactly (no missing, no stale)", () => {
    expect(() => assertRegistryCoversCensus(TESTS_UNIT_DIR, FIXTURE_GIT_ADOPTED_SUITES)).not.toThrow();
    // And the census is what we think it is (regression guard for the census fn itself).
    expect(deriveFixtureGitCensus(TESTS_UNIT_DIR).sort()).toEqual([...FIXTURE_GIT_ADOPTED_SUITES].sort());
  });

  test("every adopted suite imports tests/helpers/fixture-git.ts", () => {
    for (const suite of FIXTURE_GIT_ADOPTED_SUITES) {
      const text = readFileSync(join(TESTS_UNIT_DIR, suite), "utf8");
      expect(text.includes("helpers/fixture-git")).toBe(true);
    }
  });

  test("the census re-derivation catches an unregistered git-spawning suite (planted file)", () => {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), "fixture-git-census-")));
    tmpRoots.push(scratch);
    writeFileSync(join(scratch, "planted-rogue.test.ts"), "// future suite: runs `git init` in its fixture harness (grep-equivalent signal)\n", "utf8");
    expect(deriveFixtureGitCensus(scratch)).toEqual(["planted-rogue.test.ts"]);
    let message = "";
    try {
      assertRegistryCoversCensus(scratch, []);
      throw new Error("the pin must have thrown");
    } catch (err) {
      message = String((err as Error).message);
    }
    expect(message).toContain("planted-rogue.test.ts");
    expect(message).toContain("missing from");
    expect(message).toContain("BOTH probes");
  });

  test("a suite without census signals is NOT a census match (negative control)", () => {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), "fixture-git-census2-")));
    tmpRoots.push(scratch);
    writeFileSync(join(scratch, "planted-plain.test.ts"), "import { test } from 'bun:test';\ntest('t', () => {});\n", "utf8");
    expect(deriveFixtureGitCensus(scratch)).toEqual([]);
    expect(() => assertRegistryCoversCensus(scratch, [])).not.toThrow();
  });
});
