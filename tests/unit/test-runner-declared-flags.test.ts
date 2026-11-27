/**
 * @version 1.0.0
 * Declared-suite `sequential` / `timeout` schema extension (T-20261128-002,
 * design docs/designs/2026-11-28-test-suites-schema-extension-design.md):
 * schema validation, sequential execution order with continue-and-report,
 * timeout enforcement, FILE_TIME_BUDGETS composition, and the backward-compat
 * golden compare. Doubles as the fixture canary for Projects/co-newbiz's
 * visual e2e suite (expressed here, NOT in the co-newbiz repo).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseTestSuitesManifest, resolveFileBudgets, validateTestSuitesManifest } from "../../scripts/test-runner";
import { TEST_RUN_SUMMARY_RE } from "../../scripts/test-runner";

const RUNNER = resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "tr-declared-flags-"));
  created.push(dir);
  return dir;
}

function write(root: string, rel: string, content: string): string {
  const file = join(root, ...rel.split("/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn([process.execPath, RUNNER, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code: proc.exitCode, out, err };
}

const summaryOf = (text: string) => {
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith("TEST-RUN-SUMMARY "));
  expect(lines.length).toBe(1);
  const m = lines[0].match(TEST_RUN_SUMMARY_RE);
  expect(m).not.toBeNull();
  return m!;
};
const field = (m: RegExpMatchArray, token: string): string =>
  m[0].split(" ").find((t) => t.startsWith(`${token}=`))!.slice(token.length + 1);

const base = () => ({ version: 1, include: [], suites: [] as unknown[], quarantine: [] as unknown[] });

/** The co-newbiz visual e2e suite, expressed through the official schema —
 * the acceptance-criterion shape (design §2). */
const CONEWBIZ_VISUAL = { name: "visual", type: "bun-test", dirs: ["tests/e2e-visual"], sequential: true, timeout: 900000 };

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("schema validation (v1.24.0 keys)", () => {
  test("the co-newbiz visual entry (sequential + 900000) is valid", () => {
    expect(validateTestSuitesManifest({ ...base(), suites: [CONEWBIZ_VISUAL] })).toEqual([]);
  });

  test("each new key is independently optional, on every suite type", () => {
    expect(validateTestSuitesManifest({ ...base(), suites: [{ name: "v", type: "bun-test", dirs: ["x"], sequential: false }] })).toEqual([]);
    expect(validateTestSuitesManifest({ ...base(), suites: [{ name: "v", type: "bun-test", dirs: ["x"], timeout: 1 }] })).toEqual([]);
    expect(validateTestSuitesManifest({ ...base(), suites: [{ name: "c", type: "command", command: ["true"], timeout: 600000 }] })).toEqual([]);
    expect(validateTestSuitesManifest({ ...base(), suites: [{ name: "w", type: "workspace", dirs: ["projects/*"], timeout: 600000 }] })).toEqual([]);
  });

  test("sequential must be a boolean", () => {
    for (const bad of ["yes", 1, null, {}]) {
      const errors = validateTestSuitesManifest({ ...base(), suites: [{ name: "v", type: "bun-test", dirs: ["x"], sequential: bad }] });
      expect(errors.join("\n")).toContain('"sequential" must be a boolean');
    }
  });

  test("timeout must be a positive integer (milliseconds)", () => {
    for (const bad of [0, -1000, 12.5, "900000"]) {
      const errors = validateTestSuitesManifest({ ...base(), suites: [{ name: "v", type: "bun-test", dirs: ["x"], timeout: bad }] });
      expect(errors.join("\n")).toContain('"timeout" must be a positive integer (milliseconds)');
    }
  });

  test("sequential is rejected on command and workspace suites (they are sequential by construction)", () => {
    for (const suite of [
      { name: "c", type: "command", command: ["true"], sequential: true },
      { name: "w", type: "workspace", dirs: ["projects/*"], sequential: false },
    ]) {
      const errors = validateTestSuitesManifest({ ...base(), suites: [suite] });
      expect(errors.join("\n")).toContain('"sequential" applies to "bun-test" suites only');
    }
  });

  test("unknown keys are still rejected (the new keys are the ONLY additions)", () => {
    const errors = validateTestSuitesManifest({ ...base(), suites: [{ name: "v", type: "bun-test", dirs: ["x"], wall: 900000 }] });
    expect(errors.join("\n")).toContain('unknown key "wall"');
    const shell = validateTestSuitesManifest({ ...base(), suites: [{ name: "c", type: "command", command: ["true"], shell: true }] });
    expect(shell.join("\n")).toContain('unknown key "shell"');
  });
});

