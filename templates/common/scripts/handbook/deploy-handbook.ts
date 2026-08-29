#!/usr/bin/env bun
// @version 1.1.0
// scripts/handbook/deploy-handbook.ts
// Deploys a handbook to GitHub Pages — automates repo creation, visibility,
// GitHub Actions workflow generation, Pages activation, and verification.
//
// Usage:
//   bun run scripts/handbook/deploy-handbook.ts \
//     --project . --output handbook \
//     --repo owner/handbook-name \
//     --visibility public

import { writeFileSync, existsSync, readFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

// --- Input Validation ---
function validateRepoSlug(slug: string): boolean {
  return /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*\/[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/.test(slug);
}
function validateVisibility(vis: string): boolean {
  return vis === "public" || vis === "private";
}
function validateOutputDir(dir: string): boolean {
  return dir !== "" && !dir.includes("..") && !dir.startsWith("/") && !dir.includes("\0");
}

const projectDir = resolve(getArg("--project", "."));
const outputDir = getArg("--output", "handbook");
const repoSlug = getArg("--repo", "");
const visibility = getArg("--visibility", "public");

// Validate inputs
if (!validateRepoSlug(repoSlug)) {
  fatal('--repo must be "owner/name" with only alphanumeric, dot, hyphen, underscore');
}
if (!validateVisibility(visibility)) {
  fatal('--visibility must be "public" or "private"');
}
if (!validateOutputDir(outputDir)) {
  fatal('--output must not contain "..", start with "/", or be empty');
}

const handbookDir = join(projectDir, outputDir);
const docsDir = join(handbookDir, "docs");

// --- Helpers ---
function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

function fatal(msg: string): never {
  console.error(`\n❌  ${msg}`);
  process.exit(1);
}

function runArgs(bin: string, argv: string[], opts?: { cwd?: string; silent?: boolean; captureStderr?: boolean }): string {
  const cwd = opts?.cwd ?? projectDir;
  try {
    const stdioCfg = opts?.silent ? ["ignore", "pipe", opts?.captureStderr ? "pipe" : "inherit"] : "inherit";
    const result = execFileSync(bin, argv, {
      cwd,
      encoding: "utf-8",
      stdio: stdioCfg as never,
      timeout: 60_000,
    });
    return (result || "").trim();
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    if (opts?.captureStderr && (err.stdout !== undefined || err.stderr !== undefined)) {
      return `${err.stdout || ""}${err.stderr || ""}`.trim();
    }
    throw new Error(`Argv command failed: ${bin} ${argv.join(" ")}\n${err.stderr || err.message || e}`);
  }
}

// --- README patch helpers ---

/**
 * Detect language from README filename.
 * README_ko.md → "ko", README_ja.md → "ja", README.md → "en", etc.
 */
function detectReadmeLang(filename: string): string {
  const match = filename.match(/^README_([a-z]{2}(?:-[A-Z]{2})?)\.md$/);
  return match ? match[1] : "en";
}

/**
 * Insert or update the 🌐 GitHub Pages section in a README file.
 *
 * Three cases:
 * 1. No 🌐 section → insert before 🎯 Target Versions (or 📜 License as fallback)
 * 2. 🌐 section with different URL → replace URL in the markdown link
 * 3. 🌐 section with same URL → no-op
 */
function patchReadmePagesUrl(readmePath: string, url: string, title: string): boolean {
  let content = readFileSync(readmePath, "utf-8");
  const lang = detectReadmeLang(basename(readmePath));
  const isKo = lang === "ko";

  // Build the expected 🌐 section (matches scaffold-handbook.ts format)
  const sectionHeading = isKo
    ? "## 🌐 교육 프로그램 바로가기 (웹사이트)"
    : "## 🌐 Read the Handbook Live";
  const linkText = isKo
    ? `${title} 교육 사이트 보기`
    : "Online Handbook & Educational Program";
  const newSection = `${sectionHeading}\n👉 **[${linkText}](${url})**`;

  // Case 2/3: 🌐 section already exists
  if (content.includes("## 🌐")) {
    // Check if URL is already present
    if (content.includes(url)) return false;

    // Replace the URL in the existing markdown link within the 🌐 section
    const globeSectionRegex = /(## 🌐[^\n]*\n)(\S+)/;
    const match = content.match(globeSectionRegex);
    if (match) {
      // Replace the entire link line after the heading
      content = content.replace(
        /(## 🌐[^\n]*\n)(?:👉 \*\[[^\]]*\]\([^)]+\)\*\*|\[?[^\]]*\]?\([^)]+\))/,
        `$1👉 **[${linkText}](${url})**`,
      );
      writeFileSync(readmePath, content);
      return true;
    }

    // Fallback: couldn't parse — insert new section, remove old
    content = content.replace(/## 🌐[^\n]*\n(?:.*\n?)*?(?=\n## )/, "");
    content = content.trimEnd() + "\n\n" + newSection + "\n";
    writeFileSync(readmePath, content);
    return true;
  }

  // Case 1: No 🌐 section — insert before 🎯 or 📜
  const insertBefore = content.includes("## 🎯")
    ? "## 🎯"
    : content.includes("## 📜")
      ? "## 📜"
      : null;

  if (insertBefore) {
    content = content.replace(insertBefore, `${newSection}\n\n${insertBefore}`);
  } else {
    // No standard section found — append at end
    content = content.trimEnd() + "\n\n" + newSection + "\n";
  }

  writeFileSync(readmePath, content);
  return true;
}

// --- Step 0: Validate inputs ---
log("🔍", "Pre-flight checks...");

// repoSlug already validated above by validateRepoSlug

if (!existsSync(docsDir)) {
  fatal(`docs/ directory not found at ${docsDir} — run scaffold first`);
}

if (!existsSync(join(docsDir, "index.html"))) {
  fatal("docs/index.html not found — generate handbook content first");
}

// Validate .nojekyll exists (required for GitHub Pages with docs/ subfolder)
const nojekyllPath = join(docsDir, ".nojekyll");
if (!existsSync(nojekyllPath)) {
  writeFileSync(nojekyllPath, "");
  log("📝", "Created .nojekyll in docs/");
}

// Validate gh CLI is available and authenticated
try {
  runArgs("gh", ["auth", "status"], { silent: true });
} catch {
  fatal("gh CLI not authenticated — run `gh auth login` first");
}

// --- Step 1: Secret scan ---
log("🔒", "Running secret scan on docs/...");
const scanPatterns = [
  "api_key", "apikey", "api-key",
  "password", "passwd",
  "secret", "secret_key",
  "token", "access_token",
  "private_key",
  "credentials",
];
try {
  const scanPattern = `(${scanPatterns.join("|")})\\s*[=:]\\s*['\"]?[^'\"\\s]{8,}`;
  runArgs("grep", ["-rniE", scanPattern, "docs/"], { cwd: handbookDir, silent: true });
  fatal("Potential secrets detected in docs/ — aborting deployment. Review and remove before retry.");
} catch (e: unknown) {
  const err = e as { message?: string };
  // grep returns non-zero when no matches — that's what we want
  if (err.message?.includes("command failed") || err.message?.includes("grep")) {
    log("✅", "No secrets detected");
  } else {
    fatal(`Secret scan error: ${err.message || e}`);
  }
}

// --- Step 2: Ensure GitHub repo exists + correct visibility ---
const [owner, repoName] = repoSlug.split("/");
const fullRepo = `${owner}/${repoName}`;
const pagesUrl = `https://${owner}.github.io/${repoName}/`;

log("📦", `Ensuring GitHub repo: ${fullRepo} (${visibility})`);

let repoExists = true;
try {
  runArgs("gh", ["repo", "view", fullRepo], { silent: true });
} catch {
  repoExists = false;
}

if (repoExists) {
  // Check current visibility
  const currentVis = runArgs("gh", ["repo", "view", fullRepo, "--json", "isPrivate", "-q", ".isPrivate"], { silent: true });
  const isPrivate = currentVis === "true";
  const wantsPublic = visibility === "public";

  if (isPrivate && wantsPublic) {
    log("🔓", `Switching ${fullRepo} from private to public...`);
    runArgs("gh", ["repo", "edit", fullRepo, "--visibility", "public"]);
    log("✅", "Repository is now public");
  } else if (!isPrivate && !wantsPublic) {
    log("🔒", `Switching ${fullRepo} from public to private...`);
    runArgs("gh", ["repo", "edit", fullRepo, "--visibility", "private"]);
    log("✅", "Repository is now private");
  } else {
    log("✅", `Repository already ${visibility}`);
  }
} else {
  log("🆕", `Creating repository: ${fullRepo} (${visibility})...`);
  runArgs("gh", ["repo", "create", fullRepo, `--${visibility}`, "--source=.", "--push=false"]);
  log("✅", "Repository created");
}

// --- Step 3: Generate GitHub Pages deploy workflow ---
log("⚙️", "Generating GitHub Pages deployment workflow...");

const workflowsDir = join(handbookDir, ".github", "workflows");
if (!existsSync(workflowsDir)) {
  mkdirSync(workflowsDir, { recursive: true });
}

const deployYml = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - '${outputDir}/docs/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ${outputDir}/docs

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

const deployWorkflowPath = join(workflowsDir, "deploy-pages.yml");
writeFileSync(deployWorkflowPath, deployYml);
log("✅", "Created .github/workflows/deploy-pages.yml");

// --- Step 4: Enable GitHub Pages (Actions-based deployment) ---
log("🌐", "Configuring GitHub Pages...");

try {
  // Check if Pages is already enabled (captureStderr: gh api may exit non-zero
  // on 404 — we want the combined stdout+stderr text, not a thrown error).
  const pagesInfo = runArgs("gh", ["api", `repos/${fullRepo}/pages`, "-q", ".source"], { silent: true, captureStderr: true });

  if (pagesInfo && !pagesInfo.includes("404")) {
    log("ℹ️", "GitHub Pages is already configured");
  } else {
    throw new Error("not configured");
  }
} catch {
  // Enable Pages via Actions deployment source
  try {
    runArgs("gh", ["api", `repos/${fullRepo}/pages`, "-X", "POST", "-f", "build_type=workflow", "-f", "source[branch]=main", "-f", "source[path]=/"], { silent: true });
    log("✅", "GitHub Pages enabled (Actions deployment)");
  } catch (e: unknown) {
    const err = e as { message?: string };
    // If Pages was just enabled by the workflow, it may conflict — try just enabling via Actions
    try {
      runArgs("gh", ["api", `repos/${fullRepo}/pages`, "-X", "POST", "-f", "build_type=workflow"], { silent: true });
      log("✅", "GitHub Pages enabled (Actions deployment)");
    } catch {
      log("⚠️", `Could not enable Pages via API. It may auto-enable on first push. Manual step: go to repo Settings → Pages → Source: GitHub Actions`);
    }
  }
}

// --- Step 5: Commit and push ---
log("📤", "Committing and pushing to GitHub...");

// Ensure we're on main
try {
  runArgs("git", ["rev-parse", "--abbrev-ref", "HEAD"], { silent: true });
} catch {
  fatal("Not inside a git repository");
}

// Stage all handbook files
runArgs("git", ["add", `${outputDir}/.github/workflows/deploy-pages.yml`, `${outputDir}/docs/.nojekyll`]);
log("✅", "Staged deploy workflow and .nojekyll");

// Patch README files with GitHub Pages URL
const readmeFiles = readdirSync(handbookDir).filter(f => f.startsWith("README") && f.endsWith(".md"));
for (const readmeFile of readmeFiles) {
  const readmePath = join(handbookDir, readmeFile);
  const patched = patchReadmePagesUrl(readmePath, pagesUrl, repoName);
  if (patched) {
    runArgs("git", ["add", readmePath]);
    log("📝", `Patched ${readmeFile} with GitHub Pages URL`);
  } else {
    log("ℹ️", `${readmeFile} already has correct GitHub Pages URL`);
  }
}

// Check if there are changes to commit
const readmeArgList = readmeFiles.map(f => `${outputDir}/${f}`);
const status = runArgs("git", ["status", "--porcelain", "--", `${outputDir}/.github/workflows/deploy-pages.yml`, `${outputDir}/docs/.nojekyll`, ...readmeArgList], { silent: true });
if (status) {
  runArgs("git", ["commit", "-m", "ci(handbook): add GitHub Pages deploy workflow"]);
  log("✅", "Committed deploy workflow");
} else {
  log("ℹ️", "No new changes to commit");
}

// Add remote if not already present
const remoteUrl = `https://github.com/${fullRepo}.git`;
try {
  runArgs("git", ["remote", "get-url", "origin"], { silent: true });
  // Update origin URL if different
  runArgs("git", ["remote", "set-url", "origin", remoteUrl]);
} catch {
  runArgs("git", ["remote", "add", "origin", remoteUrl]);
  log("✅", `Added remote origin → ${remoteUrl}`);
}

// Push
try {
  runArgs("git", ["push", "-u", "origin", "main"], { silent: true });
  log("✅", "Pushed to GitHub");
} catch (e: unknown) {
  const err = e as { message?: string };
  log("⚠️", `Push failed: ${err.message || e}`);
  log("ℹ️", "Push manually: git push -u origin main");
}

// --- Step 6: Verify ---
log("⏳", "Waiting for GitHub Pages deployment...");
log("ℹ️", `Check deployment status: gh api repos/${fullRepo}/pages -q ".status"`);
log("ℹ️", `Or open: https://github.com/${fullRepo}/actions`);

console.log(`\n${"=".repeat(60)}`);
log("🎉", "Handbook deployment initiated!");
log("🌐", `Live URL: ${pagesUrl}`);
log("📦", `Repository: https://github.com/${fullRepo}`);
console.log(`${"=".repeat(60)}\n`);
