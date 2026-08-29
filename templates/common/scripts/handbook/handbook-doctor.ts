#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/handbook-doctor.ts
// Enhanced static analyzer for handbook HTML files.
// 13 checks: nav, broken links, dark palette, lang pair, visual, Course Overview,
// Instructor Guide, unused assets, duplicate IDs, hardcoded colors, empty title/h1,
// cross-language content parity.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { configureDocsDir } from "./nav-utils.ts";
import { checkI18nParity } from "./check-i18n-parity.ts";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

interface DoctorIssue {
  file: string;
  check: string;
  detail: string;
  severity: "error" | "warn";
}

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(ext)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

const project = resolve(getArg("--project", "."));
const docsDir = join(project, "docs");
const assetsDir = join(docsDir, "assets");
const severityFilter = getArg("--severity", "warn"); // "warn" = show all, "error" = errors only

const htmlFiles = walkDir(docsDir, ".html");
const cssFiles = walkDir(assetsDir, ".css");
const jsFiles = walkDir(assetsDir, ".js");

const allIssues: DoctorIssue[] = [];

// Reference/procedure documents (FAQ, glossary, setup, tools) are lookups,
// not teaching chapters — they are exempt from chapter-nav and visual-element
// requirements per AUTHORING_GUIDELINES §10.
const isReferenceDoc = (rel: string) =>
  /^faq\//.test(rel) || /^glossary\//.test(rel) || /^setup\//.test(rel) || /^tools\//.test(rel);

// --- Check 1: Missing sidebar nav ---
// The handbook layout uses a <nav> sidebar inside .layout (not a "sidebar"
// class), so check for a top-level <nav> element instead. Landing pages
// (index + course overview) intentionally use a single-column .wrap layout
// with a header and no sidebar.
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  if (/^index(?:_[a-z]{2})?\.html$/.test(rel) || /[Cc]ourse[_\-][Oo]verview/.test(rel)) continue;
  if (!/<nav[^>]*>/.test(html)) {
    allIssues.push({ file: rel, check: "sidebar-nav", detail: "No sidebar navigation", severity: "error" });
  }
}

// --- Check 2: Missing chapter-nav ---
// Landing/reference pages (index, course overview, lecture guide) and
// reference docs (FAQ, glossary, setup, tools) are not sequential chapters
// and intentionally omit prev/next navigation.
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  if (/^index(?:_[a-z]{2})?\.html$/.test(rel) || /[Cc]ourse[_\-][Oo]verview/.test(rel) || /[Ll]ecture[_\-][Gg]uide/.test(rel)) continue;
  if (isReferenceDoc(rel)) continue;
  if (!html.includes("chapter-nav")) {
    allIssues.push({ file: rel, check: "chapter-nav", detail: "No chapter-nav found", severity: "warn" });
  }
}

// --- Check 3: Broken links ---
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  const linkRe = /<a\s+(?:[^>]*?\s)?href="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    const abs = join(dirname(file), href.split("?")[0].split("#")[0]);
    if (!existsSync(abs)) {
      allIssues.push({ file: rel, check: "broken-link", detail: `Broken link: "${href}"`, severity: "error" });
    }
  }
}

// --- Check 4: No dark palette ---
// The theme lives in handbook-variables.css. Dark mode uses the 2-layer
// strategy: :root (light) + .dark class managed by dark-mode-toggle.js —
// there is intentionally no @media (prefers-color-scheme) block.
const mainCss = join(assetsDir, "css", "handbook-variables.css");
if (existsSync(mainCss)) {
  const css = readFileSync(mainCss, "utf-8");
  if (!css.includes(".dark {") && !css.includes(".dark{")) {
    allIssues.push({ file: "assets/css/handbook-variables.css", check: "dark-palette", detail: "No .dark manual toggle class", severity: "error" });
  }
} else {
  allIssues.push({ file: "assets/css/handbook-variables.css", check: "dark-palette", detail: "handbook-variables.css not found", severity: "error" });
}

// --- Check 5: Missing language pair ---
// A document set is the base name without the language suffix: both
// "ch01/01_Why_AI_Agents.html" (base, no suffix) and
// "ch01/01_Why_AI_Agents_en.html" map to set "ch01/01_Why_AI_Agents".
const langMap = new Map<string, string[]>();
for (const file of htmlFiles) {
  const rel = relFile(file);
  const base = rel.replace(/(_[a-z]{2})?\.html$/, "");
  if (!langMap.has(base)) langMap.set(base, []);
  langMap.get(base)!.push(rel);
}
for (const [base, variants] of langMap) {
  if (variants.some((v) => /_[a-z]{2}\.html$/.test(v))) {
    const hasBase = variants.some((v) => !/_[a-z]{2}\.html$/.test(v));
    if (!hasBase && variants.length === 1) {
      allIssues.push({ file: variants[0], check: "language-pair", detail: "Language variant without base file", severity: "warn" });
    }
  }
}

// --- Check 6: Missing visual element ---
// Reference docs are exempt (see isReferenceDoc above).
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  if (/^index(?:_[a-z]{2})?\.html$/.test(rel)) continue;
  if (isReferenceDoc(rel)) continue;
  const hasVisual = /<img\s|<svg[\s>]|<table[\s>]|<pre[\s>]/i.test(html);
  if (!hasVisual) {
    allIssues.push({ file: rel, check: "visual-element", detail: "No visual element (img, svg, table, code)", severity: "warn" });
  }
}

