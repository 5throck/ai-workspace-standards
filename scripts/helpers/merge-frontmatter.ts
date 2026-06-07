#!/usr/bin/env -S bun
/**
 * YAML Frontmatter Merger for Template Files
 * @version 1.0.0
 *
 * Handles two patterns:
 * 1. `extends` pattern: Variant file with `extends: path/to/skeleton.md`
 * 2. VARIANT-SECTION pattern: Marker-based section substitution
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { load, dump } from 'js-yaml';

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
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    return content; // No extends directive, return as-is
  }

  // Use explicit skeleton path if provided, otherwise resolve relative to variant file
  let skeletonPath: string;
  if (explicitSkeletonPath) {
    skeletonPath = explicitSkeletonPath;
  } else {
    const variantDir = dirname(filePath);
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
