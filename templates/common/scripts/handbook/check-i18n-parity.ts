#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-i18n-parity.ts
// Check ③: Cross-language content parity for localized handbook pages.
// Groups docs/**/*.html by base name (X.html + X_en/X_ja/X_es.html) and fails on:
//   - a localized variant missing while its siblings exist
//   - h1/h2/h3 or <pre> count mismatch vs the base page
// and warns on li/tr deviation >15% and numeric-token ($/€/%) multiset drift.
// Also fails internal links inside _en/_ja/_es pages pointing at a page that
// has a same-suffix variant on disk (wrong-language link).
// Canonical source: Handbooks/multi-agent-harness-handbook/scripts/check-i18n-parity.ts
// (vendored into the co-deck H-Stage toolkit; keep in sync when upstream changes).
//
// Usage:
//   bun run scripts/check-i18n-parity.ts --docs-dir docs
//   (or invoked as Check 13 by handbook-doctor.ts)

import { existsSync } from "node:fs";
import { relative } from "node:path";
import { findAllHtmlFiles, readFile, resolveHref, getDocsDir, configureDocsDir } from "./nav-utils.ts";

export type ParityType =
  | "missing-variant"
  | "heading-mismatch"
  | "pre-mismatch"
  | "count-deviation"
  | "numeric-tokens"
  | "wrong-language-link";

export interface ParityIssue {
  type: ParityType;
  severity: "fail" | "warn";
  group: string;
  fileA?: string;
  fileB?: string;
  href?: string;
  detail: string;
}

const LANGS = ["en", "ja", "es"] as const;
const COUNTED_TAGS = ["h1", "h2", "h3", "li", "tr", "pre", "svg", "img", "table"];
const CURRENCY_RE = /[$€]\s?\d+(?:[.,]\d+)*/g;
const PERCENT_RE = /\d+(\.\d+)?%/g;

/** Split a docs-relative path into its group key and language suffix (null = base). */
function splitRel(rel: string): { key: string; lang: string | null } {
  const m = rel.match(/^(.*)_(en|ja|es)\.html$/);
  if (m) return { key: m[1], lang: m[2] };
  return { key: rel.replace(/\.html$/, ""), lang: null };
}

interface TagStats {
  counts: Record<string, number>;
  numbers: Map<string, number>;
}

function bump(map: Map<string, number>, token: string): void {
  map.set(token, (map.get(token) ?? 0) + 1);
}

function extractStats(absPath: string): TagStats {
  // Comments may hold example markup — strip them, then parse text only.
  const html = readFile(absPath).replace(/<!--[\s\S]*?-->/g, "");
  const counts: Record<string, number> = {};
  for (const tag of COUNTED_TAGS) {
    counts[tag] = (html.match(new RegExp(`<${tag}[\\s>/]`, "gi")) || []).length;
  }
  const numbers = new Map<string, number>();
  for (const m of html.matchAll(CURRENCY_RE)) bump(numbers, m[0]);
  for (const m of html.matchAll(PERCENT_RE)) bump(numbers, m[0]);
  return { counts, numbers };
}

interface TokenDiff {
  token: string;
  a: number;
  b: number;
}

function multisetDiff(a: Map<string, number>, b: Map<string, number>): TokenDiff[] {
  const out: TokenDiff[] = [];
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  for (const k of keys) {
    const ca = a.get(k) ?? 0;
    const cb = b.get(k) ?? 0;
    if (ca !== cb) out.push({ token: k, a: ca, b: cb });
  }
  return out;
}

