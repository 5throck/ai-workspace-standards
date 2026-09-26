#!/usr/bin/env bun
// @version 1.2.0
// @description Scans workspace Markdown files for broken relative file links.
//              Invoked by dev-sync.ts as a pre-flight link validation gate and
//              spawned by audit.ts as the docs relative-link gate.
//              By default scans docs/ root level files only (no subdirectories)
//              PLUS templates/common/docs/ recursively (v1.2.0).
//              The docs/ subdirectories have many historical cross-references that
//              are managed by the validate-doc-folder.ts validator separately.
//              Use --dir to scan a specific directory, --all to scan all of docs/.
//
//              v1.1.0 (T-20260910-014): anchor fragments are now verified against
//              the target file's headings instead of being stripped. A fragment is
//              accepted when it matches either (a) the GitHub-style auto-slug of a
//              heading, or (b) an explicit `{#custom-anchor}` declaration on a
//              heading — the workspace uses both conventions (docs/constitution/).
//              Headings inside ```/~~~ fences are ignored.
//
//              v1.2.0 (design-foundation v1.2 PR-2): the default scope now also
//              covers templates/common/docs/** recursively — design-foundation.md
//              §8 previously shipped a stale project path that rotted under
//              review-only checking. Template-docs links get a documented
//              post-scaffold resolution allowance, applied per link (whole files
//              are never skipped): a link passes when its target exists at
//              (i) the plain relative path, (ii) the same href from the workspace
//              root (repo-root-relative authoring), (iii) the same href inside
//              the template delivery tree (templates/common models a delivered
//              project root, so docs/context.md matches
//              templates/common/docs/context.md), or (iv) the delivered docs/
//              root (the file's templates/common/docs subpath mirrored onto the
//              workspace docs/, so ../adr/x.md from variants/ matches
//              docs/adr/x.md — "resolves only post-scaffold", mirroring the
//              agents-md-pointer-integrity precedent). _examples/ is scaffold
//              staging, not delivered docs, and is excluded from this scope.
// @usage bun scripts/validate-docs-links.ts [--dir <path>] [--all] [--verbose]

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, resolve, dirname, extname, relative, sep } from "path";

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

// Template-scope staging directories: scaffold staging content, not delivered
// docs — excluded from the templates/common/docs scan (v1.2.0).
const TEMPLATE_STAGING_SKIP = new Set(["_examples"]);

// Template docs root: scanned recursively in the default scope; links inside it
// get the post-scaffold resolution allowance (see header, rules (i)-(iv)).
const TEMPLATE_DOCS_ROOT = join(WORKSPACE_ROOT, "templates", "common", "docs");

