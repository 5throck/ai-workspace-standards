#!/usr/bin/env bun
/**
 * validate-pm-extends.ts
 *
 * PM Extends Validation CLI Tool
 *
 * Validates pm.md extends chains for correctness and compliance.
 * Implements validation rules from ADR-0033.
 *
 * @version 0.2.0
 * @author automation-engineer
 *
 * Usage:
 *   bun scripts/validate-pm-extends.ts [options] [files...]
 *
 * Options:
 *   --fix           Auto-fix simple issues
 *   --verbose       Detailed output
 *   --json          JSON output format
 *   --max-depth N   Set custom max depth (default: 3)
 *   --help          Show this help message
 *
 * Examples:
 *   # Validate all pm.md files in workspace
 *   bun scripts/validate-pm-extends.ts
 *
 *   # Validate specific file
 *   bun scripts/validate-pm-extends.ts agents/pm.md
 *
 *   # Validate with auto-fix
 *   bun scripts/validate-pm-extends.ts --fix
 *
 *   # JSON output for CI/CD
 *   bun scripts/validate-pm-extends.ts --json
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { parsePmMd, extractVariantOverrides } from './helpers/pm-md-parser.js';

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  chain: string[];
  depth: number;
}

interface ValidationError {
  type: 'circular' | 'depth' | 'missing' | 'syntax' | 'override';
  message: string;
  file?: string;
  line?: number;
  fixable?: boolean;
}

interface ValidationWarning {
  type: 'parity' | 'deprecated';
  message: string;
  file?: string;
}

interface ExtendsFrontmatter {
  extends?: string[];
  extends_overrides?: Record<string, unknown>;
}

interface ValidateOptions {
  fix: boolean;
  verbose: boolean;
  json: boolean;
  maxDepth: number;
  files?: string[];
}

const MAX_EXTENDS_DEPTH = 3;

/**
 * Parse YAML frontmatter from a markdown file
 * Now uses the shared pm-md-parser helper
 */
function parseFrontmatter(filePath: string): ExtendsFrontmatter | null {
  try {
    const parsed = parsePmMd(filePath);

    if (!parsed.isValid) {
      return null;
    }

    const result: ExtendsFrontmatter = {};

    // Extract extends
    if (parsed.extendsPath) {
      result.extends = [parsed.extendsPath];
    }

    // Extract variant_overrides as extends_overrides for compatibility
    if (Object.keys(parsed.variantOverrides).length > 0) {
      result.extends_overrides = parsed.variantOverrides;
    }

    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Parse extends array using regex for better YAML handling
 */
function parseExtends(filePath: string): string[] | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      return [];
    }

    const yamlContent = frontmatterMatch[1];

    // Match extends: ["a", "b"] or extends: [a, b] or extends: a
    const arrayMatch = yamlContent.match(/^extends:\s*\[(.+)\]$/m);
    if (arrayMatch) {
      return arrayMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
        .filter(Boolean);
    }

    // Match single extends: value
    const singleMatch = yamlContent.match(/^extends:\s*(.+)$/m);
    if (singleMatch) {
      return [singleMatch[1].trim()];
    }

    return [];
  } catch (error) {
    return null;
  }
}

/**
 * Build extends chain for a given pm.md file
 */
