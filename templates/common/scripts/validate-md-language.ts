#!/usr/bin/env bun
// @version 1.9.0
/**
 * Markdown/YAML Language Validation Script with I18N Support
 *
 * Policy: Official documents and governance files must contain English sentences.
 * Validates only allowlisted paths: agents/, AGENTS.md, CLAUDE.md, GEMINI.md,
 * context.md, CHANGELOG.md, docs/constitution/, docs/governance/, skills/,
 * .claude/skills/, .gemini/skills/, .claude/commands/, .gemini/commands/,
 * templates/, and SECURITY.md. Both `.md` and `.yaml`/`.yml` files under these
 * paths are scanned; the `lang: ko` + `lang_reason` exception is declared in
 * `---` frontmatter for Markdown, or as a top-level `lang:`/`lang_reason:` key
 * for plain YAML files that have no frontmatter fence.
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
import { execFileSync } from "node:child_process";
import { die } from "./lib/error-handling.ts";

const _TRACKED_CO_VARIANTS: Set<string> | null = (() => {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--', 'templates/'], { encoding: 'utf-8' }).trim();
    const dirs = new Set<string>();
    if (!out) return dirs;
    for (const line of out.split('\n')) {
      const m = line.match(/^templates\/(co-[^/]+)\//);
      if (m) dirs.add(m[1]);
    }
    return dirs;
  } catch { return null; }
})();

function isCoVariantTracked(name: string): boolean {
  if (!_TRACKED_CO_VARIANTS) return true;
  return _TRACKED_CO_VARIANTS.has(name);
}

/**
 * Supported locale codes are loaded from docs/workspace-schema.json (i18n.locale_codes).
 * To add a new locale: update docs/workspace-schema.json — do NOT hardcode here.
 * If the schema file is unavailable, falls back to ['ko'] only (degraded mode,
 * with a warning) — the language policy names ko/ and locales/ko/ as translation
 * zones independent of the schema registry.
 */
