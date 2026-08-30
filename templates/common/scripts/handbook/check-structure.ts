#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-structure.ts
// HTML structure validator — the well-formedness layer of the handbook toolkit.
// Ported from intro-to-ai-harness/scripts/validate-structure.py (stack-based).
//
// Checks every *.html under the docs dir for:
//   ① <pre> / </pre> balance and one .copy-btn per <pre>
//   ② correctly-nested tags (stack-based) — catches extra, unmatched, and
//     mis-nested closing tags as well as unclosed tags at EOF. A plain
//     open/close *count* is NOT enough: an extra </div> paired with an extra
//     <div> balances to zero yet still pushes content outside <article>.
//   ③ no nested <div class="code-block">
//   ④ no closing tag glued to stray characters (e.g. "</div>d>")
//   ⑤ required script references — any known script present in assets/
//     (dark-mode-toggle.js, lang-switcher.js, inpage-search.js, site-search.js)
//     must be referenced by every page
//   ⑥ <html lang="..."> attribute present
//   ⑦ language pair completeness — every `X_<lang>.html` needs its base `X.html`
//
// Usage:
//   bun run scripts/handbook/check-structure.ts --docs-dir docs
// Exit code 0 if all pass, 1 otherwise.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { getDocsDir, configureDocsDir } from "./nav-utils.ts";

export interface StructureError {
  file: string;
  line: number;
  detail: string;
}

interface TagToken {
  tag: string;
  line: number;
  isClose: boolean;
  selfClosing: boolean;
  attrs: string;
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

// Closing tag immediately followed by a stray ASCII letter — a generation
// artifact such as "</div>d>" that count-based checks cannot see.
// Closing tags only: "<div>Text" is a normal opening tag, not corruption.
const STRAY_AFTER_CLOSE_RE = /<\/(?:div|table|thead|tbody|article|main|ul|ol)[^>]*>[a-zA-Z]/g;

const KNOWN_SCRIPTS = [
  "dark-mode-toggle.js",
  "lang-switcher.js",
  "inpage-search.js",
  "site-search.js",
];

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === "\n") n++;
  return n;
}

/** Tokenize HTML into tags with 1-based line numbers, skipping comments and
 *  script/style raw-text content (whose bodies must not be parsed as tags). */
function tokenize(html: string): TagToken[] {
  const tokens: TagToken[] = [];
  let i = 0;
  let line = 1;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    line += countNewlines(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const endPos = end === -1 ? n : end + 3;
      line += countNewlines(html.slice(lt, endPos));
      i = endPos;
      continue;
    }
    const gt = html.indexOf(">", lt);
    if (gt === -1) break;
    const raw = html.slice(lt, gt + 1);
    const m = raw.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/);
    if (m) {
      const tag = m[2].toLowerCase();
      const selfClosing = /\/\s*>$/.test(raw);
      tokens.push({ tag, line, isClose: m[1] === "/", selfClosing, attrs: raw });
      line += countNewlines(raw);
      i = gt + 1;
      // script/style bodies are raw text — jump to the closing tag
      if (m[1] !== "/" && (tag === "script" || tag === "style")) {
        const closeIdx = html.toLowerCase().indexOf(`</${tag}`, i);
        if (closeIdx !== -1) {
          line += countNewlines(html.slice(i, closeIdx));
          i = closeIdx;
        }
      }
      continue;
    }
    // Not a valid tag. A "<" that cannot start a tag (e.g. the heredoc
    // "<<" in `cat > file << 'EOF'`) must be treated as a literal character
    // and NOT be allowed to swallow up to the next ">" — that would skip
    // real tags (like "</pre>") that live inside the heredoc body.
    const nextChar = html[lt + 1] || "";
    if (!/[a-zA-Z\/!?]/.test(nextChar)) {
      i = lt + 1;
      continue;
    }
    line += countNewlines(raw);
    i = gt + 1;
  }
  return tokens;
}

function parseClasses(attrs: string): Set<string> {
  const m = attrs.match(/class="([^"]*)"/);
  return m ? new Set(m[1].split(/\s+/)) : new Set();
}

function findLastIndex<T>(arr: T[], pred: (t: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

/** Stack-based nesting check — the core well-formedness validator. */
export function checkNesting(html: string): { line: number; detail: string }[] {
  const errors: { line: number; detail: string }[] = [];
  const stack: { tag: string; line: number; classes: Set<string> }[] = [];

  for (const t of tokenize(html)) {
    if (t.selfClosing) continue; // <path ... /> — complete element
    if (VOID_TAGS.has(t.tag)) continue;
    if (!t.isClose) {
      const classes = parseClasses(t.attrs);
      if (t.tag === "div" && classes.has("code-block")) {
        if (stack.some((s) => s.tag === "div" && s.classes.has("code-block"))) {
          errors.push({ line: t.line, detail: `nested <div class="code-block">` });
        }
      }
      stack.push({ tag: t.tag, line: t.line, classes });
      continue;
    }
    if (stack.length === 0) {
      errors.push({ line: t.line, detail: `extra </${t.tag}> (no matching open tag)` });
      continue;
    }
    if (stack[stack.length - 1].tag === t.tag) {
      stack.pop();
      continue;
    }
    const idx = findLastIndex(stack, (s) => s.tag === t.tag);
    if (idx !== -1) {
      const unclosed = stack.slice(idx + 1).map((s) => `<${s.tag}>`).join(", ");
      errors.push({
        line: t.line,
        detail: `</${t.tag}> closes an outer tag while these are still open: ${unclosed}`,
      });
      stack.length = idx;
    } else {
      errors.push({ line: t.line, detail: `unmatched </${t.tag}> (not currently open)` });
    }
  }
  for (const s of stack) {
    errors.push({ line: s.line, detail: `unclosed <${s.tag}> at end of file` });
  }
  return errors;
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(ext)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function findHtmlFiles(docsDir: string): string[] {
  return findFiles(docsDir, ".html");
}

function filesInAssets(docsDir: string): string[] {
  const jsDir = join(docsDir, "assets");
  const results: string[] = [];
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) results.push(entry.name);
    }
  }
  walk(jsDir);
  return results;
}

