/**
 * @version 1.0.0
 * battery.ts v1.1.0 (design 2026-11-24-fleet-test-baseline-design §4.5, AC9, AC12,
 * test plan 6): the battery runs the CI command set. Each case builds a fixture
 * project, spawns the battery and reads the ledger rows it records.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const BATTERY = resolve(import.meta.dir, "..", "..", "scripts", "battery.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "battery-"));
  created.push(dir);
  return dir;
}

function write(root: string, rel: string, content: string): string {
  const file = join(root, ...rel.split("/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

/** A script that appends its own name to one log, then exits with the given code. */
const probe = (log: string, name: string, code = 0) =>
  `require("node:fs").appendFileSync(${JSON.stringify(log)}, ${JSON.stringify(`${name}\n`)});\nprocess.exit(${code});\n`;

type Row = { cmd: string; exit: number; summary?: string };

async function battery(project: string): Promise<{ code: number; out: string; rows: Row[] }> {
  const record = join(project, ".battery-ledger.jsonl");
  const proc = Bun.spawn([process.execPath, BATTERY, "--project", project, "--record", record], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  const rows = readFileSync(record, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
  rmSync(record, { force: true });
  return { code: proc.exitCode, out: `${out}${err}`, rows };
}

const PASSING = `import { test, expect } from "bun:test";\ntest("passes", () => { expect(1).toBe(1); });\n`;

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("battery v1.1.0 command set (AC9, AC12)", () => {
  test("wrapper present: the wrapper runs and the ledger never carries the raw bun audit", async () => {
    const root = fixture();
    const log = join(root, "calls.log");
    write(root, "scripts/dependency-audit.ts", probe(log, "dependency-audit"));
    write(root, "scripts/test-runner.ts", probe(log, "test-runner"));
    write(root, "package.json", JSON.stringify({ scripts: { audit: "bun never-runs.ts", test: "bun never-runs.ts" } }));
    const r = await battery(root);
    expect(r.code).toBe(0);
    expect(r.rows.map((x) => x.cmd)).toEqual(["bun scripts/dependency-audit.ts", "bun scripts/test-runner.ts all"]);
    expect(readFileSync(log, "utf8")).toBe("dependency-audit\ntest-runner\n");
  });

  test("wrapper absent: the raw bun audit runs", async () => {
    const root = fixture();
    write(root, "scripts/test-runner.ts", probe(join(root, "calls.log"), "test-runner"));
    // No package.json: the raw audit fails fast offline, so the case needs no network.
    const r = await battery(root);
    expect(r.rows[0].cmd).toBe("bun audit");
    expect(r.rows.map((x) => x.cmd)[1]).toBe("bun scripts/test-runner.ts all");
  });

  test("scripts/audit.ts present: the documentation audit is its own command", async () => {
    const root = fixture();
    const log = join(root, "calls.log");
    write(root, "scripts/dependency-audit.ts", probe(log, "dependency-audit"));
    write(root, "scripts/audit.ts", probe(log, "documentation-audit"));
    write(root, "scripts/test-runner.ts", probe(log, "test-runner"));
    // A package.json `audit` script is no longer read: this one must never run.
    write(root, "package.json", JSON.stringify({ scripts: { audit: "bun never-runs.ts" } }));
    const r = await battery(root);
    expect(r.code).toBe(0);
    expect(r.rows.map((x) => x.cmd)).toEqual([
      "bun scripts/dependency-audit.ts",
      "bun scripts/audit.ts",
      "bun scripts/test-runner.ts all",
    ]);
    expect(readFileSync(log, "utf8")).toBe("dependency-audit\ndocumentation-audit\ntest-runner\n");
  });

  test("a project without the runner records an exit-1 row and fails the battery", async () => {
    const root = fixture();
    write(root, "package.json", JSON.stringify({ scripts: { test: "bun nothing.ts" } }));
    const r = await battery(root);
    expect(r.code).toBe(1);
    const row = r.rows.find((x) => x.cmd === "bun scripts/test-runner.ts all");
    expect(row?.exit).toBe(1);
    expect(r.out).toContain("scripts/test-runner.ts is missing");
  });

  test("the ledger row of a real runner carries its TEST-RUN-SUMMARY line", async () => {
    const root = fixture();
    write(root, "scripts/dependency-audit.ts", probe(join(root, "calls.log"), "dependency-audit"));
    write(root, "scripts/tests/a.test.ts", PASSING);
    // The real runner, so the summary line is produced, not faked.
    copyFileSync(resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts"), join(root, "scripts", "test-runner.ts"));
    const r = await battery(root);
    expect(r.code).toBe(0);
    const row = r.rows.find((x) => x.cmd === "bun scripts/test-runner.ts all");
    expect(row?.exit).toBe(0);
    expect(row?.summary).toMatch(/^TEST-RUN-SUMMARY schema=1 entry=all .* files=1 .* result=pass$/);
  });

  test("extras run after the standard commands, through sh -c", async () => {
    const root = fixture();
    const log = join(root, "calls.log");
    write(root, "scripts/dependency-audit.ts", probe(log, "dependency-audit"));
    write(root, "scripts/audit.ts", probe(log, "documentation-audit"));
    write(root, "scripts/test-runner.ts", probe(log, "test-runner"));
    write(root, "extra.js", probe(log, "extra"));
    const record = join(root, ".battery-ledger.jsonl");
    const proc = Bun.spawn([process.execPath, BATTERY, "--project", root, "--record", record, "--", "bun extra.js"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const rows = readFileSync(record, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Row);
    rmSync(record, { force: true });
    expect(proc.exitCode).toBe(0);
    expect(rows).toHaveLength(4);
    expect(readFileSync(log, "utf8")).toBe("dependency-audit\ndocumentation-audit\ntest-runner\nextra\n");
  });
});
