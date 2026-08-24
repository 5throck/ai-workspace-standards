#!/usr/bin/env bun
/**
 * Single-File HTML Game Bundler
 * Turns a built game directory into one distributable HTML file by inlining local
 * scripts (<script src>), stylesheets (<link rel="stylesheet">, including CSS
 * @import chains and url() assets), and media references (img/audio/video/source)
 * as base64 data URIs. Remote URLs and existing data: URIs are left untouched.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/co-game/bundle-html.ts --input <built-dir> [--output <file.html>] [--check]
 * @module bundle-html
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, extname, join } from "node:path";

const VERSION = "1.0.0";
const ENTRY_DEFAULT = "index.html";
const OUTPUT_DEFAULT = "game-bundle.html";

/** Marker comment injected into every bundle; also detects already-bundled input. */
const MARKER_RE = /<!--\s*co-game bundle-html v\d+\.\d+\.\d+\s*-->/;

/** MIME types for inlinable media/font assets, keyed by lowercase file extension. */
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  woff2: "font/woff2",
};

interface Category {
  files: number;
  bytes: number;
}

interface Report {
  scripts: Category;
  stylesheets: Category;
  media: Category;
  skippedRemote: string[];
  warnings: string[];
  errors: string[];
}

type RefKind = "local" | "remote" | "inline-data" | "fragment";

/** Current bundle state — module-level because this is a one-shot CLI. */
const report: Report = {
  scripts: { files: 0, bytes: 0 },
  stylesheets: { files: 0, bytes: 0 },
  media: { files: 0, bytes: 0 },
  skippedRemote: [],
  warnings: [],
  errors: [],
};

const textCache = new Map<string, string>();
const binaryCache = new Map<string, Buffer>();

/** Case-normalized absolute path key for recursion guards (win32 is case-insensitive). */
function normKey(p: string): string {
  return process.platform === "win32" ? p.toLowerCase() : p;
}

function classifyRef(ref: string): RefKind {
  const t = ref.trim();
  if (/^data:/i.test(t)) return "inline-data";
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(t)) return "remote"; // https://, http://, protocol-relative //
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return "remote"; // any other scheme (mailto:, file:, ...)
  if (t.startsWith("#")) return "fragment";
  return "local";
}

