#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-lint.ts
// L5 — Basic HTML lint for handbook files without stylelint/eslint.
// Validates HTML quality using only regex-based checks:
//   1. Inline styles: report style="..." attributes on elements
//   2. Inline event handlers: report onclick=, onload=, onerror=, etc. (XSS risk)
//   3. Deprecated tags: report <font>, <center>, <b> (outside allowed contexts),
//      <i> (when not used for icon classes)
//   4. Duplicate IDs: parse id="..." attributes per file, report duplicates
//   5. Empty headings: <h1></h1>, <h2></h2> etc. with no text content
//
// Vendored between intro-to-ai-harness and multi-agent-harness-handbook.
//
// Usage:
//   bun run scripts/check-lint.ts --docs-dir docs
// Exit code 0 if no issues, 1 otherwise.

import { findAllHtmlFiles, readFile, getDocsDir, configureDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface LintIssue {
  file: string;
  line: number;
  category: "inline-style" | "inline-event" | "deprecated-tag" | "duplicate-id" | "empty-heading";
  detail: string;
}

// ---------------------------------------------------------------------------
// 1. Inline styles
// ---------------------------------------------------------------------------

/**
 * Check if an inline style is an intentional pattern that should not be flagged.
 * In direct-to-HTML handbooks, inline styles using CSS custom properties (var()),
 * SVG fill/stroke attributes, layout helpers, and tag/badge styling are
 * by-design — they reference the theme system and would be harder to maintain
 * if moved to external CSS files.
 */
function isAllowedInlineStyle(styleValue: string): boolean {
  // Allow any style that references CSS custom properties (var(...))
  if (/var\(/.test(styleValue)) return true;

  // Allow SVG-specific properties (fill, stroke, font-family on SVG text)
  if (/^(fill|stroke|font-family|font-size|opacity|font-weight|font-style|italic)/i.test(styleValue)) return true;

  // Allow layout helpers used for grid/layout customization
  if (/^(grid-template-columns|max-width|position|width:\d)/i.test(styleValue)) return true;

  // Allow table/code-block helpers
  if (/^(width:100%;border-collapse|padding:8px|text-align)/i.test(styleValue)) return true;

  // Allow small margin/padding adjustments
  if (/^(margin|padding)/i.test(styleValue) && styleValue.length < 60) return true;

  // Allow flexbox layout helpers (display:flex, gap, flex-direction, etc.)
  if (/display\s*:\s*flex/i.test(styleValue)) return true;

  return false;
}

/** Find style="..." attributes in HTML (outside <style> blocks). */
function checkInlineStyles(html: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Strip <style> block content first so CSS property definitions aren't flagged
  const stripped = html.replace(/<style[\s\S]*?<\/style>/gi, (m) => " ".repeat(m.length));

  const styleRe = /style\s*=\s*"([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(stripped)) !== null) {
    if (isAllowedInlineStyle(m[1])) continue;
    const line = html.slice(0, m.index!).split("\n").length;
    issues.push({
      file,
      line,
      category: "inline-style",
      detail: `style="${m[1]}"`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 2. Inline event handlers (XSS risk)
// ---------------------------------------------------------------------------

const EVENT_HANDLER_RE = /\bon(click|dblclick|mousedown|mouseup|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|load|error|focus|blur|change|submit|reset|select|abort|resize|scroll|unload|contextmenu|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|input|invalid|touchstart|touchend|touchmove|wheel|beforeunload|hashchange|popstate|storage|message)\s*=\s*"[^"]*"/gi;

/** Find inline event handler attributes (potential XSS vectors). */
function checkInlineEvents(html: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Strip <script> content so event handlers defined in JS aren't flagged
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, (m) => " ".repeat(m.length));

  let m: RegExpExecArray | null;
  while ((m = EVENT_HANDLER_RE.exec(stripped)) !== null) {
    const line = html.slice(0, m.index!).split("\n").length;
    issues.push({
      file,
      line,
      category: "inline-event",
      detail: m[0].slice(0, 100),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 3. Deprecated tags
// ---------------------------------------------------------------------------

/**
 * Check for deprecated HTML tags:
 *   <font> and <center> are always flagged
 *   <b> and <i> are flagged only when not in allowed contexts:
 *     <b> allowed inside <summary> (for summary text)
 *     <i> allowed when it has an icon-related class (e.g. class="fa-...", class="icon-...")
 */
function checkDeprecatedTags(html: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Strip <script> and <style> blocks
  const stripped = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length));

  // <font> — always deprecated
  {
    const re = /<font[\s>]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "deprecated-tag",
        detail: `<font> tag (use CSS instead)`,
      });
    }
  }

  // <center> — always deprecated
  {
    const re = /<center[\s>]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "deprecated-tag",
        detail: `<center> tag (use CSS instead)`,
      });
    }
  }

  // <b> — allowed inside <summary> or <strong> contexts
  {
    const re = /<b[\s>]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      // Check if this <b> is inside a <summary> block
      const preceding = stripped.slice(Math.max(0, m.index! - 500), m.index!);
      const hasSummaryContext = /<summary[\s>][^<]*$/i.test(preceding);
      // Check if the <b> tag itself has icon-related class
      const tagEnd = stripped.indexOf(">", m.index!);
      const tagAttrs = stripped.slice(m.index!, tagEnd > -1 ? tagEnd : m.index! + 50);

      if (!hasSummaryContext && !/class="[^"]*(?:icon|fa-|bi-|mdi-)/i.test(tagAttrs)) {
        const line = html.slice(0, m.index!).split("\n").length;
        issues.push({
          file,
          line,
          category: "deprecated-tag",
          detail: `<b> tag (use <strong> or CSS font-weight instead)`,
        });
      }
    }
  }

  // <i> — allowed when used for icons (class contains icon-related tokens)
  {
    const re = /<i\s+[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      const tagAttrs = m[0];
      const isIcon = /class="[^"]*(?:icon|fa-|bi-|mdi-|material-icons|icon-)/i.test(tagAttrs);
      if (!isIcon) {
        const line = html.slice(0, m.index!).split("\n").length;
        issues.push({
          file,
          line,
          category: "deprecated-tag",
          detail: `<i> tag without icon class (use <em> or CSS font-style instead)`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 4. Duplicate IDs
// ---------------------------------------------------------------------------

/** Parse all id="..." attributes and report duplicates within the same file. */
function checkDuplicateIds(html: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Strip <script> and <style> blocks
  const stripped = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length));

  const idRe = /id\s*=\s*"([^"]+)"/g;
  const idLocations = new Map<string, number[]>();
  let m: RegExpExecArray | null;

  while ((m = idRe.exec(stripped)) !== null) {
    const id = m[1];
    const line = html.slice(0, m.index!).split("\n").length;
    if (!idLocations.has(id)) idLocations.set(id, []);
    idLocations.get(id)!.push(line);
  }

  for (const [id, lines] of idLocations) {
    if (lines.length > 1) {
      issues.push({
        file,
        line: lines[0],
        category: "duplicate-id",
        detail: `id="${id}" appears ${lines.length} times (first at line ${lines[0]}, also at ${lines.slice(1).join(", ")})`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 5. Empty heading tags
// ---------------------------------------------------------------------------

/** Find <h1></h1>, <h2></h2>, etc. with no text content (only whitespace). */
function checkEmptyHeadings(html: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Strip <script> and <style> blocks
  const stripped = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length));

  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(stripped)) !== null) {
    const inner = m[2].replace(/<[^>]*>/g, "").trim();
    if (inner.length === 0) {
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "empty-heading",
        detail: `empty <h${m[1]}> tag`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function checkLint(): LintIssue[] {
  const all: LintIssue[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    const relFile = relative(docsDir, filePath).replace(/\\/g, "/");

    all.push(...checkInlineStyles(html, relFile));
    all.push(...checkInlineEvents(html, relFile));
    all.push(...checkDeprecatedTags(html, relFile));
    all.push(...checkDuplicateIds(html, relFile));
    all.push(...checkEmptyHeadings(html, relFile));
  }

  return all;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const issues = checkLint();

  // Group by category for readable output
  const byCategory = new Map<string, LintIssue[]>();
  const categoryLabels: Record<string, string> = {
    "inline-style": "Inline styles found",
    "inline-event": "Inline event handlers",
    "deprecated-tag": "Deprecated tags",
    "duplicate-id": "Duplicate IDs",
    "empty-heading": "Empty headings",
  };

  for (const issue of issues) {
    const label = categoryLabels[issue.category] ?? issue.category;
    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label)!.push(issue);
  }

  if (issues.length === 0) {
    console.log("check-lint: OK -- no lint issues found.");
    process.exit(0);
  }

  console.error(`check-lint: ${issues.length} issue(s) found:`);
  for (const [label, items] of byCategory) {
    console.error(`${label}:`);
    for (const item of items) {
      console.error(`  ${item.file}: line ${item.line}: ${item.detail}`);
    }
  }
  process.exit(1);
}