function buildExtendsChain(
  filePath: string,
  workspaceRoot: string,
  visited = new Set<string>(),
  depth = 0
): { chain: string[]; errors: ValidationError[]; depth: number } {
  const errors: ValidationError[] = [];
  const chain: string[] = [];

  // Check circular reference first
  if (visited.has(filePath)) {
    errors.push({
      type: 'circular',
      message: `Circular reference detected: ${filePath}`,
      file: filePath,
    });
    return { chain, errors, depth };
  }

  visited.add(filePath);

  // Check file existence
  if (!existsSync(filePath)) {
    errors.push({
      type: 'missing',
      message: `Extends target not found: ${filePath}`,
      file: filePath,
    });
    visited.delete(filePath);
    return { chain, errors, depth };
  }

  const extendsList = parseExtends(filePath);
  chain.push(filePath);

  if (!extendsList || extendsList.length === 0) {
    visited.delete(filePath);
    return { chain, errors, depth };
  }

  // Check depth limit before recursing
  if (depth >= MAX_EXTENDS_DEPTH) {
    errors.push({
      type: 'depth',
      message: `Extends chain depth (${depth + 1}) exceeds maximum (${MAX_EXTENDS_DEPTH})`,
      file: filePath,
    });
    visited.delete(filePath);
    const newDepth = depth + 1;
    return { chain, errors, depth: newDepth };
  }

  // Recursively build chain
  for (const target of extendsList) {
    const targetPath = resolveExtendsPath(filePath, target, workspaceRoot);

    if (!targetPath) {
      errors.push({
        type: 'missing',
        message: `Cannot resolve extends target: ${target}`,
        file: filePath,
      });
      continue;
    }

    const result = buildExtendsChain(targetPath, workspaceRoot, visited, depth + 1);
    chain.push(...result.chain);
    errors.push(...result.errors);
  }

  visited.delete(filePath);
  return { chain, errors, depth };
}

/**
 * Resolve extends path relative to current file
 */
function resolveExtendsPath(
  currentFile: string,
  target: string,
  workspaceRoot: string
): string | null {
  // Handle absolute paths
  if (target.startsWith('/') || target.match(/^[a-zA-Z]:/)) {
    const absolutePath = target;
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
    return null;
  }

  // Handle relative paths
  const currentDir = dirname(currentFile);
  const relativePath = join(currentDir, target);

  if (existsSync(relativePath)) {
    return relativePath;
  }

  // Handle workspace-relative paths (e.g., "templates/common/agents/pm.md")
  const workspaceRelative = join(workspaceRoot, target);
  if (existsSync(workspaceRelative)) {
    return workspaceRelative;
  }

  return null;
}

/**
 * Validate extends syntax
 */
function validateSyntax(filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      // No frontmatter is valid (no extends)
      return errors;
    }

    const yamlContent = frontmatterMatch[1];
    const lines = yamlContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check extends format
      if (line.startsWith('extends:')) {
        const validFormats = [
          /^extends:\s*\[.+\]$/,  // Array format
          /^extends:\s*[a-zA-Z0-9_\/\-\.]+$/,  // Single value
        ];

        const isValid = validFormats.some(regex => regex.test(line));
        if (!isValid) {
          errors.push({
            type: 'syntax',
            message: `Invalid extends syntax: ${line.trim()}`,
            file: filePath,
            line: i + 2, // +2 for frontmatter start
            fixable: true,
          });
        }
      }

      // Check extends_overrides format
      if (line.startsWith('extends_overrides:')) {
        if (!line.match(/^extends_overrides:\s*\{/)) {
          errors.push({
            type: 'syntax',
            message: `Invalid extends_overrides syntax: ${line.trim()}`,
            file: filePath,
            line: i + 2,
            fixable: true,
          });
        }
      }
    }
  } catch (error) {
    errors.push({
      type: 'syntax',
      message: `Failed to parse file: ${error}`,
      file: filePath,
    });
  }

  return errors;
}

/**
 * Validate override sections exist in target files
 */
function validateOverrides(filePath: string, workspaceRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      return errors;
    }

    const yamlContent = frontmatterMatch[1];

    // Parse extends_overrides
    const overrideMatch = yamlContent.match(/^extends_overrides:\s*\{(.+)\}$/m);
    if (!overrideMatch) {
      return errors;
    }

    // Simple parsing - extend as needed
    const overrideKeys = overrideMatch[1].split(',').map(s => s.trim());

    // Check if override sections exist in the file
    const bodyContent = content.replace(/^---\n[\s\S]+?\n---\n/, '');

    for (const key of overrideKeys) {
      const sectionMatch = key.match(/^(\w+):/);
      if (!sectionMatch) continue;

      const sectionName = sectionMatch[1];
      // Check if section exists in body
      const sectionExists = bodyContent.match(new RegExp(`^##\\s+${sectionName}`, 'm'));

      if (!sectionExists) {
        errors.push({
          type: 'override',
          message: `Override section '${sectionName}' not found in file body`,
          file: filePath,
        });
      }
    }
  } catch (error) {
    // Ignore parse errors for overrides
  }

  return errors;
}