/** Decode the common HTML entities that can legally appear inside src/href values. */
function decodePathEntities(p: string): string {
  return p
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Resolve a local reference (query string and fragment stripped) against its base dir. */
function resolveLocalPath(ref: string, baseDir: string): string | null {
  const cleaned = decodePathEntities(ref.trim()).split(/[?#]/)[0];
  if (cleaned === "") return null;
  return resolve(baseDir, cleaned);
}

/** Extract an attribute value from a tag's attribute string; null when absent. */
function extractAttr(attrs: string, name: string): string | null {
  const re = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  );
  const m = attrs.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? "";
}

/** Remove an attribute (name and value) from a tag's attribute string. */
function removeAttr(attrs: string, name: string): string {
  const re = new RegExp(
    `\\s*${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'>]+)`,
    "i",
  );
  return attrs.replace(re, "");
}

/** Replace an attribute's value in place (preserves attribute position). */
function setAttrValue(attrs: string, name: string, value: string): string {
  const re = new RegExp(
    `(${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s"'>]+)`,
    "i",
  );
  return attrs.replace(re, `$1"${value}"`);
}

function mimeFor(absPath: string): string | undefined {
  return MIME_BY_EXT[extname(absPath).slice(1).toLowerCase()];
}

/** Read a text asset (BOM stripped); records an error and returns null on failure. */
function readAssetText(absPath: string, displayRef: string): string | null {
  const key = normKey(absPath);
  if (textCache.has(key)) return textCache.get(key)!;
  if (!existsSync(absPath)) {
    report.errors.push(`Referenced file not found: ${displayRef} (expected ${absPath})`);
    return null;
  }
  try {
    let text = readFileSync(absPath, "utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    textCache.set(key, text);
    return text;
  } catch (e) {
    report.errors.push(`Unreadable file: ${absPath} (${(e as Error).message})`);
    return null;
  }
}

/** Read a binary asset as a Buffer; records an error and returns null on failure. */
function readAssetBinary(absPath: string): Buffer | null {
  const key = normKey(absPath);
  if (binaryCache.has(key)) return binaryCache.get(key)!;
  if (!existsSync(absPath)) {
    report.errors.push(`Referenced file not found: ${absPath}`);
    return null;
  }
  try {
    const buf = readFileSync(absPath);
    binaryCache.set(key, buf);
    return buf;
  } catch (e) {
    report.errors.push(`Unreadable file: ${absPath} (${(e as Error).message})`);
    return null;
  }
}

/** Build a data URI for a local asset, or null when it cannot be read. */
function toDataUri(absPath: string, displayRef: string, mime: string): string | null {
  const buf = readAssetBinary(absPath);
  if (buf === null) return null;
  report.media.files += 1;
  report.media.bytes += buf.length;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Inline local @import statements and url() references inside CSS text.
 * Paths resolve relative to the CSS file that declares them. The stack guards
 * against circular inclusion (a file referencing itself, directly or not).
 */
function processCss(css: string, cssDir: string, stack: string[]): string {
  // 1. @import — local stylesheets are inlined recursively.
  css = css.replace(/@import\s+([^;]+);/gi, (full, inner: string) => {
    let ref: string | null = null;
    let m = inner.match(/^url\(\s*(?:['"]([^'"]+)['"]|([^'")]+))\s*\)$/i);
    if (m) ref = m[1] ?? m[2] ?? null;
    else {
      m = inner.trim().match(/^(?:['"]([^'"]+)['"]|([^\s]+))$/);
      if (m) ref = m[1] ?? m[2] ?? null;
    }
    if (ref === null || ref === "") return full;

    const kind = classifyRef(ref);
    if (kind === "remote") {
      report.skippedRemote.push(ref);
      return full;
    }
    if (kind !== "local") return full;

    const abs = resolveLocalPath(ref, cssDir);
    if (abs === null) return full;
    if (stack.includes(normKey(abs))) {
      report.warnings.push(`Circular CSS @import skipped: ${ref}`);
      return full;
    }
    const text = readAssetText(abs, ref);
    if (text === null) return full;
    report.stylesheets.files += 1;
    report.stylesheets.bytes += Buffer.byteLength(text, "utf-8");
    stack.push(normKey(abs));
    const nested = processCss(text, dirname(abs), stack);
    stack.pop();
    return nested;
  });

  // 2. url(...) — local assets with a known extension become data URIs.
  css = css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (full, _q: string, ref: string) => {
    if (ref.trim() === "") return full;
    const kind = classifyRef(ref);
    if (kind === "remote") {
      report.skippedRemote.push(ref);
      return full;
    }
    if (kind !== "local") return full;

    const abs = resolveLocalPath(ref, cssDir);
    if (abs === null) return full;
    const mime = mimeFor(abs);
    if (!mime) {
      report.warnings.push(
        `Unknown media extension in CSS url() left as-is: ${ref} (${extname(abs) || "no extension"})`,
      );
      return full;
    }
    const dataUri = toDataUri(abs, ref, mime);
    if (dataUri === null) return full;
    return `url("${dataUri}")`;
  });

  return css;
}

/**
 * Inline local <link rel="stylesheet"> tags as <style> blocks.
 * Runs before the media/script passes so inserted CSS content is never
 * mistaken for markup by later passes.
 */
function inlineStylesheets(html: string, baseDir: string, stack: string[]): string {
  return html.replace(/<link\b([^>]*)>/gi, (full, attrs: string) => {
    const rel = extractAttr(attrs, "rel");
    if (rel === null || !/(?:^|\s)stylesheet(?:$|\s)/i.test(rel)) return full;
    const href = extractAttr(attrs, "href");
    if (href === null) return full;

    const kind = classifyRef(href);
    if (kind === "remote") {
      report.skippedRemote.push(href);
      return full;
    }
    if (kind !== "local") return full;

    const abs = resolveLocalPath(href, baseDir);
    if (abs === null) return full;
    if (stack.includes(normKey(abs))) {
      report.warnings.push(`Circular stylesheet reference skipped: ${href}`);
      return full;
    }
    const text = readAssetText(abs, href);
    if (text === null) return full;
    report.stylesheets.files += 1;
    report.stylesheets.bytes += Buffer.byteLength(text, "utf-8");
    stack.push(normKey(abs));
    const processed = processCss(text, dirname(abs), stack);
    stack.pop();
    return `<style>\n${processed.trimEnd()}\n</style>`;
  });
}

/**
 * Rewrite local src= references on img/audio/video/source tags to data URIs.
 * Runs after the stylesheet pass but before the script pass, so media embedded
 * inside inlined script strings is never rewritten.
 */
function inlineMedia(html: string, baseDir: string): string {
  return html.replace(
    /<(img|audio|video|source)\b([^>]*?)(\s*\/?)>/gi,
    (full, tag: string, attrs: string, tail: string) => {
      const src = extractAttr(attrs, "src");
      if (src === null) return full; // srcset-only <source>, or already inline

      const kind = classifyRef(src);
      if (kind === "remote") {
        report.skippedRemote.push(src);
        return full;
      }
      if (kind !== "local") return full;

      const abs = resolveLocalPath(src, baseDir);
      if (abs === null) return full;
      const mime = mimeFor(abs);
      if (!mime) {
        report.warnings.push(
          `Unknown media extension left as-is: ${src} (${extname(abs) || "no extension"})`,
        );
        return full;
      }
      const dataUri = toDataUri(abs, src, mime);
      if (dataUri === null) return full;
      return `<${tag}${setAttrValue(attrs, "src", dataUri)}${tail}>`;
    },
  );
}

/**
 * Inline local <script src="..."> tags as inline <script> blocks, preserving
 * all other attributes. Runs last so inserted script content is final.
 * The sequence "</script" inside script bodies is escaped to "<\/script" —
 * identical semantics in JS strings/regexes, but it cannot terminate the block.
 */
function inlineScripts(html: string, baseDir: string, entryPath: string): string {
  return html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (full, attrs: string, _body: string) => {
      const src = extractAttr(attrs, "src");
      if (src === null) return full; // already inline

      const kind = classifyRef(src);
      if (kind === "remote") {
        report.skippedRemote.push(src);
        return full;
      }
      if (kind !== "local") return full;

      const abs = resolveLocalPath(src, baseDir);
      if (abs === null) return full;
      if (normKey(abs) === normKey(entryPath)) {
        report.warnings.push(`Script src points at the entry HTML itself; left as-is: ${src}`);
        return full;
      }
      const text = readAssetText(abs, src);
      if (text === null) return full;
      report.scripts.files += 1;
      report.scripts.bytes += Buffer.byteLength(text, "utf-8");
      const keptAttrs = removeAttr(attrs, "src");
      const safe = text.replace(/<\/script/gi, "<\\/script").trimEnd();
      return `<script${keptAttrs}>\n${safe}\n</script>`;
    },
  );
}

/** Sum every regular file under a directory (recursive). */
function walkTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = walkTree(p);
      files += sub.files;
      bytes += sub.bytes;
    } else if (ent.isFile()) {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}

/** Insert the bundle marker right after the doctype (or at document start). */
function insertMarker(html: string): string {
  const marker = `<!-- co-game bundle-html v${VERSION} -->`;
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype && doctype.index !== undefined) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + "\n" + marker + html.slice(at);
  }
  return marker + "\n" + html;
}

function printUsage(): void {
  console.log(`co-game bundle-html v${VERSION} — single-file HTML game bundler

Usage:
  bun scripts/co-game/bundle-html.ts --input <built-dir> [--output <file.html>] [--check]

Options:
  --input <dir>    Built game directory containing index.html (default: ./dist)
  --output <file>  Output HTML path (default: <input-dir>/${OUTPUT_DEFAULT})
  --check          Validate inlinability and report without writing any file
  --help           Show this help

Inlining rules:
  1. Local <script src="...">      -> inline <script> block (other attributes kept)
  2. Local <link rel="stylesheet"> -> inline <style> block (CSS @import chains followed)
  3. Local img/audio/video/source src= and CSS url() -> base64 data URIs
  4. Remote URLs, data: URIs, and fragment refs are left untouched and reported
  5. Idempotent: re-running on a previous bundle output is a no-op`);
}

interface CliOptions {
  input: string | null;
  output: string | null;
  check: boolean;
}

function parseArgs(argv: string[]): CliOptions | { error: string } {
  const opts: CliOptions = { input: null, output: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" || arg === "--output") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        return { error: `Missing value for ${arg}` };
      }
      if (arg === "--input") opts.input = value;
      else opts.output = value;
      i += 1;
    } else if (arg === "--check") {
      opts.check = true;
    } else if (arg === "--help" || arg === "-h") {
      return { error: "__help__" };
    } else {
      return { error: `Unknown argument: ${arg}` };
    }
  }
  return opts;
}

function printReport(check: boolean): void {
  const head = check
    ? "Bundle plan (check mode — nothing will be written):"
    : "Bundle report:";
  console.log(head);
  console.log(`  Scripts inlined:     ${report.scripts.files} file(s), ${report.scripts.bytes} bytes`);
  console.log(`  Stylesheets inlined: ${report.stylesheets.files} file(s), ${report.stylesheets.bytes} bytes`);
  console.log(`  Media inlined:       ${report.media.files} file(s), ${report.media.bytes} bytes`);
  if (report.skippedRemote.length > 0) {
    console.log(`  Remote references left as-is (${report.skippedRemote.length}):`);
    for (const ref of report.skippedRemote) console.log(`    - ${ref}`);
  }
  if (report.warnings.length > 0) {
    console.log(`  Warnings (${report.warnings.length}):`);
    for (const w of report.warnings) console.log(`    - ${w}`);
  }
}

function fail(message: string): number {
  console.error(`Error: ${message}`);
  console.error("Run with --help for usage.");
  return 1;
}

function main(): number {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    if (parsed.error === "__help__") {
      printUsage();
      return 0;
    }
    return fail(parsed.error);
  }

  const inputDir = resolve(parsed.input ?? "./dist");
  if (!existsSync(inputDir)) {
    return fail(`Input directory not found: ${inputDir}`);
  }
  if (!statSync(inputDir).isDirectory()) {
    return fail(`Input path is not a directory: ${inputDir}`);
  }

  const entryPath = join(inputDir, ENTRY_DEFAULT);
  if (!existsSync(entryPath)) {
    return fail(`Entry HTML not found: ${entryPath} (expected ${ENTRY_DEFAULT} in the input directory)`);
  }

  let html: string;
  try {
    html = readFileSync(entryPath, "utf-8");
  } catch (e) {
    return fail(`Entry HTML unreadable: ${entryPath} (${(e as Error).message})`);
  }
  if (html.charCodeAt(0) === 0xfeff) html = html.slice(1); // UTF-8 no BOM

  if (MARKER_RE.test(html)) {
    console.log("Already bundled: input carries the co-game bundle-html marker. Nothing to do.");
    return 0;
  }

  // Recursion guard stack, seeded with the entry HTML so a file can never
  // (transitively) include itself back into the bundle.
  const stack: string[] = [normKey(entryPath)];

  html = inlineStylesheets(html, inputDir, stack);
  html = inlineMedia(html, inputDir);
  html = inlineScripts(html, inputDir, entryPath);

  if (report.errors.length > 0) {
    for (const err of report.errors) console.error(`Error: ${err}`);
    console.error(`Bundling failed with ${report.errors.length} error(s); no output written.`);
    return 1;
  }

  const tree = walkTree(inputDir);
  printReport(parsed.check);
  console.log(`  Input tree: ${tree.files} file(s), ${tree.bytes} bytes`);

  if (parsed.check) {
    console.log("Check complete: no files written.");
    return 0;
  }

  const finalHtml = insertMarker(html);
  const outputPath = resolve(parsed.output ?? join(inputDir, OUTPUT_DEFAULT));
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, finalHtml, "utf-8");
  } catch (e) {
    return fail(`Could not write output ${outputPath} (${(e as Error).message})`);
  }
  console.log(`  Output written: ${outputPath} (${Buffer.byteLength(finalHtml, "utf-8")} bytes)`);
  return 0;
}

process.exitCode = main();
