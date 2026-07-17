import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const SCRIPT = join(
  "templates",
  "co-deck",
  "scripts",
  "co-deck",
  "handbook",
  "apply-handbook-theme.ts"
);

describe("apply-handbook-theme.ts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `handbook-theme-test-${Date.now()}`);
    mkdirSync(join(tmpDir, "docs", "assets", "css"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("outputs to handbook-variables.css (not handbook-theme.css)", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    expect(existsSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"))).toBe(true);
    expect(existsSync(join(tmpDir, "docs", "assets", "css", "handbook-theme.css"))).toBe(false);
  });

  test("generates :root block with unified semantic variables", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    // Unified semantic accent names
    expect(css).toContain("--accent-green:");
    expect(css).toContain("--accent-purple:");
    expect(css).toContain("--accent-dark:");
    expect(css).toContain("--accent-amber:");
    expect(css).toContain("--accent-red:");

    // Semantic callout border colors
    expect(css).toContain("--border-info:");
    expect(css).toContain("--border-note:");
    expect(css).toContain("--border-warn:");
    expect(css).toContain("--border-success:");
    expect(css).toContain("--border-error:");

    // Component tokens
    expect(css).toContain("--code-bg:");
    expect(css).toContain("--code-border:");
    expect(css).toContain("--tag-bg:");
    expect(css).toContain("--tag-text:");
  });

  test("includes 3-layer dark mode structure", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    expect(css).toMatch(/:root\s*\{/);
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toMatch(/\.dark\s*\{/);
  });

  test("includes backward-compatible aliases", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    expect(css).toContain("--accent2: var(--accent-green)");
    expect(css).toContain("--accent4: var(--accent-purple)");
    expect(css).toContain("--accent6: var(--accent-dark)");
  });

  test("outputs variables only — no structural CSS rules", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    // Must NOT contain structural selectors from handbook-components.css
    expect(css).not.toContain(".layout");
    expect(css).not.toContain(".sidebar");
    expect(css).not.toContain(".card");
    expect(css).not.toContain(".callout");
    expect(css).not.toContain(".stat-grid");
    expect(css).not.toContain(".scenario-card");
    expect(css).not.toContain(".badge");
    expect(css).not.toContain("box-sizing: border-box");
    expect(css).not.toContain("font-family:");
  });

  test("all 5 built-in themes generate valid CSS", () => {
    const themes = ["azure", "graphite", "teal", "amber", "indigo"];

    for (const theme of themes) {
      execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme ${theme}`, {
        stdio: "pipe",
      });

      const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

      // Each theme must have :root with semantic variables
      expect(css).toContain(":root");
      expect(css).toContain("--accent-green:");
      expect(css).toContain("--accent-purple:");
      expect(css).toContain(`/* handbook-variables.css`);

      // Clean up for next theme
      rmSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"));
    }
  });

  test("exits with error for unknown theme", () => {
    let exitCode = 0;
    try {
      execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme nonexistent`, {
        stdio: "pipe",
      });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
  });
});
