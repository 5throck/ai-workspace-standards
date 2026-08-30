#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-a11y.ts
// L2 — Accessibility checks for handbook HTML files.
// Validates basic a11y requirements without external tools:
//   1. All <img> tags must have an alt attribute
//   2. No heading levels skipped (h1 -> h3 without h2)
//   3. All <a> tags with href must have visible text content
//   4. Every HTML file must have <html lang="..."> attribute
//
// Vendored between intro-to-ai-harness and multi-agent-harness-handbook.
//
// Usage:
//   bun run scripts/check-a11y.ts --docs-dir docs
// Exit code 0 if no issues, 1 otherwise.

import { findAllHtmlFiles, readFile, getDocsDir, configureDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface A11yIssue {
  file: string;
  line: number;
  category: "missing-alt" | "heading-hierarchy" | "empty-link" | "missing-lang";
  detail: string;
}

// ---------------------------------------------------------------------------
// 1. Missing alt attributes on <img> tags
// ---------------------------------------------------------------------------

/** Find <img> tags without an alt attribute, returning line numbers. */
function checkMissingAlt(html: string, file: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const imgRe = /<img\s[^>]*?>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    if (!/\balt\s*(?:=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/i.test(m[0])) {
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "missing-alt",
        detail: `<img> without alt at line ${line}`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 2. Heading hierarchy — no levels skipped
// ---------------------------------------------------------------------------

/**
 * Layout containers where heading hierarchy resets are expected.
 * Headings inside these containers start a new sub-hierarchy.
 */
const HIERARCHY_RESET_CONTAINERS = [
  ".compare-col",
  ".schedule-body",
  ".schedule-block",
  ".keypoints",
  ".compare-grid",
  ".faq-item",
  ".tip-box",
  ".warning-box",
  ".scenario-card",
  ".note",
  ".note-box",
];

/**
 * Check if position is inside one of the HIERARCHY_RESET_CONTAINERS.
 * Uses a stack-based depth tracker to correctly handle nested divs.
 */
function isInsideResetContainer(html: string, pos: number): boolean {
  const windowStart = Math.max(0, pos - 3000);
  const segment = html.slice(windowStart, pos);

  const divOpenRe = /<div(?:\s[^>]*)?>/gi;
  const divCloseRe = /<\/div>/gi;
  const classRe = /class\s*=\s*"([^"]*)"/;

  // Collect all div open/close events with their positions
  type DivEvent = { absPos: number; isOpen: boolean; classes: string };
  const events: DivEvent[] = [];

  let tm: RegExpExecArray | null;
  while ((tm = divOpenRe.exec(segment)) !== null) {
    const absPos = windowStart + tm.index;
    if (absPos >= pos) break;
    const classMatch = tm[0].match(classRe);
    events.push({ absPos, isOpen: true, classes: classMatch ? classMatch[1] : "" });
  }
  while ((tm = divCloseRe.exec(segment)) !== null) {
    const absPos = windowStart + tm.index;
    if (absPos >= pos) break;
    events.push({ absPos, isOpen: false, classes: "" });
  }

  // Sort by position and track nesting stack
  events.sort((a, b) => a.absPos - b.absPos);
  const stack: string[] = []; // stack of class strings for open divs

  for (const ev of events) {
    if (ev.isOpen) {
      stack.push(ev.classes);
    } else {
      stack.pop();
    }
  }

  // Check if any ancestor in the stack is a reset container.
  // HIERARCHY_RESET_CONTAINERS uses CSS class selectors (e.g. ".compare-col"),
  // but HTML class attributes don't have a leading dot.
  const classList = cls => " " + cls + " "; // pad for word-boundary matching
  for (const cls of stack) {
    if (HIERARCHY_RESET_CONTAINERS.some((selector) => {
      // Strip leading "." from selector for matching against class attribute
      const className = selector.startsWith(".") ? selector.slice(1) : selector;
      return classList(cls).includes(" " + className + " ");
    })) {
      return true;
    }
  }
  return false;
}

/** Extract heading tags in document order, verify no levels are skipped. */
function checkHeadingHierarchy(html: string, file: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const headingRe = /<h([1-6])[^>]*>/gi;
  let prevLevel = 0;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    const level = parseInt(m[1], 10);

    // Reset hierarchy inside known layout containers
    if (isInsideResetContainer(html, m.index!)) {
      prevLevel = level;
      continue;
    }

    if (prevLevel > 0 && level - prevLevel > 1) {
      const skipped: string[] = [];
      for (let l = prevLevel + 1; l < level; l++) skipped.push(`h${l}`);
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "heading-hierarchy",
        detail: `h${prevLevel} -> h${level} (skipped ${skipped.join(", ")})`,
      });
    }
    prevLevel = level;
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 3. Empty links (anchor with href but no visible text content)
// ---------------------------------------------------------------------------

/** Find <a href="...">...</a> where the inner text is empty or only whitespace. */
function checkEmptyLinks(html: string, file: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  // Match <a> tags with an href attribute — capture the full tag and inner content
  const aRe = /<a\s+(?:[^>]*?\s)?href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html)) !== null) {
    // Strip inner HTML tags to get visible text only
    const innerHtml = m[1];
    const visibleText = innerHtml.replace(/<[^>]*>/g, "").trim();
    if (visibleText.length === 0) {
      const line = html.slice(0, m.index!).split("\n").length;
      issues.push({
        file,
        line,
        category: "empty-link",
        detail: `empty <a href="...">...</a> at line ${line}`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 4. Missing lang attribute on <html>
// ---------------------------------------------------------------------------

/** Verify <html lang="..."> is present. */
function checkMissingLang(html: string, file: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  if (!/<html\s[^>]*lang\s*=\s*"[^"]+"/i.test(html) &&
      !/<html\s[^>]*lang\s*=\s*'[^']+'/i.test(html)) {
    issues.push({
      file,
      line: 0,
      category: "missing-lang",
      detail: "missing <html lang=\"...\"> attribute",
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function checkA11y(): A11yIssue[] {
  const all: A11yIssue[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    const relFile = relative(docsDir, filePath).replace(/\\/g, "/");

    all.push(...checkMissingAlt(html, relFile));
    all.push(...checkHeadingHierarchy(html, relFile));
    all.push(...checkEmptyLinks(html, relFile));
    all.push(...checkMissingLang(html, relFile));
  }

  return all;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const issues = checkA11y();

  // Group by category for readable output
  const byCategory = new Map<string, A11yIssue[]>();
  for (const issue of issues) {
    const label: Record<string, string> = {
      "missing-alt": "Missing alt attributes",
      "heading-hierarchy": "Heading hierarchy issues",
      "empty-link": "Empty links",
      "missing-lang": "Missing lang attributes",
    }[issue.category] ?? issue.category;
    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label)!.push(issue);
  }

  if (issues.length === 0) {
    console.log("check-a11y: OK -- no accessibility issues found.");
    process.exit(0);
  }

  console.error(`check-a11y: ${issues.length} issue(s) found:`);
  for (const [label, items] of byCategory) {
    console.error(`${label}:`);
    for (const item of items) {
      const loc = item.line ? `: line ${item.line}` : "";
      console.error(`  ${item.file}${loc}: ${item.detail}`);
    }
  }
  process.exit(1);
}