/** Validate one HTML file. Returns list of issue strings (empty = clean). */
function checkFile(relPath: string, content: string, requiredScripts: string[]): StructureError[] {
  const issues: StructureError[] = [];

  const preOpen = (content.match(/<pre[^>]*>/g) || []).length;
  const preClose = (content.match(/<\/pre>/g) || []).length;
  if (preOpen !== preClose) {
    issues.push({ file: relPath, line: 0, detail: `pre balance ${preOpen}/${preClose}` });
  }
  // Every <pre> code box must have a copy button. .prompt-box copy buttons are
  // optional extras (AUTHORING_GUIDELINES §2), so the total may exceed the
  // <pre> count — but it must never fall below it.
  const copyBtns = (content.match(/class="copy-btn"/g) || []).length;
  if (copyBtns < preOpen) {
    issues.push({ file: relPath, line: 0, detail: `copy-btn count ${copyBtns} btn vs ${preOpen} pre — every <pre> needs a copy button` });
  }

  if (content.includes("<img")) {
    issues.push({ file: relPath, line: 0, detail: "contains <img> (SVG must be inline)" });
  }
  if (content.includes("</code></code>")) {
    issues.push({ file: relPath, line: 0, detail: "double </code> close" });
  }
  if (content.includes("<code><div class=")) {
    issues.push({ file: relPath, line: 0, detail: "polluted <code><div>" });
  }

  for (const err of checkNesting(content)) {
    issues.push({ file: relPath, line: err.line, detail: err.detail });
  }

  for (const m of content.matchAll(STRAY_AFTER_CLOSE_RE)) {
    const line = content.slice(0, m.index).split("\n").length;
    issues.push({ file: relPath, line, detail: `stray characters after closing tag: ${m[0]}` });
  }

  // Required scripts: scripts referenced by EVERY page of the handbook are
  // site chrome — a page that omits one is broken. Scripts used only on some
  // pages (e.g. in-page search) are not enforced.
  for (const script of requiredScripts) {
    if (!content.includes(script)) {
      issues.push({ file: relPath, line: 0, detail: `missing ${script}` });
    }
  }

  if (!/<html\s[^>]*lang="/i.test(content)) {
    issues.push({ file: relPath, line: 0, detail: "missing lang attribute" });
  }

  return issues;
}

/** Run all structure checks over a docs directory. */
export function checkStructure(docsDir?: string): StructureError[] {
  const dir = docsDir ? resolve(docsDir) : getDocsDir();
  const all: StructureError[] = [];
  const files = findHtmlFiles(dir);
  const relFiles = files.map((f) => relative(dir, f).replace(/\\/g, "/"));

  // A known script present in assets/ is "required" only if every page
  // references it (site chrome). This adapts to each handbook's convention
  // (e.g. some use site-search.js, others inpage-search.js).
  const presentScripts = filesInAssets(dir).filter((f) => KNOWN_SCRIPTS.includes(f));
  const requiredScripts = presentScripts.filter((script) => {
    const withScript = files.filter((abs) => readFileSync(abs, "utf-8").includes(script)).length;
    return withScript === files.length;
  });

  for (let i = 0; i < files.length; i++) {
    const content = readFileSync(files[i], "utf-8");
    all.push(...checkFile(relFiles[i], content, requiredScripts));
  }

  // Language pair completeness: a `X_<lang>.html` is an orphan only if it has
  // neither a base (`X.html` / `X.md`) nor at least one sibling language
  // variant. Conventions differ across handbooks: some pair `X.html`+`X_en.html`,
  // some use `X_ko.html`+`X_en.html`, some keep the base as markdown.
  const present = new Set(relFiles);
  for (const abs of findFiles(dir, ".md")) {
    present.add(relative(dir, abs).replace(/\\/g, "/"));
  }
  for (const rel of relFiles) {
    const m = rel.match(/^(.+)_([a-z]{2,3}(-[A-Z]{2})?)\.html$/i);
    if (!m) continue;
    const stem = m[1];
    const hasBase = present.has(`${stem}.html`) || present.has(`${stem}.md`);
    const siblings = relFiles.filter((r) => r.startsWith(`${stem}_`) && /\.html$/i.test(r)).length;
    if (!hasBase && siblings < 2) {
      all.push({
        file: rel,
        line: 0,
        detail: `language variant without base file ${stem}.html/.md and no sibling language variant`,
      });
    }
  }

  return all;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const errors = checkStructure();
  if (errors.length === 0) {
    console.log("check-structure: OK — all structure checks clean.");
    process.exit(0);
  }
  console.error(`check-structure: ${errors.length} structure issue(s):`);
  for (const e of errors) {
    const loc = e.line ? `:${e.line}` : "";
    console.error(`  ${e.file}${loc} — ${e.detail}`);
  }
  process.exit(1);
}
