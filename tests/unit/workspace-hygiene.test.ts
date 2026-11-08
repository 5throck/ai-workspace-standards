/**
 * WP3 hygiene gate unit suite (spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 * §7.8).
 *
 * Three layers, all on ABSOLUTE tmpdir roots only (T-20261104-003 discipline — never a
 * relative fixture root that could recreate `Projects/` under the repo):
 *
 *   1. Pure classifier pins — `classifyWorkspaceHygieneResidue` on porcelain fixture
 *      strings (no git, no fs): untracked WHOLE top-level dirs from the known list fail;
 *      untracked FILES inside tracked dirs, nested dirs, unknown tops and all
 *      tracked-file states stay clean.
 *   2. Integration — the standalone scripts/check-workspace-hygiene.ts invoked against a
 *      mkdtemp git repo fixture: exit 0 clean / exit 1 on planted `Projects/` residue;
 *      `--json` shape verified.
 *   3. dev-sync placement — Step 6.4 (the design's proposed 5.9) must appear in source
 *      order BEFORE the 6.5 S1 snapshot and must be blocking (process.exit(1)).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyWorkspaceHygieneResidue, KNOWN_TOP_LEVEL_DIRS } from "../../scripts/lib/workspace-hygiene.ts";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";

const REPO_ROOT = realpathSync(join(import.meta.dir, "..", ".."));

// ── 1. Pure classifier pins (fixture strings — no git calls) ─────────────────

describe("classifyWorkspaceHygieneResidue", () => {
  test("flags untracked whole top-level dirs from the known list", () => {
    expect(classifyWorkspaceHygieneResidue("?? Projects/\n")).toEqual(["Projects/"]);
    expect(classifyWorkspaceHygieneResidue("?? tests/")).toEqual(["tests/"]);
    expect(classifyWorkspaceHygieneResidue("?? scripts/")).toEqual(["scripts/"]);
    expect(classifyWorkspaceHygieneResidue("?? services/")).toEqual(["services/"]);
    expect(classifyWorkspaceHygieneResidue("?? docs/")).toEqual(["docs/"]);
    expect(classifyWorkspaceHygieneResidue("?? agents/")).toEqual(["agents/"]);
    expect(classifyWorkspaceHygieneResidue("?? skills/")).toEqual(["skills/"]);
    expect(classifyWorkspaceHygieneResidue("?? templates/")).toEqual(["templates/"]);
  });

  test("returns every offender, deduped and sorted", () => {
    const out = classifyWorkspaceHygieneResidue(
      "?? tests/\n M scripts/dev-sync.ts\n?? Projects/\n?? docs/\n?? Projects/\n",
    );
    expect(out).toEqual(["Projects/", "docs/", "tests/"]);
  });

  test("untracked FILES inside tracked dirs are ordinary work — clean", () => {
    expect(classifyWorkspaceHygieneResidue("?? tests/unit/new-thing.test.ts")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? scripts/helpers/new-helper.ts")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? memory/meeting-2026-11-08.md")).toEqual([]);
  });

  test("untracked NESTED dirs inside tracked dirs are ordinary work — clean", () => {
    expect(classifyWorkspaceHygieneResidue("?? tests/nested-fixture-dir/")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? services/co-workspace-new/")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? docs/some-new-subdir/")).toEqual([]);
  });

  test("tracked-but-modified / staged / renamed rows never fail", () => {
    const porcelain = [
      " M scripts/dev-sync.ts",
      "M  tests/unit/x.test.ts",
      "A  docs/new.md",
      "AM tests/unit/y.test.ts",
      "R  old.ts -> new.ts",
      "D  agents/removed.md",
      "?? docs/designs/2026-11-08-some-design.md",
    ].join("\n");
    expect(classifyWorkspaceHygieneResidue(porcelain)).toEqual([]);
  });

  test("whole-dir rows for tops outside the known list are clean", () => {
    expect(classifyWorkspaceHygieneResidue("?? memory/")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? tickets/")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? Projects-archive/")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? node_modules/")).toEqual([]);
  });

  test("C-quoted paths are unquoted before classification", () => {
    expect(classifyWorkspaceHygieneResidue('?? "Projects/"')).toEqual(["Projects/"]);
    expect(classifyWorkspaceHygieneResidue('?? "tests/"')).toEqual(["tests/"]);
  });

  test("CRLF and empty input tolerated", () => {
    expect(classifyWorkspaceHygieneResidue("")).toEqual([]);
    expect(classifyWorkspaceHygieneResidue("?? Projects/\r\n M a.ts\r\n")).toEqual(["Projects/"]);
  });

  test("top-level entries only: `?? Projects` without the trailing slash is not a whole-dir row", () => {
    // porcelain collapses an entirely-untracked dir to `?? <dir>/`; a slash-less row is
    // a weird file literally named `Projects` — not this gate's signature.
    expect(classifyWorkspaceHygieneResidue("?? Projects")).toEqual([]);
  });

  test("the known-dir list matches design §5.1 exactly", () => {
    expect([...KNOWN_TOP_LEVEL_DIRS].sort()).toEqual(
      ["Projects", "agents", "docs", "scripts", "services", "skills", "templates", "tests"].sort(),
    );
  });
});

// ── 2. Integration — standalone script on a mkdtemp git repo fixture ─────────

/** Absolute tmpdir fixture repo (T-20261104-003: mkdtempSync under realpath(tmpdir())).
 * Every git call runs with gitCleanEnv() — a hook context (`git push` pre-push)
 * exports GIT_DIR aimed at this checkout's private git dir, and unsanitized fixture
 * git calls honor it over cwd: init/add/commit landed in the WORKTREE repo and put
 * a rogue `initial` commit on the PR branch (2026-11-07 external-deps incident
 * class, reproduced live on 2026-11-09). */