// Link pattern: [text](path#fragment) — captures relative paths plus their
// optional anchor fragment (v1.1.0 verifies fragments; not http/https/mailto/#-only anchors)
const RELATIVE_LINK_RE = /\[([^\]]*)\]\(([^)#\s]+)(#[^)\s]+)?\)/g;

let totalFiles = 0;
let totalLinks = 0;
let brokenLinks = 0;
const errors: string[] = [];

/**
 * GitHub-style heading slug: lowercase, strip combining marks, drop characters
 * that are not letters/numbers/spaces/hyphens/underscores, then map each
 * whitespace character to a hyphen WITHOUT collapsing runs (so "A & B" →
 * "a--b"). Matches the anchors GitHub renders for the workspace's headings —
 * e.g. "### 10. Terminology → Canonical Definitions" →
 * "10-terminology--canonical-definitions".
 */
function headingSlug(headingText: string): string {
  return headingText
    .trim()
    .toLowerCase()
    // eslint-disable-next-line no-irregular-whitespace
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .replace(/[^\p{L}\p{N}\p{M}\s\-_]/gu, "")
    .replace(/\s/g, "-");
}

/**
 * Collect the anchor fragments a target markdown file exposes: the auto-slug of
 * every non-fenced ATX heading plus any explicit `{#custom-anchor}` declaration.
 */
function collectAnchorFragments(mdPath: string): Set<string> {
  const fragments = new Set<string>();
  let content: string;
  try {
    content = readFileSync(mdPath, "utf8");
  } catch {
    return fragments;
  }
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (!heading) continue;
    const explicit = heading[2].match(/\{#([A-Za-z0-9_-]+)\}/);
    if (explicit) fragments.add(explicit[1].toLowerCase());
    const text = heading[2].replace(/\s*#+\s*$/, "").replace(/\{#[A-Za-z0-9_-]+\}/g, "").trim();
    fragments.add(headingSlug(text));
  }
  return fragments;
}

/**
 * Collect .md files from a directory.
 * @param dir Directory to scan
 * @param recurse Whether to recurse into subdirectories
 * @param extraSkipDirs Additional directory names to skip (merged with SKIP_DIRS)
 */
function collectMdFiles(dir: string, recurse = true, extraSkipDirs?: Set<string>): string[] {
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
      if (recurse && !SKIP_DIRS.has(entry) && !extraSkipDirs?.has(entry)) {
        files.push(...collectMdFiles(fullPath, recurse, extraSkipDirs));
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
  // v1.2.0: post-scaffold resolution allowance for template docs, applied per
  // link (whole files are never skipped). Candidate bases in resolution order;
  // see the header for rules (i)-(iv). Files outside the template docs keep
  // the plain relative-path behavior.
  const candidateBases: string[] = [mdDir];
  if (!relative(TEMPLATE_DOCS_ROOT, mdPath).startsWith("..")) {
    candidateBases.push(
      WORKSPACE_ROOT, // (ii) repo-root-relative authoring
      join(WORKSPACE_ROOT, "templates", "common"), // (iii) template delivery tree
      join(WORKSPACE_ROOT, "docs", relative(TEMPLATE_DOCS_ROOT, mdDir)), // (iv) delivered docs/ root
    );
  }
  RELATIVE_LINK_RE.lastIndex = 0;

  for (const match of content.matchAll(RELATIVE_LINK_RE)) {
    const href = match[2].trim();
    const fragment = match[3] ? match[3].slice(1) : null;
    // Skip remote URLs, empty hrefs, anchor-only refs, and example placeholders
    if (!href || isRemote(href) || href.startsWith("#") || isExamplePath(href)) continue;

    // Strip query strings and anchor fragments
    const hrefClean = href.split("?")[0].split("#")[0];
    if (!hrefClean) continue;

    totalLinks++;
    // v1.2.0: the first existing candidate in the allowance chain wins
    let target: string | null = null;
    for (const base of candidateBases) {
      const candidate = resolve(base, hrefClean);
      if (existsSync(candidate)) {
        target = candidate;
        break;
      }
    }

    if (target === null) {
      brokenLinks++;
      const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
      const msg = `  ${rel}: broken link → ${href}`;
      errors.push(msg);
      if (verbose) console.error(msg);
      continue;
    }

    // v1.1.0: verify the anchor fragment resolves against the target's headings
    if (fragment && extname(target) === ".md") {
      // D4: Check for § character in the fragment — GitHub strips it from headings
      if (fragment.includes("§")) {
        brokenLinks++;
        const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
        const correctedFragment = fragment.replace(/§/g, "");
        const msg = `  ${rel}: anchor contains '§', which GitHub strips from slugs; use #${correctedFragment} instead → ${hrefClean}#${correctedFragment}`;
        errors.push(msg);
        if (verbose) console.error(msg);
        continue;
      }
      const fragments = collectAnchorFragments(target);
      if (fragments.size > 0 && !fragments.has(fragment.toLowerCase())) {
        brokenLinks++;
        const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
        const msg = `  ${rel}: broken anchor → ${hrefClean}#${fragment} (no matching heading in target)`;
        errors.push(msg);
        if (verbose) console.error(msg);
      }
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
  // v1.2.0: also gate the common template docs (design-foundation.md et al.),
  // recursive. _examples/ is scaffold staging and skipped via
  // TEMPLATE_STAGING_SKIP; template Projects staging lives outside docs/.
  mdFiles.push(...collectMdFiles(TEMPLATE_DOCS_ROOT, true, TEMPLATE_STAGING_SKIP));
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
