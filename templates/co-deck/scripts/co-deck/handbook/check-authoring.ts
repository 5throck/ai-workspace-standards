#!/usr/bin/env bun
// scripts/co-deck/handbook/check-authoring.ts
// AUTHORING_GUIDELINES compliance checker.
// Validates handbook HTML against the 21-section authoring guidelines + dark mode + i18n.
// Uses --examples-dir to validate examples/ as regression fixtures.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

interface AuthoringIssue {
  file: string;
  rule: string;
  section: string;
  detail: string;
  severity: "error" | "warn";
}

function findAllHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function readHtml(path: string): string {
  return readFileSync(path, "utf-8");
}

/** Check 1: §10 — Each section must have at least one visual element */
function checkVisualElements(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  // Look for visual indicators: <img, <svg, CSS class-based visuals, <table, code blocks
  const visualPatterns = [
    /<img\s/gi,
    /<svg[\s>]/gi,
    /class="[^"]*(?:tree-box|flow-box|compare-grid|stat-grid|variant-list)[^"]*"/gi,
    /<table[\s>]/gi,
    /<pre[\s>]/gi,
    /class="[^"]*(?:video-refs)[^"]*"/gi,
  ];
  const hasVisual = visualPatterns.some((re) => re.test(html));
  if (!hasVisual) {
    issues.push({
      file, rule: "visual-element", section: "§10",
      detail: "No visual element found (img, svg, table, code block, or CSS visual class)",
      severity: "warn",
    });
  }
  return issues;
}

/** Check 2: §2 — Copy buttons on code blocks */
function checkCopyButtons(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  const codeBlocks = (html.match(/<pre[\s>]/g) || []).length;
  const copyButtons = (html.match(/copyCode|class="[^"]*copy[^"]*"/gi) || []).length;
  // For reference/manual pages, code blocks should have copy buttons
  if (codeBlocks > 2 && copyButtons === 0) {
    issues.push({
      file, rule: "copy-buttons", section: "§2",
      detail: `${codeBlocks} code blocks but no copy buttons found`,
      severity: "warn",
    });
  }
  return issues;
}

/** Check 3: §21-1 — Sidebar navigation */
function checkSidebarNav(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  if (!html.includes("class=\"sidebar\"") && !html.includes("class='sidebar'") && !html.includes("id=\"sidebar\"")) {
    issues.push({
      file, rule: "sidebar-nav", section: "§21-1",
      detail: "No sidebar navigation found",
      severity: "error",
    });
  }
  return issues;
}

/** Check 4: §21-1 — Chapter navigation (prev/next) */
function checkChapterNav(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  // index.html, course-overview, instructor-guide don't need chapter-nav
  const base = relative(process.cwd(), file).replace(/\\/g, "/");
  if (/index\.html$/.test(base) || /course-overview/.test(base) || /instructor-guide/.test(base)) return issues;
  if (!html.includes("class=\"chapter-nav\"") && !html.includes("class='chapter-nav'")) {
    issues.push({
      file, rule: "chapter-nav", section: "§21-1",
      detail: "No chapter-nav found",
      severity: "error",
    });
  }
  return issues;
}

/** Check 5: §11-1 — flex layout min-width: 0 */
function checkFlexMinWidth(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  if (html.includes("step-list") && html.includes("step-content") && !html.includes("min-width: 0") && !html.includes("min-width:0")) {
    issues.push({
      file, rule: "flex-min-width", section: "§11-1",
      detail: "step-content without min-width: 0 (flex overflow risk)",
      severity: "warn",
    });
  }
  return issues;
}

/** Check 6: §11 — No mid-word <strong> wrapping */
function checkMidWordStrong(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  const re = /<strong>([가-힣]{1,3})<\/strong>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Korean words shorter than 4 chars wrapped in <strong> are suspicious
    issues.push({
      file, rule: "mid-word-strong", section: "§11",
      detail: `Suspicious short <strong> in Korean text: "${m[1]}" — wrap natural phrases instead`,
      severity: "warn",
    });
  }
  return issues;
}

/** Check 7: §14 — Course Overview 9 required items */
function checkCourseOverview(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  if (!/course-overview/.test(file)) return issues;
  const requiredItems = [
    "한 줄 요약",
    "학습 목표",
    "대상자",
    "사전 요구사항",
    "강의 형태",
    "강의 일정",
    "다루는 주제",
    "수료 후",
    "강사 정보",
  ];
  for (const item of requiredItems) {
    if (!html.includes(item)) {
      issues.push({
        file, rule: "course-overview-items", section: "§14",
        detail: `Missing required item: "${item}"`,
        severity: "error",
      });
    }
  }
  return issues;
}

