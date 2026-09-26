/**
 * Unit tests for scripts/design-lint.ts v2.0.0 registry sub-checks:
 * components (T-20260926-028), patterns (T-20260926-029), icons (T-20260926-030).
 *
 * Spec: docs/designs/2026-09-26-design-lint-registries-design.md (§6.1–§6.3, §8).
 * Hermetic fixture project trees under mkdtempSync(os.tmpdir()); the CLI is
 * exercised via shell-out with .nothrow() (compile-tokens.test.ts idiom).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";

const LINT = resolve(import.meta.dir, "../../scripts/design-lint.ts");
const ROOT = mkdtempSync(join(tmpdir(), "design-lint-registries-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

let counter = 0;

/** Create a fixture project tree under the temp root; returns the project dir. */
function makeProject(files: Record<string, string>): string {
  const dir = join(ROOT, `proj-${++counter}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(resolve(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  return dir;
}

async function run(project: string, ...args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const proc = await $`bun ${LINT} --check ${args} ${project}`.nothrow();
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString() };
}

const VALID_TOKENS_CSS = "--color-primary: #0055ff;\n--color-hover: #0044cc;\n";
const CLEAN_SRC = "export const x = 1;\n";

describe("design-lint components sub-check (T-20260926-028)", () => {
  const registry = (body: string) => `version: 1\ncomponents:\n${body}`;

  test("valid registry with bound tokens passes (exit 0, PASS)", async () => {
    const proj = makeProject({
      "tokens.css": VALID_TOKENS_CSS,
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/components.registry.yaml": registry(
        "  - id: card\n    tokens:\n      default: [\"--color-primary\"]\n      hover: [\"--color-hover\"]\n    layout_primitives: [Stack]\n    status: active\n",
      ),
    });
    const { exitCode, stdout } = await run(proj, "components");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS components");
  });

  test("registry-bound token missing from the token source fails with the ref named", async () => {
    const proj = makeProject({
      "tokens.css": VALID_TOKENS_CSS,
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/components.registry.yaml": registry(
        "  - id: card\n    tokens:\n      default: [\"--color-secondary\"]\n",
      ),
    });
    const { exitCode, stdout } = await run(proj, "components");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("FAIL components");
    expect(stdout).toContain("unbound-token");
    expect(stdout).toContain("--color-secondary");
  });

  test("raw value in a governed component style block fails; same raw value with no registry is a SKIP", async () => {
    const files = {
      "tokens.css": VALID_TOKENS_CSS,
      "src/ui.tsx": "export const y = { background: \"#ff0000\" };\n",
    };
    const withRegistry = makeProject({
      ...files,
      "docs/design/components.registry.yaml": registry("  - id: card\n    tokens:\n      default: [\"--color-primary\"]\n"),
    });
    const governed = await run(withRegistry, "components");
    expect(governed.exitCode).toBe(1);
    expect(governed.stdout).toContain("hex-color");
    expect(governed.stdout).toContain("#ff0000");

    const ungoverned = makeProject(files);
    const skippedRun = await run(ungoverned, "components");
    expect(skippedRun.exitCode).toBe(0);
    expect(skippedRun.stdout).toContain("SKIP components");
    expect(skippedRun.stdout).toContain("registry absent");
  });

  test("malformed registry fails with an actionable message (bad YAML)", async () => {
    const proj = makeProject({
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/components.registry.yaml": "version: 1\ncomponents:\n  - id: [broken\n",
    });
    const { exitCode, stdout } = await run(proj, "components");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("invalid YAML in docs/design/components.registry.yaml");
  });

  test("structural violations fail: missing id, duplicate id, non-kebab id, missing tokens", async () => {
    const missingId = makeProject({
      "docs/design/components.registry.yaml": registry("  - tokens:\n      default: []\n"),
    });
    const r1 = await run(missingId, "components");
    expect(r1.exitCode).toBe(1);
    expect(r1.stdout).toContain("missing required field `id`");

    const duplicate = makeProject({
      "docs/design/components.registry.yaml": registry(
        "  - id: card\n    tokens: {}\n  - id: card\n    tokens: {}\n",
      ),
    });
    const r2 = await run(duplicate, "components");
    expect(r2.exitCode).toBe(1);
    expect(r2.stdout).toContain("duplicate `id`");

    const nonKebab = makeProject({
      "docs/design/components.registry.yaml": registry("  - id: BigCard\n    tokens: {}\n"),
    });
    const r3 = await run(nonKebab, "components");
    expect(r3.exitCode).toBe(1);
    expect(r3.stdout).toContain("kebab-case");

    const missingTokens = makeProject({
      "docs/design/components.registry.yaml": registry("  - id: card\n"),
    });
    const r4 = await run(missingTokens, "components");
    expect(r4.exitCode).toBe(1);
    expect(r4.stdout).toContain("missing required field `tokens`");
  });

  test("deprecated component with an unbound token is reported as INFO and does not fail (design §5.1)", async () => {
    const proj = makeProject({
      "tokens.css": VALID_TOKENS_CSS,
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/components.registry.yaml": registry(
        "  - id: legacy-card\n    tokens:\n      default: [\"--color-gone\"]\n    status: deprecated\n",
      ),
    });
    const { exitCode, stdout } = await run(proj, "components");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS components");
    expect(stdout).toContain("1 info");
    expect(stdout).toContain("--color-gone");
  });

  test("bindings with no token source at all fail with an actionable aggregate finding", async () => {
    const proj = makeProject({
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/components.registry.yaml": registry(
        "  - id: card\n    tokens:\n      default: [\"--color-primary\"]\n",
      ),
    });
    const { exitCode, stdout } = await run(proj, "components");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("no token source found");
    expect(stdout).toContain("--color-primary");
  });
});

describe("design-lint patterns sub-check (T-20260926-029)", () => {
  const registry = "version: 1\npatterns:\n  - id: card-list\n    trigger: repeated content rows\n";

  test("registry absent skips with exit 0", async () => {
    const proj = makeProject({ "docs/other.md": "no patterns here\n" });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP patterns");
    expect(stdout).toContain("registry absent");
  });

  test("registered front-matter pattern usage passes", async () => {
    const proj = makeProject({
      "docs/design/patterns.registry.yaml": registry,
      "docs/screens.md": "---\ntitle: Screens\npatterns: [card-list]\n---\n",
    });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS patterns");
  });

  test("unregistered pattern reference fails with file:line (front-matter and body forms)", async () => {
    const proj = makeProject({
      "docs/design/patterns.registry.yaml": registry,
      "docs/screens.md": "---\npatterns: [card-list]\n---\n\npattern: carousel\n",
    });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("FAIL patterns");
    expect(stdout).toContain("unregistered-pattern");
    expect(stdout).toContain("carousel");
    expect(stdout).toContain("docs/screens.md:5");
  });

  test("body block-list form is detected", async () => {
    const proj = makeProject({
      "docs/design/patterns.registry.yaml": registry,
      "docs/screens.md": "patterns:\n  - carousel\n",
    });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("carousel");
  });

  test("pattern-waiver records INFO and never fails (design §6.2)", async () => {
    const proj = makeProject({
      "docs/design/patterns.registry.yaml": registry,
      "docs/screens.md": "---\npatterns: [carousel]\npattern-waiver: legacy screen, refactor planned\n---\n",
    });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS patterns");
    expect(stdout).toContain("pattern-waiver");
    expect(stdout).toContain("legacy screen, refactor planned");
  });

  test("pattern references inside code fences are not declarations", async () => {
    const proj = makeProject({
      "docs/design/patterns.registry.yaml": registry,
      "docs/guide.md": "```\npattern: carousel\n```\n",
    });
    const { exitCode, stdout } = await run(proj, "patterns");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS patterns");
  });

  test("composes_from must resolve when the components registry exists", async () => {
    const unresolved = makeProject({
      "docs/design/patterns.registry.yaml":
        "version: 1\npatterns:\n  - id: card-list\n    composes_from: [ghost]\n",
      "docs/design/components.registry.yaml": "version: 1\ncomponents:\n  - id: card\n    tokens: {}\n",
    });
    const r1 = await run(unresolved, "patterns");
    expect(r1.exitCode).toBe(1);
    expect(r1.stdout).toContain("unresolved-composes-from");
    expect(r1.stdout).toContain("ghost");

    const resolved = makeProject({
      "docs/design/patterns.registry.yaml":
        "version: 1\npatterns:\n  - id: card-list\n    composes_from: [card]\n",
      "docs/design/components.registry.yaml": "version: 1\ncomponents:\n  - id: card\n    tokens: {}\n",
    });
    const r2 = await run(resolved, "patterns");
    expect(r2.exitCode).toBe(0);
    expect(r2.stdout).toContain("PASS patterns");
  });

  test("malformed patterns registry fails (duplicate id, missing list, bad version)", async () => {
    const duplicate = makeProject({
      "docs/design/patterns.registry.yaml":
        "version: 1\npatterns:\n  - id: a\n  - id: a\n",
    });
    const r1 = await run(duplicate, "patterns");
    expect(r1.exitCode).toBe(1);
    expect(r1.stdout).toContain("duplicate `id`");

    const noList = makeProject({ "docs/design/patterns.registry.yaml": "version: 1\n" });
    const r2 = await run(noList, "patterns");
    expect(r2.exitCode).toBe(1);
    expect(r2.stdout).toContain("`patterns`");

    const badVersion = makeProject({
      "docs/design/patterns.registry.yaml": "version: one\npatterns: []\n",
    });
    const r3 = await run(badVersion, "patterns");
    expect(r3.exitCode).toBe(1);
    expect(r3.stdout).toContain("`version`");
  });
});

describe("design-lint icons sub-check (T-20260926-030)", () => {
  const registry = "version: 1\nicons:\n  - id: trash\n    source: lucide\n    contexts: [actions]\n    aria_label_required: true\n";

  test("registered icon references pass; aria_label_required is declarative only", async () => {
    const proj = makeProject({
      "src/ui.tsx": "export const a = <Icon name=\"trash\" />;\nexport const b = <button icon=\"trash\" />;\n",
      "docs/design/icon-vocabulary.yaml": registry,
    });
    const { exitCode, stdout } = await run(proj, "icons");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS icons");
  });

  test("unregistered icon reference fails with file:line and the id", async () => {
    const proj = makeProject({
      "src/ui.tsx": "export const a = <Icon name=\"trash\" />;\nexport const b = <Icon name=\"pencil\" />;\n",
      "docs/design/icon-vocabulary.yaml": registry,
    });
    const { exitCode, stdout } = await run(proj, "icons");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("FAIL icons");
    expect(stdout).toContain("unregistered-icon");
    expect(stdout).toContain("pencil");
    expect(stdout).toContain("src/ui.tsx:2");
  });

  test("icon=\"...\" attribute form is a reference convention (design §6.3)", async () => {
    const proj = makeProject({
      "src/button.tsx": "export const b = { icon: 1 }; export const c = <span icon=\"star\" />;\n",
      "docs/design/icon-vocabulary.yaml": registry,
    });
    const { exitCode, stdout } = await run(proj, "icons");
    expect(exitCode).toBe(1);
    expect(stdout).toContain("star");
  });

  test("dynamic (non-literal) bindings are not icon references", async () => {
    const proj = makeProject({
      "src/ui.tsx": "export const a = <Icon name={iconName} />;\n",
      "docs/design/icon-vocabulary.yaml": registry,
    });
    const { exitCode, stdout } = await run(proj, "icons");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS icons");
  });

  test("registry absent skips; malformed registry fails; empty registry is valid", async () => {
    const absent = makeProject({ "src/ui.tsx": CLEAN_SRC });
    const r1 = await run(absent, "icons");
    expect(r1.exitCode).toBe(0);
    expect(r1.stdout).toContain("SKIP icons");

    const duplicate = makeProject({
      "docs/design/icon-vocabulary.yaml": "version: 1\nicons:\n  - id: trash\n  - id: trash\n",
    });
    const r2 = await run(duplicate, "icons");
    expect(r2.exitCode).toBe(1);
    expect(r2.stdout).toContain("duplicate `id`");

    const empty = makeProject({
      "src/ui.tsx": CLEAN_SRC,
      "docs/design/icon-vocabulary.yaml": "version: 1\nicons: []\n",
    });
    const r3 = await run(empty, "icons");
    expect(r3.exitCode).toBe(0);
    expect(r3.stdout).toContain("PASS icons");
  });
});
