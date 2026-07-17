// scripts/co-deck/handbook/nav-utils.ts
// HTML parsing helpers for navigation validation — zero external deps.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/nav-utils.ts
// DOCS_DIR is configurable via --docs-dir CLI arg.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

/** Resolve DOCS_DIR from CLI args or default. */
function resolveDocsDir(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) {
    // If absolute path, use as-is; if relative, resolve from cwd
    const raw = args[idx + 1];
    return join(process.cwd(), raw);
  }
  // Default: handbook/docs relative to project root
  return join(import.meta.dirname || ".", "..", "..", "..", "handbook", "docs");
}

const DOCS_DIR = resolveDocsDir();

/** Find all .html files under docs/ (recursively), returning absolute paths. */
export function findAllHtmlFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) results.push(full);
    }
  }
  walk(DOCS_DIR);
  return results;
}

/** Read file as UTF-8 string. */
export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

/** Resolve a relative href from a source HTML file to an absolute disk path. */
export function resolveHref(fromFile: string, href: string): string | null {
  // Skip external links, anchors, mailto, etc.
  if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) return null;
  const dir = dirname(fromFile);
  let resolved = join(dir, href);
  // Normalize: remove query string, hash
  resolved = resolved.split("?")[0].split("#")[0];
  return resolved;
}

/** Extract the chapter-nav links from an HTML string.
 *  Returns { prev?: { href, label }, next?: { href, label }, others: { href, label }[] }
 */
export function extractChapterNav(html: string): {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
  others: { href: string; label: string }[];
} {
  const result: { prev?: { href: string; label: string }; next?: { href: string; label: string }; others: { href: string; label: string }[] } = { others: [] };

  // Extract <div class="chapter-nav">...</div> block using depth-aware parsing
  const openIdx = html.indexOf('<div class="chapter-nav"');
  if (openIdx === -1) return result;

  const tagEnd = html.indexOf(">", openIdx);
  if (tagEnd === -1) return result;

  let depth = 1;
  let pos = tagEnd + 1;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const charAfter = html[nextOpen + 4];
      if (charAfter === " " || charAfter === ">") {
        depth++;
        pos = nextOpen + 4;
        continue;
      }
    }
    depth--;
    pos = nextClose + 6;
  }

  const navHtml = html.slice(tagEnd + 1, pos - 6);

  const aTagRe = /<a\s+href="([^"]*)"\s*((?:class="[^"]*")?\s*(?:style="[^"]*")?\s*)>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;

  while ((m = aTagRe.exec(navHtml)) !== null) {
    const href = m[1];
    const attrs = m[2] || "";
    const inner = m[3];

    const classMatch = attrs.match(/class="([^"]*)"/);
    const cls = classMatch ? classMatch[1] : "";

    const ttlMatch = inner.match(/<div\s+class="ttl">([\s\S]*?)<\/div>/);
    const label = ttlMatch ? ttlMatch[1].trim() : inner.trim();
    const entry = { href, label };

    if (cls.includes("prev")) result.prev = entry;
    else if (cls.includes("next")) result.next = entry;
    else result.others.push(entry);
  }

  return result;
}

/** Extract ALL <a href="..."> targets from an HTML string (for broken link check). */
export function extractAllLinks(html: string): { href: string; context: string }[] {
  const results: { href: string; context: string }[] = [];
  const re = /<a\s+(?:[^>]*?\s)?href="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push({ href: m[1], context: m[0].slice(0, 120) });
  }
  return results;
}

/** Extract title tag content. */
export function extractTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return m ? m[1].trim() : "";
}

/** Extract h1 tag text content. */
export function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].trim() : "";
}

/** Parse the DOCS array from site-search.js. Returns { path, title }[]. */
export function parseDocsArray(jsContent: string): { path: string; title: string }[] {
  const entries: { path: string; title: string }[] = [];
  const re = /\{\s*path:\s*'([^']*)'\s*,\s*title:\s*'([^']*)'\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(jsContent)) !== null) {
    entries.push({ path: m[1], title: m[2] });
  }
  return entries;
}

/** Check if an absolute file path exists on disk. */
export function fileExists(absPath: string): boolean {
  return existsSync(absPath);
}

/** Get the docs directory path. */
export function getDocsDir(): string {
  return DOCS_DIR;
}
