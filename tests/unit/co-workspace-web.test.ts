/**
 * Regression guard (QA fair P1 root cause): the demo page module script is served raw to
 * browsers — any TypeScript syntax in it crashes the WHOLE UI at parse time (no handlers, no
 * auth card, no admin menu). This test extracts every module script from the web pages and
 * asserts they parse as plain JS via `bun build`.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serviceRoot = join(import.meta.dir, "..", "..", "services", "co-workspace");

function extractModuleScript(htmlFile: string): string {
  const html = readFileSync(htmlFile, "utf8");
  const start = html.indexOf('<script type="module">');
  const end = html.indexOf("</script>", start);
  if (start === -1 || end === -1) throw new Error(`no module script in ${htmlFile}`);
  return html.slice(start + '<script type="module">'.length, end);
}

function parsesAsPlainJs(label: string, script: string): void {
  const dir = mkdtempSync(join(tmpdir(), `gw-script-${crypto.randomUUID().slice(0, 8)}-`));
  const file = join(dir, "script.mjs");
  writeFileSync(file, script);
  const proc = Bun.spawnSync(["bun", "build", file, "--no-bundle"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr || proc.stdout);
    throw new Error(`${label} module script is not plain JS (TS syntax leak?):\n${err.slice(0, 800)}`);
  }
}

describe("web UI scripts parse as plain JS (QA fair P1 regression guard)", () => {
  test("index.html module script", () => {
    parsesAsPlainJs("index.html", extractModuleScript(join(serviceRoot, "web", "index.html")));
  });

  test("login.html module script", () => {
    parsesAsPlainJs("login.html", extractModuleScript(join(serviceRoot, "web", "login.html")));
  });

  test("no TypeScript annotations remain in served pages", () => {
    for (const file of ["index.html", "login.html"]) {
      const script = extractModuleScript(join(serviceRoot, "web", file));
      for (const pattern of [
        /let \w+: \{/,
        /function \w+\([^)]*:\s*\w+/,
        /\(\w+:\s*(?:string|number|boolean)\)/,
      ]) {
        if (pattern.test(script)) {
          throw new Error(`${file}: TypeScript annotation leaked (${pattern})`);
        }
      }
    }
  });
});
