// skill-graph-transient-snapshot.test.ts — S4 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.4/§9:
// the durable snapshot records every transient `pr/*` checkout discovery
// skipped (lib/git-aware-scan.ts checkoutHead + the fleet report's
// buildTransientEntries / snapshot `transient[]` shape). All fixtures are
// synthetic repos under tmpdir — the real Projects/ tree is never touched.

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import {
  assertCallerEnvSafeForGitFixtures,
  assertFixtureGitIdentity,
} from "../helpers/fixture-git.ts";
import { checkoutHead, filterTransientCheckouts } from "../../scripts/lib/git-aware-scan.ts";
import {
  TRANSIENT_CHECKOUT_REASON,
  buildTransientEntries,
  serializeSnapshot,
} from "../../scripts/skill-graph-fleet-report.ts";

// Hooks (pre-push) run `bun test` with GIT_DIR exported; sanitize for the
// suite's duration (the git-aware-scan.test.ts pattern) so fixture repos are
// hermetic regardless of the caller's git environment.
const GIT_ENV_KEYS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY"];
const savedGitEnv = new Map<string, string | undefined>();
for (const key of GIT_ENV_KEYS) {
  savedGitEnv.set(key, process.env[key]);
  delete process.env[key];
}
afterAll(() => {
  for (const [key, value] of savedGitEnv) {
    if (value !== undefined) process.env[key] = value;
  }
});

function git(repo: string, args: string[]): void {
  const res = spawnSync("git", args, { cwd: repo, encoding: "utf8", env: gitCleanEnv() as NodeJS.ProcessEnv });
  if (res.status !== 0) throw new Error(`fixture git ${args.join(" ")} failed: ${res.stderr}`);
}

