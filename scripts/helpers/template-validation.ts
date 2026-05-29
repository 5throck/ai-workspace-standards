#!/usr/bin/env bun
/**
 * template-validation.ts — Validate required template files in common/ and variant/
 *
 * Usage:
 *   bun scripts/helpers/template-validation.ts <variant>
 *
 * Exits with:
 *   0 if all required files exist
 *   1 if any required files are missing (prints list to stderr)
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const variant = args[0];

if (!variant) {
  console.error('Usage: bun template-validation.ts <variant>');
  process.exit(1);
}

const workspaceRoot = process.cwd();
const commonPath = join(workspaceRoot, 'templates', 'common');
const variantPath = join(workspaceRoot, 'templates', variant);

// Files required in templates/common/
const commonRequired = [
  '.gitignore',
  '.githooks/pre-commit',
];

// Files required in templates/<variant>/
const variantRequired = [
  'CLAUDE.md',
  'GEMINI.md',
  'agents/pm.md',
  'variant.json',
];

const missing: string[] = [];

// Check common files
for (const file of commonRequired) {
  if (!existsSync(join(commonPath, file))) {
    missing.push(`common/${file}`);
  }
}

// Check variant files
for (const file of variantRequired) {
  if (!existsSync(join(variantPath, file))) {
    missing.push(`${variant}/${file}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing required template files: ${missing.join(', ')}`);
  process.exit(1);
}

process.exit(0);
