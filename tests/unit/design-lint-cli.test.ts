/**
 * Unit tests for scripts/design-lint.ts v2.0.0 CLI contract:
 * --help, --schema, --json, --check selection, usage errors, exit codes, and
 * the preserved v1.0.0 invocation surface ([paths...], --dir,
 * design-token-exempt: suppression, default scan roots).
 *
 * Spec: docs/designs/2026-09-26-design-lint-registries-design.md (§4.3, §8).
 * Hermetic fixture project trees under mkdtempSync(os.tmpdir()); shell-out via
 * Bun $ with .nothrow() (compile-tokens.test.ts idiom).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";

const LINT = resolve(import.meta.dir, "../../scripts/design-lint.ts");
const ROOT = mkdtempSync(join(tmpdir(), "design-lint-cli-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

let counter = 0;

function makeProject(files: Record<string, string> = {}): string {
  const dir = join(ROOT, `proj-${++counter}`);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(resolve(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  return dir;
}

async function run(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = await $`bun ${LINT} ${args}`.nothrow();
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

const RAW_HEX_SRC = "export const y = { background: \"#ff0000\" };\n";
const TOKENS_CSS = "--color-primary: #0055ff;\n";
const COMPONENTS_REGISTRY =
  "version: 1\ncomponents:\n  - id: card\n    tokens:\n      default: [\"--color-primary\"]\n";
const PATTERNS_REGISTRY = "version: 1\npatterns:\n  - id: card-list\n    trigger: lists\n";
const ICONS_REGISTRY = "version: 1\nicons: []\n";

describe("design-lint CLI flags", () => {
  test("--help exits 0 and documents the sub-check runner", async () => {
    const { exitCode, stdout } = await run("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("design-lint.ts v2.0.0");
    expect(stdout).toContain("token-usage");
    expect(stdout).toContain("--schema");
    expect(stdout).toContain("design-token-exempt");
  });

  test("--schema prints the three registry shapes and exits 0", async () => {
    const { exitCode, stdout } = await run("--schema");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("docs/design/components.registry.yaml");
    expect(stdout).toContain("docs/design/patterns.registry.yaml");
    expect(stdout).toContain("docs/design/icon-vocabulary.yaml");
    expect(stdout).toContain("version: 1");
  });

  test("--check with an unknown name is a usage error (exit 1)", async () => {
    const { exitCode, stderr } = await run("--check", "colors");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("usage error");
    expect(stderr).toContain("colors");
  });

  test("a bare positional that names a sub-check is rejected with guidance", async () => {
    const { exitCode, stderr } = await run("--check", "components", "fonts");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--check");
  });
});

describe("design-lint --json contract", () => {
  test("no registries, no positional: every check reports status 'skipped', exit 0 (success criterion 3)", async () => {
    const proj = makeProject();
    const proc = await $`cd ${proj} && bun ${LINT} --json`.nothrow();
    expect(proc.exitCode).toBe(0);
    const report = JSON.parse(proc.stdout.toString()) as {
      tool: string;
      version: string;
      checks: Array<{ name: string; status: string; findings: unknown[]; skipReason?: string }>;
    };
    expect(report.tool).toBe("design-lint");
    expect(report.version).toBe("2.0.0");
    expect(report.checks.map((c) => c.name)).toEqual([
      "token-usage",
      "components",
      "patterns",
      "icons",
      "fonts",
    ]);
    for (const check of report.checks) {
      expect(check.status).toBe("skipped");
      expect(check.findings).toEqual([]);
      expect(typeof check.skipReason).toBe("string");
    }
  });

  test("violations produce per-check status 'fail' with typed findings, exit 1", async () => {
    const proj = makeProject({
      "tokens.css": TOKENS_CSS,
      "src/ui.tsx": "export const b = <Icon name=\"ghost\" />;\n",
      "docs/design/components.registry.yaml": COMPONENTS_REGISTRY,
      "docs/design/patterns.registry.yaml": PATTERNS_REGISTRY,
      "docs/design/icon-vocabulary.yaml": ICONS_REGISTRY,
    });
    const { exitCode, stdout } = await run("--json", proj);
    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout) as {
      checks: Array<{ name: string; status: string; findings: Array<{ file: string; line?: number; pattern: string; match: string; severity: string }>; counts: { fail: number; info: number } }>;
    };
    const byName = Object.fromEntries(report.checks.map((c) => [c.name, c]));
    expect(byName["token-usage"].status).toBe("pass"); // scanned recursively, nothing raw
    expect(byName["components"].status).toBe("pass"); // registry valid, token bound; clean src
    expect(byName["patterns"].status).toBe("pass"); // no docs/*.md declares a pattern
    expect(byName["icons"].status).toBe("fail");
    expect(byName["icons"].findings[0]).toMatchObject({
      file: "src/ui.tsx",
      line: 1,
      pattern: "unregistered-icon",
      match: "ghost",
      severity: "fail",
    });
    expect(byName["icons"].counts.fail).toBe(1);
    expect(byName["fonts"].status).toBe("skipped"); // no --font-* declared
  });
});

describe("design-lint v1.0.0 backward compatibility", () => {
  test("--dir scopes the raw-value scan exactly as v1.0.0 (detection + exit 1)", async () => {
    const proj = makeProject({ "src/legacy.css": ".card { background: #ff0000; padding: 12px; }\n" });
    const { exitCode, stdout } = await run("--dir", join(proj, "src"));
    expect(exitCode).toBe(1);
    expect(stdout).toContain("hex-color");
    expect(stdout).toContain("#ff0000");
    expect(stdout).toContain("raw-px-length");
    expect(stdout).toContain("12px");
  });

  test("bare positional path scopes the raw-value scan exactly as v1.0.0", async () => {
    const proj = makeProject({ "src/legacy.css": ".card { background: #ff0000; }\n" });
    const { exitCode, stdout } = await run(join(proj, "src"));
    expect(exitCode).toBe(1);
    expect(stdout).toContain("hex-color");
    // the other four checks skip (no registries, no token source)
    expect(stdout).toContain("SKIP components");
    expect(stdout).toContain("SKIP patterns");
    expect(stdout).toContain("SKIP icons");
    expect(stdout).toContain("SKIP fonts");
  });

  test("design-token-exempt: <reason> suppression still downgrades to exit 0", async () => {
    const suppressed = makeProject({
      "src/legacy.css": ".card { background: #ff0000; } /* design-token-exempt: legacy palette screenshot */\n",
    });
    const { exitCode, stdout } = await run("--dir", join(suppressed, "src"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("one-off (documented)");
    expect(stdout).toContain("legacy palette screenshot");
    expect(stdout).toContain("PASS token-usage");
  });

  test("false-positive classification (URL fragment hex) still never fails", async () => {
    const proj = makeProject({
      "src/page.html": "<a href=\"#ff0000\">anchor</a>\n",
    });
    const { exitCode, stdout } = await run("--dir", join(proj, "src"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("false-positive");
  });

  test("default scan roots (<root>/playground/src, <root>/src) and v1 exit-0-no-roots semantics", async () => {
    const withSrc = makeProject({ "src/app.tsx": "export const c = { color: \"#123456\" };\n" });
    const r1 = await $`cd ${withSrc} && bun ${LINT}`.nothrow();
    expect(r1.exitCode).toBe(1);
    expect(r1.stdout.toString()).toContain("FAIL token-usage");

    const empty = makeProject();
    const r2 = await $`cd ${empty} && bun ${LINT}`.nothrow();
    expect(r2.exitCode).toBe(0);
    expect(r2.stdout.toString()).toContain("SKIP token-usage");
    expect(r2.stdout.toString()).toContain("no scan roots found");
    expect(r2.stdout.toString()).toContain("CLEAN");
  });
});

