/**
 * @version 1.0.0
 * OS applicability (design 2026-11-24-fleet-test-baseline-design §4.8-4.9, AC5, AC7,
 * test plan 4): tag parsing, selection per platform, both scopes and --plan-os.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { TEST_RUN_SUMMARY_RE, formatPlanOs, isFileApplicable, parseBunCounts, parseOsTag } from "../../scripts/test-runner";

const RUNNER = resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "tr-os-"));
  created.push(dir);
  return dir;
}

function write(root: string, rel: string, content: string): string {
  const file = join(root, ...rel.split("/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

const PASSING = `import { test, expect } from "bun:test";\ntest("passes", () => { expect(1).toBe(1); });\n`;

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
const field = (m: RegExpMatchArray, token: string): string => m[0].split(" ").find((t) => t.startsWith(`${token}=`))!.slice(token.length + 1);

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("tag parsing and selection", () => {
  test("parseOsTag reads the suffix before .test.ts and nothing else", () => {
    expect(parseOsTag("a.win32.test.ts")).toBe("win32");
    expect(parseOsTag(join("dir", "sub", "b.darwin.test.ts"))).toBe("darwin");
    expect(parseOsTag("c.linux.test.ts")).toBe("linux");
    expect(parseOsTag("d.test.ts")).toBeNull();
    expect(parseOsTag("e.win32.ts")).toBeNull();
    expect(parseOsTag("f.win32.spec.ts")).toBeNull();
  });

  test("isFileApplicable per scope", () => {
    const plain = "p.test.ts";
    const win = "w.win32.test.ts";
    expect(isFileApplicable(plain, "linux", "both")).toBe(true);
    expect(isFileApplicable(win, "linux", "both")).toBe(false);
    expect(isFileApplicable(win, "win32", "both")).toBe(true);
    expect(isFileApplicable(win, "win32", "specific")).toBe(true);
    expect(isFileApplicable(plain, "win32", "specific")).toBe(false);
    expect(isFileApplicable(plain, "win32", "independent")).toBe(true);
    expect(isFileApplicable(win, "win32", "independent")).toBe(false);
  });

  test("parseBunCounts sums bun's pass and fail rows; null without rows", () => {
    expect(parseBunCounts(" 2 pass\n 1 fail\n 4 expect() calls\n")).toEqual({ pass: 2, fail: 1 });
    expect(parseBunCounts(" 0 pass\n 1 fail\n")).toEqual({ pass: 0, fail: 1 });
    expect(parseBunCounts("nothing here\n1 passed\n")).toBeNull();
  });

  test("formatPlanOs orders win32 before darwin", () => {
    expect(formatPlanOs(["darwin", "win32"])).toBe('["win32","darwin"]');
    expect(formatPlanOs(["darwin"])).toBe('["darwin"]');
    expect(formatPlanOs([])).toBe("[]");
  });
});

describe("AC5: a .win32.test.ts file off its platform", () => {
  const withTagged = (root: string, name = "w.win32.test.ts", marker?: string) => {
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, `scripts/deck/tests/${name}`, marker
      ? `import { test, expect } from "bun:test";\ntest("writes", () => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "1"); expect(1).toBe(1); });\n`
      : PASSING);
    write(root, "test-suites.json", JSON.stringify({
      version: 1,
      include: [],
      suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }],
      quarantine: [],
    }));
  };

  test("is not dispatched on a non-win32 platform and is counted in not_applicable", async () => {
    if (process.platform === "win32") return;
    const root = fixture();
    const marker = join(root, "ran.log");
    withTagged(root, "w.win32.test.ts", marker);
    const r = await run(root, "all");
    expect(r.code).toBe(0);
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("pass");
    expect(field(m, "not_applicable")).toBe("1");
    expect(field(m, "files")).toBe("1");
    expect(existsSync(marker)).toBe(false);
    expect(r.out).toContain("  - scripts/deck/tests/w.win32.test.ts (not applicable on ");
    expect(r.out).not.toMatch(/✓ scripts\/deck\/tests\/w\.win32\.test\.ts/);
  });

  test("is dispatched on win32", async () => {
    if (process.platform !== "win32") return;
    const root = fixture();
    const marker = join(root, "ran.log");
    withTagged(root, "w.win32.test.ts", marker);
    const r = await run(root, "all");
    expect(r.code).toBe(0);
    expect(field(summaryOf(r.out), "files")).toBe("2");
    expect(existsSync(marker)).toBe(true);
  });

  test("--os win32 --dry-run lists it", async () => {
    const root = fixture();
    withTagged(root);
    const r = await run(root, "all", "--os", "win32", "--dry-run");
    expect(r.code).toBe(0);
    expect(field(summaryOf(r.out), "os")).toBe("win32");
    expect(r.out).toContain("    scripts/deck/tests/w.win32.test.ts\n");
  });

  test("--os linux --dry-run reports it as not applicable", async () => {
    const root = fixture();
    withTagged(root);
    const r = await run(root, "all", "--os", "linux", "--dry-run");
    expect(field(summaryOf(r.out), "files")).toBe("1");
    expect(field(summaryOf(r.out), "not_applicable")).toBe("1");
  });

  test("--os-scope independent keeps only untagged files", async () => {
    const root = fixture();
    withTagged(root);
    const r = await run(root, "all", "--os-scope", "independent", "--dry-run");
    expect(field(summaryOf(r.out), "scope")).toBe("independent");
    expect(field(summaryOf(r.out), "files")).toBe("1");
  });

  test("--os-scope specific is exempt from the baseline rules", async () => {
    const root = fixture();
    withTagged(root);
    const r = await run(root, "all", "--os", "win32", "--os-scope", "specific", "--dry-run");
    expect(r.code).toBe(0);
    expect(field(summaryOf(r.out), "files")).toBe("1");
    const none = await run(fixture(), "all", "--os-scope", "specific", "--dry-run");
    expect(none.code).toBe(0);
    expect(field(summaryOf(none.out), "result")).toBe("selected");
  });

  test("a suite-level os key limits a declared suite to that platform", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({
      version: 1,
      include: [],
      suites: [{ name: "price", type: "command", command: [process.execPath, "-e", "process.exit(0)"], os: "win32" }],
      quarantine: [],
    }));
    const off = await run(root, "all", "--os", "linux", "--dry-run");
    expect(field(summaryOf(off.out), "files")).toBe("1");
    expect(off.out).toContain("- suite price skipped on linux (suite os win32)");
    const on = await run(root, "all", "--os", "win32", "--dry-run");
    expect(field(summaryOf(on.out), "files")).toBe("2");
    const independent = await run(root, "all", "--os-scope", "independent", "--dry-run");
    expect(field(summaryOf(independent.out), "files")).toBe("1");
  });
});

describe("AC7: --plan-os", () => {
  test("prints [] with no OS-specific target", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    const r = await run(root, "all", "--plan-os");
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("[]");
  });

  test('prints ["win32"] for one .win32.test.ts file and ["darwin"] for a darwin one', async () => {
    const win = fixture();
    write(win, "scripts/tests/a.test.ts", PASSING);
    write(win, "scripts/deck/tests/w.win32.test.ts", PASSING);
    write(win, "test-suites.json", JSON.stringify({ version: 1, include: [], suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }], quarantine: [] }));
    const a = await run(win, "all", "--plan-os");
    expect(a.code).toBe(0);
    expect(a.out.trim()).toBe('["win32"]');

    const mac = fixture();
    write(mac, "scripts/tests/a.test.ts", PASSING);
    write(mac, "scripts/deck/tests/m.darwin.test.ts", PASSING);
    write(mac, "test-suites.json", JSON.stringify({ version: 1, include: [], suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }], quarantine: [] }));
    const b = await run(mac, "all", "--plan-os");
    expect(b.out.trim()).toBe('["darwin"]');
  });

  test("a failing baseline rule is fatal for --plan-os too", async () => {
    const r = await run(fixture(), "all", "--plan-os");
    expect(r.code).toBe(1);
  });
});

describe("FILE_TIME_BUDGETS keys (K4)", () => {
  test("every key still names an untagged tests/unit file", () => {
    const source = readFileSync(RUNNER, "utf8");
    const block = source.slice(source.indexOf("const FILE_TIME_BUDGETS"), source.indexOf("function getTestFiles"));
    const keys = [...block.matchAll(/^\s*"([^"]+\.test\.ts)": \{ suite:/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    const unitDir = resolve(import.meta.dir);
    const names = new Set(readdirSync(unitDir));
    for (const key of keys) {
      expect(names.has(key)).toBe(true);
      expect(parseOsTag(key)).toBeNull();
    }
  });
});
