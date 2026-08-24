import { describe, test, expect, afterEach } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "co-game", "bundle-html.ts");
const BUNDLE_NAME = "game-bundle.html";

// Minimal PNG-shaped bytes (magic number + payload) — only base64 encoding matters here.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const OGG_BYTES = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 1, 2]);

const tempDirs: string[] = [];

function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cogame-bundle-"));
  tempDirs.push(dir);
  return dir;
}

function runCli(args: string[]): { code: number; out: string; err: string } {
  const proc = Bun.spawnSync([process.execPath, SCRIPT, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: proc.exitCode,
    out: proc.stdout.toString(),
    err: proc.stderr.toString(),
  };
}

/** Standard fixture: index.html + main.js + style.css (with url(bg.png)) + sprite.png + bg.png + music.ogg. */
function writeStandardFixture(dir: string): void {
  writeFileSync(
    join(dir, "index.html"),
    `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
  <script src="main.js" defer></script>
</head>
<body>
  <img src="sprite.png">
  <audio src="music.ogg" controls></audio>
</body>
</html>
`,
    "utf-8",
  );
  writeFileSync(join(dir, "main.js"), `console.log("game-start");\n`, "utf-8");
  writeFileSync(join(dir, "style.css"), `body { background: url(bg.png); }\n`, "utf-8");
  writeFileSync(join(dir, "sprite.png"), PNG_BYTES);
  writeFileSync(join(dir, "bg.png"), PNG_BYTES);
  writeFileSync(join(dir, "music.ogg"), OGG_BYTES);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("bundle-html (templates/co-game/scripts/co-game/bundle-html.ts)", () => {
  test("(a) inlines script, stylesheet, and png/ogg media into one file with correct tags and mimes", () => {
    const dir = makeFixtureDir();
    writeStandardFixture(dir);

    const result = runCli(["--input", dir]);
    expect(result.code).toBe(0);
    expect(result.err).toBe("");

    const bundlePath = join(dir, BUNDLE_NAME);
    expect(existsSync(bundlePath)).toBe(true);
    const bundle = readFileSync(bundlePath, "utf-8");

    // Script inlined with non-src attributes preserved, src dropped, content present.
    expect(bundle).toContain('<script defer>');
    expect(bundle).toContain('console.log("game-start");');
    expect(bundle).not.toContain('main.js');

    // Stylesheet inlined as a <style> block with its url() asset as a data URI.
    expect(bundle).toContain("<style>");
    expect(bundle).not.toContain('rel="stylesheet"');
    expect(bundle).toContain("url(\"data:image/png;base64,");
    expect(bundle).not.toContain("style.css");
    expect(bundle).not.toContain("bg.png");

    // Media inlined as data URIs with the right mimes, in place.
    expect(bundle).toContain('src="data:image/png;base64,');
    expect(bundle).toContain('src="data:audio/ogg;base64,');
    expect(bundle).not.toContain("sprite.png");
    expect(bundle).not.toContain("music.ogg");

    // Bundle marker present for idempotency detection; single file, UTF-8 no BOM.
    expect(bundle).toContain("<!-- co-game bundle-html v");
    expect(bundle.charCodeAt(0)).not.toBe(0xfeff);
  });

  test("(b) leaves remote URLs and data URIs untouched, reporting the remote ones", () => {
    const dir = makeFixtureDir();
    writeFileSync(
      join(dir, "index.html"),
      `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.example.com/lib.js"></script>
</head>
<body>
  <img src="https://example.com/logo.png">
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
</body>
</html>
`,
      "utf-8",
    );

    const result = runCli(["--input", dir]);
    expect(result.code).toBe(0);

    const bundle = readFileSync(join(dir, BUNDLE_NAME), "utf-8");
    expect(bundle).toContain('src="https://cdn.example.com/lib.js"');
    expect(bundle).toContain('src="https://example.com/logo.png"');
    expect(bundle).toContain('src="data:image/gif;base64,R0lGODlhAQABAAAAACw="');

    // Remote references are reported in the summary.
    expect(result.out).toContain("https://cdn.example.com/lib.js");
    expect(result.out).toContain("https://example.com/logo.png");
    expect(result.out.toLowerCase()).toContain("remote");
  });

  test("(c) is idempotent — re-running on the bundler's own output is a no-op", () => {
    const dir = makeFixtureDir();
    writeStandardFixture(dir);
    expect(runCli(["--input", dir]).code).toBe(0);
    const firstBundle = readFileSync(join(dir, BUNDLE_NAME), "utf-8");

    // Feed the produced bundle back in as an entry HTML.
    const dir2 = makeFixtureDir();
    writeFileSync(join(dir2, "index.html"), firstBundle, "utf-8");

    const rerun = runCli(["--input", dir2]);
    expect(rerun.code).toBe(0);
    expect(rerun.out).toContain("Already bundled");
    // No-op means nothing was written.
    expect(existsSync(join(dir2, BUNDLE_NAME))).toBe(false);
  });

  test("(d) exits 1 with a clear message when index.html is missing", () => {
    const dir = makeFixtureDir(); // empty dir, no index.html
    const result = runCli(["--input", dir]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("index.html");
    expect(result.err).toContain("Entry HTML not found");
  });

  test("(e) --check validates and reports but writes nothing", () => {
    const dir = makeFixtureDir();
    writeStandardFixture(dir);

    const result = runCli(["--input", dir, "--check"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("check mode");
    expect(result.out).toContain("no files written");
    expect(result.out).toContain("Scripts inlined:     1 file(s)");
    expect(result.out).toContain("Stylesheets inlined: 1 file(s)");
    expect(result.out).toContain("Media inlined:       3 file(s)"); // sprite.png + bg.png (CSS url) + music.ogg
    expect(existsSync(join(dir, BUNDLE_NAME))).toBe(false);
  });

  test("(f) warns and leaves unknown-extension media references as-is", () => {
    const dir = makeFixtureDir();
    writeFileSync(
      join(dir, "index.html"),
      `<!DOCTYPE html>
<html><body><img src="model.obj"></body></html>
`,
      "utf-8",
    );
    writeFileSync(join(dir, "model.obj"), "solid data", "utf-8");

    const result = runCli(["--input", dir]);
    expect(result.code).toBe(0);

    const bundle = readFileSync(join(dir, BUNDLE_NAME), "utf-8");
    expect(bundle).toContain('src="model.obj"');
    expect(result.out).toContain("model.obj");
    expect(result.out.toLowerCase()).toContain("unknown media extension");
  });

  test("(g) exits 1 when a referenced local asset is missing", () => {
    const dir = makeFixtureDir();
    writeFileSync(
      join(dir, "index.html"),
      `<!DOCTYPE html>
<html><head><script src="missing.js"></script></head><body></body></html>
`,
      "utf-8",
    );

    const result = runCli(["--input", dir]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("missing.js");
    expect(result.err).toContain("not found");
    expect(existsSync(join(dir, BUNDLE_NAME))).toBe(false);
  });
});
