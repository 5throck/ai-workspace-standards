/**
 * Repository-config integrity guard unit suite (spec
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §11).
 *
 * Three layers, all on ABSOLUTE mkdtemp roots only (T-20261104-003 discipline — never a
 * relative fixture root that could recreate directories under the repo):
 *
 *   1. Pure `diffRepoConfig` pins (fixture strings — no git, no fs): added / removed /
 *      changed, multi-value keys, order-insensitivity, empty delta.
 *   2. Integration — mkdtemp git fixtures: `snapshotRepoConfig` serializes sorted
 *      `key=value` lines plus the effective core.bare; `assertWorkTreeHealthy` accepts a
 *      healthy work tree, refuses `core.bare = true` with the exact repair command and
 *      the incident reference, and refuses a non-repository directory; a mid-run flip of
 *      core.bare is caught by the snapshot pair.
 *   3. dev-sync / pre-push placement — structural pins mirroring
 *      tests/unit/workspace-hygiene.test.ts: the start-of-run invariant appears BEFORE
 *      the first test-executing step, the config gate AFTER step 4.85 and BEFORE the
 *      audit gate, both blocking, and the pre-push hook wraps its changed-path test run.
 *
 * Every git spawn in the fixtures goes through gitCleanEnv() — an inherited GIT_DIR
 * would point the fixture at the invoking repository and the tests would assert on the
 * wrong config (the 2026-11-09 incident's own mechanism).
 *
 * v1.1.0 (2026-11-09, QA follow-up fix): pins the pre-push hook's fail-closed contract, which
 * v1.8.0 got wrong — an unreadable pre-run snapshot used to warn and SKIP the check, and
 * the comparison dropped the effective `core.bare` field. Both behaviours are now pinned
 * here (abort on a throw; refuse a bare flip whose local key diff is empty).
 *
 * @version 1.1.0
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CORE_BARE_REPAIR_COMMAND,
  REPO_INTEGRITY_INCIDENT_REF,
  assertWorkTreeHealthy,
  diffRepoConfig,
  isEmptyRepoConfigDelta,
  snapshotRepoConfig,
} from "../../scripts/lib/repo-integrity.ts";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import {
  repoConfigGuardVerdict,
  repoConfigSnapshotFailureMessage,
  snapshotRepoConfigOrAbort,
  type RepoConfigSnapshot,
} from "../../scripts/hooks/pre-push.ts";

const REPO_ROOT = realpathSync(join(import.meta.dir, "..", ".."));

function git(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const res = spawnSync("git", args, { cwd, encoding: "utf8", env: gitCleanEnv() });
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

const tmpRoots: string[] = [];

function makeRepo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "repo-integrity-fixture-")));
  tmpRoots.push(dir);
  const init = git(dir, ["init", "-q", "."]);
  expect(init.status).toBe(0);
  return dir;
}

beforeEach(() => {
  tmpRoots.length = 0;
});

afterEach(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop()!;
    // Only ever inside the OS tmpdir, and only directories this suite created.
    if (dir.startsWith(realpathSync(tmpdir()))) rmSync(dir, { recursive: true, force: true });
  }
});

// ── 1. Pure diff pins ────────────────────────────────────────────────────────

describe("diffRepoConfig", () => {
  test("identical lists produce an empty delta", () => {
    const entries = ["core.bare=false", "core.filemode=true"];
    const delta = diffRepoConfig(entries, entries);
    expect(delta).toEqual({ added: [], removed: [], changed: [] });
    expect(isEmptyRepoConfigDelta(delta)).toBe(true);
  });

  test("reports keys only present after as added and only present before as removed", () => {
    const delta = diffRepoConfig(
      ["core.bare=false", "core.hooksPath=.githooks"],
      ["core.bare=false", "core.worktree=/tmp/w"],
    );
    expect(delta.added).toEqual(["core.worktree=/tmp/w"]);
    expect(delta.removed).toEqual(["core.hooksPath=.githooks"]);
    expect(delta.changed).toEqual([]);
    expect(isEmptyRepoConfigDelta(delta)).toBe(false);
  });

  test("reports a value flip as changed (the core.bare incident shape)", () => {
    const delta = diffRepoConfig(["core.bare=false"], ["core.bare=true"]);
    expect(delta).toEqual({ added: [], removed: [], changed: ["core.bare: false → true"] });
  });

  test("is order-insensitive", () => {
    const a = ["core.bare=false", "core.filemode=true"];
    const b = ["core.filemode=true", "core.bare=false"];
    expect(diffRepoConfig(a, b)).toEqual({ added: [], removed: [], changed: [] });
  });

  test("multi-value keys compare as value sets, not as line order", () => {
    const before = [
      "remote.origin.fetch=+refs/heads/main:refs/remotes/origin/main",
      "remote.origin.fetch=+refs/heads/pr/*:refs/remotes/origin/pr/*",
    ];
    const after = [
      "remote.origin.fetch=+refs/heads/pr/*:refs/remotes/origin/pr/*",
      "remote.origin.fetch=+refs/heads/main:refs/remotes/origin/main",
    ];
    expect(diffRepoConfig(before, after).changed).toEqual([]);

    // A key that already existed gains a value: that is a CHANGE to its value set,
    // not an `added` key (added/removed are key-level).
    const widened = [...after, "remote.origin.fetch=+refs/tags/*:refs/tags/*"];
    const delta = diffRepoConfig(before, widened);
    expect(delta.added).toEqual([]);
    expect(delta.changed.length).toBe(1);
    expect(delta.changed[0].startsWith("remote.origin.fetch: ")).toBe(true);
    expect(delta.changed[0]).toContain("+refs/tags/*:refs/tags/*");
    expect(isEmptyRepoConfigDelta(delta)).toBe(false);
  });

  test("value-less keys survive the round trip", () => {
    expect(diffRepoConfig(["core.bare"], [])).toEqual({ added: [], removed: ["core.bare"], changed: [] });
    expect(diffRepoConfig(["core.bare"], [""])).toEqual({
      added: [""],
      removed: ["core.bare"],
      changed: [],
    });
  });
});

// ── 2. Fixture integration ──────────────────────────────────────────────────

describe("snapshotRepoConfig", () => {
  test("returns sorted key=value lines and the effective core.bare", () => {
    const repo = makeRepo();
    git(repo, ["config", "--local", "core.hooksPath", ".githooks"]);
    const snap = snapshotRepoConfig(repo);

    expect(snap.root).toBe(repo);
    // git lowercases key names in --list output (core.hooksPath → core.hookspath), so
    // compare case-insensitively rather than pinning one git build's spelling.
    expect(snap.entries.some((line) => line.toLowerCase() === "core.hookspath=.githooks")).toBe(true);
    expect(snap.entries).toEqual([...snap.entries].sort());
    expect(snap.entries.every((line) => line.includes("=") || line.length > 0)).toBe(true);
    expect(snap.coreBare).toBe("false");
  });

  test("a snapshot pair detects a mid-run core.bare flip", () => {
    const repo = makeRepo();
    const before = snapshotRepoConfig(repo);

    // What a redirected fixture-side write did to the real checkout in the incident.
    expect(git(repo, ["config", "--local", "core.bare", "true"]).status).toBe(0);

    const after = snapshotRepoConfig(repo);
    const delta = diffRepoConfig(before.entries, after.entries);
    expect(isEmptyRepoConfigDelta(delta)).toBe(false);
    expect(delta.changed).toContain("core.bare: false → true");
    expect(after.coreBare).toBe("true");
  });

  test("a bare flip through the GLOBAL scope leaves the local key diff empty yet is refused", () => {
    const repo = makeRepo();
    // Local core.bare unset → the effective value now comes from a higher-precedence
    // scope, which is exactly what `git config --local --list` cannot show.
    expect(git(repo, ["config", "--local", "--unset", "core.bare"]).status).toBe(0);
    const before = snapshotRepoConfig(repo);
    expect(before.coreBare).toBe(null);

    const cfgDir = realpathSync(mkdtempSync(join(tmpdir(), "repo-integrity-globalcfg-")));
    tmpRoots.push(cfgDir);
    const globalConfig = join(cfgDir, "global.gitconfig");
    writeFileSync(globalConfig, "[core]\n\tbare = true\n", "utf8");

    const previous = process.env.GIT_CONFIG_GLOBAL;
    let after: RepoConfigSnapshot;
    try {
      process.env.GIT_CONFIG_GLOBAL = globalConfig;
      after = snapshotRepoConfig(repo);
    } finally {
      if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = previous;
    }

    expect(after.coreBare).toBe("true");
    // The local listing did not move an inch — the key-diff-only comparison used to
    // pass this straight through (the v1.8.0 gap).
    expect(isEmptyRepoConfigDelta(diffRepoConfig(before.entries, after.entries))).toBe(true);
    expect(repoConfigGuardVerdict(before, after).refused).toBe(true);
  });

  test("throws when the root is not a repository", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "repo-integrity-nogit-")));
    tmpRoots.push(dir);
    expect(() => snapshotRepoConfig(dir)).toThrow();
  });
});

// ── 2b. Pre-push guard contract (design §11 fail-closed semantics) ───────────

describe("repoConfigGuardVerdict", () => {
  const snap = (entries: string[], coreBare: string | null): RepoConfigSnapshot => ({
    root: "/fixture",
    entries,
    coreBare,
  });

  test("an unchanged snapshot pair is accepted", () => {
    const s = snap(["core.bare=false", "core.filemode=true"], "false");
    expect(repoConfigGuardVerdict(s, s)).toEqual({ refused: false, lines: [] });
  });

  test("a core.bare flip with an EMPTY local key diff is still refused", () => {
    // The shape the local key listing cannot see: `core.bare` is resolved
    // local > global > system, so a global/system flip leaves
    // `git config --local --list` byte-identical and the work tree still breaks.
    const before = snap(["core.filemode=true"], null);
    const after = snap(["core.filemode=true"], "true");

    expect(isEmptyRepoConfigDelta(diffRepoConfig(before.entries, after.entries))).toBe(true);

    const verdict = repoConfigGuardVerdict(before, after);
    expect(verdict.refused).toBe(true);
    expect(verdict.lines).toContain("~ core.bare (effective): (unset) → true");
  });

  test("a key delta alone is refused and reported", () => {
    const verdict = repoConfigGuardVerdict(
      snap(["core.filemode=true"], "false"),
      snap(["core.filemode=true", "core.worktree=/tmp/w"], "false"),
    );
    expect(verdict.refused).toBe(true);
    expect(verdict.lines).toContain("+ core.worktree=/tmp/w");
  });
});

describe("snapshotRepoConfigOrAbort (pre-push v1.8.1 fail-closed fix)", () => {
  test("an unreadable pre-run snapshot ABORTS instead of skipping the check", () => {
    const aborts: string[] = [];
    const abort = (message: string): never => {
      aborts.push(message);
      throw new Error("__aborted__");
    };

    expect(() =>
      snapshotRepoConfigOrAbort(
        "before",
        () => {
          throw new Error("cannot read local git config at /fixture");
        },
        abort,
      ),
    ).toThrow("__aborted__");

    expect(aborts).toHaveLength(1);
    expect(aborts[0]).toContain("FATAL");
    expect(aborts[0]).toContain("could not be read before the changed-path test run");
    expect(aborts[0]).toContain("cannot read local git config at /fixture");
    // The fail-OPEN wording that v1.8.0 shipped must never come back.
    expect(aborts[0]).not.toContain("skipped");
  });

  test("an unreadable post-run snapshot aborts with the 're-read' wording", () => {
    const aborts: string[] = [];
    const abort = (message: string): never => {
      aborts.push(message);
      throw new Error("__aborted__");
    };

    expect(() =>
      snapshotRepoConfigOrAbort("after", () => { throw new Error("boom"); }, abort),
    ).toThrow("__aborted__");
    expect(aborts[0]).toContain("could not be re-read after the changed-path test run");
  });

  test("a readable snapshot passes through untouched", () => {
    const expected = { root: "/fixture", entries: ["core.bare=false"], coreBare: "false" };
    const got = snapshotRepoConfigOrAbort(
      "before",
      () => expected,
      () => { throw new Error("abort must not be called"); },
    );
    expect(got).toBe(expected);
  });

  test("the failure message names the phase and the underlying error", () => {
    const message = repoConfigSnapshotFailureMessage("before", new Error("exit 128"));
    expect(message.startsWith("pre-push: FATAL — ")).toBe(true);
    expect(message).toContain("exit 128");
  });
});

describe("assertWorkTreeHealthy", () => {
  test("accepts a healthy work tree", () => {
    const repo = makeRepo();
    expect(assertWorkTreeHealthy(repo)).toEqual({ ok: true });
  });

  test("refuses core.bare = true with the repair command and the incident reference", () => {
    const repo = makeRepo();
    git(repo, ["config", "--local", "core.bare", "true"]);
    const health = assertWorkTreeHealthy(repo);
    expect(health.ok).toBe(false);
    if (health.ok) throw new Error("unreachable");
    expect(health.reason).toContain("core.bare is true");
    expect(health.reason).toContain(CORE_BARE_REPAIR_COMMAND);
    expect(health.reason).toContain(REPO_INTEGRITY_INCIDENT_REF);
    expect(CORE_BARE_REPAIR_COMMAND).toBe("git config --local core.bare false");
  });

  test("refuses a non-repository directory", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "repo-integrity-nogit-")));
    tmpRoots.push(dir);
    const health = assertWorkTreeHealthy(dir);
    expect(health.ok).toBe(false);
    if (health.ok) throw new Error("unreachable");
    expect(health.reason).toContain("is-inside-work-tree");
    expect(health.reason).toContain(REPO_INTEGRITY_INCIDENT_REF);
  });

  test("repairing core.bare restores health (the documented recovery)", () => {
    const repo = makeRepo();
    git(repo, ["config", "--local", "core.bare", "true"]);
    expect(assertWorkTreeHealthy(repo).ok).toBe(false);
    expect(git(repo, ["config", "--local", "core.bare", "false"]).status).toBe(0);
    expect(assertWorkTreeHealthy(repo)).toEqual({ ok: true });
  });
});

// ── 3. Caller placement (structural pins) ───────────────────────────────────

describe("dev-sync repository-config guard placement (design §11 structural pin)", () => {
  const devSync = Bun.file(join(REPO_ROOT, "scripts", "dev-sync.ts")).text();

  test("dev-sync imports the shared guard primitives (one derivation, two callers)", async () => {
    const src = await devSync;
    expect(src).toContain("from './lib/repo-integrity.ts'");
    expect(src).toContain("assertWorkTreeHealthy");
    expect(src).toContain("diffRepoConfig");
    expect(src).toContain("snapshotRepoConfig");
  });

  test("the start-of-run invariant runs BEFORE the first test-executing step", async () => {
    const src = await devSync;
    const invariantIdx = src.indexOf("const workTreeHealth = assertWorkTreeHealthy(expectedRoot)");
    const snapshotIdx = src.indexOf("configSnapshotAtStart = snapshotRepoConfig(expectedRoot)");
    const firstTestIdx = src.indexOf("3.95 QA Pre-checks");
    expect(invariantIdx).toBeGreaterThan(-1);
    expect(snapshotIdx).toBeGreaterThan(-1);
    expect(firstTestIdx).toBeGreaterThan(-1);
    expect(invariantIdx).toBeLessThan(firstTestIdx);
    expect(snapshotIdx).toBeLessThan(firstTestIdx);
  });

  test("the config integrity gate runs AFTER step 4.85 and BEFORE the audit gate", async () => {
    const src = await devSync;
    const step485Idx = src.indexOf("4.85 Version-bump test gate");
    const gateIdx = src.indexOf("4.88 Repository-config integrity gate");
    const auditIdx = src.indexOf("4.9 Audit gate");
    expect(step485Idx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(step485Idx);
    expect(gateIdx).toBeLessThan(auditIdx);
  });

  test("both guard sites fail closed (process.exit(1))", async () => {
    const src = await devSync;
    const invariantBlock = src.slice(
      src.indexOf("const workTreeHealth = assertWorkTreeHealthy(expectedRoot)"),
      src.indexOf("configSnapshotAtStart = snapshotRepoConfig(expectedRoot)"),
    );
    expect(invariantBlock).toContain("process.exit(1)");

    const gateBlock = src.slice(
      src.indexOf("4.88 Repository-config integrity gate"),
      src.indexOf("4.9 Audit gate"),
    );
    expect(gateBlock).toContain("process.exit(1)");
    expect(gateBlock).toContain("diffRepoConfig");
    expect(gateBlock).toContain("isEmptyRepoConfigDelta");
  });
});

describe("pre-push repository-config guard placement (design §11 structural pin)", () => {
  const hook = Bun.file(join(REPO_ROOT, "scripts", "hooks", "pre-push.ts")).text();

  test("the hook snapshots the config around its changed-path test run", async () => {
    const src = await hook;
    const spawnIdx = src.indexOf("await $`bun test ${changedTestFiles}`");
    const beforeIdx = src.indexOf("snapshotRepoConfigOrAbort(\n      'before'");
    const afterIdx = src.indexOf("snapshotRepoConfigOrAbort(\n      'after'");
    expect(spawnIdx).toBeGreaterThan(-1);
    expect(beforeIdx).toBeGreaterThan(-1);
    expect(afterIdx).toBeGreaterThan(beforeIdx);
    expect(beforeIdx).toBeLessThan(spawnIdx);
    expect(afterIdx).toBeGreaterThan(spawnIdx);
  });

  test("a config delta blocks the push", async () => {
    const src = await hook;
    const guardIdx = src.indexOf("repoConfigGuardVerdict(configBefore, configAfter)");
    expect(guardIdx).toBeGreaterThan(-1);
    const tail = src.slice(guardIdx, guardIdx + 900);
    expect(tail).toContain("process.exit(1)");
    expect(tail).toContain("mutated the REPOSITORY git config");
  });

  test("both snapshot phases fail closed (v1.8.1) — no fail-open skip path survives", async () => {
    const src = await hook;
    // The removed v1.8.0 behaviour: warn and skip the whole check.
    expect(src).not.toContain("config-integrity check skipped");
    expect(src).not.toContain("snapshot unavailable");
    // Both reads go through the fail-closed wrapper (two CALL sites; the definition
    // itself is the third textual match, so anchor on the assignment).
    expect(src.match(/= snapshotRepoConfigOrAbort\(/g)?.length).toBe(2);
    expect(src).toContain("repoConfigGuardVerdict(configBefore, configAfter)");
  });
});
