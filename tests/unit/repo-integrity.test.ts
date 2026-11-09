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
 * v1.2.0 (2026-11-09, spec docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md
 *          §6.1): the corruption-MODE-1 battery — pure filterRogueCommits pins including
 *          the near-miss table, resolveRogueScanBase resolution order (upstream →
 *          origin/main → fail-closed; a detached HEAD exercises the fallback), fixture
 *          scan integration (a planted `Test <test@example.com>` commit is reported with
 *          SHA + identity + subject; a clean range passes; a non-repository root fails
 *          closed), worktree-scope snapshot pins (`wt: `-prefixed verdict rows, extension
 *          off = empty, extension flips on mid-run), the dev-sync Arm-2 placement pins
 *          (scan inside the step-4.88 block after the config compare, before the audit
 *          gate, fail-closed on every branch, no env skip path), and the pre-push
 *          pushed-range scan pins (after the pure-deletion early-exit, before gitleaks,
 *          fail-closed, no env skip path).
 * v1.1.0 (2026-11-09, QA follow-up fix): pins the pre-push hook's fail-closed contract, which
 * v1.8.0 got wrong — an unreadable pre-run snapshot used to warn and SKIP the check, and
 * the comparison dropped the effective `core.bare` field. Both behaviours are now pinned
 * here (abort on a throw; refuse a bare flip whose local key diff is empty).
 *
 * @version 1.2.0
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CORE_BARE_REPAIR_COMMAND,
  REPO_INTEGRITY_INCIDENT_REF,
  ROGUE_IDENTITY_EMAIL_PATTERNS,
  assertWorkTreeHealthy,
  diffRepoConfig,
  filterRogueCommits,
  isEmptyRepoConfigDelta,
  resolveRogueScanBase,
  rogueScanRefusalLines,
  scanRogueCommits,
  scanRogueCommitsInRange,
  snapshotRepoConfig,
} from "../../scripts/lib/repo-integrity.ts";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from "../helpers/fixture-git.ts";
import {
  repoConfigGuardVerdict,
  repoConfigSnapshotFailureMessage,
  rogueScanRevArgs,
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
  // Fixture-suite self-assertion (spec 2026-11-09-repo-integrity-mode1-detector-design
  // §3.5): FM1 first (hostile caller env fails LOUDLY pre-write), FM2 right after init.
  assertCallerEnvSafeForGitFixtures(dir);
  const init = git(dir, ["init", "-q", "."]);
  expect(init.status).toBe(0);
  assertFixtureGitIdentity(dir);
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
  const snap = (entries: string[], coreBare: string | null, worktreeEntries: string[] = []): RepoConfigSnapshot => ({
    root: "/fixture",
    entries,
    coreBare,
    worktreeEntries,
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

  test("the spawned-child integrity gate (two arms) runs AFTER step 4.85 and BEFORE the audit gate", async () => {
    const src = await devSync;
    const step485Idx = src.indexOf("4.85 Version-bump test gate");
    const gateIdx = src.indexOf("4.88 Spawned-child integrity gate");
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
      src.indexOf("4.88 Spawned-child integrity gate"),
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

// ── 4. Corruption mode 1: rogue-author commit detector (design §3.1, v1.2.0) ─

const FIELD_SEPARATOR = "\x1f";

function logRecord(
  sha: string,
  authorName: string,
  authorEmail: string,
  committerName: string,
  committerEmail: string,
  subject: string,
): string {
  return [sha, authorName, authorEmail, committerName, committerEmail, subject].join(FIELD_SEPARATOR);
}

describe("filterRogueCommits (pure pins, design §6.1)", () => {
  test("author and committer hits are reported independently and name the matched field", () => {
    const out = filterRogueCommits([
      logRecord("aaaaaaaa", "Alice", "alice@ok.dev", "Bob", "bob@ok.dev", "clean work"),
      logRecord("bbbbbbbb", "Test", "test@example.com", "Alice", "alice@ok.dev", "rogue author"),
      logRecord("cccccccc", "Alice", "alice@ok.dev", "Test", "test@example.com", "rogue committer"),
    ].join("\n"));
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ sha: "bbbbbbbb", field: "author", identity: "Test <test@example.com>", subject: "rogue author" });
    expect(out[1]).toEqual({ sha: "cccccccc", field: "committer", identity: "Test <test@example.com>", subject: "rogue committer" });
  });

  test("both fields matching on one commit yields two records, author first", () => {
    const out = filterRogueCommits(logRecord("dddddddd", "Test", "test@example.com", "Test", "test@example.com", "rogue both"));
    expect(out.map((r) => r.field)).toEqual(["author", "committer"]);
    expect(out.every((r) => r.sha === "dddddddd")).toBe(true);
  });

  test("matching is case-insensitive on the email", () => {
    const out = filterRogueCommits(logRecord("eeeeeeee", "Test", "TEST@EXAMPLE.COM", "X", "x@ok.dev", "shouty identity"));
    expect(out).toHaveLength(1);
    expect(out[0].field).toBe("author");
    expect(out[0].identity).toBe("Test <TEST@EXAMPLE.COM>");
  });

  test("the near-miss table never matches (exact anchored email, both fields)", () => {
    const out = filterRogueCommits([
      logRecord("11111111", "Evil", "test@example.com.evil", "X", "x@ok.dev", "suffix collision"),
      logRecord("22222222", "Evil", "test@example-com", "X", "x@ok.dev", "hyphen collision"),
      logRecord("33333333", "Evil", "tests@example.com", "X", "x@ok.dev", "plural collision"),
      logRecord("44444444", "Test", "test@ok.dev", "X", "x@ok.dev", "human named Test, different email"),
      logRecord("55555555", "Evil", "test@example.com.evil.example", "Y", "y@ok.dev", "dotted suffix"),
      logRecord("66666666", "X", "x@ok.dev", "Evil", "xtest@example.com", "prefix collision, committer side"),
    ].join("\n"));
    expect(out).toEqual([]);
  });

  test("empty and malformed input yield no hits (defensive parse)", () => {
    expect(filterRogueCommits("")).toEqual([]);
    expect(filterRogueCommits("\n\n")).toEqual([]);
    expect(filterRogueCommits("not-a-record")).toEqual([]);
    expect(filterRogueCommits(["too", "few", "fields"].join(FIELD_SEPARATOR))).toEqual([]);
  });

  test("a subject containing the field separator stays one record", () => {
    const out = filterRogueCommits(logRecord("fffffff1", "Test", "test@example.com", "X", "x@ok.dev", `subject with${FIELD_SEPARATOR}separator`));
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe(`subject with${FIELD_SEPARATOR}separator`);
  });

  test("multi-commit streams return every hit in stream order", () => {
    const out = filterRogueCommits([
      logRecord("a1aaaaaa", "Test", "test@example.com", "X", "x@ok.dev", "first hit"),
      logRecord("a2aaaaaa", "X", "x@ok.dev", "X", "x@ok.dev", "clean between"),
      logRecord("a3aaaaaa", "X", "x@ok.dev", "Test", "test@example.com", "last hit"),
    ].join("\n"));
    expect(out.map((r) => r.sha)).toEqual(["a1aaaaaa", "a3aaaaaa"]);
  });

  test("the seeded blocklist carries the incident identity pattern only", () => {
    expect(ROGUE_IDENTITY_EMAIL_PATTERNS).toHaveLength(1);
    expect(ROGUE_IDENTITY_EMAIL_PATTERNS[0].source).toBe("^test@example\\.com$");
    expect(ROGUE_IDENTITY_EMAIL_PATTERNS[0].flags).toContain("i");
  });
});

describe("rogueScanRefusalLines (pure pin, design §3.1)", () => {
  test("lists SHA + field + identity + subject per commit and the manual-repair guidance", () => {
    const lines = rogueScanRefusalLines(
      [{ sha: "abc123d", field: "author", identity: "Test <test@example.com>", subject: "fixture wrote into the checkout" }],
      "origin/pr/9..HEAD",
    );
    const joined = lines.join("\n");
    expect(lines[0]).toContain("origin/pr/9..HEAD");
    expect(joined).toContain("abc123d [author] Test <test@example.com> — fixture wrote into the checkout");
    expect(joined.toLowerCase()).toContain("no auto-repair");
    expect(joined).toContain("git rebase");
    expect(joined).toContain("git-env.ts");
    expect(joined).toContain("2026-11-09-repo-integrity-mode1-detector-design.md");
  });
});

describe("resolveRogueScanBase (fixture integration, design §3.2)", () => {
  test("prefers HEAD@{upstream} when the branch has one", () => {
    const repo = makeRepo();
    expect(git(repo, ["-c", "user.email=op@example.com", "-c", "user.name=Operator", "commit", "--allow-empty", "-q", "-m", "initial"]).status).toBe(0);
    const sha = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
    // Wire up an upstream the config-level way: a configured remote (so the fetch
    // refspec can map the tracking branch), the remote-tracking ref, and the branch's
    // remote/merge keys. Avoids any network or default-branch-name assumptions.
    expect(git(repo, ["remote", "add", "origin", repo]).status).toBe(0);
    expect(git(repo, ["update-ref", "refs/remotes/origin/pr/42", sha]).status).toBe(0);
    const currentBranch = git(repo, ["symbolic-ref", "--short", "HEAD"]).stdout.trim();
    expect(git(repo, ["config", `branch.${currentBranch}.remote`, "origin"]).status).toBe(0);
    expect(git(repo, ["config", `branch.${currentBranch}.merge`, "refs/heads/pr/42"]).status).toBe(0);
    const base = resolveRogueScanBase(repo);
    expect(base).toEqual({ ok: true, base: "origin/pr/42" });
  });

  test("falls back to origin/main when HEAD has no upstream", () => {
    const repo = makeRepo();
    expect(git(repo, ["-c", "user.email=op@example.com", "-c", "user.name=Operator", "commit", "--allow-empty", "-q", "-m", "initial"]).status).toBe(0);
    const sha = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
    expect(git(repo, ["update-ref", "refs/remotes/origin/main", sha]).status).toBe(0);
    expect(resolveRogueScanBase(repo)).toEqual({ ok: true, base: "origin/main" });
  });

  test("refuses fail-closed when NEITHER probe resolves, naming both", () => {
    const repo = makeRepo(); // no commits, no upstream, no origin/main
    const base = resolveRogueScanBase(repo);
    expect(base.ok).toBe(false);
    if (base.ok) throw new Error("unreachable");
    expect(base.reason).toContain("HEAD@{upstream}");
    expect(base.reason).toContain("origin/main");
    expect(base.reason).toContain("must not silently pass");
  });

  test("a detached HEAD exercises the origin/main fallback path", () => {
    const repo = makeRepo();
    expect(git(repo, ["-c", "user.email=op@example.com", "-c", "user.name=Operator", "commit", "--allow-empty", "-q", "-m", "initial"]).status).toBe(0);
    const sha = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
    expect(git(repo, ["update-ref", "refs/remotes/origin/main", sha]).status).toBe(0);
    expect(git(repo, ["checkout", "-q", "--detach", "HEAD"]).status).toBe(0);
    expect(resolveRogueScanBase(repo)).toEqual({ ok: true, base: "origin/main" });
  });
});

describe("scanRogueCommits (fixture integration, design §6.1)", () => {
  test("a planted rogue commit is found with SHA + identity + subject; the clean range passes", () => {
    const repo = makeRepo();
    const commitOpts = ["-c", "user.email=op@example.com", "-c", "user.name=Operator"];
    expect(git(repo, [...commitOpts, "commit", "--allow-empty", "-q", "-m", "legit work"]).status).toBe(0);
    const base = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
    // env-scoped fixture identity on the FIXTURE repo — sanctioned (design §6.1);
    // the detectors exist because this class of write must never reach the OUTER repo.
    expect(git(repo, [...commitOpts, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-q", "-m", "rogue fixture write"]).status).toBe(0);
    const rogueSha = git(repo, ["rev-parse", "HEAD"]).stdout.trim();

    const scan = scanRogueCommits(base, repo);
    expect(scan.ok).toBe(true);
    if (!scan.ok) throw new Error("unreachable");
    expect(scan.commits.length).toBeGreaterThanOrEqual(1);
    expect(scan.commits.every((c) => c.sha === rogueSha)).toBe(true);
    expect(scan.commits.some((c) => c.field === "author" && c.identity === "Test <test@example.com>")).toBe(true);
    expect(scan.commits.every((c) => c.subject === "rogue fixture write")).toBe(true);

    // A clean range (base === HEAD) reports zero commits.
    const clean = scanRogueCommits(rogueSha, repo);
    expect(clean).toEqual({ ok: true, commits: [] });
  });

  test("a non-repository root fails closed ({ ok:false })", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "repo-integrity-nogit-")));
    tmpRoots.push(dir);
    const scan = scanRogueCommits("origin/main", dir);
    expect(scan.ok).toBe(false);
    if (scan.ok) throw new Error("unreachable");
    expect(scan.reason).toContain("git log");
  });

  test("an empty rev-args list is refused (would scan unbounded history)", () => {
    const result = scanRogueCommitsInRange([], REPO_ROOT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("empty revision range");
  });
});

describe("snapshotRepoConfig worktree scope (v1.1.0, design §3.4)", () => {
  test("extension off → worktreeEntries is [] (feature-inactive, not a failure)", () => {
    const repo = makeRepo();
    expect(snapshotRepoConfig(repo).worktreeEntries).toEqual([]);
  });

  test("extension on + a mid-run --worktree write → refused with wt: rows", () => {
    const repo = makeRepo();
    expect(git(repo, ["config", "--local", "extensions.worktreeConfig", "true"]).status).toBe(0);
    const before = snapshotRepoConfig(repo);
    // Extension on, no config.worktree content yet → the truthful snapshot is empty
    // (verified 2026-11-09: git exits 128 "unable to read config file … config.worktree").
    expect(before.worktreeEntries).toEqual([]);

    expect(git(repo, ["config", "--worktree", "wt.leak", "midrun-write"]).status).toBe(0);
    const after = snapshotRepoConfig(repo);
    expect(after.worktreeEntries).toContain("wt.leak=midrun-write");

    const verdict = repoConfigGuardVerdict(before, after);
    expect(verdict.refused).toBe(true);
    expect(verdict.lines).toContain("wt: + wt.leak=midrun-write");
    // The extension was already on at BOTH ends, and the --worktree write only moves
    // the per-worktree scope: the local listing is untouched (the mid-run enabling-key
    // flip is a separate pin below).
    expect(isEmptyRepoConfigDelta(diffRepoConfig(before.entries, after.entries))).toBe(true);
  });

  test("extension on at BOTH ends → a config.worktree content change is caught by the wt diff alone", () => {
    const repo = makeRepo();
    expect(git(repo, ["config", "--local", "extensions.worktreeConfig", "true"]).status).toBe(0);
    expect(git(repo, ["config", "--worktree", "wt.key", "a"]).status).toBe(0);
    const before = snapshotRepoConfig(repo);
    expect(git(repo, ["config", "--worktree", "wt.key", "b"]).status).toBe(0);
    const after = snapshotRepoConfig(repo);

    // The local listing did not move an inch.
    expect(isEmptyRepoConfigDelta(diffRepoConfig(before.entries, after.entries))).toBe(true);
    const verdict = repoConfigGuardVerdict(before, after);
    expect(verdict.refused).toBe(true);
    expect(verdict.lines.some((l) => l.startsWith("wt: ~ wt.key:"))).toBe(true);
  });

  test("the extension flipping ON mid-run: local delta carries the enabling key, wt section appears", () => {
    const repo = makeRepo();
    const before = snapshotRepoConfig(repo);
    expect(before.worktreeEntries).toEqual([]);
    expect(git(repo, ["config", "--local", "extensions.worktreeConfig", "true"]).status).toBe(0);
    expect(git(repo, ["config", "--worktree", "wt.midrun", "1"]).status).toBe(0);
    const after = snapshotRepoConfig(repo);

    expect(after.worktreeEntries).toEqual(["wt.midrun=1"]);
    expect(diffRepoConfig(before.entries, after.entries).added.some((l) => l.toLowerCase().startsWith("extensions.worktreeconfig="))).toBe(true);
    expect(repoConfigGuardVerdict(before, after).refused).toBe(true);
  });
});

// ── 5. Caller placement, Arm 2 + pushed-range scan (design §3.3, v1.2.0) ─────

describe("dev-sync step-4.88 Arm-2 placement (design §6.1 structural pin)", () => {
  const devSync = Bun.file(join(REPO_ROOT, "scripts", "dev-sync.ts")).text();

  test("the rogue scan sits INSIDE the step-4.88 block, after the config compare, before the audit gate", async () => {
    const src = await devSync;
    const gateIdx = src.indexOf("4.88 Spawned-child integrity gate");
    const configCompareIdx = src.indexOf("const configDelta = diffRepoConfig(configSnapshotAtStart.entries");
    const arm2Idx = src.indexOf("const baseResolution = resolveRogueScanBase(expectedRoot)");
    const auditIdx = src.indexOf("4.9 Audit gate");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(configCompareIdx).toBeGreaterThan(gateIdx);
    expect(arm2Idx).toBeGreaterThan(configCompareIdx);
    expect(arm2Idx).toBeLessThan(auditIdx);
  });

  test("Arm 2 is fail-closed on every branch, lists refusals, and has NO env skip path", async () => {
    const src = await devSync;
    const gateBlock = src.slice(
      src.indexOf("4.88 Spawned-child integrity gate"),
      src.indexOf("4.9 Audit gate"),
    );
    expect(gateBlock).toContain("resolveRogueScanBase(");
    expect(gateBlock).toContain("scanRogueCommits(");
    expect(gateBlock).toContain("rogueScanRefusalLines(");
    // Five abort branches: snapshot re-read failure, config delta, unresolvable base,
    // failed git log, non-empty rogue commit list.
    expect(gateBlock.match(/process\.exit\(1\)/g)?.length).toBe(5);
    // The Arm-2 section must consult no environment variable — no skip path.
    const arm2Block = gateBlock.slice(gateBlock.indexOf("const baseResolution = resolveRogueScanBase(expectedRoot)"));
    expect(arm2Block).not.toContain("process.env");
  });
});

describe("pre-push rogue-commit scan placement (design §6.1 structural pin)", () => {
  const hook = Bun.file(join(REPO_ROOT, "scripts", "hooks", "pre-push.ts")).text();

  test("the scan runs after the pure-deletion early-exit and BEFORE the gitleaks stage", async () => {
    const src = await hook;
    const deletionIdx = src.indexOf("isPureDeletionPush(refUpdates)");
    const scanIdx = src.indexOf("=== pre-push rogue-commit scan ===");
    const gitleaksIdx = src.indexOf("which gitleaks");
    expect(deletionIdx).toBeGreaterThan(-1);
    expect(scanIdx).toBeGreaterThan(deletionIdx);
    expect(scanIdx).toBeLessThan(gitleaksIdx);
  });

  test("the pushed-range scan is fail-closed and has NO env skip path", async () => {
    const src = await hook;
    const scanBlock = src.slice(
      src.indexOf("=== pre-push rogue-commit scan ==="),
      src.indexOf("Secret scan (gitleaks)"),
    );
    expect(scanBlock).toContain("rogueScanRevArgs(ref)");
    expect(scanBlock).toContain("scanRogueCommitsInRange(revArgs)");
    expect(scanBlock).toContain("rogueScanRefusalLines(");
    // Two abort branches: unreadable scan, non-empty commit list.
    expect(scanBlock.match(/process\.exit\(1\)/g)?.length).toBe(2);
    expect(scanBlock).not.toContain("process.env");
  });

  test("rogueScanRevArgs mirrors the collectPushedChangedFiles scoping (no new range math)", () => {
    const local = "a".repeat(40);
    const remote = "b".repeat(40);
    const zero = "0".repeat(40);
    // Existing remote counterpart → its exact pushed range.
    expect(rogueScanRevArgs({ localRef: "refs/heads/x", localOid: local, remoteRef: "refs/remotes/o/x", remoteOid: remote }))
      .toEqual([`${remote}..${local}`]);
    // New branch (zero remote OID) → local commits not reachable from any remote ref.
    expect(rogueScanRevArgs({ localRef: "refs/heads/x", localOid: local, remoteRef: "refs/heads/x", remoteOid: zero }))
      .toEqual([local, "--not", "--remotes"]);
    // Deletion update → nothing to scan.
    expect(rogueScanRevArgs({ localRef: "refs/heads/x", localOid: zero, remoteRef: "refs/heads/x", remoteOid: remote })).toBeNull();
    // Non-hex OID → skipped exactly like collectPushedChangedFiles validates.
    expect(rogueScanRevArgs({ localRef: "refs/heads/x", localOid: "not-hex", remoteRef: "refs/heads/x", remoteOid: zero })).toBeNull();
    // SHA-256-length OIDs pass the same validation.
    expect(rogueScanRevArgs({ localRef: "refs/heads/x", localOid: "c".repeat(64), remoteRef: "refs/heads/x", remoteOid: zero }))
      .toEqual(["c".repeat(64), "--not", "--remotes"]);
  });
});

describe("no env-var skip path for any new detector (design §7, grep-verifiable)", () => {
  test("the shared module contains no process.env reference at all", async () => {
    const src = await Bun.file(join(REPO_ROOT, "scripts", "lib", "repo-integrity.ts")).text();
    expect(src).not.toContain("process.env");
    expect(src).not.toMatch(/ROGUE_[A-Z_]*SKIP|SKIP[A-Z_]*ROGUE/);
  });
});