export function checkI18nParity(): ParityIssue[] {
  const docsDir = getDocsDir();
  const issues: ParityIssue[] = [];
  const htmlFiles = findAllHtmlFiles();
  const relOf = (abs: string): string => relative(docsDir, abs).replace(/\\/g, "/");

  // --- Group discovery ---
  interface Group {
    key: string;
    baseAbs: string | null;
    variants: Map<string, string>;
  }
  const groups = new Map<string, Group>();
  for (const abs of htmlFiles) {
    const { key, lang } = splitRel(relOf(abs));
    let g = groups.get(key);
    if (!g) {
      g = { key, baseAbs: null, variants: new Map() };
      groups.set(key, g);
    }
    if (lang) g.variants.set(lang, abs);
    else g.baseAbs = abs;
  }

  // --- Per-group parity checks ---
  for (const g of groups.values()) {
    const present = LANGS.filter((l) => g.variants.has(l));
    if (present.length === 0) continue; // no localized variants -> not a translation group

    for (const lang of LANGS) {
      if (!g.variants.has(lang)) {
        issues.push({
          type: "missing-variant",
          severity: "fail",
          group: g.key,
          detail: `${g.key}_${lang}.html missing while ${present.map((l) => `${g.key}_${l}.html`).join(", ")} exist(s)`,
        });
      }
    }

    if (!g.baseAbs) continue; // count checks compare against the base page
    const base = extractStats(g.baseAbs);

    for (const lang of present) {
      const abs = g.variants.get(lang)!;
      const stats = extractStats(abs);
      const rel = relOf(abs);

      for (const tag of ["h1", "h2", "h3"]) {
        if (stats.counts[tag] !== base.counts[tag]) {
          issues.push({
            type: "heading-mismatch",
            severity: "fail",
            group: g.key,
            fileA: rel,
            detail: `<${tag}> count ${stats.counts[tag]} vs base ${base.counts[tag]}`,
          });
        }
      }
      if (stats.counts.pre !== base.counts.pre) {
        issues.push({
          type: "pre-mismatch",
          severity: "fail",
          group: g.key,
          fileA: rel,
          detail: `<pre> count ${stats.counts.pre} vs base ${base.counts.pre}`,
        });
      }
      for (const tag of ["li", "tr"]) {
        const b = base.counts[tag];
        const v = stats.counts[tag];
        const dev = b === 0 ? (v > 0 ? Infinity : 0) : Math.abs(v - b) / b;
        if (dev > 0.15) {
          const pct = Number.isFinite(dev) ? `${Math.round(dev * 100)}%` : "new";
          issues.push({
            type: "count-deviation",
            severity: "warn",
            group: g.key,
            fileA: rel,
            detail: `<${tag}> count ${v} vs base ${b} (${pct} deviation > 15%)`,
          });
        }
      }
      const diffs = multisetDiff(base.numbers, stats.numbers);
      if (diffs.length > 0) {
        const shown = diffs.slice(0, 10).map((d) => `${d.token} (base×${d.a}, ${lang}×${d.b})`).join("; ");
        const more = diffs.length > 10 ? ` (+${diffs.length - 10} more)` : "";
        issues.push({
          type: "numeric-tokens",
          severity: "warn",
          group: g.key,
          fileA: rel,
          detail: `numeric tokens differ from base: ${shown}${more}`,
        });
      }
    }
  }

  // --- Wrong-language internal links ---
  for (const abs of htmlFiles) {
    const srcRel = relOf(abs);
    const self = splitRel(srcRel);
    if (!self.lang) continue;
    // Comments can't be clicked — strip before scanning hrefs.
    const html = readFile(abs).replace(/<!--[\s\S]*?-->/g, "");
    const linkRe = /<a\s+(?:[^>]*?\s)?href="([^"]*)"[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      const targetAbs = resolveHref(abs, href);
      if (!targetAbs || !existsSync(targetAbs)) continue; // external/anchor/broken handled elsewhere
      const targetRel = relOf(targetAbs);
      if (/^index(?:_[a-z]{2})?\.html$/.test(targetRel)) continue; // docs home valid for every language
      const family = groups.get(splitRel(targetRel).key);
      if (!family || family.variants.size === 0) continue; // target has no variants -> exempt
      const expected = family.variants.get(self.lang);
      if (expected && expected !== targetAbs) {
        issues.push({
          type: "wrong-language-link",
          severity: "fail",
          group: self.key,
          fileA: srcRel,
          fileB: targetRel,
          href,
          detail: `links to ${targetRel} but ${relOf(expected)} exists — expected same-suffix (_${self.lang}) link`,
        });
      }
    }
  }

  return issues;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const issues = checkI18nParity();
  const fails = issues.filter((i) => i.severity === "fail");
  const warns = issues.filter((i) => i.severity === "warn");

  console.log("\n🌐 check-i18n-parity\n");
  if (issues.length === 0) {
    console.log("✅ All translation groups are in parity.");
  } else {
    const byGroup = new Map<string, ParityIssue[]>();
    for (const i of issues) {
      if (!byGroup.has(i.group)) byGroup.set(i.group, []);
      byGroup.get(i.group)!.push(i);
    }
    for (const [group, list] of byGroup) {
      const icon = list.some((i) => i.severity === "fail") ? "❌" : "⚠️ ";
      console.log(`${icon} GROUP ${group}.html`);
      for (const i of list) {
        const loc = i.fileA ? `${i.fileA}${i.fileB ? ` → ${i.fileB}` : ""}: ` : "";
        console.log(`   [${i.type}] ${loc}${i.detail}`);
      }
    }
    console.log(`\n   Total: ${fails.length} FAIL, ${warns.length} WARN`);
  }

  process.exit(fails.length > 0 ? 1 : 0);
}
