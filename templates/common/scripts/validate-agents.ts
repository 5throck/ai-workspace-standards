#!/usr/bin/env bun
/**
 * Agent Lifecycle Validation Script
 * @version 1.0.0
 *
 * Validates all agents/*.md files for required lifecycle frontmatter
 * and checks governance records in docs/lifecycle/agents/*.md
 *
 * Performs two validations:
 * 1. Runtime definition validation: agents/*.md must have lifecycle frontmatter
 * 2. Governance record validation: docs/lifecycle/agents/*.md must have detailed documentation
 *
 * Usage:
 *   bun scripts/validate-agents.ts
 *   bun scripts/validate-agents.ts --json
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  check: string;
  message: string;
  fix?: string;
}

interface ValidationResult {
  totalFilesChecked: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: string;
}

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();
const AGENTS_DIR = join(ROOT, 'agents');
const LIFECYCLE_DOCS_DIR = join(ROOT, 'docs', 'lifecycle', 'agents');

// Required sections in governance records (docs/lifecycle/agents/*.md)
const GOVERNANCE_REQUIRED_SECTIONS = ['## Phase History', '## Acceptance Criteria'];

// Required frontmatter fields in runtime definitions (agents/*.md)
const FRONTMATTER_REQUIRED_FIELDS = ['lifecycle.phase', 'lifecycle.governance'];

// Guard: must be run from workspace root
if (!existsSync(AGENTS_DIR)) {
  console.error(`\x1b[31m[ERROR] validate-agents.ts must be run from the workspace root.\x1b[0m`);
  console.error(`        Current directory: ${ROOT}`);
  console.error(`        Expected: a directory containing agents/`);
  console.error(`        Usage: cd <workspace-root> && bun scripts/validate-agents.ts`);
  process.exit(1);
}

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');

const issues: ValidationIssue[] = [];
let totalFiles = 0;

function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}✅${colors.reset} ${msg}`);
}

function fail(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', file, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.red}❌${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

function warn(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', file, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

// Normalize content: strip BOM and normalize line endings
function normalizeContent(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Parse frontmatter fields from markdown
function parseFrontmatter(rawContent: string): Record<string, true> {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fields: Record<string, true> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Support nested keys (e.g., lifecycle.phase)
    if (key && !key.startsWith(' ') && !key.startsWith('-')) {
      fields[key] = true;
      // Also register full nested path
      if (key.includes('.')) {
        const parts = key.split('.');
        for (let i = 1; i <= parts.length; i++) {
          fields[parts.slice(0, i).join('.')] = true;
        }
      }
    }
  }
  return fields;
}

// Check nested field existence in frontmatter
function hasNestedField(rawContent: string, fieldPath: string): boolean {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;

  const parts = fieldPath.split('.');
  const lines = match[1].split('\n');

  // For nested fields like lifecycle.phase, check both forms:
  // 1. Direct key: lifecycle.phase: production
  // 2. Nested structure: lifecycle:\n    phase: production
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check direct key form (lifecycle.phase:)
    if (trimmed.startsWith(`${fieldPath}:`)) {
      return true;
    }

    // Check nested structure form
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      if (key === parts[0]) {
        // Found parent key, now check nested values
        if (parts.length === 1) return true;

        // Look for nested value in subsequent lines
        const indent = line.search(/\S/);
        for (let i = lines.indexOf(line) + 1; i < lines.length; i++) {
          const nextLine = lines[i];
          if (nextLine.trim() === '' || nextLine.startsWith('---')) break;

          const nextIndent = nextLine.search(/\S/);
          if (nextIndent <= indent) break; // Not a nested line

          const nextTrimmed = nextLine.trim();
          const nextColonIdx = nextTrimmed.indexOf(':');
          if (nextColonIdx !== -1) {
            const nextKey = nextTrimmed.slice(0, nextColonIdx).trim();
            const fullPath = `${parts[0]}.${nextKey}`;
            if (fullPath === fieldPath) return true;
          }
        }
      }
    }
  }

  return false;
}

// Part 1: Validate runtime definitions (agents/*.md)
function validateRuntimeDefinitions(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 1: Runtime Definition Validation (agents/*.md)${colors.reset}`);

  const agentFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');

  for (const file of agentFiles) {
    totalFiles++;
    const agentName = file.replace('.md', '');
    const filePath = join(AGENTS_DIR, file);
    const rawContent = readFileSync(filePath, 'utf-8');

    const missingFields: string[] = [];

    // Check for required frontmatter fields
    for (const field of FRONTMATTER_REQUIRED_FIELDS) {
      if (!hasNestedField(rawContent, field)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      fail(
        agentName,
        'frontmatter-missing',
        `${agentName}: Missing frontmatter fields: ${missingFields.join(', ')}`,
        `Add missing fields to YAML frontmatter:\n     lifecycle:\n       phase: production\n       created: YYYY-MM-DD\n       last_updated: YYYY-MM-DD\n       governance: docs/lifecycle/agents/${agentName}.md`
      );
    } else {
      pass(`${agentName}: All required frontmatter fields present`);
    }
  }
}

// Part 2: Validate governance records (docs/lifecycle/agents/*.md)
function validateGovernanceRecords(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 2: Governance Record Validation (docs/lifecycle/agents/*.md)${colors.reset}`);

  if (!existsSync(LIFECYCLE_DOCS_DIR)) {
    warn(
      'docs/lifecycle/agents',
      'directory-not-found',
      'docs/lifecycle/agents/ directory not found',
      'Create docs/lifecycle/agents/ directory with governance documentation'
    );
    return;
  }

  const lifecycleDocs = readdirSync(LIFECYCLE_DOCS_DIR).filter(f => f.endsWith('.md'));

  for (const file of lifecycleDocs) {
    totalFiles++;
    const docName = file.replace('.md', '');
    const filePath = join(LIFECYCLE_DOCS_DIR, file);
    const content = normalizeContent(readFileSync(filePath, 'utf-8'));

    const missingSections: string[] = [];

    // Check for required sections
    if (!content.includes('## Phase History')) {
      missingSections.push('Phase History');
    }

    if (!content.includes('## Acceptance Criteria')) {
      missingSections.push('Acceptance Criteria');
    }

    if (missingSections.length > 0) {
      fail(
        `Governance doc ${docName}`,
        'sections-missing',
        `${docName}: Missing sections: ${missingSections.join(', ')}`,
        `Add missing sections to docs/lifecycle/agents/${file}`
      );
    } else {
      pass(`Governance doc ${docName}: All required sections present`);
    }
  }
}

// Main
function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}🔍 Validating agent lifecycle documentation...${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
  }

  validateRuntimeDefinitions();
  validateGovernanceRecords();

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (!JSON_MODE) {
    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}📊 Validation Summary:${colors.reset}`);
    console.log(`   Total files checked: ${totalFiles}`);
    console.log(`   ${colors.red}Errors: ${errors.length}${colors.reset}`);
    console.log(`   ${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({
      totalFilesChecked: totalFiles,
      errors,
      warnings,
      summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    }, null, 2));
  } else {
    if (errors.length > 0) {
      console.log(`\n${colors.red}❌ Validation failed with ${errors.length} error(s)${colors.reset}`);
      console.log(`\n${colors.dim}Fix instructions:${colors.reset}`);
      console.log(`  1. For runtime definition errors: Add lifecycle frontmatter to agents/*.md`);
      console.log(`     Example:`);
      console.log(`     lifecycle:`);
      console.log(`       phase: production`);
      console.log(`       created: 2026-05-29`);
      console.log(`       last_updated: 2026-05-29`);
      console.log(`       governance: docs/lifecycle/agents/[name].md`);
      console.log(`  2. For governance record errors: Add missing sections to docs/lifecycle/agents/*.md`);
    } else {
      console.log(`\n${colors.green}✅ All agents validated successfully${colors.reset}`);
      console.log(`   Runtime definitions and governance records are both valid`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
