/**
 * @version 1.0.0
 * Summary line (design 2026-11-24-fleet-test-baseline-design §4.4, AC4, test plan 4):
 * exactly one TEST-RUN-SUMMARY line per run, one regex for every field, counts on a
 * passing and a failing fixture, -1 for a command suite, and the dry-run verdict.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { TEST_RUN_SUMMARY_RE } from "../../scripts/test-runner";

const RUNNER = resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "tr-summary-"));
  created.push(dir);
  return dir;
}

function write(root: string, rel: string, content: string): string {
  const file = join(root, ...rel.split("/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

const twoTests = `import { test, expect } from "bun:test";\ntest("one", () => { expect(1).toBe(1); });\ntest("two", () => { expect(2).toBe(2); });\n`;
const oneFails = `import { test, expect } from "bun:test";\ntest("ok", () => { expect(1).toBe(1); });\ntest("bad", () => { expect(1).toBe(2); });\n`;

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn([process.execPath, RUNNER, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code: proc.exitCode, out, err };
}

type Fields = Record<string, string>;
const summaryOf = (r: { out: string; err: string }): Fields => {
  const lines = `${r.out}\n${r.err}`.split(/\r?\n/).filter((l) => l.includes("TEST-RUN-SUMMARY "));
  expect(lines.length).toBe(1);
  const m = lines[0].match(TEST_RUN_SUMMARY_RE);
  expect(m).not.toBeNull();
  return Object.fromEntries(m![0].slice("TEST-RUN-SUMMARY ".length).split(" ").map((t) => t.split("=") as [string, string]));
};

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

const EXPECTED_KEYS = ["schema", "entry", "os", "scope", "suites", "files", "files_failed", "tests", "tests_failed", "not_applicable", "quarantined_failed", "result"];

describe("TEST-RUN-SUMMARY (AC4)", () => {
  test("the regex extracts every field of the design's line", () => {
    const line = "TEST-RUN-SUMMARY schema=1 entry=all os=linux scope=both suites=2/2 files=5 files_failed=1 tests=40 tests_failed=12 not_applicable=0 quarantined_failed=12 result=pass";
    const m = line.match(TEST_RUN_SUMMARY_RE);
    expect(m).not.toBeNull();
    const fields = line.slice("TEST-RUN-SUMMARY ".length).split(" ").map((t) => t.split("=")[0]);
    expect(fields).toEqual(EXPECTED_KEYS);
    expect(line.replace("schema=1 ", "")).not.toMatch(TEST_RUN_SUMMARY_RE);
  });

  test("is the last stdout line of a passing run, exactly once", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", twoTests);
    const r = await run(root, "all");
    const lines = r.out.trimEnd().split(/\r?\n/);
    expect(lines[lines.length - 1]).toMatch(TEST_RUN_SUMMARY_RE);
    expect(lines.filter((l) => l.includes("TEST-RUN-SUMMARY "))).toHaveLength(1);
    const s = summaryOf(r);
    expect(r.code).toBe(0);
    expect(s).toMatchObject({ schema: "1", entry: "all", scope: "both", suites: "1/1", files: "1", files_failed: "0", tests: "2", tests_failed: "0", not_applicable: "0", quarantined_failed: "-1", result: "pass" });
    expect(s.os).toBe(process.platform);
  });

  test("counts tests and failures on a failing fixture", async () => {
    const root = fixture();
    write(root, "scripts/tests/ok.test.ts", twoTests);
    write(root, "scripts/tests/bad.test.ts", oneFails);
    const r = await run(root, "common");
    const s = summaryOf(r);
    expect(r.code).toBe(1);
    expect(s).toMatchObject({ files: "2", files_failed: "1", tests: "4", tests_failed: "1", result: "fail" });
  });

  test("a command suite prints -1 for its counts", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", twoTests);
    write(root, "test-suites.json", JSON.stringify({ version: 1, include: [], suites: [{ name: "price", type: "command", command: [process.execPath, "-e", "process.exit(0)"] }], quarantine: [] }));
    const r = await run(root, "all");
    const s = summaryOf(r);
    expect(r.code).toBe(0);
    expect(s).toMatchObject({ suites: "2/2", files: "2", tests: "-1", tests_failed: "-1", result: "pass" });
  });

  test("dry-run executes nothing and ends with result=selected", async () => {
    const root = fixture();
    const marker = join(root, "ran.log");
    write(root, "scripts/tests/a.test.ts", `import { test } from "bun:test";\ntest("writes", () => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "1"); });\n`);
    const r = await run(root, "all", "--dry-run");
    const s = summaryOf(r);
    expect(r.code).toBe(0);
    expect(s).toMatchObject({ suites: "0/1", files: "1", result: "selected" });
    expect(existsSync(marker)).toBe(false);
  });

  test("a failing built-in specialized suite reports result=fail and exit 1", async () => {
    const root = fixture();
    write(root, "tests/unit/bad.test.ts", oneFails);
    const r = await run(root, "unit");
    expect(r.code).toBe(1);
    expect(summaryOf(r)).toMatchObject({ entry: "unit", files: "1", files_failed: "1", result: "fail" });
  });
});