describe("sequential execution (co-newbiz canary: order + continue-and-report)", () => {
  test("files run one at a time in order; a failing file does not stop the rest", async () => {
    const root = fixture();
    const log = join(root, "order.log");
    const append = (tag: string) => `import { test, expect } from "bun:test";\nimport { appendFileSync } from "node:fs";\ntest("${tag}", () => { appendFileSync(${JSON.stringify(log)}, "${tag}\\n"); expect(1).toBe(1); });\n`;
    write(root, "tests/e2e-visual/a-visual.test.ts", append("a"));
    write(root, "tests/e2e-visual/b-visual.test.ts", `import { test, expect } from "bun:test";\nimport { appendFileSync } from "node:fs";\ntest("b", () => { appendFileSync(${JSON.stringify(log)}, "b\\n"); expect(1).toBe(2); });\n`);
    write(root, "tests/e2e-visual/c-visual.test.ts", append("c"));
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ ...CONEWBIZ_VISUAL, timeout: 60000 }] }));
    const r = await run(root, "visual");
    expect(r.code).toBe(1);
    expect(readFileSync(log, "utf8")).toBe("a\nb\nc\n");
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("fail");
    expect(field(m, "files")).toBe("3");
    expect(field(m, "files_failed")).toBe("1");
    expect(field(m, "tests")).toBe("3");
    expect(field(m, "tests_failed")).toBe("1");
    expect(r.out).toContain("Running visual suite (3 test files, sequential)");
    expect(r.out).toContain("✓ tests/e2e-visual/a-visual.test.ts");
    expect(r.out).toContain("✓ tests/e2e-visual/c-visual.test.ts");
    expect(r.err).toContain("FAIL: tests/e2e-visual/b-visual.test.ts");
  });
});

describe("timeout enforcement (co-newbiz canary: the declared wall kills)", () => {
  test("a file overrunning the declared suite wall is killed and reported TIMEOUT", async () => {
    const root = fixture();
    write(root, "tests/slow/slow.test.ts", `import { test, expect } from "bun:test";\ntest("slow", async () => { await Bun.sleep(10000); expect(1).toBe(1); });\n`);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "slow", type: "bun-test", dirs: ["tests/slow"], timeout: 1500 }] }));
    const r = await run(root, "slow");
    expect(r.code).toBe(1);
    expect(r.err).toContain("TIMEOUT (1500ms)");
    expect(r.err).toContain("Test timed out after 1500ms");
    expect(field(summaryOf(r.out), "files_failed")).toBe("1");
  });
});

