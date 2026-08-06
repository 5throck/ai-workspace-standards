#!/usr/bin/env bun
// @version 1.0.0
// @description Scans workspace Markdown files for broken relative file links.
//              Invoked by dev-sync.ts as a pre-flight link validation gate.
//              By default scans docs/ root level files only (no subdirectories).
//              The docs/ subdirectories have many historical cross-references that
//              are managed by the validate-doc-folder.ts validator separately.
//              Use --dir to scan a specific directory, --all to scan all of docs/.
// @usage bun scripts/validate-docs-links.ts [--dir <path>] [--all] [--verbose]

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, resolve, dirname, extname } from "path";

const WORKSPACE_ROOT = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const scanAll = args.includes("--all");
const dirArg = args.find((a) => a.startsWith("--dir="))?.split("=")[1];

// Directories to skip during recursive scan
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".tmp",
  ".cache",
  ".gateguard-state",
]);

// Placeholder example paths to skip (documentation examples, not real links)
const EXAMPLE_PATH_PATTERNS = [
  /^path\/to\//,
  /^\/path\/to\//,
  /^\.\.\.$/,
  /^example\//,
  /^your-/,
  /^<[^>]+>$/, // Template placeholders like <agent-name>
  /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/, // Single filename with no path sep — root file refs / placeholders
  /\.sh$/, // Shell scripts removed per ADR-0036
  /^\[.+\]+$/, // Regex patterns accidentally matched as links
];

// Link pattern: [text](path) — captures relative paths (not http/https/mailto/# anchors)
const RELATIVE_LINK_RE = /\[([^\]]*)\]\(([^)#]+?)(?:#[^)]*)?\)/g;

let totalFiles = 0;
let totalLinks = 0;
let brokenLinks = 0;
const errors: string[] = [];

/**
 * Collect .md files from a directory.
 * @param dir Directory to scan
 * @param recurse Whether to recurse into subdirectories
 */
function collectMdFiles(dir: string, recurse = true): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (recurse && !SKIP_DIRS.has(entry)) {
        files.push(...collectMdFiles(fullPath, recurse));
      }
    } else if (extname(entry) === ".md") {
      files.push(fullPath);
    }
  }
  return files;
}

function isRemote(href: string): boolean {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("ftp://") ||
    href.startsWith("//") ||
    href.startsWith("github.com")
  );
}

function isExamplePath(href: string): boolean {
  return EXAMPLE_PATH_PATTERNS.some((re) => re.test(href));
}

function checkFile(mdPath: string): void {
  let content: string;
  try {
    content = readFileSync(mdPath, "utf8");
  } catch {
    return;
  }
  totalFiles++;
  const mdDir = dirname(mdPath);
  RELATIVE_LINK_RE.lastIndex = 0;

  for (const match of content.matchAll(RELATIVE_LINK_RE)) {
    const href = match[2].trim();
    // Skip remote URLs, empty hrefs, anchor-only refs, and example placeholders
    if (!href || isRemote(href) || href.startsWith("#") || isExamplePath(href)) continue;

    // Strip query strings and anchor fragments
    const hrefClean = href.split("?")[0].split("#")[0];
    if (!hrefClean) continue;

    totalLinks++;
    const target = resolve(mdDir, hrefClean);

    if (!existsSync(target)) {
      brokenLinks++;
      const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
      const msg = `  ${rel}: broken link → ${href}`;
      errors.push(msg);
      if (verbose) console.error(msg);
    }
  }
}

// Determine what to scan
let mdFiles: string[] = [];

if (dirArg) {
  // Explicit directory argument — recurse into it
  const scanDir = resolve(WORKSPACE_ROOT, dirArg);
  mdFiles = collectMdFiles(scanDir, true);
} else if (scanAll) {
  // Full docs/ recursive scan (for CI deep validation)
  mdFiles = collectMdFiles(join(WORKSPACE_ROOT, "docs"), true);
} else {
  // Default: docs/ root level files only (no subdirectories)
  // Subdirectories like adr/, designs/, architecture/ have many historical
  // cross-references managed separately by validate-doc-folder.ts
  mdFiles = collectMdFiles(join(WORKSPACE_ROOT, "docs"), false);
}

if (verbose) console.log(`🔍 Scanning ${mdFiles.length} markdown file(s) for broken links...\n`);

for (const f of mdFiles) {
  checkFile(f);
}

if (brokenLinks > 0) {
  console.error(`\n❌ Found ${brokenLinks} broken link(s) in ${totalFiles} markdown file(s):\n`);
  for (const e of errors) console.error(e);
  console.error(`\nTotal links checked: ${totalLinks}`);
  process.exit(1);
} else {
  if (verbose) {
    console.log(`\n✅ All ${totalLinks} relative links in ${totalFiles} markdown files resolve correctly.`);
  }
  process.exit(0);
}
