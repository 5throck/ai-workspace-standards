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
 * v1.3.0 (2026-11-09, PR #1941 CI follow-up round 3 — terminal-pass design): the
 *          canonical-containment describe was re-audited pin by pin for Windows
 *          portability. Two pins failed on windows-latest and were REDESIGNED, not
 *          conditionally patched: (a) the default-canonicalizer pin now feeds REAL
 *          mkdtemp paths and asserts OS-invariants — separator-normalized fixed point,
 *          idempotence, real containment true/false — because a POSIX-shaped synthetic
 *          input (`/a/b/.git`) is not well-defined on Windows (drive-relative
 *          resolution); (b) the FM2 seam-wiring double was platform-blind (it restyled
 *          the raw 8.3-vs-long mismatch instead of resolving it) — it now canonicalizes
 *          via canonicalizePath FIRST, then rebases by fixture basename, so the mapping
 *          collapses both sides whatever shape they arrive in; the split-namespace pin
 *          got the same canonicalize-first treatment for a deterministic refusal.
 *          Helper side (fixture-git.ts v1.3.0): the `--show-toplevel` equality runs
 *          through path.relative (=== '') like containment — win32's case-insensitive
 *          comparison tolerates drive-letter case drift (`C:/` vs `c:/`) that string
 *          equality would refuse. See the v1.3.0 audit table in this file's report.
 * v1.2.0 (2026-11-09, PR #1941 CI follow-up round 2): the two FM1 message-content pins
 *          (GIT_DIR leak, GIT_WORK_TREE-only leak) assert against
 *          canonicalizePath(outer) — the helper's canonical comparison form — instead
 *          of the raw mkdtemp path: the refusal messages carry the GIT-REPORTED paths,
 *          which on Windows 8.3 runners are the LONG forward-slash form while mkdtemp
 *          hands out the SHORT form. Equivalent on POSIX (canonicalizer ≈ identity
 *          there). Audit: these were the only raw-path containment assertions on
 *          refusal messages — every other path assertion either pins the RAW fixture
 *          input echoed by the message header (stable by construction) or no path.
 * v1.1.0 (2026-11-09, PR #1941 CI follow-up): canonical-containment pins — Windows
 *          runners hand fixture roots in 8.3 short-name form (RUNNER~1) while git
 *          resolves the long form (runneradmin); the raw prefix check refused safe
 *          fixtures. Pins the injectable canonicalize seam with a fake native-expansion
 *          normalizer over synthetic Windows-styled strings (no real 8.3 filesystem),
 *          the fail-closed direction (a differently-styled leak still refuses), and the
 *          both-sides seam wiring of both probes.
 *
 * @version 1.3.1 (2026-11-11: registry gains upgrade-overwrite-protection.test.ts — overwrite-protection PR-A)
 */
import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import {
  assertCallerEnvSafeForGitFixtures,
  assertFixtureGitIdentity,
  canonicalizePath,
  deriveFixtureGitCensus,
  isGitPathInsideFixture,
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
  "upgrade-overwrite-protection.test.ts",
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
    // The message carries the GIT-REPORTED path, which on Windows 8.3 runners is the
    // LONG forward-slash form (git resolves GIT_DIR itself), not the SHORT-form mkdtemp
    // input — so assert against the helper's canonical form of `outer` (identity-ish on
    // POSIX, where this equals the raw path). PR #1941 CI follow-up round 2.
    expect(message).toContain(canonicalizePath(outer));
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
    // Same canonical-form assertion as the GIT_DIR pin: git reports the toplevel in the
    // LONG forward-slash form on Windows 8.3 runners (PR #1941 CI follow-up round 2).
    expect(message).toContain(canonicalizePath(outer));
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

// ── 1b. Canonical containment (PR #1941 CI follow-up — Windows 8.3 aliasing) ─
//
// Windows runners hand mkdtemp'd fixture roots in 8.3 SHORT-NAME form
// (`C:\Users\RUNNER~1\AppData\Local\Temp\...`) while git resolves the SAME directory
// to the LONG form (`C:/Users/runneradmin/...`). The raw containment check refused a
// safe fixture and failed suites like external-deps-cli on windows-latest. The fix
// canonicalizes BOTH sides (OS-native realpath + separator normalization) through an
// injectable seam; these pins prove the aliasing behavior with synthetic strings and a
// fake normalizer — deterministically on every platform, no real 8.3 filesystem needed.
describe("canonical containment (PR #1941 — Windows 8.3 short-name aliasing)", () => {
  const cleanEnv = gitCleanEnv(process.env);
  /** Fake fs.realpathSync.native on a Windows runner: expand the 8.3 segment, normalize separators. */
  const fakeWindowsNative = (p: string): string => p.replace("RUNNER~1", "runneradmin").replace(/\\+/g, "/");

  const SHORT_ROOT = "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\extdeps-cli-xM01Ff\\repo";
  const LONG_GIT_DIR = "C:/Users/runneradmin/AppData/Local/Temp/extdeps-cli-xM01Ff/repo/.git";
  const LONG_TOPLEVEL = "C:/Users/runneradmin/AppData/Local/Temp/extdeps-cli-xM01Ff/repo";

  test("a RUNNER~1-styled fixture root canonicalizes EQUAL to the long-form git path (the CI shape passes)", () => {
    expect(isGitPathInsideFixture(LONG_GIT_DIR, SHORT_ROOT, fakeWindowsNative)).toBe(true);
    expect(isGitPathInsideFixture(LONG_TOPLEVEL, SHORT_ROOT, fakeWindowsNative)).toBe(true);
  });

  test("without canonicalization the same pair textually mismatches (the exact CI failure mode)", () => {
    expect(isGitPathInsideFixture(LONG_GIT_DIR, SHORT_ROOT, (p) => p)).toBe(false);
  });

  test("a genuinely different directory still fails containment under the fake normalizer", () => {
    const other = "C:/Users/runneradmin/AppData/Local/Temp/OTHER-PROJECT/repo/.git";
    expect(isGitPathInsideFixture(other, SHORT_ROOT, fakeWindowsNative)).toBe(false);
  });

  test("default canonicalizer: normalized, idempotent, and containment holds on REAL paths", () => {
    // REAL existing paths only, every assertion an OS-invariant (PR #1941 round 3): a
    // POSIX-shaped synthetic input (`/a/b/.git`) is NOT well-defined on Windows, where
    // realpathSync.native resolves it drive-relative — that platform-blind premise is
    // exactly what failed the previous version of this pin on windows-latest. The raw
    // mkdtemp output is fed in on purpose (no pre-realpath): canonicalizing must absorb
    // whatever aliasing/casing the platform reports.
    const root = mkdtempSync(join(tmpdir(), "fixture-git-canonical-"));
    tmpRoots.push(root);
    expect(git(root, ["init", "-q", "."]).status).toBe(0); // make <root>/.git exist
    const canonRoot = canonicalizePath(root);
    // Invariant 1 — separator-normalized: the sep→'/' rewrite is a fixed point.
    expect(canonRoot.split(sep).join("/")).toBe(canonRoot);
    // Invariant 2 — idempotent: canonicalizing the canonical form returns it unchanged
    // (POSIX: realpath(realpath(p)) === realpath(p); Windows: nothing left to expand or
    // re-case). Holds on both OSes by construction.
    expect(canonicalizePath(canonRoot)).toBe(canonRoot);
    // Invariant 3 — containment semantics on real paths: the fixture's own .git is
    // inside; a real sibling tmp directory is not.
    expect(isGitPathInsideFixture(join(root, ".git"), root)).toBe(true);
    const sibling = mkdtempSync(join(tmpdir(), "fixture-git-canonical-sib-"));
    tmpRoots.push(sibling);
    expect(isGitPathInsideFixture(sibling, root)).toBe(false);
  });

  test("FM2 passes when the injectable canonicalizer maps BOTH sides into one namespace (seam wiring)", () => {
    const fixture = makeFixtureRepo("fixture-git-seam-");
    // Shape-agnostic double (PR #1941 round 3): canonicalize FIRST — resolving whatever
    // aliasing/drive-casing/separators the OS and git actually report — then rebase
    // anything carrying the fixture basename into one synthetic namespace. The mapping
    // keys on the basename found INSIDE the canonical text, so it works whatever shape
    // the two sides arrive in (POSIX `/var/...`, Windows `C:\Users\RUNNER~1\...` vs
    // git's `C:/Users/runneradmin/...`). Whether the probe CONSULTS the seam at all is
    // pinned by the NEXT test: a double that sends the git-dir side elsewhere must
    // cause a refusal — the default canonicalizer would silently pass it.
    const base = basename(fixture);
    const uniform = (p: string): string => {
      const canon = canonicalizePath(p);
      const at = canon.indexOf(base);
      return at === -1 ? canon : `/canonical-ns/${base}${canon.slice(at + base.length)}`;
    };
    expect(() => assertFixtureGitIdentity(fixture, cleanEnv, { canonicalize: uniform })).not.toThrow();
    expect(() => assertCallerEnvSafeForGitFixtures(fixture, cleanEnv, { canonicalize: uniform })).not.toThrow();
  });

  test("FM2 still refuses when the canonicalizer styles the git-dir side differently (fail-closed seam)", () => {
    const fixture = makeFixtureRepo("fixture-git-seam2-");
    // Shape-agnostic AND deterministic (round 3): canonicalize FIRST so root and
    // toplevel always collapse together, then send ONLY the git-dir side (a canonical
    // `/.git` suffix) to another namespace — the refusal is therefore always the
    // --absolute-git-dir check, on every platform. Canonicalization may never paper
    // over a real leak.
    const splitNamespace = (p: string): string => {
      const canon = canonicalizePath(p);
      return canon.endsWith("/.git") ? `/git-ns${canon}` : `/fs-ns${canon}`;
    };
    expect(() => assertFixtureGitIdentity(fixture, cleanEnv, { canonicalize: splitNamespace }))
      .toThrow(/absolute-git-dir resolves OUTSIDE/);
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