/** Check 8: §22 — ALL colors via CSS variables (no hardcoded hex) */
function checkCssVariablesOnly(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  // Find hardcoded hex colors in inline styles (not in CSS variable definitions)
  const styleRe = /style="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html)) !== null) {
    const style = m[1];
    const hexColors = style.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexColors) {
      for (const color of hexColors) {
        issues.push({
          file, rule: "hardcoded-color", section: "§22",
          detail: `Hardcoded color ${color} in inline style — use CSS variable instead`,
          severity: "warn",
        });
      }
    }
  }
  return issues;
}

/** Check 9: §23 — Language file pairs */
function checkLanguagePairs(htmlFiles: string[], baseDir: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  const files = new Map<string, string[]>();
  for (const f of htmlFiles) {
    const rel = relative(baseDir, f).replace(/\\/g, "/");
    const name = rel.replace(/_[a-z]{2}\.html$/, "");
    if (!files.has(name)) files.set(name, []);
    files.get(name)!.push(rel);
  }
  for (const [name, variants] of files) {
    // Skip base templates and assets
    if (name.includes("assets/") || name.includes("templates/")) continue;
    // Check if there's a _XX suffix variant
    const suffixed = variants.filter((v) => /_[a-z]{2}\.html$/.test(v));
    if (suffixed.length === 1) {
      issues.push({
        file: suffixed[0], rule: "language-pair", section: "§23",
        detail: `Language variant "${suffixed[0]}" has no base file counterpart`,
        severity: "warn",
      });
    }
  }
  return issues;
}

/** Check 10: §24 — Instructor Guide completeness */
function checkInstructorGuide(html: string, file: string): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  if (!/instructor-guide/.test(file)) return issues;
  const requiredSections = [
    "시간 배분",
    "강사 노트",
    "확인 질문",
    "사전 준비물",
  ];
  for (const section of requiredSections) {
    if (!html.includes(section)) {
      issues.push({
        file, rule: "instructor-guide-section", section: "§24",
        detail: `Missing required section: "${section}"`,
        severity: "warn",
      });
    }
  }
  return issues;
}

// --- Main ---

const project = resolve(getArg("--project", "."));
const lang = getArg("--lang", "ko");
const examplesDir = getArg("--examples-dir", "");

const docsDir = join(project, "docs");
const htmlFiles = examplesDir
  ? findAllHtmlFiles(examplesDir)
  : findAllHtmlFiles(docsDir);

const baseDir = examplesDir || docsDir;
const allIssues: AuthoringIssue[] = [];

console.log(`\n📋 check-authoring.ts — checking ${htmlFiles.length} HTML files in ${baseDir}`);
console.log(`   Language: ${lang}${examplesDir ? " (examples regression mode)" : ""}\n`);

// Per-file checks
for (const file of htmlFiles) {
  const rel = relative(baseDir, file).replace(/\\/g, "/");
  const html = readHtml(file);

  allIssues.push(...checkVisualElements(html, rel));
  allIssues.push(...checkCopyButtons(html, rel));
  allIssues.push(...checkSidebarNav(html, rel));
  allIssues.push(...checkChapterNav(html, rel));
  allIssues.push(...checkFlexMinWidth(html, rel));
  allIssues.push(...checkMidWordStrong(html, rel));
  allIssues.push(...checkCourseOverview(html, rel));
  allIssues.push(...checkCssVariablesOnly(html, rel));
  allIssues.push(...checkInstructorGuide(html, rel));
}

// Cross-file checks
allIssues.push(...checkLanguagePairs(htmlFiles, baseDir));

// Report
const errors = allIssues.filter((i) => i.severity === "error");
const warns = allIssues.filter((i) => i.severity === "warn");

if (allIssues.length === 0) {
  console.log("✅ All checks passed — no issues found!\n");
} else {
  for (const issue of allIssues) {
    const icon = issue.severity === "error" ? "❌" : "⚠️ ";
    console.log(`${icon} [${issue.section}] ${issue.rule}: ${issue.file}`);
    console.log(`   ${issue.detail}`);
  }
  console.log(`\n   ${errors.length} error(s), ${warns.length} warning(s) — ${allIssues.length} total`);
}

// In examples regression mode, errors in examples are critical
if (examplesDir && errors.length > 0) {
  console.log(`\n🚨 REGRESSION FAILURE: ${errors.length} example(s) fail authoring checks!`);
  console.log(`   Examples must pass all checks to serve as regression fixtures.`);
  process.exit(1);
}

process.exit(errors.length > 0 ? 1 : 0);