describe("FILE_TIME_BUDGETS composition (resolveFileBudgets contract)", () => {
  test("CLI flag > budget row > declared/builtin suite wall > defaults; slots resolve independently", () => {
    // Declared suite wall fills the suite slot; per-test ceiling keeps the default.
    expect(resolveFileBudgets("x.test.ts", 900000, undefined, {})).toEqual({ suite: 900000, test: 15000 });
    // The hardcoded bun-test fallback when no declared timeout exists.
    expect(resolveFileBudgets("x.test.ts", 120000, undefined, {})).toEqual({ suite: 120000, test: 15000 });
    // A budget row overrides the suite wall per file, both slots independently.
    expect(resolveFileBudgets("x.test.ts", 900000, undefined, { "x.test.ts": { suite: 60000, test: 30000 } })).toEqual({
      suite: 60000,
      test: 30000,
    });
    expect(resolveFileBudgets("x.test.ts", 900000, undefined, { "x.test.ts": { suite: 60000, test: 15000 } })).toEqual({
      suite: 60000,
      test: 15000,
    });
    // A sibling without a row stays on the declared wall.
    expect(resolveFileBudgets("y.test.ts", 900000, undefined, { "x.test.ts": { suite: 60000, test: 30000 } })).toEqual({
      suite: 900000,
      test: 15000,
    });
    // An explicit --timeout CLI flag wins over row and suite wall alike.
    expect(resolveFileBudgets("x.test.ts", 900000, 45000, { "x.test.ts": { suite: 60000, test: 30000 } })).toEqual({
      suite: 45000,
      test: 45000,
    });
  });
});

describe("backward-compat golden (pre-v1.24.0 manifests parse identically)", () => {
  test("the v1.19.0 design-example manifest validates empty and parses to the pinned object", () => {
    const raw = {
      ...base(),
      include: ["integration"],
      suites: [
        { name: "deck", type: "bun-test", dirs: ["scripts/co-deck/tests", "scripts/helpers"] },
        { name: "price", type: "command", command: ["bunx", "vitest", "run"] },
        { name: "games", type: "workspace", dirs: ["projects/*"] },
      ],
      quarantine: [{ path: "scripts/x.test.ts", ticket: "T-1", reason: "known failures", expires: "2027-01-01" }],
    };
    expect(validateTestSuitesManifest(raw)).toEqual([]);
    expect(parseTestSuitesManifest(JSON.stringify(raw)).manifest).toEqual({
      version: 1,
      include: ["integration"],
      suites: [
        { name: "deck", type: "bun-test", dirs: ["scripts/co-deck/tests", "scripts/helpers"] },
        { name: "price", type: "command", command: ["bunx", "vitest", "run"] },
        { name: "games", type: "workspace", dirs: ["projects/*"] },
      ],
      quarantine: [{ path: "scripts/x.test.ts", ticket: "T-1", reason: "known failures", expires: "2027-01-01" }],
    });
    expect(parseTestSuitesManifest(JSON.stringify(raw)).errors).toEqual([]);
  });

  test("the minimal manifest parses to the pinned defaults", () => {
    expect(validateTestSuitesManifest(base())).toEqual([]);
    expect(parseTestSuitesManifest(JSON.stringify(base())).manifest).toEqual({ version: 1, include: [], suites: [], quarantine: [] });
  });

  test("a declared bun-test suite WITHOUT the new keys still runs parallel (default walls)", async () => {
    const root = fixture();
    write(root, "tests/legacy/a.test.ts", `import { test, expect } from "bun:test";\ntest("a", () => { expect(1).toBe(1); });\n`);
    write(root, "tests/legacy/b.test.ts", `import { test, expect } from "bun:test";\ntest("b", () => { expect(1).toBe(1); });\n`);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "legacy", type: "bun-test", dirs: ["tests/legacy"] }] }));
    const r = await run(root, "legacy");
    expect(r.code).toBe(0);
    expect(r.out).toContain("Running legacy suite (2 test files, parallel (concurrency:");
    expect(r.out).not.toContain(", sequential)");
    expect(field(summaryOf(r.out), "result")).toBe("pass");
  });

  test("declared command/workspace steps keep their hardcoded 300000 default via resolveFileBudgets default contract", () => {
    // The runner passes 300000 as suiteTimeoutMs for command/workspace steps;
    // without a declared timeout the row/default chain is unchanged.
    expect(resolveFileBudgets("anything", 300000, undefined, {})).toEqual({ suite: 300000, test: 15000 });
  });
});
