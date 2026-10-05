#!/usr/bin/env bun
// @version 1.5.0
// @description Scans workspace Markdown files for broken relative file links.
//              Invoked by dev-sync.ts as a pre-flight link validation gate and
//              spawned by audit.ts as the docs relative-link gate.
//              By default scans docs/ root level files only (no subdirectories)
//              PLUS templates/common/docs/ recursively (v1.2.0).
//              The docs/ subdirectories have many historical cross-references that
//              are managed by the validate-doc-folder.ts validator separately.
//              Use --dir to scan a specific directory, --all to scan all of docs/.
//
//              v1.5.0 (template-quality batch 3, T-20261005-019): --all now also
//              walks templates/<variant>/docs/** (default scope unchanged).
//              Variant-doc links get the same per-link post-scaffold resolution
//              allowance as common (rules (i)-(iv), generalized from the
//              templates/common/docs tree to any templates/<name>/docs tree),
//              plus a common-delivered allowlist — links that only resolve once
//              the scaffold delivers their target (docs/context.md,
//              docs/governance/**, docs/VERSION_MANIFEST.md, CLAUDE.md,
//              GEMINI.md, .env.sample at the template root) are skipped. Links
//              still unresolved are WARNINGS, never errors: variant content is
//              remediated by fleet agents and scaffold delivery differs per
//              variant — flag-then-report, don't gate.
//
//              v1.3.0 (T-20260927-018): fenced code blocks are dropped before
//              link matching. Code samples legitimately contain non-links —
//              template placeholders like ${entry.file} inside Markdown-link
//              syntax — that the relative-link regex flagged as broken. Fence
//              semantics match collectAnchorFragments (``` / ~~~ toggles).
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
import { join, resolve, dirname, extname, relative, sep, basename } from "path";

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

// v1.5.0: common-delivered links — targets the scaffold delivers post-scaffold
// (l0-ref/scaffold delivery rules), so a template doc referencing them is not
// broken even though the file is absent from the template tree. Matched on the
// link's resolved location relative to its template root. Anything outside this
// list that still fails resolution is a warning, never an error ("when unsure,
// warn not error").
function isCommonDeliveredPath(templateRoot: string, mdDir: string, hrefClean: string): boolean {
  const relToTpl = relative(templateRoot, resolve(mdDir, hrefClean)).split(sep).join("/");
  if (relToTpl.startsWith("..")) return false;
  return (
    relToTpl === "docs/context.md" ||
    relToTpl === "docs/VERSION_MANIFEST.md" ||
    relToTpl.startsWith("docs/governance/") ||
    relToTpl === "CLAUDE.md" ||
    relToTpl === "GEMINI.md" ||
    relToTpl === ".env.sample"
  );
}

/**
 * v1.5.0: the templates/<name> root when `mdPath` lives under
 * templates/<name>/docs/, else null. Generalizes the v1.2.0 common-only
 * allowance to every template's docs tree (the templates/common behavior —
 * bases and error semantics — is unchanged by the generalization).
 */
function templateDocsOwner(mdPath: string): string | null {
  const rel = relative(join(WORKSPACE_ROOT, "templates"), mdPath);
  if (rel.startsWith("..") || rel === "") return null;
  const parts = rel.split(sep);
  if (parts.length < 3 || parts[1] !== "docs") return null; // <name>/docs/<file...>
  return join(WORKSPACE_ROOT, "templates", parts[0]);
}

