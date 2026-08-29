// @version 1.0.0
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkStructure } from "../handbook/check-structure.ts";

// Regression fixtures: each injected defect mirrors a real production bug
// found in the handbook repos (extra </div>, nested code-block, "</div>d>",
// extra </p>, orphaned language variant).
describe("check-structure.ts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `check-structure-test-${Date.now()}`);
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeHtml(name: string, html: string): void {
    writeFileSync(join(tmpDir, "docs", name), html, "utf-8");
  }

  const CLEAN = `<!DOCTYPE html>
<html lang="ko">
<head><title>Test</title></head>
<body>
  <div class="layout">
  <main>
  <article>
    <p>Hello</p>
    <div class="code-block">
<pre><code>x</code></pre>
<button type="button" class="copy-btn">복사</button>
    </div>
  </article>
  </main>
  </div>
</body>
</html>`;

  test("clean file passes all checks", () => {
    writeHtml("index.html", CLEAN);
    expect(checkStructure(join(tmpDir, "docs"))).toEqual([]);
  });

  test("catches extra </div> that closes outer tags (layout/article)", () => {
    // The exact defect that broke ch09/ch11 in intro-to-ai-harness.
    writeHtml(
      "index.html",
      CLEAN.replace("</div>\n  </article>", "</div>\n  </div>\n  </article>"),
    );
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("closes an outer tag"))).toBe(true);
  });

  test("catches nested <div class=\"code-block\">", () => {
    writeHtml(
      "index.html",
      CLEAN.replace('<div class="code-block">\n<pre>', '<div class="code-block">\n<div class="code-block">\n<pre>'),
    );
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("nested <div class=\"code-block\">"))).toBe(true);
  });

  test("catches stray characters after closing tag (</div>d>)", () => {
    // The exact defect found in ch02_en.
    writeHtml(
      "index.html",
      CLEAN.replace("</div>\n  </article>", "</div>d>\n  </article>"),
    );
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("stray characters after closing tag"))).toBe(true);
  });

  test("catches extra </p> with no matching open tag", () => {
    // The exact defect found in multi-agent-harness-handbook lecture-guide files.
    writeHtml("index.html", CLEAN.replace("<p>Hello</p>", "<p>Hello</p></p>"));
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("unmatched </p>"))).toBe(true);
  });

  test("catches unclosed <p> at end of file", () => {
    writeHtml("index.html", `<!DOCTYPE html>\n<html lang="ko">\n<body>\n  <p>Hello`);
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("unclosed <p> at end of file"))).toBe(true);
  });

  test("catches <p> left open when a block closes (misnest)", () => {
    // Mirrors the multi-agent-harness-handbook workflows ja defect: a <p>
    // left open before </article> is reported as a misnest.
    writeHtml("index.html", CLEAN.replace("<p>Hello</p>", "<p>Hello"));
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("still open: <p>"))).toBe(true);
  });

  test("catches language variant without base file", () => {
    writeHtml("index_en.html", CLEAN);
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("without base file"))).toBe(true);
  });

  test("catches pre/copy-btn mismatch", () => {
    writeHtml("index.html", CLEAN.replace('<button type="button" class="copy-btn">복사</button>', ""));
    const errors = checkStructure(join(tmpDir, "docs"));
    expect(errors.some((e) => e.detail.includes("copy-btn count"))).toBe(true);
  });
});
