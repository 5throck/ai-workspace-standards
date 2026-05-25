#!/usr/bin/env bun
/**
 * README Lifecycle Audit Script (Project Version)
 *
 * Validates project README file
 * Checks: required sections, last updated date, content quality
 *
 * Usage:
 *   bun scripts/readme-lifecycle-audit.ts
 *   bun scripts/readme-lifecycle-audit.ts --json   # JSON output
 *
 * @version 1.0.0
 * @license MIT
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cwd } from 'node:process';

interface ReadmeIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
}

interface AuditResult {
  readmesScanned: number;
  errors: ReadmeIssue[];
  warnings: ReadmeIssue[];
  summary: string;
  summaryClean: string;
}

// ANSI colors
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();

// Platform detection
const PLATFORM = detectPlatform();

function detectPlatform(): 'claude-code' | 'antigravity' | 'unknown' {
  if (existsSync(join(ROOT, 'GEMINI.md'))) return 'antigravity';
  if (existsSync(join(ROOT, 'CLAUDE.md')) || existsSync(join(ROOT, '.claude'))) return 'claude-code';
  return 'unknown';
}

// Check for Last Updated date
function hasLastUpdated(content: string): boolean {
  return /Last Updated:\s*\d{4}-\d{2}-\d{2}/.test(content);
}

// Check if date is recent (within 90 days)
function isDateRecent(content: string): boolean {
  const match = content.match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return false;

  const lastUpdated = new Date(match[1]);
  const daysSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= 90;
}

// Check for empty or minimal README
function hasSubstantialContent(content: string): boolean {
  const visibleContent = content
    .replace(/^---\n[\s\S]*?\n---/m, '') // Remove frontmatter
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/\s/g, ''); // Remove whitespace
  return visibleContent.length >= 50;
}

// Check for common README sections
function hasCommonSections(content: string): { hasTitle: boolean; hasDescription: boolean; sectionCount: number } {
  const lines = content.split('\n');
  let hasTitle = false;
  let hasDescription = false;
  let sectionCount = 0;

  for (const line of lines) {
    if (line.startsWith('# ') && !hasTitle) {
      hasTitle = true;
    }
    if (line.startsWith('## ')) {
      sectionCount++;
    }
  }

  // Check for description (first paragraph after title)
  const afterTitle = content.indexOf('# ');
  if (afterTitle >= 0) {
    const afterTitleContent = content.slice(afterTitle + 2);
    const firstParagraph = afterTitleContent.match(/^([^#\n][^\n]*)/);
    if (firstParagraph && firstParagraph[1].trim().length > 20) {
      hasDescription = true;
    }
  }

  return { hasTitle, hasDescription, sectionCount };
}

// Main audit function
function auditReadme(jsonMode = false): AuditResult {
  const readmePath = join(ROOT, 'README.md');

  const errors: ReadmeIssue[] = [];
  const warnings: ReadmeIssue[] = [];

  // Skip header in JSON mode
  if (!jsonMode) {
    console.log(`${colors.cyan}🔍 README Lifecycle Audit${colors.reset}`);
    console.log(`${colors.cyan}=========================${colors.reset}`);
    console.log(`${colors.dim}Platform: ${PLATFORM}${colors.reset}`);
    console.log(`${colors.dim}Location: Current project${colors.reset}`);
    console.log('');
  }

  if (!existsSync(readmePath)) {
    errors.push({
      level: 'error',
      file: 'README.md',
      message: 'README.md not found',
      fix: 'Create README.md with project description and setup instructions',
    });
  } else {
    const content = readFileSync(readmePath, 'utf-8');
    const checks = hasCommonSections(content);

    // Check for project title
    if (!checks.hasTitle) {
      warnings.push({
        level: 'warning',
        file: 'README.md',
        message: 'Missing project title (should start with # Project Name)',
        fix: 'Add a title at the top: # Your Project Name',
      });
    }

    // Check for description
    if (!checks.hasDescription) {
      warnings.push({
        level: 'warning',
        file: 'README.md',
        message: 'Missing project description',
        fix: 'Add a brief description after the title explaining what this project does',
      });
    }

    // Check for minimal sections
    if (checks.sectionCount < 2) {
      warnings.push({
        level: 'warning',
        file: 'README.md',
        message: `README has only ${checks.sectionCount} section(s)`,
        fix: 'Add common sections like ## Installation, ## Usage, ## Development',
      });
    }

    // Check for substantive content
    if (!hasSubstantialContent(content)) {
      errors.push({
        level: 'error',
        file: 'README.md',
        message: 'README appears to be empty or minimal',
        fix: 'Add substantive content to the README',
      });
    }

    // Check for Last Updated
    if (!hasLastUpdated(content)) {
      warnings.push({
        level: 'warning',
        file: 'README.md',
        message: 'Missing "Last Updated" date',
        fix: 'Add "*Last Updated: YYYY-MM-DD*" at the end of the file',
      });
    } else if (!isDateRecent(content)) {
      warnings.push({
        level: 'warning',
        file: 'README.md',
        message: 'Last Updated date is older than 90 days',
        fix: 'Update the Last Updated date if content has changed',
      });
    }
  }

  const scanned = existsSync(readmePath) ? 1 : 0;
  const summary = generateSummary(scanned, errors.length, warnings.length);

  return {
    readmesScanned: scanned,
    errors,
    warnings,
    summary: summary.colored,
    summaryClean: summary.clean,
  };
}

function generateSummary(scanned: number, errors: number, warnings: number): { colored: string; clean: string } {
  if (errors === 0 && warnings === 0) {
    return {
      colored: `${colors.green}✓ README healthy${colors.reset}`,
      clean: `README healthy`,
    };
  }
  return {
    colored: (scanned > 0 ? `${colors.green}✓ README scanned${colors.reset}` : `${colors.yellow}⚠️  README not found${colors.reset}`) +
      (warnings > 0 ? `\n${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}` : '') +
      (errors > 0 ? `\n${colors.red}✖ Errors: ${errors}${colors.reset}` : ''),
    clean: scanned > 0 ? `README scanned` : `README not found` +
      (warnings > 0 ? `, Warnings: ${warnings}` : '') +
      (errors > 0 ? `, Errors: ${errors}` : ''),
  };
}

function printResults(result: AuditResult): void {
  for (const error of result.errors) {
    console.log(`${colors.red}✖ ERROR: ${error.message}${colors.reset}`);
    console.log(`   File: ${error.file}`);
    if (error.fix) console.log(`   Fix: ${error.fix}`);
    console.log('');
  }

  for (const warning of result.warnings) {
    console.log(`${colors.yellow}⚠️  WARNING: ${warning.message}${colors.reset}`);
    console.log(`   File: ${warning.file}`);
    if (warning.fix) console.log(`   Fix: ${warning.fix}`);
    console.log('');
  }

  console.log(`${colors.cyan}=========================${colors.reset}`);
  console.log(result.summary);
}

function printJsonResults(result: AuditResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// CLI interface
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const helpMode = args.includes('--help') || args.includes('-h');

if (helpMode) {
  console.log(`
README Lifecycle Audit v1.0.0 (Project Version)

Usage:
  bun scripts/readme-lifecycle-audit.ts          # Run audit
  bun scripts/readme-lifecycle-audit.ts --json   # JSON output
  bun scripts/readme-lifecycle-audit.ts --help   # Show this help

Checks:
  ✓ README.md existence
  ✓ Project title and description
  ✓ Common sections (Installation, Usage, etc.)
  ✓ Substantive content
  ✓ Last Updated date

Platform: ${PLATFORM}
  `);
  process.exit(0);
}

const result = auditReadme(jsonMode);

if (jsonMode) {
  printJsonResults(result);
} else {
  printResults(result);
}

process.exit(result.errors.length > 0 ? 1 : 0);