// Link pattern: [text](path#fragment) — captures relative paths plus their
// optional anchor fragment (v1.1.0 verifies fragments; not http/https/mailto/#-only anchors)
const RELATIVE_LINK_RE = /\[([^\]]*)\]\(([^)#\s]+)(#[^)\s]+)?\)/g;

let totalFiles = 0;
let totalLinks = 0;
let brokenLinks = 0;
const errors: string[] = [];
// v1.5.0: variant template-docs findings under --all are informational.
const templateDocWarnings: string[] = [];

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
 * v1.3.0 (T-20260927-018): drop fenced code blocks before link matching. Code
 * samples carry Markdown-link syntax that is documentation, not navigation —
 * template placeholders like ${entry.file} would otherwise be flagged broken.
 * Fence semantics match collectAnchorFragments (``` / ~~~ toggles).
 */
function stripFencedBlocks(content: string): string {
  const kept: string[] = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line);
  }
  // T-20261003-015: also drop INLINE code spans — CHANGELOG history quotes link SYNTAX
  // inside backticks (e.g. the A-6 rule's `](docs/context.md)` rewrite), which is prose
  // about links, never a live link. Strip after fence removal; a span cannot cross lines.
  return kept
    .join("\n")
    .split("\n")
    .map((line) => line.replace(/`[^`]*`/g, (span) => " ".repeat(span.length)))
    .join("\n");
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
  // see the header for rules (i)-(iv). v1.5.0 generalizes the allowance from
  // the templates/common/docs tree to every templates/<name>/docs tree — the
  // common behavior (same bases, error semantics) is unchanged. Files outside
  // any template docs keep the plain relative-path behavior.
  const templateRoot = templateDocsOwner(mdPath);
  // Variant template docs (all but common): under --all their unresolved links
  // are warnings, and common-delivered links are skipped (delivery allowance).
  const isVariantDocs = templateRoot !== null && basename(templateRoot) !== "common";
  const candidateBases: string[] = [mdDir];
  if (templateRoot !== null) {
    const docsRel = relative(join(templateRoot, "docs"), mdDir);
    candidateBases.push(
      WORKSPACE_ROOT, // (ii) repo-root-relative authoring
      templateRoot, // (iii) template delivery tree
      join(WORKSPACE_ROOT, "docs", docsRel), // (iv) delivered docs/ root
    );
  }
  RELATIVE_LINK_RE.lastIndex = 0;

  for (const match of stripFencedBlocks(content).matchAll(RELATIVE_LINK_RE)) {
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
      const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
      // v1.5.0: variant template docs — allowance-listed deliveries are skipped,
      // anything else is a warning (never an error).
      if (isVariantDocs && templateRoot !== null) {
        if (isCommonDeliveredPath(templateRoot, mdDir, hrefClean)) continue;
        const msg = `  WARN ${rel}: template-doc link does not resolve pre-scaffold → ${href} (post-scaffold delivery or stale — verify manually)`;
        templateDocWarnings.push(msg);
        if (verbose) console.error(msg);
        continue;
      }
      brokenLinks++;
      const msg = `  ${rel}: broken link → ${href}`;
      errors.push(msg);
      if (verbose) console.error(msg);
      continue;
    }

    // v1.1.0: verify the anchor fragment resolves against the target's headings
    if (fragment && extname(target) === ".md") {
      // D4: Check for § character in the fragment — GitHub strips it from headings
      if (fragment.includes("§")) {
        const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
        const correctedFragment = fragment.replace(/§/g, "");
        const msg = `  ${rel}: anchor contains '§', which GitHub strips from slugs; use #${correctedFragment} instead → ${hrefClean}#${correctedFragment}`;
        if (isVariantDocs) {
          templateDocWarnings.push(`  WARN${msg.replace(/^  /, " ")}`);
          if (verbose) console.error(`  WARN${msg.replace(/^  /, " ")}`);
        } else {
          brokenLinks++;
          errors.push(msg);
          if (verbose) console.error(msg);
        }
        continue;
      }
      const fragments = collectAnchorFragments(target);
      if (fragments.size > 0 && !fragments.has(fragment.toLowerCase())) {
        const rel = mdPath.replace(WORKSPACE_ROOT + "\\", "").replace(WORKSPACE_ROOT + "/", "");
        const msg = `  ${rel}: broken anchor → ${hrefClean}#${fragment} (no matching heading in target)`;
        if (isVariantDocs) {
          templateDocWarnings.push(`  WARN${msg.replace(/^  /, " ")}`);
          if (verbose) console.error(`  WARN${msg.replace(/^  /, " ")}`);
        } else {
          brokenLinks++;
          errors.push(msg);
          if (verbose) console.error(msg);
        }
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
  // v1.5.0 (template-quality batch 3, T-20261005-019): --all also walks
  // templates/<variant>/docs/** — with the post-scaffold allowance, the
  // common-delivered allowlist, and warning-only semantics (see header).
  // Default scope is unchanged; templates/common/docs stays in the default
  // (error-semantics) scope via the branch below.
  const templatesDir = join(WORKSPACE_ROOT, "templates");
  let templateEntries: string[] = [];
  try {
    templateEntries = readdirSync(templatesDir);
  } catch {
    /* no templates dir */
  }
  for (const entry of templateEntries) {
    if (entry === "common") continue; // already gated with error semantics in the default scope
    const docsDir = join(templatesDir, entry, "docs");
    if (existsSync(docsDir)) {
      mdFiles.push(...collectMdFiles(docsDir, true, TEMPLATE_STAGING_SKIP));
    }
  }
} else {
  // Default: docs/ root level files only (no subdirectories)
  // Subdirectories like adr/, designs/, architecture/ have many historical
  // cross-references managed separately by validate-doc-folder.ts
  mdFiles = collectMdFiles(join(WORKSPACE_ROOT, "docs"), false);
  // v1.2.0: also gate the common template docs (design-foundation.md et al.),
  // recursive. _examples/ is scaffold staging and skipped via
  // TEMPLATE_STAGING_SKIP; template Projects staging lives outside docs/.
  mdFiles.push(...collectMdFiles(TEMPLATE_DOCS_ROOT, true, TEMPLATE_STAGING_SKIP));
  // T-20261003-015 (2026-10-03 review, standards M3): CHANGELOG entries cite docs/
  // paths and a dead one (the team-gateway QA review) had survived since 2026-09-27
  // because the ledger sat outside every scan scope. Its links resolve relative to
  // the workspace root, same as docs/-root files.
  const changelog = join(WORKSPACE_ROOT, "CHANGELOG.md");
  if (existsSync(changelog)) mdFiles.push(changelog);
}

if (verbose) console.log(`🔍 Scanning ${mdFiles.length} markdown file(s) for broken links...\n`);

for (const f of mdFiles) {
  checkFile(f);
}

// v1.5.0: variant template-docs findings are informational — printed, never
// gated on (the exit code below depends only on brokenLinks).
if (templateDocWarnings.length > 0) {
  console.error(
    `\n⚠️  ${templateDocWarnings.length} template-docs link warning(s) in --all scope (informational, not gated):\n`
  );
  for (const w of templateDocWarnings) console.error(w);
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
  if (!verbose && templateDocWarnings.length > 0) {
    console.error(`\n✅ 0 broken links in ${totalFiles} markdown file(s) (${templateDocWarnings.length} template-docs warning(s) above; informational).`);
  }
  process.exit(0);
}
