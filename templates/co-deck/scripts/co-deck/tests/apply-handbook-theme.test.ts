// @version 1.0.1
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const SCRIPT = existsSync(join("scripts", "co-deck", "handbook", "apply-handbook-theme.ts"))
  ? join("scripts", "co-deck", "handbook", "apply-handbook-theme.ts")
  : join("templates", "co-deck", "scripts", "co-deck", "handbook", "apply-handbook-theme.ts");

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

  test("includes 2-layer dark mode structure (:root + .dark)", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    expect(css).toMatch(/:root\s*\{/);
    // No @media block — JS handles OS preference via .dark class toggle
    expect(css).not.toContain("@media (prefers-color-scheme: dark)");
    expect(css).toMatch(/\.dark\s*\{/);
  });

  test("includes backward-compatible aliases", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    expect(css).toContain("--accent2: var(--accent-green)");
    expect(css).toContain("--accent3: var(--accent-amber)");
    expect(css).toContain("--accent4: var(--accent-purple)");
    expect(css).toContain("--accent5: var(--accent-red)");
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
  });

  test("all 6 built-in themes generate valid CSS", () => {
    const themes = ["azure", "graphite", "teal", "amber", "indigo", "native"];

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

  test("includes expanded variable categories (platform, badge, compare, situation, video)", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme azure`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    // Text inverse
    expect(css).toContain("--text-inverse:");

    // Platform colors
    expect(css).toContain("--platform-claude:");
    expect(css).toContain("--platform-claudeapp:");
    expect(css).toContain("--platform-agy:");
    expect(css).toContain("--platform-antigravity:");

    // Badge palettes
    expect(css).toContain("--badge-green-bg:");
    expect(css).toContain("--badge-blue-fg:");
    expect(css).toContain("--badge-purple-border:");
    expect(css).toContain("--badge-red-bg:");

    // Compare boxes
    expect(css).toContain("--compare-without-bg:");
    expect(css).toContain("--compare-with-bg:");

    // Situation & video
    expect(css).toContain("--bg-situation:");
    expect(css).toContain("--border-situation:");
    expect(css).toContain("--bg-video:");
    expect(css).toContain("--border-video:");
  });

  test("native theme has source-project-specific callout colors", () => {
    execSync(`bun run ${SCRIPT} --project ${tmpDir} --theme native`, {
      stdio: "pipe",
    });

    const css = readFileSync(join(tmpDir, "docs", "assets", "css", "handbook-variables.css"), "utf-8");

    // Native theme uses lighter callout backgrounds than Azure
    expect(css).toContain("--bg-info: #f0f7ff");   // Azure uses #ddf4ff
    expect(css).toContain("--bg-warn: #fff8f8");   // Azure uses #fff1c5
    expect(css).toContain("--bg-success: #f0fff4"); // Azure uses #dafbe1
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
