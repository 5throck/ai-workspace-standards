#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/handbook-sync-audit.ts
// Handbook Sync Audit — three audit modes for co-deck generated handbooks
// (and any handbook directory laid out the same way, e.g. the Handbooks repo):
//
//   1. content   — does the handbook reflect upstream workspace content?
//                  Scans <workspace>/docs/designs/*.md and <workspace>/docs/adr/*,
//                  derives search keywords from each item, and reports items the
//                  handbook never mentions (optionally restricted to items newer
//                  than --since).
//   2. structure — is each handbook internally consistent and are sibling
//                  handbooks linked coherently? Checks broken internal links,
//                  orphan pages (files never referenced by any other page or
//                  the index), and cross-handbook link resolution.
//   3. parity    — section-level language comparison. Groups pages by base
//                  name (X.html / X_en / X_ja / X_es) and diffs the h2/h3 id
//                  sets so a section added to the base page but missing from a
//                  translation is reported with the exact heading.
//
// Usage:
//   bun scripts/handbook/handbook-sync-audit.ts content --handbook-dir <docs> --workspace <ws> [--since 2026-08-01]
//   bun scripts/handbook/handbook-sync-audit.ts structure --handbook-root <dir-containing-handbook-repos>
//   bun scripts/handbook/handbook-sync-audit.ts parity --handbook-dir <docs>
//   bun scripts/handbook/handbook-sync-audit.ts all ... (runs all three; flags shared)
//
// Exit code: 1 if any FAIL-severity finding exists, else 0.