// Read locale codes from workspace-schema.json (SSOT for i18n policy)
// Falls back to ['ko'] (degraded mode) if schema is unavailable
function loadSupportedLocales(): string[] {
  try {
    const schemaPath = join(dirname(import.meta.path), '..', 'docs', 'workspace-schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const codes = schema?.i18n?.locale_codes;
    if (Array.isArray(codes) && codes.length > 0) return codes;
  } catch {
    // fall through to degraded fallback
  }
  // Degraded mode (schema missing, e.g. project-local runs where the workspace
  // schema is not shipped): only 'ko' is guaranteed without the registry.
  console.warn('[validate-md-language] docs/workspace-schema.json unavailable — using degraded locale list (ko only); other translation zones will not be exempted.');
  return ['ko'];
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
 * Returns true for protected paths where lang: ko exception is never permitted —
 * core governance/routing docs that must stay single-source English regardless
 * of a project's domain. agents/*.md and skills/*.md are NOT protected: a project
 * whose real-world domain requires Korean (e.g. citing Korean building codes,
 * bilingual client-facing skill docs) may declare `lang: ko` + `lang_reason:
 * legal|source-material|proper-noun` in frontmatter, same exception mechanism
 * used everywhere else — see Stage 3 in analyzeFile().
 */
function isProtectedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() ?? '';
  if (['CLAUDE.md', 'GEMINI.md', 'CONSTITUTION.md', 'AGENTS.md'].includes(basename)) return true;
  if (basename.endsWith('.context.md')) return true;
  return false;
}

/**
 * Extract lang and lang_reason from YAML frontmatter (`---`-fenced, as used in
 * Markdown files). For plain YAML files with no fence (e.g. `schema.yaml`
 * starting directly with `schema_version:`), fall back to a top-level
 * (column-0) `lang:`/`lang_reason:` key when isPlainYaml is true.
 */
function parseLangDeclaration(content: string, isPlainYaml: boolean): { lang?: string; lang_reason?: string } {
  const fenced = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const source = fenced ? fenced[1] : (isPlainYaml ? content : null);
  if (source === null) return {};
  return {
    lang: source.match(/^lang:\s*(\S+)/m)?.[1],
    lang_reason: source.match(/^lang_reason:\s*(\S+)/m)?.[1],
  };
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
 *
 * Directory-prefixed patterns match both `.md` and `.yaml`/`.yml` files; the
 * fixed root filenames (AGENTS.md, CLAUDE.md, ...) are Markdown-only by name.
 */
function isOfficialDocument(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Allowlisted official paths
  const officialPatterns = [
    /^agents\/.*\.(md|ya?ml)$/,
    /^AGENTS\.md$/,
    /^CLAUDE\.md$/,
    /^GEMINI\.md$/,
    /^CONSTITUTION\.md$/,
    /^CHANGELOG\.md$/,
    /^SECURITY\.md$/,
    /^docs\/constitution\/.*\.(md|ya?ml)$/,
    /^docs\/governance\/.*\.(md|ya?ml)$/,
    /^skills\/.*\.(md|ya?ml)$/,
    /^\.claude\/skills\/.*\.(md|ya?ml)$/,
    /^\.claude\/commands\/.*\.(md|ya?ml)$/,
    /^\.gemini\/skills\/.*\.(md|ya?ml)$/,
    /^\.gemini\/commands\/.*\.(md|ya?ml)$/,
    /^templates\/.*\.(md|ya?ml)$/,
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
      new RegExp(`[._-]${locale}\\.(md|ya?ml)$`).test(normalized) || // README-ko.md, foo-ko.yaml
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
 * Stage 2: Protected path (core governance/routing files) → FAIL
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
        reason: "Korean content in protected path (core governance/routing file) — lang: ko exception is not permitted"
      };
    }

    // Stage 3: Frontmatter/top-level lang declaration
    const { lang, lang_reason } = parseLangDeclaration(content, /\.ya?ml$/.test(filePath));
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
  console.log("🔍 Scanning official markdown/YAML files for undeclared Korean content...\n");

  // Find all .md and .yaml/.yml files using Bun's built-in Glob API
  const globPatterns = ["**/*.md", "**/*.{yaml,yml}"];
  let allFiles: string[] = [];
  try {
    for (const pattern of globPatterns) {
      const globber = new Bun.Glob(pattern);
      allFiles.push(...await Array.fromAsync(globber.scan({ cwd: process.cwd(), onlyFiles: true })));
    }
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

  // Collect templates/<variant>/ directories whose variant.json has country_config.locales
  // Files under those variants are exempt from Korean language validation
  const variantLocaleExemptions = new Map<string, Set<string>>(); // variantDir -> Set<locale>
  try {
    const templatesDir = join(cwd, 'templates');
    if (existsSync(templatesDir)) {
      const { readdirSync } = await import('fs');
      for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const vf = join(templatesDir, entry.name, 'variant.json');
        if (!existsSync(vf)) continue;
        try {
          const vjson = JSON.parse(readFileSync(vf, 'utf-8'));
          const locales: string[] = vjson?.country_config?.locales ?? [];
          if (locales.length > 0) {
            variantLocaleExemptions.set(entry.name + '/', new Set(locales));
          }
        } catch { /* ignore parse errors */ }
      }
    }
  } catch { /* ignore scan errors */ }

  const candidateFiles = allFiles.filter((f) => {
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
    // Skip untracked template variants (WIP scaffolds on disk)
    if (normalized.startsWith("templates/co-")) {
      const afterTemplates = normalized.slice("templates/".length);
      const slashIdx = afterTemplates.indexOf('/');
      if (slashIdx > 0) {
        const variantName = afterTemplates.slice(0, slashIdx);
        if (!isCoVariantTracked(variantName)) return false;
      }
    }
    return true;
  });

  const violations: Violation[] = [];
  let officialCount = 0;

  for (const file of candidateFiles) {
    // Skip excluded paths (locales, planning docs)
    if (isExcludedPath(file)) {
      continue;
    }

    // Only validate official documents
    if (!isOfficialDocument(file)) {
      continue;
    }

    officialCount++;

    // Check variant locale exemption (templates/<variant>/ with country_config.locales)
    const normed = file.replace(/\\/g, "/");
    let variantExempt = false;
    if (normed.startsWith("templates/")) {
      const afterTemplates = normed.slice("templates/".length);
      const slashIdx = afterTemplates.indexOf('/');
      if (slashIdx > 0) {
        const variantDir = afterTemplates.slice(0, slashIdx + 1);
        const exemptLocales = variantLocaleExemptions.get(variantDir);
        if (exemptLocales?.has('ko')) {
          variantExempt = true;
        }
      }
    }
    if (variantExempt) continue;

    const violation = analyzeFile(file);
    if (violation) {
      violations.push(violation);
    }
  }

  // Report results
  if (violations.length === 0) {
    console.log("✅ No language violations in official documents.\n");
    console.log(`   Scanned ${officialCount} official markdown/YAML files (agents, governance, skills, templates)`);
    console.log(`   I18N locale files excluded: ${SUPPORTED_LOCALES.length} language codes (${SUPPORTED_LOCALES.join(", ")})`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} language violation(s) in official documents:\n`);
    violations.forEach((v) => {
      console.log(`   📄 ${v.file}`);
      console.log(`      Reason: ${v.reason}\n`);
    });
    console.log("Policy: Official documents must be in English. Korean exception requires 'lang: ko' + 'lang_reason: legal|source-material|proper-noun' in frontmatter (Markdown) or as a top-level key (plain YAML).");
    console.log("Exception NOT available for: CLAUDE.md, GEMINI.md, CONSTITUTION.md, AGENTS.md, *.context.md");
    console.log("See: CONSTITUTION.md — Language Policy Exception — Korean Legal/Regulatory Content\n");
    process.exit(1);
  }
}

// Run validation
validateMarkdownLanguage().catch((error) => {
  if (import.meta.main) {
    die(`Validation error: ${error instanceof Error ? error.message : String(error)}`, 1);
  } else {
    console.error("Validation error:", error);
  }
});
