#!/usr/bin/env bun
/**
 * PM.md Parser Helper
 *
 * Parses YAML frontmatter from pm.md files and extracts variant_overrides.
 * Handles both L0 (workspace root), L1 (templates/common), and L2 (templates/co-*) pm.md files.
 *
 * @version 1.0.2
 * @author automation-engineer
 *
 * Usage:
 *   import { parsePmMd, extractVariantOverrides } from './helpers/pm-md-parser.js';
 *
 *   const pmMdPath = 'templates/co-design/agents/pm.md';
 *   const parsed = parsePmMd(pmMdPath);
 *   const overrides = extractVariantOverrides(parsed.frontmatter);
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PmMdFrontmatter {
  name?: string;
  status?: string;
  formal_name?: string;
  tier?: {
    claude?: string;
    antigravity?: string;
    gemini?: string;
    gemini_cli?: string;
  };
  model?: string;
  color?: string;
  description?: string;
  examples?: Array<{ user: string; assistant: string }>;
  extends?: string;
  extends_overrides?: Record<string, unknown>;
  remove_sections?: string[];
  owner?: string;
  variant_overrides?: VariantOverrides;
  [key: string]: unknown;
}

export interface VariantOverrides {
  role?: string | Record<string, unknown> | unknown[];
  updated_role?: string | Record<string, unknown> | unknown[];
  governance_workflow?: string | Record<string, unknown> | unknown[];
  agent_roster?: string | Record<string, unknown> | unknown[];
  dispatch_protocol?: string | Record<string, unknown> | unknown[];
  phase_determination?: {
    constraints?: {
      phase_determination?: string;
    };
  };
  [key: string]: unknown;
}

export interface PmMdParseResult {
  frontmatter: PmMdFrontmatter;
  content: string;
  extendsPath?: string;
  removeSections: string[];
  variantOverrides: VariantOverrides;
  isValid: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML Frontmatter Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown content
 * @param content - Markdown file content
 * @param filePath - File path (for error messages)
 * @returns Parsed frontmatter and content
 */
