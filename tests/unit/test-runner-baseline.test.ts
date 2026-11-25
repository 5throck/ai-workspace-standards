/**
 * @version 1.0.0
 * Fleet test baseline (design 2026-11-24-fleet-test-baseline-design §4.1-4.2, AC1-AC3):
 * the `common` baseline, the `all` order and the fail-closed rules FC1-FC5. Each case
 * uses a fixture project and the spawned CLI and asserts the exit code and the summary line.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { TEST_RUN_SUMMARY_RE } from "../../scripts/test-runner";

const RUNNER = resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "tr-baseline-"));
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
const FAILING = `import { test, expect } from "bun:test";\ntest("fails", () => { expect(1).toBe(2); });\n`;

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

describe("baseline: common and all (AC1, test plan 1)", () => {
  test("common discovers the flat scripts/tests files and passes", async () => {
    const root = fixture();
    for (const name of ["a", "b", "c"]) write(root, `scripts/tests/${name}.test.ts`, PASSING);
    write(root, "scripts/tests/nested/deep.test.ts", PASSING);
    const r = await run(root, "common");
    const m = summaryOf(r.out);
    expect(r.code).toBe(0);
    expect(field(m, "entry")).toBe("common");
    expect(field(m, "files")).toBe("3");
    expect(field(m, "result")).toBe("pass");
    expect(r.out).toContain("✓ scripts/tests/a.test.ts (");
  });

  test("all runs common, then unit, then include, then declared suites", async () => {
    const root = fixture();
    const log = join(root, "order.log");
    const step = (label: string) => `import { test } from "bun:test";\ntest("${label}", () => { require("node:fs").appendFileSync(${JSON.stringify(log)}, "${label}\\n"); });\n`;
    write(root, "scripts/tests/base.test.ts", step("common"));
    write(root, "tests/unit/u.test.ts", step("unit"));
    write(root, "tests/i.test.ts", step("integration"));
    write(root, "test-suites.json", JSON.stringify({
      version: 1,
      include: ["integration"],
      suites: [{ name: "extra", type: "command", command: [process.execPath, "-e", `require("node:fs").appendFileSync(${JSON.stringify(log)}, "declared\\n")`] }],
      quarantine: [],
    }));
    const r = await run(root, "all");
    expect(r.code).toBe(0);
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("pass");
    expect(field(m, "suites")).toBe("4/4");
    expect(field(m, "files")).toBe("4");
    // The command suite makes the test total unknown: -1 by design (§4.3).
    expect(field(m, "tests")).toBe("-1");
    expect(readFileSync(log, "utf8")).toBe("common\nunit\nintegration\ndeclared\n");
  });

  test("a built-in specialized suite keeps its v1.18.0 per-file lines and verdict", async () => {
    const root = fixture();
    write(root, "tests/unit/ok.test.ts", PASSING);
    const r = await run(root, "unit");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/Running unit suite \(1 test file, sequential\)\.\.\./);
    expect(r.out).toMatch(/  Running: tests[/\\]unit[/\\]ok\.test\.ts/);
    expect(r.out).toMatch(/✓ unit suite passed \(\d+ms\)/);
    expect(field(summaryOf(r.out), "result")).toBe("pass");
  });
});

describe("fail-closed rules (AC2, test plan 2)", () => {
  test("FC1: common without scripts/tests exits 1 with result=no-tests", async () => {
    const r = await run(fixture(), "common");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
  });

  test("FC1: a zero baseline in all stops the run before any other suite starts", async () => {
    const root = fixture();
    const log = join(root, "order.log");
    write(root, "tests/unit/u.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({
      version: 1,
      include: [],
      suites: [{ name: "extra", type: "command", command: [process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(log)}, "ran")`] }],
      quarantine: [],
    }));
    const r = await run(root, "all");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
    expect(field(summaryOf(r.out), "files")).toBe("0");
    expect(existsSync(log)).toBe(false);
  });

  test("an absent built-in specialized suite keeps exit 0 and prints a WARN row", async () => {
    const r = await run(fixture(), "unit");
    expect(r.code).toBe(0);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
    expect(r.out).toContain("non-fatal: a built-in specialized suite");
  });

  test("FC2: a built-in listed in include with zero targets exits 1", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({ version: 1, include: ["integration"], suites: [], quarantine: [] }));
    const r = await run(root, "all");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
    expect(r.err).toContain('built-in suite "integration"');
  });

  test("FC2: a declared suite with zero targets exits 1", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({
      version: 1,
      include: [],
      suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }],
      quarantine: [],
    }));
    const r = await run(root, "all");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
  });

  test("FC3: a baseline whose parsed test total is 0 exits 1", async () => {
    const root = fixture();
    write(root, "scripts/tests/empty.test.ts", "// no tests in this file\n");
    const r = await run(root, "common");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("no-tests");
    expect(field(summaryOf(r.out), "tests")).toBe("0");
  });

  test("FC4: an invalid test-suites.json exits 1 for every entry point", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "tests/unit/u.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({ version: 1, bogus: true, include: [], suites: [], quarantine: [] }));
    for (const entry of ["all", "common", "unit"]) {
      const r = await run(root, entry);
      expect(r.code).toBe(1);
      expect(field(summaryOf(r.out), "result")).toBe("fail");
      expect(r.err).toContain('unknown key "bogus"');
    }
  });

  test("FC5: a baseline file with an OS tag exits 1", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "scripts/tests/b.win32.test.ts", PASSING);
    for (const entry of ["common", "all"]) {
      const r = await run(root, entry);
      expect(r.code).toBe(1);
      expect(field(summaryOf(r.out), "result")).toBe("no-tests");
      expect(r.err).toContain("a baseline file carries an OS tag");
    }
  });
});
