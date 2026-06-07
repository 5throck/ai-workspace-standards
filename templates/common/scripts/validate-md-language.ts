#!/usr/bin/env bun
// @version 1.3.0
/**
 * Markdown Language Validation Script with I18N Support
 *
 * Policy: Official documents and governance files must contain English sentences.
 * Validates only allowlisted paths: agents/, AGENTS.md, CLAUDE.md, GEMINI.md,
 * CONSTITUTION.md, CHANGELOG.md, docs/constitution/, docs/governance/, skills/,
 * .claude/skills/, .gemini/skills/, .claude/commands/, .gemini/commands/,
 * templates/, and SECURITY.md.
 *
 * Excludes: memory/ logs, docs/superpowers/, docs/adr/, locale-specific files
 * for all supported I18N languages, and node_modules/.git directories.
 *
 * Locale-only content in excluded paths is acceptable. Mixed-language content
 * is acceptable in all paths.
 *
 * Reference: CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts
 *            CONSTITUTION.md §4 - Internationalization (I18N)
 *
 * Usage: bun run scripts/validate-md-language.ts
 * Exit codes: 0 (pass), 1 (violation found)
 */

import { readFileSync } from "fs";
import { join, dirname } from "node:path";

/**
 * Supported locale codes are loaded from docs/workspace-schema.json (i18n.locale_codes).
 * To add a new locale: update docs/workspace-schema.json — do NOT hardcode here.
 * Falls back to a built-in list if the schema file is unavailable.
 */
// Read locale codes from workspace-schema.json (SSOT for i18n policy)
// Falls back to a minimal default if schema is unavailable
function loadSupportedLocales(): string[] {
  try {
    const schemaPath = join(dirname(import.meta.path), '..', 'docs', 'workspace-schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const codes = schema?.i18n?.locale_codes;
    if (Array.isArray(codes) && codes.length > 0) return codes;
  } catch {
    // fall through to default
  }
  // Fallback: minimal set if schema unavailable
  return ['ko', 'ja', 'zh-CN', 'zh-TW', 'de', 'es', 'fr', 'pt', 'vi', 'ms', 'id', 'th', 'ru', 'it', 'ar'];
}

const SUPPORTED_LOCALES: string[] = loadSupportedLocales();

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
 * Check if file path is a locale-specific path for any supported I18N language.
 * Dynamically built from SUPPORTED_LOCALES to support extensibility.
 */
function isI18nLocalePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return SUPPORTED_LOCALES.some(locale => {
    return (
      normalized.endsWith(`_${locale}.md`) ||        // README_ko.md
      normalized.endsWith(`-${locale}.md`) ||        // README-ko.md
      normalized.endsWith(`.${locale}.md`) ||        // README.ko.md
      normalized.startsWith(`${locale}/`) ||         // ko/...
      normalized.includes(`/${locale}/`) ||          // .../ko/...
      normalized.startsWith(`locales/${locale}/`) || // locales/ko/...
      normalized.includes(`/locales/${locale}/`)     // .../locales/ko/...
    );
  });
}

/**
 * Check if file path should be explicitly excluded (locale files, infrastructure)
 */
function isExcludedPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // I18N: exclude locale-specific files and directories for all supported languages
  if (isI18nLocalePath(normalizedPath)) {
    return true;
  }

  // Exclude planning/draft docs (locale-only content is acceptable here)
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
    console.log("✅ No language-only violations in official documents.\n");
    console.log(`   Scanned ${officialCount} official markdown files (agents, governance, skills, templates)`);
    console.log(`   I18N locale files excluded: ${SUPPORTED_LOCALES.length} language codes (${SUPPORTED_LOCALES.join(", ")})`);
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