describe("design-lint end-to-end (success criterion 4)", () => {
  test("fixture with all five violation classes produces the five correct FAILs and exit 1", async () => {
    const proj = makeProject({
      "tokens.css": TOKENS_CSS + "--font-display: Canela;\n",
      "src/ui.tsx": "export const b = <Icon name=\"ghost\" />;\nexport const c = { background: \"#ff0000\" };\n",
      "docs/design/components.registry.yaml": COMPONENTS_REGISTRY,
      "docs/design/patterns.registry.yaml": PATTERNS_REGISTRY,
      "docs/design/icon-vocabulary.yaml": ICONS_REGISTRY,
      "docs/screens.md": "pattern: carousel\n",
    });
    const { exitCode, stdout } = await run(proj);
    expect(exitCode).toBe(1);
    // (i) unbound token -> components FAIL
    expect(stdout).toContain("FAIL components");
    // (ii) raw value in a governed component style block -> components FAIL (detector reuse)
    expect(stdout).toContain("hex-color");
    // (iii) unregistered pattern reference -> patterns FAIL
    expect(stdout).toContain("FAIL patterns");
    expect(stdout).toContain("carousel");
    // (iv) unregistered icon -> icons FAIL
    expect(stdout).toContain("FAIL icons");
    expect(stdout).toContain("ghost");
    // (v) single-face font token -> fonts FAIL
    expect(stdout).toContain("FAIL fonts");
    expect(stdout).toContain("Canela");
    expect(stdout).toContain("NEEDS REMEDIATION");
  });

  test("fully clean governed project exits 0 with PASS lines and CLEAN verdict", async () => {
    const proj = makeProject({
      "tokens.css": TOKENS_CSS + "--font-sans: Inter, sans-serif;\n",
      "src/ui.tsx": "export const b = <Icon name=\"trash\" />;\n",
      "docs/design/components.registry.yaml": COMPONENTS_REGISTRY,
      "docs/design/patterns.registry.yaml": PATTERNS_REGISTRY,
      "docs/design/icon-vocabulary.yaml": "version: 1\nicons:\n  - id: trash\n    source: lucide\n    contexts: [actions]\n",
      "docs/screens.md": "patterns: [card-list]\n",
    });
    const { exitCode, stdout } = await run(proj);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS token-usage");
    expect(stdout).toContain("PASS components");
    expect(stdout).toContain("PASS patterns");
    expect(stdout).toContain("PASS icons");
    expect(stdout).toContain("PASS fonts");
    expect(stdout).toContain("CLEAN");
  });
});
