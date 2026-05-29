#!/usr/bin/env bun
/**
 * Markdown Language Validation Script
 *
 * Policy: All .md files outside ko/ and locales/ko/ must contain English sentences.
 * Korean-only content is considered a violation of CONSTITUTION.md §3.
 *
 * Usage: bun run scripts/validate-md-language.ts
 * Exit codes: 0 (pass), 1 (violation found)
 */

import { glob } from "glob";
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
 * Check if file path should be excluded from English validation
 * Exempts: 1) ko/ or locales/ko/ directories, 2) Files with _ko/.ko./-ko patterns
 */
function isExcludedPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Condition 1: Directory exclusion
  if (normalizedPath.startsWith("ko/") ||
      normalizedPath.includes("/ko/") ||
      normalizedPath.startsWith("locales/ko/") ||
      normalizedPath.includes("/locales/ko/")) {
    return true;
  }

  // Condition 1.5: Individual project directories (excluded from workspace validation scope)
  if (normalizedPath.startsWith("Product-Planning/") ||
      normalizedPath.startsWith("abap_vibe_coding/")) {
    return true;
  }

  // Condition 2: Filename patterns (_ko, .ko., -ko)
  const filename = normalizedPath.split("/").pop() || "";
  return filename.includes("_ko") ||
         filename.includes(".ko.") ||
         filename.includes("-ko");
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

  // Find all .md files
  const mdFiles = await glob("**/*.md", {
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**"
    ]
  });

  const violations: Violation[] = [];

  for (const file of mdFiles) {
    if (isExcludedPath(file)) {
      continue; // Skip Korean directories
    }

    const violation = analyzeFile(file);
    if (violation) {
      violations.push(violation);
    }
  }

  // Report results
  if (violations.length === 0) {
    console.log("✅ No Korean-only markdown files found.\n");
    console.log(`   Scanned ${mdFiles.length} markdown files`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} Korean-only markdown file(s):\n`);
    violations.forEach((v) => {
      console.log(`   📄 ${v.file}`);
      console.log(`      Reason: ${v.reason}\n`);
    });
    console.log("Policy: All .md files outside ko/ and locales/ko/ must contain English sentences.");
    console.log("See: CONSTITUTION.md §3 - Mandatory English Git & PR Artifacts\n");
    process.exit(1);
  }
}

// Run validation
validateMarkdownLanguage().catch((error) => {
  console.error("Validation error:", error);
  process.exit(1);
});