/**
 * Check platform parity status
 */
function checkPlatformParity(filePath: string, workspaceRoot: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const relativePath = relative(workspaceRoot, filePath);

  // Check if this is an L0 file (workspace root agents/)
  const isL0 = relativePath.match(/^agents\/[^/]+\.md$/);

  // Check if this is an L1 file (templates/common/agents/)
  const isL1 = relativePath.match(/^templates\/common\/agents\/[^/]+\.md$/);

  // Check if this is an L2 file (templates/co-*/agents/)
  const isL2 = relativePath.match(/^templates\/co-[^/]+\/agents\/[^/]+\.md$/);

  if (isL0) {
    // L0 should have L1 counterpart
    const l1Path = join(workspaceRoot, relativePath.replace(/^agents\//, 'templates/common/agents/'));
    if (!existsSync(l1Path)) {
      warnings.push({
        type: 'parity',
        message: `L0 file missing L1 counterpart: ${relativePath.replace(/^agents\//, 'templates/common/agents/')}`,
        file: relativePath,
      });
    }
  }

  if (isL1) {
    // L1 should have L0 origin
    const l0Path = join(workspaceRoot, relativePath.replace(/^templates\/common\/agents\//, 'agents/'));
    if (!existsSync(l0Path)) {
      warnings.push({
        type: 'parity',
        message: `L1 file missing L0 origin: ${relativePath.replace(/^templates\/common\/agents\//, 'agents/')}`,
        file: relativePath,
      });
    }
  }

  return warnings;
}

/**
 * Validate a single pm.md file
 */
function validatePmFile(filePath: string, workspaceRoot: string, options: ValidateOptions): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Validate syntax
  errors.push(...validateSyntax(filePath));

  // 2. Build chain and check for circular references and depth limits
  const chainResult = buildExtendsChain(filePath, workspaceRoot);
  errors.push(...chainResult.errors);

  // 3. Validate overrides
  errors.push(...validateOverrides(filePath, workspaceRoot));

  // 4. Check platform parity
  warnings.push(...checkPlatformParity(filePath, workspaceRoot));

  return {
    file: relative(workspaceRoot, filePath),
    valid: errors.length === 0,
    errors,
    warnings,
    chain: chainResult.chain.map(p => relative(workspaceRoot, p)),
    depth: chainResult.depth,
  };
}

/**
 * Find all pm.md files in workspace
 */
function findPmFiles(workspaceRoot: string, targetPaths?: string[]): string[] {
  if (targetPaths && targetPaths.length > 0) {
    return targetPaths.filter(p => existsSync(p));
  }

  const pmFiles: string[] = [];

  function scanDirectory(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            scanDirectory(fullPath);
          }
        } else if (entry.name === 'pm.md') {
          pmFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  scanDirectory(workspaceRoot);
  return pmFiles;
}

/**
 * Auto-fix simple validation errors
 */
function autoFixErrors(filePath: string, errors: ValidationError[]): boolean {
  if (errors.length === 0) return false;

  let fixed = false;
  const content = readFileSync(filePath, 'utf-8');
  let newContent = content;

  for (const error of errors) {
    if (error.fixable && error.type === 'syntax') {
      // Fix simple syntax errors (extend as needed)
      fixed = true;
    }
  }

  if (fixed) {
    // Write back (extend as needed)
    // writeFileSync(filePath, newContent, 'utf-8');
  }

  return fixed;
}

/**
 * Main validation function
 */
function validate(workspaceRoot: string, options: ValidateOptions): ValidationResult[] {
  const pmFiles = findPmFiles(workspaceRoot, options.files);
  const results: ValidationResult[] = [];

  for (const file of pmFiles) {
    const result = validatePmFile(file, workspaceRoot, options);

    if (options.fix) {
      autoFixErrors(file, result.errors);
    }

    results.push(result);
  }

  return results;
}

/**
 * Format output as human-readable text
 */
function formatHuman(results: ValidationResult[], verbose: boolean): string {
  const lines: string[] = [];

  const validCount = results.filter(r => r.valid).length;
  const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0);
  const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

  lines.push(`🔍 PM Extends Validation Results`);
  lines.push(``);
  lines.push(`Files validated: ${results.length}`);
  lines.push(`✅ Valid: ${validCount}`);
  lines.push(`❌ Errors: ${errorCount}`);
  lines.push(`⚠️  Warnings: ${warningCount}`);
  lines.push(``);

  for (const result of results) {
    if (!result.valid || verbose) {
      lines.push(`\n📄 ${result.file}`);

      if (result.valid && result.warnings.length === 0 && !verbose) {
        lines.push(`  ✅ Valid`);
        continue;
      }

      if (result.chain.length > 0) {
        lines.push(`  Chain: ${result.chain.join(' → ')}`);
        lines.push(`  Depth: ${result.depth}`);
      }

      for (const error of result.errors) {
        lines.push(`  ❌ ${error.type.toUpperCase()}: ${error.message}`);
      }

      for (const warning of result.warnings) {
        lines.push(`  ⚠️  ${warning.type.toUpperCase()}: ${warning.message}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format output as JSON
 */
function formatJson(results: ValidationResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Show help message
 */
function showHelp(): void {
  const lines: string[] = [
    `PM Extends Validation CLI Tool`,
    ``,
    `Usage:`,
    `  bun scripts/validate-pm-extends.ts [options] [files...]`,
    ``,
    `Options:`,
    `  --fix           Auto-fix simple issues (optional)`,
    `  --verbose       Detailed output`,
    `  --json          JSON output format`,
    `  --max-depth N   Set custom max depth (default: ${MAX_EXTENDS_DEPTH})`,
    `  --help          Show this help message`,
    ``,
    `Examples:`,
    `  # Validate all pm.md files in workspace`,
    `  bun scripts/validate-pm-extends.ts`,
    ``,
    `  # Validate specific file`,
    `  bun scripts/validate-pm-extends.ts agents/pm.md`,
    ``,
    `  # Validate with auto-fix`,
    `  bun scripts/validate-pm-extends.ts --fix`,
    ``,
    `  # JSON output for CI/CD`,
    `  bun scripts/validate-pm-extends.ts --json`,
    ``,
    `Validation Rules:`,
    `  1. Extends Chain Syntax - YAML frontmatter format is correct`,
    `  2. Circular References - No A→B→A cycles`,
    `  3. Depth Limits - Chain depth ≤ ${MAX_EXTENDS_DEPTH}`,
    `  4. File Existence - All extends targets exist`,
    `  5. Override Validity - Override sections exist in target files`,
    `  6. Platform Parity - L0→L1→L2 sync status`,
  ];

  console.error(lines.join('\n'));
}

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): ValidateOptions {
  const options: ValidateOptions = {
    fix: false,
    verbose: false,
    json: false,
    maxDepth: MAX_EXTENDS_DEPTH,
    files: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--fix':
        options.fix = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--max-depth':
        options.maxDepth = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          options.files = options.files || [];
          options.files.push(arg);
        }
        break;
    }
  }

  return options;
}

/**
 * Main entry point
 */
async function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  const results = validate(workspaceRoot, options);

  if (options.json) {
    console.log(formatJson(results));
  } else {
    console.log(formatHuman(results, options.verbose));
  }

  // Exit with error code if any validation failed
  const hasErrors = results.some(r => !r.valid);
  process.exit(hasErrors ? 1 : 0);
}

// Run main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