/** One standalone repo on `main` with a single commit (short-sha readable). */
function initFixtureRepo(prefix: string): string {
  const repo = mkdtempSync(join(tmpdir(), prefix));
  // FM1 first (raw-env caller probe), then git init, then FM2 (sanitized machinery probe)
  // — the fixture-git adoption contract for every git-spawning suite.
  assertCallerEnvSafeForGitFixtures(repo);
  git(repo, ["init", "-q", "-b", "main"]);
  assertFixtureGitIdentity(repo);
  writeFileSync(join(repo, "seed.md"), "x\n");
  git(repo, ["add", "seed.md"]);
  git(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
  return repo;
}

/** A clone of `source` checked out on a `pr/*` branch — the PR-checkout shape. */
function cloneOnPrBranch(source: string, name: string): string {
  const clone = mkdtempSync(join(tmpdir(), name));
  rmSync(clone, { recursive: true, force: true });
  git(source, ["clone", "--quiet", source, clone]);
  git(clone, ["checkout", "-qb", "pr/20261126-fixture"]);
  return clone;
}

describe("checkoutHead (S4: rev-parse metadata, fail-open)", () => {
  test("a committed fixture repo returns its short HEAD sha (7-40 hex chars)", () => {
    const repo = initFixtureRepo("sg-transient-head-");
    try {
      const head = checkoutHead(repo);
      expect(head).not.toBeNull();
      expect(head!).toMatch(/^[0-9a-f]{7,40}$/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a non-git directory fails open to null", () => {
    const dir = mkdtempSync(join(tmpdir(), "sg-transient-nonrepo-"));
    try {
      expect(checkoutHead(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unborn-HEAD repo (git init, no commit) fails open to null", () => {
    const repo = mkdtempSync(join(tmpdir(), "sg-transient-unborn-"));
    try {
      assertCallerEnvSafeForGitFixtures(repo);
      git(repo, ["init", "-q", "-b", "main"]);
      assertFixtureGitIdentity(repo);
      expect(checkoutHead(repo)).toBeNull();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("transient[] snapshot records (S4: one entry per skipped pr/* checkout)", () => {
  test("a pr/* checkout yields exactly one entry with id, branch, head, reason; main/detached yield none", () => {
    const main_ = initFixtureRepo("sg-transient-main-");
    const pr = cloneOnPrBranch(main_, "sg-transient-pr-");
    const detached = mkdtempSync(join(tmpdir(), "sg-transient-det-"));
    rmSync(detached, { recursive: true, force: true });
    try {
      git(main_, ["clone", "--quiet", main_, detached]);
      git(detached, ["checkout", "--detach", "HEAD"]);

      const { projects, skipped } = filterTransientCheckouts([main_, pr, detached], (dir) => {
        const res = spawnSync("git", ["-C", dir, "branch", "--show-current"], {
          encoding: "utf8",
          env: gitCleanEnv() as NodeJS.ProcessEnv,
        });
        return res.status === 0 ? (res.stdout || "").trim() || null : null;
      });
      // main and detached stay (fail-open); only the pr/* checkout is skipped.
      expect(projects).toEqual([main_, detached]);
      expect(skipped).toEqual([{ name: pr, branch: "pr/20261126-fixture" }]);

      const entries = buildTransientEntries(skipped);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.id).toMatch(/^sg-transient-pr-/);
      expect(entries[0]!.branch).toBe("pr/20261126-fixture");
      expect(entries[0]!.head).toMatch(/^[0-9a-f]{7,40}$/);
      expect(entries[0]!.reason).toBe(TRANSIENT_CHECKOUT_REASON);
      expect(TRANSIENT_CHECKOUT_REASON).toContain("T-20261103-004");
    } finally {
      rmSync(main_, { recursive: true, force: true });
      rmSync(pr, { recursive: true, force: true });
      rmSync(detached, { recursive: true, force: true });
    }
  });

  test("the head read receives only the checkout dir — the PR tree is never walked", () => {
    // Mechanism-level pin of the S4 non-goal: buildTransientEntries passes the
    // checkout path itself to the head reader, never a path inside the tree.
    const seen: string[] = [];
    const entries = buildTransientEntries([{ name: "Projects/co-x", branch: "pr/y" }], (dir) => {
      seen.push(dir);
      return "abc1234";
    });
    expect(seen).toEqual(["Projects/co-x"]);
    expect(entries[0]!.head).toBe("abc1234");
  });

  test("a git failure in the head read degrades to head:null, not a dropped record", () => {
    const entries = buildTransientEntries([{ name: "Projects/co-x", branch: "pr/y" }], () => null);
    expect(entries[0]!.head).toBeNull();
    expect(entries[0]!.branch).toBe("pr/y");
    expect(entries[0]!.reason).toBe(TRANSIENT_CHECKOUT_REASON);
  });
});

describe("snapshot shape (S4: additive-only; legacy snapshots parse unchanged)", () => {
  const legacy = {
    date: "2026-11-01",
    projects: { "co-a": { nodes: 1, edges: 0, skills: 1 } },
    fleetPresence: { skill: 1 },
    missingFromProjects: { "co-a": [] as string[] },
    jaccard: { "co-a": 0.5 },
  };

  test("a legacy snapshot without transient serializes without the field", () => {
    const text = serializeSnapshot(legacy as Parameters<typeof serializeSnapshot>[0]);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(Object.hasOwn(parsed, "transient")).toBe(false);
    expect(parsed.date).toBe("2026-11-01");
  });

  test("a snapshot with transient keeps every pre-existing field and adds the block", () => {
    const withTransient = {
      ...legacy,
      transient: [
        { id: "co-b", branch: "pr/z", head: "abc1234", reason: TRANSIENT_CHECKOUT_REASON },
      ],
    };
    const parsed = JSON.parse(serializeSnapshot(withTransient as Parameters<typeof serializeSnapshot>[0])) as Record<
      string,
      unknown
    >;
    expect(parsed.date).toBe("2026-11-01");
    expect(parsed.fleetPresence).toEqual(legacy.fleetPresence);
    expect(parsed.transient).toEqual([
      { id: "co-b", branch: "pr/z", head: "abc1234", reason: TRANSIENT_CHECKOUT_REASON },
    ]);
  });

  test("the main snapshot fixture file written by this suite round-trips through JSON", () => {
    // Guard the actual serializer on a real file write (tmpdir, not the repo's
    // memory/ dir — the durable artifact path stays untouched by tests).
    const dir = mkdtempSync(join(tmpdir(), "sg-transient-snap-"));
    try {
      const file = join(dir, "snapshot-fixture.json");
      const withTransient = { ...legacy, transient: [] };
      writeFileSync(file, serializeSnapshot(withTransient as Parameters<typeof serializeSnapshot>[0]));
      expect(existsSync(file)).toBe(true);
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      expect(Object.hasOwn(parsed, "transient")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
