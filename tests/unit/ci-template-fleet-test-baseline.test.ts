/**
 * @version 1.0.0
 * Template CI workflow text (design 2026-11-24-fleet-test-baseline-design §4.6, §4.9,
 * AC6, AC7, test plan 5): the two test jobs, the concurrency block, the OS matrix
 * expressions and `shell: bash`. The co-abap overlay mirrors both job bodies.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { load } from "js-yaml";
import { CI_RESERVED_JOBS } from "../../scripts/lib/ci-workflow-merge";

const ROOT = resolve(import.meta.dir, "..", "..");
const COMMON = join(ROOT, "templates", "common", ".github", "workflows", "ci.yml");
const ABAP = join(ROOT, "templates", "co-abap", ".github", "workflows", "ci.yml");
const TEMPLATE_RUNNER = join(ROOT, "templates", "common", "scripts", "test-runner.ts");
const ROOT_RUNNER = join(ROOT, "scripts", "test-runner.ts");

type Workflow = {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": string };
  jobs: Record<string, Job>;
};
type Job = {
  name?: string;
  "runs-on": string;
  needs?: string;
  if?: string;
  timeout?: number;
  "timeout-minutes"?: number;
  outputs?: Record<string, string>;
  strategy?: { "fail-fast": boolean; matrix: { os: string } };
  steps: { name?: string; run?: string; shell?: string; uses?: string; id?: string; with?: Record<string, string> }[];
};

const loadWorkflow = (path: string): Workflow => load(readFileSync(path, "utf8")) as Workflow;
const jobText = (text: string, key: string): string => {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === `  ${key}:`);
  expect(start).toBeGreaterThan(-1);
  let end = start + 1;
  while (end < lines.length && !/^ {2}[A-Za-z0-9_"-][^ ]*:\s*$/.test(lines[end])) end++;
  return lines.slice(start, end).join("\n").replace(/\s+$/, "");
};

describe("template unit-tests job (§4.6, AC6)", () => {
  const wf = loadWorkflow(COMMON);
  const job = wf.jobs["unit-tests"];

  test("job key and display name are unchanged", () => {
    expect(job).toBeDefined();
    expect(job.name).toBe("Unit Tests");
    expect(job["runs-on"]).toBe("ubuntu-latest");
  });

  test("no detect step remains and nothing gates the test step", () => {
    expect(job.steps.some((s) => /Detect test:unit/.test(s.name ?? ""))).toBe(false);
    expect(job.steps.some((s) => s.id === "detect")).toBe(false);
    for (const step of job.steps) {
      expect(step.run ?? "").not.toContain("has_unit");
      expect(JSON.stringify(step)).not.toContain("steps.detect");
    }
  });

  test("the job-level if: is the emergency switch only", () => {
    expect(job.if).toBe("${{ vars.CI_SKIP_DEFAULT_UNIT_TESTS != 'true' }}");
  });

  test("it runs `all` and writes the os-legs output from --plan-os", () => {
    const runs = job.steps.map((s) => (s.run ?? "").trim());
    expect(runs).toContain("bun scripts/test-runner.ts all");
    expect(runs).toContain('echo "os-legs=$(bun scripts/test-runner.ts all --plan-os)" >> "$GITHUB_OUTPUT"');
    expect(job.outputs?.["os-legs"]).toBe("${{ steps.plan-os.outputs.os-legs }}");
    expect(job.steps.find((s) => s.id === "plan-os")).toBeDefined();
  });

  test("the install step tests the root manifest in the shell and loops over nested lockfiles", () => {
    const install = job.steps.find((s) => s.name === "Install dependencies")!;
    expect(install.shell).toBe("bash");
    expect(install.run).toContain("if [ -f package.json ]; then bun install --frozen-lockfile; fi");
    expect(install.run).toContain("for lock in $(find . -mindepth 2 -maxdepth 4");
    expect(install.run).toContain("bun.lockb");
    expect(install.run).toContain('-not -path \'*/node_modules/*\'');
    // A `for` loop fails the step on a failed nested install; a piped while loop does not.
    expect(install.run).not.toContain("| while read");
  });
});

describe("template unit-tests-os job (§4.9, AC6, AC7)", () => {
  const wf = loadWorkflow(COMMON);
  const job = wf.jobs["unit-tests-os"];

  test("it exists with the reserved key and its display name", () => {
    expect(job.name).toBe("Unit Tests (os)");
    expect(CI_RESERVED_JOBS).toContain("unit-tests-os");
    expect(CI_RESERVED_JOBS).toContain("unit-tests");
  });

  test("it needs unit-tests and is gated on a non-empty os-legs output", () => {
    expect(job.needs).toBe("unit-tests");
    expect(job.if).toBe("${{ needs.unit-tests.outputs.os-legs != '[]' && vars.CI_SKIP_DEFAULT_UNIT_TESTS != 'true' }}");
  });

  test("the matrix derives from os-legs, maps win32 to windows and is not fail-fast", () => {
    expect(job["runs-on"]).toBe("${{ matrix.os == 'win32' && 'windows-latest' || 'macos-latest' }}");
    expect(job.strategy?.["fail-fast"]).toBe(false);
    expect(job.strategy?.matrix.os).toBe("${{ fromJSON(needs.unit-tests.outputs.os-legs) }}");
  });

  test("its install and test steps run under bash, and the test step selects the specific scope", () => {
    expect(job["timeout-minutes"]).toBe(15);
    for (const step of job.steps.filter((s) => s.run)) expect(step.shell).toBe("bash");
    const testStep = job.steps.find((s) => s.name === "Run OS-specific tests")!;
    expect(testStep.run.trim()).toBe("bun scripts/test-runner.ts all --os-scope specific");
  });

  test("an OS leg costs nothing with no declaration: only the job-level if gates it", () => {
    // No `if:` on any step of the OS job, and no schedule/path filter on the workflow.
    for (const step of job.steps) expect((step as { if?: string }).if).toBeUndefined();
    expect(Object.keys(wf.on).sort()).toEqual(["pull_request", "push", "workflow_dispatch"]);
  });
});

describe("workflow-level concurrency (§4.9)", () => {
  test("the group is workflow + PR number or ref, and only PRs cancel in progress", () => {
    const wf = loadWorkflow(COMMON);
    expect(wf.concurrency?.group).toBe("${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}");
    expect(wf.concurrency?.["cancel-in-progress"]).toBe("${{ github.event_name == 'pull_request' }}");
  });
});

describe("co-abap overlay (PR-B2)", () => {
  test("both job bodies are byte-identical to the common template", () => {
    const common = readFileSync(COMMON, "utf8");
    const overlay = readFileSync(ABAP, "utf8");
    const wf = loadWorkflow(ABAP);
    expect(wf.concurrency).toEqual(loadWorkflow(COMMON).concurrency);
    for (const key of ["unit-tests", "unit-tests-os"]) {
      expect(jobText(overlay, key)).toBe(jobText(common, key));
    }
    expect(wf.jobs["unit-tests-os"]).toBeDefined();
  });
});

describe("runner blobs and templates", () => {
  test("the root and template test-runner.ts are byte-identical (AC6)", () => {
    expect(readFileSync(TEMPLATE_RUNNER, "utf8")).toBe(readFileSync(ROOT_RUNNER, "utf8"));
  });

  test("every delivered workflow references only scripts that exist in the template", () => {
    const dir = join(ROOT, "templates", "common", ".github", "workflows");
    const refs = new Set<string>();
    for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
      const text = readFileSync(join(dir, name), "utf8");
      for (const m of text.matchAll(/bun (scripts\/[A-Za-z0-9_.\/-]+\.ts)/g)) refs.add(m[1]);
    }
    for (const ref of refs) {
      const rel = ref.replace(/^scripts\//, "");
      expect(existsSync(join(ROOT, "templates", "common", "scripts", rel))).toBe(true);
    }
  });
});
