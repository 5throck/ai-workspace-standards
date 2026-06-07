#!/usr/bin/env -S bun
/**
 * YAML Frontmatter Merger for Template Files
 * @version 1.3.0
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
 * Recursively resolve the extends chain of a skeleton file
 */
function resolveExtendsRecursively(filePath: string): { frontmatter: Frontmatter; content: string } {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    return {
      frontmatter: parsed.frontmatter,
      content: parsed.content
    };
  }

  const currentDir = dirname(absolutePath);
  const skeletonPath = resolve(currentDir, parsed.frontmatter.extends);

  const skeletonResolved = resolveExtendsRecursively(skeletonPath);

  // Merge skeleton resolved frontmatter and current frontmatter
  const mergedFrontmatter = { ...skeletonResolved.frontmatter };
  for (const key of Object.keys(parsed.frontmatter)) {
    if (key !== 'extends') {
      mergedFrontmatter[key] = parsed.frontmatter[key];
    }
  }
  delete (mergedFrontmatter as any).extends;

  // Use current content if it exists, otherwise skeleton's content
  const useCurrentContent = parsed.content.trim().length > 0;
  const finalContent = useCurrentContent ? parsed.content : skeletonResolved.content;

  return {
    frontmatter: mergedFrontmatter,
    content: finalContent
  };
}

/**
 * Remove markdown sections listed in `remove_sections` from a content string.
 *
 * A "section" starts at its heading line (e.g. `## Foo`) and ends just before
 * the next heading of equal or higher level (fewer or equal `#` signs), or at
 * the end of the content.
 *
 * @param content - The markdown body text
 * @param sectionsToRemove - Array of heading strings (e.g. ["## Governance Workflow"])
 * @returns The content with specified sections removed
 */
function removeSections(content: string, sectionsToRemove: string[]): string {
  if (!sectionsToRemove || sectionsToRemove.length === 0) return content;

  const lines = content.split('\n');
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  // Normalize removal specs: "## Foo Bar" → ["##", "Foo Bar"]
  const toRemove: Array<{ hashes: string; prefix: string }> = sectionsToRemove.map(s => {
    const trimmed = s.trim().replace(/\s+/g, ' ');
    const spaceIdx = trimmed.indexOf(' ');
    return {
      hashes: spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed,
      prefix: spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).toLowerCase() : ''
    };
  });

  /**
   * Returns true if `heading` (e.g. "## Updated Role (Phase 0/1-2/5/6 Only)")
   * starts with any removal spec (e.g. "## Updated Role").
   * Matching is case-insensitive prefix on the title part after the `#` markers.
   */
  function shouldRemove(hashes: string, title: string): boolean {
    const titleLower = title.trim().replace(/\s+/g, ' ').toLowerCase();
    return toRemove.some(r =>
      r.hashes === hashes &&
      (titleLower === r.prefix || titleLower.startsWith(r.prefix + ' ') || titleLower.startsWith(r.prefix + '('))
    );
  }

  const result: string[] = [];
  let skipping = false;
  let skipLevel = 0;

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      const level = match[1].length;
      const hashes = match[1];
      const title = match[2];

      if (shouldRemove(hashes, title)) {
        // Start skipping this section
        skipping = true;
        skipLevel = level;
        continue;
      }

      if (skipping && level <= skipLevel) {
        // A same-or-higher-level heading ends the skipped section
        skipping = false;
        skipLevel = 0;
      }
    }

    if (!skipping) {
      result.push(line);
    }
  }

  // Collapse multiple consecutive blank lines left behind by removal
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Generate markdown sections from variant_overrides YAML structure.
 *
 * Handles four standard override sections:
 *   - updated_role      → ## Updated Role
 *   - governance_workflow → ## Governance Workflow
 *   - agent_roster      → ## Agent Roster
 *   - dispatch_protocol → ## Dispatch Protocol
 *
 * @param variantOverrides - The variant_overrides object from merged frontmatter
 * @param variant - The variant name (e.g. "co-develop")
 * @returns Markdown string with generated sections, or empty string if no overrides
 */