// --- Check 7: Missing Course Overview (§14) ---
// The required items are Korean headings; only the base (Korean) file is checked.
let hasCourseOverview = false;
for (const file of htmlFiles) {
  if (/00_Course_Overview\.html$/.test(file)) {
    hasCourseOverview = true;
    const html = readHtml(file);
    const rel = relFile(file);
    const required = ["학습 목표", "대상자", "사전 요구사항"];
    for (const item of required) {
      if (!html.includes(item)) {
        allIssues.push({ file: rel, check: "course-overview", detail: `Missing: "${item}"`, severity: "error" });
      }
    }
  }
}
if (!hasCourseOverview) {
  allIssues.push({ file: "docs/", check: "course-overview", detail: "No course-overview.html found (§14 requirement for course handbooks)", severity: "warn" });
}

// --- Check 8: Missing Instructor Guide ---
// The required items are Korean headings; only the base (Korean) file is checked.
let hasInstructorGuide = false;
for (const file of htmlFiles) {
  if (/00_Lecture_Guide\.html$/.test(file)) {
    hasInstructorGuide = true;
    const html = readHtml(file);
    const rel = relFile(file);
    const required = ["시간 배분", "강사 노트", "확인 질문"];
    for (const item of required) {
      if (!html.includes(item)) {
        allIssues.push({ file: rel, check: "instructor-guide", detail: `Missing: "${item}"`, severity: "warn" });
      }
    }
  }
}
if (!hasInstructorGuide) {
  allIssues.push({ file: "docs/", check: "instructor-guide", detail: "No instructor-guide.html found (§24 requirement for course handbooks)", severity: "warn" });
}

// --- Check 9: Unused assets ---
const allAssetRefs = new Set<string>();
for (const file of htmlFiles) {
  const html = readHtml(file);
  const re = /(?:src|href)="([^"]*(?:\.css|\.js|\.png|\.jpg|\.svg|\.gif|\.ico))"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1].split("?")[0].split("#")[0];
    const filename = ref.split("/").pop() || "";
    allAssetRefs.add(filename);
  }
}
for (const file of [...cssFiles, ...jsFiles]) {
  const filename = file.split(/[/\\]/).pop() || "";
  if (!allAssetRefs.has(filename)) {
    allIssues.push({ file: relFile(file), check: "unused-asset", detail: `Asset not referenced in any HTML file`, severity: "warn" });
  }
}

// --- Check 10: Duplicate IDs ---
// IDs only collide within a single HTML document. Each handbook page is an
// independent document, and locale variants intentionally share section IDs
// (so the language switcher jumps to the same position), so only flag an ID
// that appears twice inside the SAME file.
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  const seen = new Set<string>();
  const re = /\sid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) {
      allIssues.push({ file: rel, check: "duplicate-id", detail: `Duplicate ID "${id}" within file`, severity: "warn" });
      break;
    }
    seen.add(id);
  }
}

// --- Check 11: Hardcoded colors ---
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  const styleRe = /style="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html)) !== null) {
    const style = m[1];
    const hexColors = style.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexColors) {
      for (const color of hexColors) {
        allIssues.push({ file: rel, check: "hardcoded-color", detail: `Hardcoded ${color} in inline style`, severity: "warn" });
      }
    }
  }
}

// --- Check 12: Empty title/h1 ---
for (const file of htmlFiles) {
  const html = readHtml(file);
  const rel = relFile(file);
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (titleMatch && titleMatch[1].trim() === "") {
    allIssues.push({ file: rel, check: "empty-title", detail: "Empty <title> tag", severity: "error" });
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1Match && h1Match[1].trim() === "") {
    allIssues.push({ file: rel, check: "empty-h1", detail: "Empty <h1> tag", severity: "error" });
  }
}

// --- Check 13: Cross-language content parity ---
// Delegates to the shared i18n parity checker: FAIL conditions (missing
// language variants, h1/h2/h3/pre count mismatches, wrong-language links)
// become errors; drift warnings (>15% li/tr, numeric-token divergence)
// become warns. Workflow rules: skills/handbook/references/I18N_PARITY_PLAYBOOK.md
configureDocsDir(docsDir);
for (const issue of checkI18nParity()) {
  allIssues.push({
    file: issue.fileA,
    check: "i18n-parity",
    detail: `[${issue.type}] ${issue.detail}`,
    severity: issue.severity === "fail" ? "error" : "warn",
  });
}

// --- Helpers ---
function readHtml(file: string): string {
  return readFileSync(file, "utf-8");
}

function relFile(file: string): string {
  return relative(docsDir, file).replace(/\\/g, "/");
}

// --- Report ---
let filtered = allIssues;
if (severityFilter === "error") {
  filtered = allIssues.filter((i) => i.severity === "error");
}

console.log(`\n🏥 handbook-doctor — ${htmlFiles.length} HTML, ${cssFiles.length} CSS, ${jsFiles.length} JS files\n`);

if (filtered.length === 0) {
  console.log("✅ All checks passed — handbook is healthy!\n");
} else {
  const errors = filtered.filter((i) => i.severity === "error");
  const warns = filtered.filter((i) => i.severity === "warn");

  // Group by check
  const byCheck = new Map<string, DoctorIssue[]>();
  for (const issue of filtered) {
    if (!byCheck.has(issue.check)) byCheck.set(issue.check, []);
    byCheck.get(issue.check)!.push(issue);
  }

  for (const [check, issues] of byCheck) {
    const icon = issues[0].severity === "error" ? "❌" : "⚠️ ";
    console.log(`${icon} ${check} (${issues.length})`);
    for (const issue of issues) {
      console.log(`   ${issue.file}: ${issue.detail}`);
    }
  }

  console.log(`\n   Total: ${errors.length} error(s), ${warns.length} warning(s)`);
}

process.exit(filtered.some((i) => i.severity === "error") ? 1 : 0);
