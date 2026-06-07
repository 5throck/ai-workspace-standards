#!/usr/bin/env -S bun
/**
 * YAML Frontmatter Merger for Template Files
 * @version 1.1.0
 *
 * Handles two patterns:
 * 1. `extends` pattern: Variant file with `extends: path/to/skeleton.md`
 * 2. VARIANT-SECTION pattern: Marker-based section substitution
 *
 * Integrated with ADR-0033 circular reference prevention via extends-validator.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, normalize } from 'path';
import { load, dump } from 'js-yaml';
import { safeValidateExtends, ExtendsValidationResult } from './extends-validator.js';

interface Frontmatter {
  extends?: string;
  [key: string]: any;
}

interface ParsedFile {
  frontmatter: Frontmatter;
  content: string;
  raw: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): ParsedFile {
  // Match frontmatter with optional content body
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: content.trim(), raw: content };
  }

  try {
    const frontmatter = load(match[1]) as Frontmatter;
    return {
      frontmatter,
      content: match[2] ? match[2].trim() : '',
      raw: content
    };
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    return { frontmatter: {}, content: content, raw: content };
  }
}

/**
 * Merge frontmatter from skeleton and variant
 */
function mergeFrontmatter(
  skeletonFrontmatter: Frontmatter,
  variantFrontmatter: Frontmatter
): Frontmatter {
  const merged = { ...skeletonFrontmatter };

  for (const key of Object.keys(variantFrontmatter)) {
    if (key === 'extends') continue; // Skip template directive (not included in final output)
    merged[key] = variantFrontmatter[key];
  }

  // Remove extends field from final merged result if it exists
  delete (merged as any).extends;

  return merged;
}

/**
 * Process a single file with `extends` directive
 * @param filePath - Path to the variant file
 * @param explicitSkeletonPath - Optional absolute path to skeleton (resolves extends field before copy)
 */
function processFile(filePath: string, explicitSkeletonPath?: string): string {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    return content; // No extends directive, return as-is
  }

  // ADR-0033: Validate extends chain before processing
  console.log(`🔍 Validating extends chain for: ${absolutePath}`);
  const validationResult: ExtendsValidationResult = safeValidateExtends(absolutePath);

  if (!validationResult.valid) {
    // Safe fallback behavior per ADR-0033
    console.error(`❌ Extends validation failed: ${validationResult.message}`);
    console.error(`   Error type: ${validationResult.error_type}`);
    console.error(`   Current value: ${validationResult.current_value}`);
    console.error(`   Limit: ${validationResult.limit}`);
    console.error(`   Chain: ${validationResult.chain.join(' → ')}`);
    console.warn(`⚠️  Falling back to safe default: returning original content without extends resolution`);

    // Safe fallback: return original content without crash
    return content;
  }

  console.log(`✅ Extends validation passed (depth: ${validationResult.depth})`);

  // Use explicit skeleton path if provided, otherwise resolve relative to variant file
  let skeletonPath: string;
  if (explicitSkeletonPath) {
    skeletonPath = explicitSkeletonPath;
  } else {
    const variantDir = dirname(absolutePath);
    skeletonPath = resolve(variantDir, parsed.frontmatter.extends);
  }

  try {
    const skeletonContent = readFileSync(skeletonPath, 'utf-8');
    const skeletonParsed = parseFrontmatter(skeletonContent);

    // Merge frontmatters
    const mergedFrontmatter = mergeFrontmatter(skeletonParsed.frontmatter, parsed.frontmatter);

    // Combine: merged frontmatter + skeleton content body
    // Use skeleton content body, not variant content body (which is typically empty for extends-only files)
    const result = `---
${dump(mergedFrontmatter).trim()}
---

${skeletonParsed.content}`;

    return result;
  } catch (error) {
    console.error(`Failed to read skeleton: ${skeletonPath}`, error);
    console.warn(`⚠️  Falling back to safe default: returning original content`);
    return content;
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: merge-frontmatter.ts <file-path> [skeleton-path]');
  console.error('  file-path: Path to the variant file with extends directive');
  console.error('  skeleton-path: Optional absolute path to skeleton file');
  process.exit(1);
}

const filePath = args[0];
const explicitSkeletonPath = args[1] || undefined;
const result = processFile(filePath, explicitSkeletonPath);
writeFileSync(filePath, result, 'utf-8');
console.log(`✅ Merged frontmatter for ${filePath}`);
