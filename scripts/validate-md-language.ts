#!/usr/bin/env bun
// @version 1.1.0
/**
 * Markdown Language Validation Script
 *
 * Policy: Official documents and governance files must contain English sentences.
 * Validates only allowlisted paths: agents/, AGENTS.md, CLAUDE.md, GEMINI.md,
 * CONSTITUTION.md, CHANGELOG.md, docs/constitution/, docs/governance/, skills/,
 * .claude/skills/, .gemini/skills/, .claude/commands/, .gemini/commands/,
 * templates/, and SECURITY.md.
 *
 * Excludes: memory/ logs, docs/superpowers/, docs/adr/, locale files (_ko.md,
 * -ko.md, ko/, locales/ko/), and node_modules/.git directories.
 *
 * Korean-only content in excluded paths is acceptable. Korean+English mixed
 * content is acceptable in all paths.
 *
 * Reference: CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts
 *
 * Usage: bun run scripts/validate-md-language.ts
 * Exit codes: 0 (pass), 1 (violation found)
 */

import { readFileSync } from "fs";

// Korean character range (Hangul syllables and jamo)
const KOREAN_PATTERN = /[가-힯ᄀ-ᇿ]/;

// English sentence pattern (requires letters, spaces, and sentence punctuation)
const ENGLISH_SENTENCE_PATTERN = /[A-Za-z][A-Za-z\s,;\.!\?]{10,}/;

interface Violation {
  file: string;
  reason: string;
}

/**
 * Check if file path is an OFFICIAL document that requires English validation
 *
 * Only validates these allowlisted paths:
 * - agents/ (subdirectories)
 * - AGENTS.md, CLAUDE.md, GEMINI.md, CONSTITUTION.md, CHANGELOG.md, SECURITY.md
 * - docs/constitution/ (subdirectories)
 * - docs/governance/ (subdirectories)
 * - skills/ (subdirectories)
 * - .claude/skills/, .claude/commands/ (subdirectories)
 * - .gemini/skills/, .gemini/commands/ (subdirectories)
 * - templates/ (subdirectories)
 */
function isOfficialDocument(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Allowlisted official paths
  const officialPatterns = [
    /^agents\/.*\.md$/,
    /^AGENTS\.md$/,
    /^CLAUDE\.md$/,
    /^GEMINI\.md$/,
    /^CONSTITUTION\.md$/,
    /^CHANGELOG\.md$/,
    /^SECURITY\.md$/,
    /^docs\/constitution\/.*\.md$/,
    /^docs\/governance\/.*\.md$/,
    /^skills\/.*\.md$/,
    /^\.claude\/skills\/.*\.md$/,
    /^\.claude\/commands\/.*\.md$/,
    /^\.gemini\/skills\/.*\.md$/,
    /^\.gemini\/commands\/.*\.md$/,
    /^templates\/.*\.md$/,
  ];

  return officialPatterns.some(pattern => pattern.test(normalizedPath));
}

/**
 * Check if file path should be explicitly excluded (locale files, infrastructure)
 */
function isExcludedPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Exclude locale-specific files
  if (normalizedPath.includes("_ko.md") ||
      normalizedPath.includes("-ko.md") ||
      normalizedPath.startsWith("ko/") ||
      normalizedPath.includes("/ko/") ||
      normalizedPath.startsWith("locales/ko/") ||
      normalizedPath.includes("/locales/ko/")) {
    return true;
  }

  // Exclude planning/draft docs
  if (normalizedPath.startsWith("docs/superpowers/") ||
      normalizedPath.startsWith("docs/adr/")) {
    return true;
  }

  return false;
}

/**
 * Analyze file content for language violations
 */
function analyzeFile(filePath: string): Violation | null {
  try {
    const content = readFileSync(filePath, "utf-8");

    // Remove code blocks and inline code from analysis
    const contentWithoutCode = content.replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, ""); // Remove markdown links

    // Check for Korean characters
    const hasKorean = KOREAN_PATTERN.test(contentWithoutCode);

    // Check for English sentences
    const hasEnglish = ENGLISH_SENTENCE_PATTERN.test(contentWithoutCode);

    // Violation: Korean-only content (has Korean but no English)
    if (hasKorean && !hasEnglish) {
      return {
        file: filePath,
        reason: "Korean-only content detected (no English sentences found)"
      };
    }

    return null;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Main validation function
 */
async function validateMarkdownLanguage(): Promise<void> {
  console.log("🔍 Scanning for Korean-only markdown files...\n");

  // Find all .md files using Bun's built-in Glob API
  const globber = new Bun.Glob("**/*.md");
  const allFiles = await Array.fromAsync(globber.scan({ cwd: process.cwd(), onlyFiles: true }));
  const mdFiles = allFiles.filter((f) => {
    const normalized = f.replace(/\\/g, "/");
    return !normalized.includes("node_modules/") &&
           !normalized.includes(".git/") &&
           !normalized.includes("dist/") &&
           !normalized.includes("build/");
  });

  const violations: Violation[] = [];
  let officialCount = 0;

  for (const file of mdFiles) {
    // Skip excluded paths (locales, planning docs)
    if (isExcludedPath(file)) {
      continue;
    }

    // Only validate official documents
    if (!isOfficialDocument(file)) {
      continue;
    }

    officialCount++;
    const violation = analyzeFile(file);
    if (violation) {
      violations.push(violation);
    }
  }

  // Report results
  if (violations.length === 0) {
    console.log("✅ No Korean-only violations in official documents.\n");
    console.log(`   Scanned ${officialCount} official markdown files (agents, governance, skills, templates)`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} Korean-only violation(s) in official documents:\n`);
    violations.forEach((v) => {
      console.log(`   📄 ${v.file}`);
      console.log(`      Reason: ${v.reason}\n`);
    });
    console.log("Policy: Official documents (agents, governance, skills, templates, etc.) must contain English sentences.");
    console.log("See: CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts\n");
    process.exit(1);
  }
}

// Run validation
validateMarkdownLanguage().catch((error) => {
  console.error("Validation error:", error);
  process.exit(1);
});
