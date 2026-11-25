/**
 * @version 1.0.0
 * Declared suites, quarantine and opt-out (design 2026-11-24-fleet-test-baseline-design
 * §4.3, test plan 3): manifest validation, the three suite types, and the quarantine rules.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { quarantineFor, validateTestSuitesManifest } from "../../scripts/test-runner";
import { TEST_RUN_SUMMARY_RE } from "../../scripts/test-runner";

const RUNNER = resolve(import.meta.dir, "..", "..", "scripts", "test-runner.ts");
const created: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(resolve(process.env.TEST_TEMP_DIR ?? tmpdir()), "tr-manifest-"));
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
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => isoDate(new Date(Date.now() + n * 24 * 60 * 60 * 1000));

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

const base = () => ({ version: 1, include: [], suites: [] as unknown[], quarantine: [] as unknown[] });

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("manifest validation (FC4)", () => {
  test("a minimal manifest and the design example are valid", () => {
    expect(validateTestSuitesManifest({ version: 1, include: ["integration"], suites: [
      { name: "deck", type: "bun-test", dirs: ["scripts/co-deck/tests", "scripts/helpers"] },
      { name: "price", type: "command", command: ["bunx", "vitest", "run"] },
      { name: "games", type: "workspace", dirs: ["projects/*"] },
    ], quarantine: [{ path: "scripts/x.test.ts", ticket: "T-1", reason: "r", expires: daysFromNow(30) }] })).toEqual([]);
    expect(validateTestSuitesManifest(base())).toEqual([]);
  });

  test("unknown top-level key, unknown suite key, unknown type", () => {
    const errors = validateTestSuitesManifest({ ...base(), bogus: 1 });
    expect(errors.join("\n")).toContain('unknown key "bogus"');
    const suite = validateTestSuitesManifest({ ...base(), suites: [{ name: "x", type: "nonsense" }] });
    expect(suite.join("\n")).toContain('"type" must be one of');
    const key = validateTestSuitesManifest({ ...base(), suites: [{ name: "x", type: "command", command: ["true"], shell: true }] });
    expect(key.join("\n")).toContain('unknown key "shell"');
  });

  test("a suite name must not shadow a built-in or all, and must be unique", () => {
    for (const name of ["all", "common", "unit", "integration", "scenarios", "scripts"]) {
      const e = validateTestSuitesManifest({ ...base(), suites: [{ name, type: "command", command: ["true"] }] });
      expect(e.join("\n")).toContain("shadows a built-in");
    }
    const dup = validateTestSuitesManifest({ ...base(), suites: [
      { name: "x", type: "command", command: ["true"] },
      { name: "x", type: "command", command: ["true"] },
    ] });
    expect(dup.join("\n")).toContain("duplicate suite name");
  });

  test("include accepts built-in specialized names only", () => {
    for (const name of ["unit", "common", "all", "deck"]) {
      const e = validateTestSuitesManifest({ ...base(), include: [name] });
      expect(e.join("\n")).toContain('"include" accepts built-in specialized suites only');
    }
    expect(validateTestSuitesManifest({ ...base(), include: ["integration", "integration"] }).join("\n")).toContain("repeats a suite");
  });

  test("quarantine: every field required, expiry at most 60 days out, valid date", () => {
    const q = { path: "scripts/x.test.ts", ticket: "T-1", reason: "r", expires: daysFromNow(30) };
    for (const missing of Object.keys(q)) {
      const entry = { ...q } as Record<string, string>;
      delete entry[missing];
      expect(validateTestSuitesManifest({ ...base(), quarantine: [entry] }).join("\n")).toContain(`"${missing}" is required`);
    }
    expect(validateTestSuitesManifest({ ...base(), quarantine: [{ ...q, expires: daysFromNow(61) }] }).join("\n")).toContain("more than 60 days");
    expect(validateTestSuitesManifest({ ...base(), quarantine: [{ ...q, expires: daysFromNow(60) }] })).toEqual([]);
    expect(validateTestSuitesManifest({ ...base(), quarantine: [{ ...q, expires: "2026-02-30" }] }).join("\n")).toContain("YYYY-MM-DD");
  });

  test("opt-out requires reason, ticket and review", () => {
    expect(validateTestSuitesManifest({ ...base(), optOut: { reason: "r", ticket: "T-1" } }).join("\n")).toContain('"review" is required');
    expect(validateTestSuitesManifest({ ...base(), optOut: { reason: "r", ticket: "T-1", review: "2027-01-01" } })).toEqual([]);
  });
});

describe("declared suites", () => {
  test("bun-test: flat files in each listed directory, one verdict for all", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "scripts/deck/tests/d.test.ts", PASSING);
    write(root, "scripts/helpers/h.test.ts", PASSING);
    write(root, "scripts/deck/tests/nested/n.test.ts", FAILING);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests", "scripts/helpers"] }] }));
    const r = await run(root, "deck");
    expect(r.code).toBe(0);
    const m = summaryOf(r.out);
    expect(field(m, "entry")).toBe("deck");
    expect(field(m, "files")).toBe("2");
  });

  test("a declared suite is runnable on its own and fails with its files", async () => {
    const root = fixture();
    write(root, "scripts/deck/tests/d.test.ts", FAILING);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }] }));
    const r = await run(root, "deck");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("fail");
    expect(field(summaryOf(r.out), "files_failed")).toBe("1");
    expect(field(summaryOf(r.out), "tests_failed")).toBe("1");
  });

  test("command: the exit code is the verdict and counts print as -1", async () => {
    const root = fixture();
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "price", type: "command", command: [process.execPath, "-e", "process.exit(1)"] }] }));
    const r = await run(root, "price");
    expect(r.code).toBe(1);
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("fail");
    expect(field(m, "tests")).toBe("-1");
    expect(field(m, "tests_failed")).toBe("-1");
  });

  test("workspace: runs bun run test where a test script exists, skips a directory without one", async () => {
    const root = fixture();
    const log = join(root, "ws.log");
    write(root, "projects/pac/write-log.js", `require("node:fs").appendFileSync(${JSON.stringify(log)}, "pac\\n");`);
    write(root, "projects/pac/package.json", JSON.stringify({ scripts: { test: "bun write-log.js" } }));
    write(root, "projects/bare/package.json", JSON.stringify({}));
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "games", type: "workspace", dirs: ["projects/*"] }] }));
    const r = await run(root, "games");
    expect(r.code).toBe(0);
    const m = summaryOf(r.out);
    expect(field(m, "files")).toBe("1");
    expect(field(m, "result")).toBe("pass");
    expect(r.out).toContain(`"projects/bare" has no test script`);
    expect(existsSync(log)).toBe(true);
  });

  test("workspace: a test script that fails fails the suite", async () => {
    const root = fixture();
    write(root, "projects/pac/package.json", JSON.stringify({ scripts: { test: "bun -e \"process.exit(3)\"" } }));
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "games", type: "workspace", dirs: ["projects/*"] }] }));
    const r = await run(root, "games");
    expect(r.code).toBe(1);
    expect(field(summaryOf(r.out), "result")).toBe("fail");
  });
});

describe("quarantine and opt-out", () => {
  const withDeck = (root: string, quarantine: unknown[]) => {
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "scripts/deck/tests/bad.test.ts", FAILING);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }], quarantine }));
  };
  const entry = { path: "scripts/deck/tests/bad.test.ts", ticket: "T-20261124-016", reason: "known failures", expires: daysFromNow(30) };

  test("an active quarantine reports the failure without failing the run", async () => {
    const root = fixture();
    withDeck(root, [entry]);
    const r = await run(root, "all");
    expect(r.code).toBe(0);
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("pass");
    expect(field(m, "quarantined_failed")).toBe("1");
    expect(r.out).toContain("QUARANTINED under T-20261124-016");
    expect(r.err).toContain("FAIL: scripts/deck/tests/bad.test.ts");
  });

  test("the target still runs", async () => {
    const root = fixture();
    const marker = join(root, "ran.log");
    write(root, "scripts/tests/a.test.ts", PASSING);
    write(root, "scripts/deck/tests/bad.test.ts", `import { test } from "bun:test";\ntest("writes", () => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "1"); expect(1).toBe(2); });\n`);
    write(root, "test-suites.json", JSON.stringify({ ...base(), suites: [{ name: "deck", type: "bun-test", dirs: ["scripts/deck/tests"] }], quarantine: [entry] }));
    const r = await run(root, "all");
    expect(r.code).toBe(0);
    expect(existsSync(marker)).toBe(true);
  });

  test("an expired entry is not honored", async () => {
    const root = fixture();
    withDeck(root, [{ ...entry, expires: daysFromNow(-1) }]);
    const r = await run(root, "all");
    expect(r.code).toBe(1);
    const m = summaryOf(r.out);
    expect(field(m, "result")).toBe("fail");
    expect(field(m, "quarantined_failed")).toBe("-1");
    expect(field(m, "files_failed")).toBe("1");
  });

  test("quarantineFor matches the file and anything under a workspace directory", () => {
    const q = { path: "projects/pac", ticket: "T", reason: "r", expires: daysFromNow(5) };
    expect(quarantineFor("projects/pac/x.test.ts", [q])).toHaveLength(1);
    expect(quarantineFor("projects/pacman/x.test.ts", [q])).toHaveLength(0);
  });

  test("opt-out: common and all skip the baseline and print result=opt-out", async () => {
    const root = fixture();
    write(root, "test-suites.json", JSON.stringify({ ...base(), optOut: { reason: "no scripts", ticket: "T-9", review: "2027-01-01" } }));
    for (const entryPoint of ["common", "all"]) {
      const r = await run(root, entryPoint);
      expect(r.code).toBe(0);
      expect(field(summaryOf(r.out), "result")).toBe("opt-out");
    }
  });
});