function injectVariantSections(variantOverrides: Record<string, any> | undefined, variant: string): string {
  if (!variantOverrides || Object.keys(variantOverrides).length === 0) return '';

  const sections: string[] = [];

  // ## Updated Role
  if (variantOverrides.updated_role) {
    const r = variantOverrides.updated_role;
    const lines = [`## Updated Role`];
    if (r.description) lines.push(``, r.description);
    if (r.scope) lines.push(``, `**Scope**: ${r.scope}`);
    sections.push(lines.join('\n'));
  }

  // ## Governance Workflow
  if (variantOverrides.governance_workflow) {
    const g = variantOverrides.governance_workflow;
    const lines = [`## Governance Workflow`];
    if (Array.isArray(g.phases) && g.phases.length > 0) {
      lines.push(``, `**Orchestrated Phases**: ${g.phases.map((p: number) => `Phase ${p}`).join(', ')}`);
    }
    if (typeof g.triage_required === 'boolean') {
      lines.push(``, `**Triage Required**: ${g.triage_required ? 'Yes' : 'No'}`);
    }
    sections.push(lines.join('\n'));
  }

  // ## Agent Roster
  if (Array.isArray(variantOverrides.agent_roster) && variantOverrides.agent_roster.length > 0) {
    const lines = [
      `## Agent Roster`,
      ``,
      `| Phase | Group | Agents |`,
      `|-------|-------|--------|`,
    ];
    for (const entry of variantOverrides.agent_roster) {
      const agents = Array.isArray(entry.agents)
        ? entry.agents.map((a: string) => `\`${a}\``).join(', ')
        : '';
      lines.push(`| ${entry.phase ?? ''} | ${entry.group ?? ''} | ${agents} |`);
    }
    sections.push(lines.join('\n'));
  }

  // ## Dispatch Protocol
  if (variantOverrides.dispatch_protocol) {
    const d = variantOverrides.dispatch_protocol;
    const lines = [`## Dispatch Protocol`];
    if (Array.isArray(d.can_lead_phases)) {
      lines.push(``, `**Can Lead Phases**: [${d.can_lead_phases.join(', ')}]`);
    }
    if (Array.isArray(d.can_support_in) && d.can_support_in.length > 0) {
      lines.push(`**Can Support In**: [${d.can_support_in.join(', ')}]`);
    }
    if (Array.isArray(d.auto_dispatch_to) && d.auto_dispatch_to.length > 0) {
      lines.push(`**Auto-Dispatch To**: ${d.auto_dispatch_to.map((a: string) => `\`${a}\``).join(', ')}`);
    }
    if (d.tier) lines.push(`**Tier**: ${d.tier}`);
    if (d.communication_style) lines.push(`**Communication Style**: ${d.communication_style}`);
    sections.push(lines.join('\n'));
  }

  if (sections.length === 0) return '';

  console.log(`💉  Injected ${sections.length} variant section(s) from variant_overrides for variant '${variant}'`);
  return `\n\n` + sections.join(`\n\n`);
}

/**
 * Process a single file with `extends` directive
 * @param filePath - Path to the variant file
 * @param explicitSkeletonPath - Optional absolute path to skeleton (resolves extends field before copy)
 * @param originalContextPath - Optional path to the original context file for extends validation
 */
function processFile(filePath: string, explicitSkeletonPath?: string, originalContextPath?: string): string {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    return content; // No extends directive, return as-is
  }

  // ADR-0033: Validate extends chain before processing
  const validationPath = originalContextPath ? resolve(originalContextPath) : absolutePath;
  console.log(`🔍 Validating extends chain for: ${validationPath}`);
  const validationResult: ExtendsValidationResult = safeValidateExtends(validationPath);

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
    // Recursively resolve the skeleton path
    const skeletonResolved = resolveExtendsRecursively(skeletonPath);

    // Merge: variant frontmatter overrides the resolved skeleton frontmatter
    const mergedFrontmatter = { ...skeletonResolved.frontmatter };
    for (const key of Object.keys(parsed.frontmatter)) {
      if (key !== 'extends') {
        mergedFrontmatter[key] = parsed.frontmatter[key];
      }
    }
    delete (mergedFrontmatter as any).extends;

    // Use variant content if it is not empty, otherwise use the resolved skeleton content
    const useCurrentContent = parsed.content.trim().length > 0;
    let finalContent = useCurrentContent ? parsed.content : skeletonResolved.content;

    // Apply remove_sections from the merged frontmatter to the body content
    const sectionsToRemove: string[] = mergedFrontmatter.remove_sections || [];
    if (sectionsToRemove.length > 0) {
      finalContent = removeSections(finalContent, sectionsToRemove);
      if (finalContent !== (useCurrentContent ? parsed.content : skeletonResolved.content)) {
        console.log(`✂️  Removed ${sectionsToRemove.length} section(s) from content: ${sectionsToRemove.join(', ')}`);
      }
    }

    // Inject variant_overrides as markdown sections (appended after base content)
    const variantOverrides = mergedFrontmatter.variant_overrides;
    const variantName: string = mergedFrontmatter.variant || 'unknown';
    const injected = injectVariantSections(variantOverrides, variantName);
    if (injected) {
      finalContent = finalContent + injected;
    }

    // Do not include remove_sections / extends directives in final output frontmatter
    delete (mergedFrontmatter as any).remove_sections;

    const result = `---
${dump(mergedFrontmatter).trim()}
---

${finalContent}`;

    return result;
  } catch (error) {
    console.error(`Failed to resolve skeleton: ${skeletonPath}`, error);
    console.warn(`⚠️  Falling back to safe default: returning original content`);
    return content;
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: merge-frontmatter.ts <file-path> [skeleton-path] [original-context-path]');
  console.error('  file-path: Path to the variant file with extends directive');
  console.error('  skeleton-path: Optional absolute path to skeleton file');
  console.error('  original-context-path: Optional path to the original context file for extends validation');
  process.exit(1);
}

const filePath = args[0];
const explicitSkeletonPath = args[1] || undefined;
const originalContextPath = args[2] || undefined;
const result = processFile(filePath, explicitSkeletonPath, originalContextPath);
writeFileSync(filePath, result, 'utf-8');
console.log(`✅ Merged frontmatter for ${filePath}`);
