/**
 * Unit tests for scripts/design-lint.ts v2.0.0 fonts sub-check
 * (T-20260926-031): the font fallback token contract.
 *
 * Spec: docs/designs/2026-09-26-design-lint-registries-design.md (§6.4, §8).
 * Contract: every `--font-*` custom property in the project token source must be
 * a stack with >= 2 comma-separated families AND a terminating generic family
 * from the closed set (serif, sans-serif, monospace, cursive, fantasy, system-ui,
 * ui-serif, ui-sans-serif, ui-monospace, ui-rounded). Regex-level parse only.
 * Absent --font-* declarations (or no token source at all) is a SKIP, never an
 * error (constraint d).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";

const LINT = resolve(import.meta.dir, "../../scripts/design-lint.ts");
const ROOT = mkdtempSync(join(tmpdir(), "design-lint-fonts-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

let counter = 0;

function makeProject(files: Record<string, string>): string {
  const dir = join(ROOT, `proj-${++counter}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(resolve(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  return dir;
}

async function runFonts(project: string): Promise<{ exitCode: number; stdout: string }> {
  const proc = await $`bun ${LINT} --check fonts ${project}`.nothrow();
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString() };
}

describe("design-lint fonts sub-check (T-20260926-031)", () => {
  test("stacks with a fallback and a terminating generic pass (closed set incl. system-ui / ui-*)", async () => {
    const proj = makeProject({
      "tokens.css": [
        "--font-sans: Inter, sans-serif;",
        "--font-serif: Georgia, serif;",
        "--font-mono: 'SF Mono', ui-monospace;",
        "--font-system: Roboto, system-ui;",
        "--font-rounded: SF Pro Rounded, ui-rounded;",
        "--font-cursive: Brush Script MT, cursive;",
        "--font-fantasy: Impact, fantasy;",
        "--font-ui-serif: Charter, ui-serif;",
        "--font-ui-sans: -apple-system, ui-sans-serif;",
        "--color-primary: #0055ff;",
      ].join("\n") + "\n",
    });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS fonts");
  });

  test("generic family match is case-insensitive", async () => {
    const proj = makeProject({ "tokens.css": "--font-sans: Inter, SANS-SERIF;\n" });
    const { exitCode } = await runFonts(proj);
    expect(exitCode).toBe(0);
  });

  test("single-face stack fails (no fallback)", async () => {
    const proj = makeProject({ "tokens.css": "--font-display: \"Canela\";\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("FAIL fonts");
    expect(stdout).toContain("font-fallback-contract");
    expect(stdout).toContain("--font-display");
    expect(stdout).toContain("at least one fallback");
  });

  test("two non-generic faces fail (no terminating generic)", async () => {
    const proj = makeProject({ "tokens.css": "--font-brand: Brand Sans, Brand Serif;\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("terminate in a generic family");
  });

  test("generic family in a non-terminal position still fails", async () => {
    const proj = makeProject({ "tokens.css": "--font-weird: sans-serif, Brand Sans;\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("--font-weird");
  });

  test("quote-aware splitting: multi-word quoted family plus fallback passes", async () => {
    const proj = makeProject({ "tokens.css": "--font-body: \"Helvetica Neue\", Arial, sans-serif;\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS fonts");
  });

  test("tokens.json source: font.<name> leaves compile to --font-* properties", async () => {
    const passing = makeProject({
      "tokens.json": JSON.stringify(
        { font: { sans: { value: "Roboto, system-ui" } }, color: { primary: { value: "#fff" } } },
        null,
        2,
      ),
    });
    const r1 = await runFonts(passing);
    expect(r1.exitCode).toBe(0);
    expect(r1.stdout).toContain("PASS fonts");

    const failing = makeProject({
      "tokens.json": JSON.stringify({ font: { fancy: { value: "Comic Sans" } } }, null, 2),
    });
    const r2 = await runFonts(failing);
    expect(r2.exitCode).toBe(1);
    expect(r2.stdout).toContain("--font-fancy");
  });

  test("token source with no --font-* properties skips (constraint d)", async () => {
    const proj = makeProject({ "tokens.css": "--color-primary: #0055ff;\n--space-4: 16px;\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP fonts");
    expect(stdout).toContain("no --font-*");
  });

  test("no token source at all skips (no typography decision exercised)", async () => {
    const proj = makeProject({ "src/ui.tsx": "export const x = 1;\n" });
    const { exitCode, stdout } = await runFonts(proj);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SKIP fonts");
  });

  test("findings carry file:line for CSS sources", async () => {
    const proj = makeProject({
      "tokens.css": "--color-primary: #0055ff;\n--font-display: Canela;\n",
    });
    const { stdout } = await runFonts(proj);
    expect(stdout).toContain("tokens.css:2");
  });
});