import { join, relative, isAbsolute, dirname, resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

// ─── helpers ─────────────────────────────────────────────────────────────────

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function read(p: string): string {
  return readFileSync(p, "utf8");
}

/** Strip tags/scripts/styles and collapse whitespace for plain-text search. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
}

// ─── 1. content: workspace reflection ────────────────────────────────────────

const STOP = new Set([
  "and", "the", "for", "with", "from", "into", "design", "plan", "template",
  "update", "add", "new", "fix", "feat", "docs", "doc", "refactor", "chore",
]);

function keywordsFromName(base: string): string[] {
  return base
    .replace(/\.md$/, "")
    .split("-")
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOP.has(w));
}

interface ContentFinding {
  source: string;
  kind: "design-doc" | "adr";
  keywords: string[];
  date?: string;
}

export function collectWorkspaceItems(ws: string, since?: string): ContentFinding[] {
  const items: ContentFinding[] = [];
  const push = (dir: string, kind: "design-doc" | "adr") => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const kw = keywordsFromName(f);
      if (kw.length === 0) continue;
      const full = join(dir, f);
      let date: string | undefined;
      const m = f.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) date = m[1];
      if (since && date && date < since) continue;
      items.push({ source: relative(ws, full), kind, keywords: kw, date });
    }
  };
  push(join(ws, "docs", "designs"), "design-doc");
  push(join(ws, "docs", "adr"), "adr");
  return items;
}

export function auditContent(handbookDir: string, ws: string, since?: string) {
  const htmlFiles = walk(handbookDir).filter((f) => f.endsWith(".html"));
  const corpus = htmlFiles.map((f) => htmlToText(read(f)));
  const items = collectWorkspaceItems(ws, since);
  const missing: ContentFinding[] = [];

  for (const item of items) {
    // An item counts as reflected if the handbook mentions a quorum of its
    // keywords (>=2, or all if the item yields only one keyword).
    const need = Math.min(2, item.keywords.length);
    const hits = item.keywords.filter((kw) => corpus.some((t) => t.includes(kw))).length;
    if (hits < need) missing.push(item);
  }

  console.log(`\n═══ content audit — workspace reflection ═══`);
  console.log(`workspace: ${ws}`);
  console.log(`handbook docs: ${handbookDir} (${htmlFiles.length} pages)`);
  console.log(`workspace items checked: ${items.length}`);
  if (missing.length === 0) {
    console.log(`✅ all checked workspace items are reflected in the handbook`);
  } else {
    console.log(`⚠️  ${missing.length} workspace item(s) not reflected (keyword-quorum miss):`);
    for (const m of missing)
      console.log(`  [${m.kind}] ${m.source}${m.date ? ` (${m.date})` : ""} — keywords: ${m.keywords.join(", ")}`);
  }
  return { items: items.length, missing };
}

// ─── 2. structure: internal + cross-handbook linkage ─────────────────────────

interface LinkIssue {
  file: string;
  href: string;
  reason: string;
}

function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\s+(?:[^>]*?\s)?href="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function resolveLocal(file: string, href: string): string | null {
  if (/^[a-z]+:|^\/|^#/i.test(href)) return null; // external, absolute, anchor-only
  const clean = href.split("#")[0];
  if (!clean) return null;
  return resolve(dirname(file), clean);
}

function looksLikeHandbook(dir: string): boolean {
  return existsSync(join(dir, "docs", "index.html"));
}

export function auditStructure(handbookRoot: string) {
  console.log(`\n═══ structure audit — internal & cross-handbook linkage ═══`);
  console.log(`handbook root: ${handbookRoot}`);

  const repos = readdirSync(handbookRoot)
    .map((e) => join(handbookRoot, e))
    .filter((p) => statSync(p).isDirectory() && looksLikeHandbook(p));
  console.log(`handbooks found: ${repos.map((r) => relative(handbookRoot, r)).join(", ") || "(none)"}`);

  const issues: LinkIssue[] = [];
  const orphans: string[] = [];

  for (const repo of repos) {
    const docs = join(repo, "docs");
    const htmlFiles = walk(docs).filter((f) => f.endsWith(".html"));
    const referenced = new Set<string>();
    const allFiles = new Set(htmlFiles);
    let brokenInternal = 0;
    let brokenCross = 0;

    for (const f of htmlFiles) {
      for (const href of extractHrefs(read(f))) {
        const target = resolveLocal(f, href);
        if (target === null) continue;
        referenced.add(resolve(target));
        if (!existsSync(target)) {
          const insideRepo = !relative(repo, target).startsWith("..");
          if (insideRepo) {
            brokenInternal++;
            issues.push({ file: relative(docs, f), href, reason: "broken internal link" });
          } else {
            brokenCross++;
            issues.push({ file: relative(docs, f), href, reason: "cross-handbook link target missing" });
          }
        }
      }
    }
    for (const f of allFiles) {
      if (!referenced.has(resolve(f)) && !f.endsWith("index.html")) orphans.push(relative(docs, f));
    }
    const name = relative(handbookRoot, repo);
    console.log(
      `  ${name}: ${htmlFiles.length} pages, broken internal: ${brokenInternal}, broken cross-handbook: ${brokenCross}`
    );
  }

  if (orphans.length > 0) {
    console.log(`⚠️  orphan pages (never referenced by index or any page):`);
    for (const o of orphans) console.log(`  ${o}`);
  } else {
    console.log(`  orphans: none`);
  }
  if (issues.length === 0) {
    console.log(`✅ all internal and cross-handbook links resolve`);
  } else {
    console.log(`❌ ${issues.length} link issue(s):`);
    for (const i of issues) console.log(`  ${i.reason}: ${i.file} → ${i.href}`);
  }
  return { issues, orphans };
}

// ─── 3. parity: section-level language diff ──────────────────────────────────

const LANGS = ["en", "ja", "es"] as const;

function headingIds(rawHtml: string): Map<string, string> {
  // Strip comments first — header comments may mention "<h2 id>" patterns
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, " ");
  const map = new Map<string, string>();
  const re = /<h([23])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    map.set(m[2], m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }
  return map;
}

interface ParityFinding {
  group: string;
  lang: string;
  missing: { id: string; title: string }[];
}

export function auditParity(handbookDir: string) {
  console.log(`\n═══ parity audit — section-level language comparison ═══`);
  console.log(`handbook docs: ${handbookDir}`);

  const htmlFiles = walk(handbookDir).filter((f) => f.endsWith(".html"));
  const groups = new Map<string, Map<string, string>>(); // base -> lang -> file
  for (const f of htmlFiles) {
    const base = relative(handbookDir, f).replace(/\\/g, "/");
    const m = base.match(/^(.*)_(en|ja|es)\.html$/);
    const key = m ? m[1] : base.replace(/\.html$/, "");
    const lang = m ? m[2] : "base";
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key)!.set(lang, f);
  }

  const findings: ParityFinding[] = [];
  for (const [key, langs] of groups) {
    const baseFile = langs.get("base");
    if (!baseFile || langs.size === 1) continue;
    const baseIds = headingIds(read(baseFile));
    for (const lang of LANGS) {
      const file = langs.get(lang);
      if (!file) {
        console.log(`  [${key}] ⚠️  missing ${lang} variant entirely`);
        findings.push({ group: key, lang, missing: [{ id: "(whole page)", title: key }] });
        continue;
      }
      const ids = headingIds(read(file));
      const missing = [...baseIds.entries()]
        .filter(([id]) => !ids.has(id))
        .map(([id, title]) => ({ id, title }));
      if (missing.length > 0) {
        findings.push({ group: key, lang, missing });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`✅ all language variants share the same section structure`);
  } else {
    console.log(`⚠️  ${findings.length} group(s) with missing sections:`);
    for (const f of findings) {
      console.log(`  [${f.group}] ${f.lang} missing ${f.missing.length} section(s):`);
      for (const s of f.missing) console.log(`    #${s.id} — "${s.title}"`);
    }
  }
  return findings;
}

// ─── main ────────────────────────────────────────────────────────────────────

const mode = process.argv[2] ?? "all";
let fail = false;

if (mode === "content" || mode === "all") {
  const hb = argValue("--handbook-dir");
  const ws = argValue("--workspace");
  if (!hb || !ws) {
    console.error("content audit requires --handbook-dir <docs> and --workspace <dir> [--since YYYY-MM-DD]");
    process.exit(2);
  }
  const { missing } = auditContent(resolve(hb), resolve(ws), argValue("--since"));
  if (missing.length > 0) fail = true;
}
if (mode === "structure" || mode === "all") {
  const root = argValue("--handbook-root");
  if (!root) {
    console.error("structure audit requires --handbook-root <dir containing handbook repos>");
    process.exit(2);
  }
  const { issues } = auditStructure(resolve(root));
  if (issues.length > 0) fail = true;
}
if (mode === "parity" || mode === "all") {
  const hb = argValue("--handbook-dir");
  if (!hb) {
    console.error("parity audit requires --handbook-dir <docs>");
    process.exit(2);
  }
  const findings = auditParity(resolve(hb));
  if (findings.length > 0) fail = true;
}

console.log(`\nresult: ${fail ? "FAIL (findings above — investigate causes, then resolve)" : "PASS"}`);
process.exit(fail ? 1 : 0);
