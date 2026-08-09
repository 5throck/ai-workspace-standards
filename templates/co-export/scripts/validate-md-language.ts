#!/usr/bin/env bun
// @version 1.4.4
/**
 * Markdown Language Validation Script with I18N Support
 *
 * Policy: Official documents and governance files must contain English sentences.
 * Validates only allowlisted paths: agents/, AGENTS.md, CLAUDE.md, GEMINI.md,
 * context.md, CHANGELOG.md, docs/constitution/, docs/governance/, skills/,
 * .claude/skills/, .gemini/skills/, .claude/commands/, .gemini/commands/,
 * templates/, and SECURITY.md.
 *
 * Excludes: memory/ logs, docs/designs/, docs/adr/, locale-specific files
 * for all supported I18N languages, and node_modules/.git directories.
 *
 * Locale-only content in excluded paths is acceptable. Mixed-language content
 * is acceptable in all paths.
 *
 * Reference: context.md §3 - Mandatory English Git & PR Artifacts
 *            context.md §4 - Internationalization (I18N)
 *
 * Usage: bun run scripts/validate-md-language.ts
 * Exit codes: 0 (pass), 1 (violation found)
 */

import { readFileSync, existsSync } from "fs";
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

// Permitted lang_reason values for Korean exception declarations
const ALLOWED_LANG_REASONS = ['legal', 'source-material', 'proper-noun'] as const;

interface Violation {
  file: string;
  reason: string;
}

/**
 * Returns true for protected paths where lang: ko exception is never permitted.
 */
function isProtectedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() ?? '';
  if (['CLAUDE.md', 'GEMINI.md', 'context.md', 'AGENTS.md'].includes(basename)) return true;
  if (basename.endsWith('.context.md')) return true;
  return [
    /(?:^|\/)agents\/[^/]+\.md$/,
    /(?:^|\/)skills\/.*\.md$/,
  ].some(p => p.test(normalized));
}

/**
 * Extract lang and lang_reason from YAML frontmatter.
 */
function parseFrontmatterLang(content: string): { lang?: string; lang_reason?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = match[1];
  const lang = /^lang:\s*(\S+)/m.exec(fm)?.[1];
  const lang_reason = /^lang_reason:\s*(\S+)/m.exec(fm)?.[1];
  return { lang, lang_reason };
}

/**
 * Check if file path is an OFFICIAL document that requires English validation
 *
 * Only validates these allowlisted paths:
 * - agents/ (subdirectories)
 * - AGENTS.md, CLAUDE.md, GEMINI.md, context.md, CHANGELOG.md, SECURITY.md
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
  if (normalizedPath.startsWith("docs/designs/") ||
      normalizedPath.startsWith("docs/adr/")) {
    return true;
  }

  return false;
}

/**
 * Analyze file content for language violations using 4-stage judgment.
 *
 * Stage 1 (exception folder) is handled upstream by isExcludedPath / isOfficialDocument.
 * Stage 2: Protected path (agents/, skills/, governance files) → FAIL
 * Stage 3: lang: ko frontmatter → PASS+INFO (valid reason) or FAIL (missing/invalid)
 * Stage 4: No declaration → FAIL
 */
function analyzeFile(filePath: string): Violation | null {
  try {
    const content = readFileSync(filePath, "utf-8");

    // Remove code blocks and inline code from analysis
    const contentWithoutCode = content.replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "");

    const hasKorean = KOREAN_PATTERN.test(contentWithoutCode);
    if (!hasKorean) return null;

    // Stage 2: Protected path — no exception permitted
    if (isProtectedPath(filePath)) {
      return {
        file: filePath,
        reason: "Korean content in protected path (agents/, skills/, or governance file) — lang: ko exception is not permitted"
      };
    }

    // Stage 3: Frontmatter lang declaration
    const { lang, lang_reason } = parseFrontmatterLang(content);
    if (lang === 'ko') {
      if (lang_reason && (ALLOWED_LANG_REASONS as readonly string[]).includes(lang_reason)) {
        console.log(`   ℹ️  [INFO] Korean exception granted: ${filePath} (lang_reason: ${lang_reason})`);
        return null;
      }
      return {
        file: filePath,
        reason: `lang: ko declared but lang_reason is ${lang_reason ? `invalid ("${lang_reason}")` : 'missing'} — must be one of: ${ALLOWED_LANG_REASONS.join(' | ')}`
      };
    }

    // Stage 4: Korean without declaration
    return {
      file: filePath,
      reason: "Korean content detected without lang: ko declaration"
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Main validation function
 */
async function validateMarkdownLanguage(): Promise<void> {
  console.log("🔍 Scanning official markdown files for undeclared Korean content...\n");

  // Find all .md files using Bun's built-in Glob API
  const globber = new Bun.Glob("**/*.md");
  let allFiles: string[] = [];
  try {
    allFiles = await Array.fromAsync(globber.scan({ cwd: process.cwd(), onlyFiles: true }));
  } catch (err) {
    // On Windows, scaffold test directories may have EPERM; collect files that are accessible
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EPERM' && code !== 'EACCES') throw err;
    console.warn(`⚠️  Glob scan encountered permission error (${code}) — some directories may be skipped`);
  }
  // Collect root-level generated project directories (have AGENTS.md or variant.json)
  // to exclude their contents from scanning — they are separate projects, not workspace governance.
  const cwd = process.cwd();
  const rootProjectDirs = new Set<string>();
  try {
    const { readdirSync, statSync } = await import("fs");
    for (const entry of readdirSync(cwd, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(cwd, entry.name);
      if (existsSync(join(fullPath, 'AGENTS.md')) || existsSync(join(fullPath, 'variant.json'))) {
        rootProjectDirs.add(entry.name + '/');
      }
    }
  } catch { /* ignore scan errors */ }

  const mdFiles = allFiles.filter((f) => {
    const normalized = f.replace(/\\/g, "/");
    if (normalized.includes("node_modules/") ||
        normalized.includes(".git/") ||
        normalized.includes("dist/") ||
        normalized.includes("build/") ||
        normalized.startsWith("test-project/")) return false;
    // Exclude root-level generated project directories
    for (const dir of rootProjectDirs) {
      if (normalized.startsWith(dir)) return false;
    }
    return true;
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
    console.log("✅ No language violations in official documents.\n");
    console.log(`   Scanned ${officialCount} official markdown files (agents, governance, skills, templates)`);
    console.log(`   I18N locale files excluded: ${SUPPORTED_LOCALES.length} language codes (${SUPPORTED_LOCALES.join(", ")})`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} language violation(s) in official documents:\n`);
    violations.forEach((v) => {
      console.log(`   📄 ${v.file}`);
      console.log(`      Reason: ${v.reason}\n`);
    });
    console.log("Policy: Official documents must be in English. Korean exception requires 'lang: ko' + 'lang_reason: legal|source-material|proper-noun' in frontmatter.");
    console.log("Exception NOT available for: agents/, skills/, CLAUDE.md, GEMINI.md, context.md, AGENTS.md, *.context.md");
    console.log("See: context.md — Language Policy Exception — Korean Legal/Regulatory Content\n");
    process.exit(1);
  }
}

// Run validation
validateMarkdownLanguage().catch((error) => {
  console.error("Validation error:", error);
  if (import.meta.main) {
    process.exit(1);
  }
});