function makeFixtureRepo(): string {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "ws-hygiene-fix-")); // ABSOLUTE
  const git = (args: string) =>
    Bun.spawnSync(["git", "-c", "user.email=fix@test", "-c", "user.name=fixer", ...args], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: gitCleanEnv(),
    });
  mkdirSync(join(root, "tests", "unit"), { recursive: true });
  writeFileSync(join(root, "tests", "unit", "tracked.test.ts"), "test();\n");
  git(["init"]);
  git(["add", "tests/unit/tracked.test.ts"]);
  git(["commit", "-m", "initial"]);
  return root;
}

function runHygieneScript(
  root: string,
  extraArgs: string[] = [],
  extraEnv: Record<string, string> = {},
): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(
    [process.execPath, join(REPO_ROOT, "scripts", "check-workspace-hygiene.ts"), "--root", root, ...extraArgs],
    // Sanitize the inherited environment (a hook context exports GIT_DIR — see
    // makeFixtureRepo), then layer extraEnv ON TOP: the GIT_DIR regression test
    // deliberately re-injects pollution to prove the GATE sanitizes internally.
    { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe", env: { ...gitCleanEnv(process.env), ...extraEnv } },
  );
  return { code: proc.exitCode ?? -1, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

describe("check-workspace-hygiene.ts (integration, mkdtemp git fixture)", () => {
  test("exit 0 on a dirty-but-tracked tree and on untracked files inside tracked dirs", () => {
    const root = makeFixtureRepo();
    try {
      appendFileSync(join(root, "tests", "unit", "tracked.test.ts"), "\n// modified\n"); // tracked-dirty
      writeFileSync(join(root, "tests", "unit", "brand-new.test.ts"), "test();\n"); // untracked file
      const clean = runHygieneScript(root);
      expect(clean.code).toBe(0);
      expect(clean.stdout).toContain("clean");

      const asJson = runHygieneScript(root, ["--json"]);
      expect(asJson.code).toBe(0);
      expect(JSON.parse(asJson.stdout)).toEqual({ ok: true, root, offenders: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("exit 1 listing offenders on planted whole-dir residue; --json carries them", () => {
    const root = makeFixtureRepo();
    try {
      mkdirSync(join(root, "Projects", "some-tenant"), { recursive: true }); // the incident signature
      writeFileSync(join(root, "Projects", "some-tenant", "x.txt"), "x");
      const res = runHygieneScript(root);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Projects/");
      expect(res.stderr).toContain("2026-11-08-gw-tenant-loop-and-hardening-design.md");

      const asJson = runHygieneScript(root, ["--json"]);
      expect(asJson.code).toBe(1);
      expect(JSON.parse(asJson.stdout)).toEqual({ ok: false, root, offenders: ["Projects/"] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("exit 1 fail-closed when the target is not a git repo", () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), "ws-hygiene-nogit-")); // ABSOLUTE, no git init
    try {
      const res = runHygieneScript(root);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Fail-closed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("REGRESSION: an inherited GIT_DIR from a hook context cannot break the fail-closed contract", () => {
    // `git push` runs hooks with GIT_DIR pointed at this checkout's private git
    // dir. Before scripts/lib/git-env.ts, the gate inherited it and `git status`
    // inspected the OUTER repo — a non-git --root passed vacuously instead of
    // failing closed (this exact scenario failed pre-fix, verified on
    // 2026-11-09). The gate must always inspect the requested --root.
    const decoyRepo = makeFixtureRepo(); // a DIFFERENT, real git fixture
    const root = mkdtempSync(join(realpathSync(tmpdir()), "ws-hygiene-nogit-hook-")); // ABSOLUTE, no git init
    try {
      const res = runHygieneScript(root, [], { GIT_DIR: decoyRepo });
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("Fail-closed");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(decoyRepo, { recursive: true, force: true });
    }
  });
});

// ── 3. dev-sync placement — Step 6.4 before the 6.5 S1 snapshot, blocking ─────

describe("dev-sync step 6.4 placement (design §7.8 structural pin)", () => {
  const devSync = Bun.file(join(REPO_ROOT, "scripts", "dev-sync.ts")).text();

  test("dev-sync imports the shared classifier (one derivation, two callers)", async () => {
    const src = await devSync;
    expect(src).toContain("from './lib/workspace-hygiene.ts'");
    expect(src).toContain("classifyWorkspaceHygieneResidue");
  });

  test("the hygiene step appears in source order BEFORE the S1 staging snapshot", async () => {
    const src = await devSync;
    const stepIdx = src.indexOf("6.4 Fixture-root hygiene residue gate");
    const s1Idx = src.indexOf("let s1Paths = new Set<string>();");
    expect(stepIdx).toBeGreaterThan(-1);
    expect(s1Idx).toBeGreaterThan(-1);
    expect(stepIdx).toBeLessThan(s1Idx);
  });

  test("the step is blocking (process.exit(1) on residue and on gate error)", async () => {
    const src = await devSync;
    const stepStart = src.indexOf("6.4 Fixture-root hygiene residue gate");
    const stepEnd = src.indexOf("6.5 Scoped staging", stepStart);
    const step = src.slice(stepStart, stepEnd);
    expect(step).toContain("process.exit(1)");
    expect(step).toContain("residue.length > 0");
    expect(step).toContain("fail-closed");
  });
});
