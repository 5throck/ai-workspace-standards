#!/usr/bin/env bun
/**
 * Skill Lifecycle Validation Script
 * @version 1.0.0
// Validates skills/*/SKILL.md files for required frontmatter
// and checks governance records in docs/lifecycle/skills/*.md
//
// Usage:
//   bun scripts/validate-skills.ts
//   bun scripts/validate-skills.ts --json

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
const SKILLS_DIR = join(ROOT, 'skills');
const LIFECYCLE_DOCS_DIR = join(ROOT, 'docs', 'lifecycle', 'skills');

// Required sections in governance records (docs/lifecycle/skills/*.md)
const GOVERNANCE_REQUIRED_SECTIONS = ['## Phase History', '## Acceptance Criteria'];

// Required frontmatter fields in runtime definitions (skills/*/SKILL.md)
const FRONTMATTER_REQUIRED_FIELDS = ['name', 'status', 'description', 'owner', 'version'];

// Guard: must be run from workspace root
if (!existsSync(SKILLS_DIR)) {
  console.error(`\x1b[31m[ERROR] validate-skills.ts must be run from the workspace root.\x1b[0m`);
  console.error(`        Current directory: ${ROOT}`);
  console.error(`        Expected: a directory containing skills/`);
  console.error(`        Usage: cd <workspace-root> && bun scripts/validate-skills.ts`);
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
    // Skip nested keys and list items
    if (key && !key.startsWith(' ') && !key.startsWith('-')) {
      fields[key] = true;
    }
  }
  return fields;
}

// Check field existence in frontmatter
function hasField(rawContent: string, fieldName: string): boolean {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;

  const lines = match[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      if (key === fieldName) {
        return true;
      }
    }
  }

  return false;
}

// Part 1: Validate runtime definitions (skills/*/SKILL.md)
function validateRuntimeDefinitions(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 1: Runtime Definition Validation (skills/*/SKILL.md)${colors.reset}`);

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const skillDir of skillDirs) {
    const skillFile = join(SKILLS_DIR, skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    totalFiles++;
    const rawContent = readFileSync(skillFile, 'utf-8');

    const missingFields: string[] = [];

    // Check for required frontmatter fields
    for (const field of FRONTMATTER_REQUIRED_FIELDS) {
      if (!hasField(rawContent, field)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      fail(
        skillDir,
        'frontmatter-missing',
        `${skillDir}: Missing frontmatter fields: ${missingFields.join(', ')}`,
        `Add missing fields to YAML frontmatter:\n     ---\n     name: ${skillDir}\n     status: active\n     description: >\n       Brief description of what this skill does.\n       Use when: trigger phrases or conditions.\n     owner: pm|automation-engineer\n     version: 1.0.0\n     ---`
      );
    } else {
      pass(`${skillDir}: All required frontmatter fields present`);
    }
  }
}

// Part 2: Validate governance records (docs/lifecycle/skills/*.md)
function validateGovernanceRecords(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 2: Governance Record Validation (docs/lifecycle/skills/*.md)${colors.reset}`);

  if (!existsSync(LIFECYCLE_DOCS_DIR)) {
    warn(
      'docs/lifecycle/skills',
      'directory-not-found',
      'docs/lifecycle/skills/ directory not found',
      'Create docs/lifecycle/skills/ directory with governance documentation'
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
        `Add missing sections to docs/lifecycle/skills/${file}`
      );
    } else {
      pass(`Governance doc ${docName}: All required sections present`);
    }
  }
}

// Main
function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}🔍 Validating skill lifecycle documentation...${colors.reset}`);
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
      console.log(`  1. For runtime definition errors: Add frontmatter to skills/*/SKILL.md`);
      console.log(`     Example:`);
      console.log(`     ---`);
      console.log(`     name: skill-name`);
      console.log(`     status: active`);
      console.log(`     description: >`);
      console.log(`       Brief description of what this skill does.`);
      console.log(`       Use when: trigger phrases or conditions.`);
      console.log(`     owner: pm|automation-engineer`);
      console.log(`     version: 1.0.0`);
      console.log(`     ---`);
      console.log(`  2. For governance record errors: Add missing sections to docs/lifecycle/skills/*.md`);
    } else {
      console.log(`\n${colors.green}✅ All skills validated successfully${colors.reset}`);
      console.log(`   Runtime definitions and governance records are both valid`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