function parseYamlFrontmatter(content: string, filePath: string): { frontmatter: PmMdFrontmatter; content: string; error?: string } {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, content: content.trim() };
  }

  try {
    const yamlText = match[1];
    const frontmatter = yaml.load(yamlText) as PmMdFrontmatter;

    return {
      frontmatter: frontmatter || {},
      content: match[2] ? match[2].trim() : ''
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      frontmatter: {},
      content: content,
      error: `Failed to parse YAML frontmatter in ${filePath}: ${errorMsg}`
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Parser Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse pm.md file and extract all relevant information
 * @param filePath - Path to pm.md file
 * @returns Parsed result with frontmatter, content, and extracted data
 */
export function parsePmMd(filePath: string): PmMdParseResult {
  const result: PmMdParseResult = {
    frontmatter: {},
    content: '',
    removeSections: [],
    variantOverrides: {},
    isValid: false
  };

  // Check file existence
  if (!existsSync(filePath)) {
    result.error = `File not found: ${filePath}`;
    return result;
  }

  // Read file content
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    result.error = `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }

  // Parse YAML frontmatter
  const { frontmatter, content: bodyContent, error: parseError } = parseYamlFrontmatter(content, filePath);

  if (parseError) {
    result.error = parseError;
    // Continue anyway with partial data
  }

  result.frontmatter = frontmatter;
  result.content = bodyContent;

  // Extract extends path
  if (frontmatter.extends) {
    result.extendsPath = resolve(dirname(filePath), frontmatter.extends);
  }

  // Extract remove_sections
  if (frontmatter.remove_sections && Array.isArray(frontmatter.remove_sections)) {
    result.removeSections = frontmatter.remove_sections;
  }

  // Extract variant_overrides
  if (frontmatter.variant_overrides) {
    result.variantOverrides = extractVariantOverrides(frontmatter);
  }

  result.isValid = !parseError;
  return result;
}

/**
 * Extract variant_overrides from frontmatter
 * @param frontmatter - Parsed frontmatter object
 * @returns Variant overrides object
 */
export function extractVariantOverrides(frontmatter: PmMdFrontmatter): VariantOverrides {
  const overrides: VariantOverrides = {};

  if (frontmatter.variant_overrides && typeof frontmatter.variant_overrides === 'object') {
    const vo = frontmatter.variant_overrides as Record<string, unknown>;

    if (vo.role !== undefined) {
      overrides.role = vo.role as VariantOverrides['role'];
    }

    if (vo.updated_role !== undefined) {
      overrides.updated_role = vo.updated_role as VariantOverrides['updated_role'];
    }

    if (vo.governance_workflow !== undefined) {
      overrides.governance_workflow = vo.governance_workflow as VariantOverrides['governance_workflow'];
    }

    if (vo.agent_roster !== undefined) {
      overrides.agent_roster = vo.agent_roster as VariantOverrides['agent_roster'];
    }

    if (vo.dispatch_protocol !== undefined) {
      overrides.dispatch_protocol = vo.dispatch_protocol as VariantOverrides['dispatch_protocol'];
    }

    if (vo.phase_determination && typeof vo.phase_determination === 'object') {
      overrides.phase_determination = vo.phase_determination as VariantOverrides['phase_determination'];
    }
  }

  return overrides;
}

/**
 * Resolve extends chain and collect all variant overrides
 * @param filePath - Path to pm.md file
 * @param workspaceRoot - Workspace root directory
 * @param visited - Set of visited files (for circular reference detection)
 * @returns Array of parsed pm.md files in the extends chain
 */
export function resolveExtendsChain(
  filePath: string,
  workspaceRoot: string = process.cwd(),
  visited: Set<string> = new Set()
): PmMdParseResult[] {
  const chain: PmMdParseResult[] = [];

  // Normalize file path
  const normalizedPath = resolve(filePath);

  // Check for circular reference
  if (visited.has(normalizedPath)) {
    console.warn(`⚠️  Circular reference detected: ${normalizedPath}`);
    return chain;
  }

  visited.add(normalizedPath);

  // Parse current file
  const parsed = parsePmMd(normalizedPath);
  chain.push(parsed);

  // If there's an extends path, recursively resolve it
  if (parsed.extendsPath && existsSync(parsed.extendsPath)) {
    const parentChain = resolveExtendsChain(parsed.extendsPath, workspaceRoot, visited);
    chain.push(...parentChain);
  }

  return chain;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Interface (for testing)
// ─────────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: bun scripts/helpers/pm-md-parser.ts <pm-md-file-path>');
    console.error('  pm-md-file-path: Path to a pm.md file');
    process.exit(1);
  }

  const pmMdPath = args[0];
  console.log(`🔍 Parsing pm.md file: ${pmMdPath}\n`);

  const result = parsePmMd(pmMdPath);

  if (!result.isValid) {
    console.error(`❌ Parse error: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Parsed successfully\n`);
  console.log(`Frontmatter:`);
  console.log(JSON.stringify(result.frontmatter, null, 2));

  if (result.extendsPath) {
    console.log(`\nExtends: ${result.extendsPath}`);
  }

  if (result.removeSections.length > 0) {
    console.log(`\nRemove Sections:`);
    for (const section of result.removeSections) {
      console.log(`  - ${section}`);
    }
  }

  if (Object.keys(result.variantOverrides).length > 0) {
    console.log(`\nVariant Overrides:`);
    console.log(JSON.stringify(result.variantOverrides, null, 2));
  }

  console.log(`\nContent preview (first 200 chars):`);
  console.log(result.content.substring(0, 200) + '...');
}

/**
 * Generate context.md content from variant overrides
 * @param variantName - Name of the variant (e.g., 'co-design')
 * @param variantOverrides - Variant overrides object
 * @returns Formatted context.md content
 */
export function generateContextMd(variantName: string, variantOverrides: VariantOverrides): string {
  const lines: string[] = [];

  lines.push(`# ${variantName} Context`);
  lines.push('');
  lines.push(`> Generated from pm.md variant_overrides`);
  lines.push('');
  lines.push(`## Variant-Specific PM Configuration`);
  lines.push('');

  const formatOverrideValue = (val: unknown): string => {
    if (typeof val === 'string') return val;
    return JSON.stringify(val, null, 2);
  };

  if (variantOverrides.updated_role) {
    lines.push(`### Updated Role`);
    lines.push('');
    lines.push(formatOverrideValue(variantOverrides.updated_role));
    lines.push('');
  }

  if (variantOverrides.governance_workflow) {
    lines.push(`### Governance Workflow`);
    lines.push('');
    lines.push(formatOverrideValue(variantOverrides.governance_workflow));
    lines.push('');
  }

  if (variantOverrides.agent_roster) {
    lines.push(`### Agent Roster`);
    lines.push('');
    lines.push(formatOverrideValue(variantOverrides.agent_roster));
    lines.push('');
  }

  if (variantOverrides.dispatch_protocol) {
    lines.push(`### Dispatch Protocol`);
    lines.push('');
    lines.push(formatOverrideValue(variantOverrides.dispatch_protocol));
    lines.push('');
  }

  if (variantOverrides.phase_determination) {
    lines.push(`### Phase Determination`);
    lines.push('');
    if (variantOverrides.phase_determination.constraints?.phase_determination) {
      lines.push(variantOverrides.phase_determination.constraints.phase_determination);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Write context.md file to variant directory
 * @param variantPath - Path to variant directory
 * @param variantName - Name of the variant
 * @param variantOverrides - Variant overrides object
 */
export function writeContextMd(variantPath: string, variantName: string, variantOverrides: VariantOverrides): void {
  const contextPath = path.join(variantPath, 'docs', `${variantName}.context.md`);
  const contextContent = generateContextMd(variantName, variantOverrides);

  try {
    fs.mkdirSync(path.dirname(contextPath), { recursive: true });
    fs.writeFileSync(contextPath, contextContent, 'utf-8');
    console.log(`✅ Generated ${contextPath}`);
  } catch (error) {
    console.error(`❌ Failed to write context.md: ${error}`);
  }
}
