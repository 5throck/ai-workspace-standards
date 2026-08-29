#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-tables.ts
// Enforces the "TABLE COLUMN-SIZING POLICY" documented in
// docs/assets/css/handbook-components.css (search for that heading).
// Vendored from Handbooks/multi-agent-harness-handbook/scripts/check-tables.ts
// (canonical source: scripts/handbook/).
// Hand-tuned per-table column ratios are forbidden:
//   1. No <colgroup> / <col style="width:..."> markup in docs/**/*.html
//   2. No per-table `col.col-*` percentage width rules in the CSS
//   3. No `white-space: nowrap` on a table's first `td` column — that
//      column routinely holds translatable prose (chapter labels, task
//      names), and nowrap forces auto layout to size it to whichever
//      locale's longest untranslated value, starving every other column.
//   4. No `max-width` on a table-column rule without an accompanying
//      `width` — max-width alone gives auto layout no real target and
//      collapses the column to its single-word min-content instead.
//
// Usage:
//   bun run scripts/handbook/check-tables.ts --docs-dir docs

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { getDocsDir, configureDocsDir } from "./nav-utils.ts";

export interface TableError {
  file: string;
  line: number;
  rule: "inline-colgroup" | "inline-col-width" | "css-col-percentage" | "nowrap-first-column" | "max-width-without-width";
  snippet: string;
}

interface CssRule {
  selector: string;
  body: string;
  startLine: number;
}

function findAllHtmlFiles(docsDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) results.push(full);
    }
  }
  walk(docsDir);
  return results;
}

// Blanks out comment contents (keeping line breaks, so line numbers stay
// accurate) so documentation prose can't be mistaken for real selectors —
// e.g. a comment explaining why `nowrap` + `:nth-child(1)` is unsafe would
// otherwise itself get flagged as the violation it's warning against.
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function parseCssRules(css: string): CssRule[] {
  const stripped = stripCssComments(css);
  const rules: CssRule[] = [];
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stripped.matchAll(ruleRegex)) {
    const selector = match[1].trim();
    const body = match[2];
    const startLine = stripped.slice(0, match.index).split("\n").length;
    if (selector) rules.push({ selector, body, startLine });
  }
  return rules;
}

export function checkTables(docsDir?: string): TableError[] {
  const dir = docsDir ? docsDir : getDocsDir();
  const errors: TableError[] = [];

  for (const filePath of findAllHtmlFiles(dir)) {
    const html = readFileSync(filePath, "utf-8");
    const relFile = relative(dir, filePath).replace(/\\/g, "/");
    const lines = html.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/<colgroup[\s>]/.test(line)) {
        errors.push({ file: relFile, line: i + 1, rule: "inline-colgroup", snippet: line.trim().slice(0, 120) });
      } else if (/<col\s[^>]*style\s*=/.test(line)) {
        errors.push({ file: relFile, line: i + 1, rule: "inline-col-width", snippet: line.trim().slice(0, 120) });
      }
    }
  }

  const cssRelPath = "assets/css/handbook-components.css";
  const cssPath = join(dir, "assets", "css", "handbook-components.css");
  const css = readFileSync(cssPath, "utf-8");
  const cssLines = css.split("\n");

  for (let i = 0; i < cssLines.length; i++) {
    if (/col\.col-[\w-]+\s*\{[^}]*width\s*:\s*\d+%/.test(cssLines[i])) {
      errors.push({ file: cssRelPath, line: i + 1, rule: "css-col-percentage", snippet: cssLines[i].trim().slice(0, 120) });
    }
  }

  for (const rule of parseCssRules(css)) {
    const selectors = rule.selector.split(",").map((s) => s.trim());
    const isTableContext = selectors.some((s) => /\btable\b|\.table-|[\s>.]t[dh]\b/.test(s));
    if (!isTableContext) continue;

    // A selector combining 2+ classes on the table wrapper (e.g.
    // `.table-compare.narrow-first-col`) is a deliberate, scoped opt-in —
    // it only affects instances that explicitly opt in via markup, unlike
    // a single-class selector (`.table-schedule`) that silently applies to
    // every table of that type regardless of whether nowrap is safe there.
    const isExplicitOptIn = selectors.every((s) => (s.match(/\.[\w-]+/g) || []).length >= 2);

    const targetsFirstColumnTd = selectors.some(
      (s) => /\btd\b/.test(s) && /:nth-child\(\s*1\s*\)|:first-child/.test(s)
    );
    if (targetsFirstColumnTd && !isExplicitOptIn && /white-space\s*:\s*nowrap/.test(rule.body)) {
      errors.push({
        file: cssRelPath,
        line: rule.startLine,
        rule: "nowrap-first-column",
        snippet: `${rule.selector} { ${rule.body.trim().slice(0, 80)} }`,
      });
    }

    if (/max-width\s*:/.test(rule.body) && !/(?<!-)width\s*:/.test(rule.body)) {
      errors.push({
        file: cssRelPath,
        line: rule.startLine,
        rule: "max-width-without-width",
        snippet: `${rule.selector} { ${rule.body.trim().slice(0, 80)} }`,
      });
    }
  }

  return errors;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const errors = checkTables();
  if (errors.length === 0) {
    console.log("check-tables: OK — no hand-tuned table column ratios found.");
  } else {
    console.error(`check-tables: ${errors.length} violation(s) of the table column-sizing policy:`);
    for (const e of errors) {
      console.error(`  ${e.file}:${e.line} [${e.rule}] ${e.snippet}`);
    }
    console.error(
      "Fix: remove inline colgroup/col widths; never nowrap a table's first (translatable) column; " +
        "pair max-width with a real width. See the TABLE COLUMN-SIZING POLICY comment in handbook-components.css."
    );
    process.exit(1);
  }
}
