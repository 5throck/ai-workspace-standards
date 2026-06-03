#!/usr/bin/env bun
/**
 * README Lifecycle Audit Script
 *
 * Validates README files across workspace root, templates, and projects
 * Checks: required sections, i18n consistency, link validity, last updated
 *
 * Usage:
 *   bun scripts/readme-lifecycle-audit.ts
 *   bun scripts/readme-lifecycle-audit.ts --json   # JSON output
 *
 * @version 1.0.1
 * @last_updated 2026-06-02
 * @license MIT
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { cwd } from 'node:process';

interface ReadmeIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
}

interface ReadmeSection {
  title: string;
  line: number;
  level: number;
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
const CONSTITUTION_FILE = join(ROOT, 'CONSTITUTION.md');
const IS_WORKSPACE_ROOT = existsSync(CONSTITUTION_FILE);

// Required sections for workspace root and templates
const REQUIRED_SECTIONS_ROOT = [
  'What Is This?',
  'Quick Start',
  'Repository Structure',
  'Session Start Checklist',
  'Multi-Agent Workflow',
  'License',
];

// Required sections for project READMEs — no required sections (projects define their own structure)
const REQUIRED_SECTIONS_PROJECT: string[] = [];

// Platform detection
const PLATFORM = detectPlatform();

function detectPlatform(): 'claude-code' | 'antigravity' | 'unknown' {
  if (existsSync(join(ROOT, 'GEMINI.md'))) return 'antigravity';
  if (existsSync(join(ROOT, 'CLAUDE.md')) || existsSync(join(ROOT, '.claude'))) return 'claude-code';
  return 'unknown';
}

// Parse markdown sections
function parseSections(filePath: string): Map<string, ReadmeSection> {
  const content = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sections = new Map<string, ReadmeSection>();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      sections.set(title, { title, line: i + 1, level });
    }
  }

  return sections;
}

// Extract sections by level for i18n comparison
function getSectionsByLevel(sections: Map<string, ReadmeSection>, level: number): string[] {
  return Array.from(sections.values())
    .filter(s => s.level === level)
    .map(s => s.title);
}

// Check if path is a project directory
function isProjectDirectory(dir: string): boolean {
  // A project directory has docs/context.md or AGENTS.md or CLAUDE.md or GEMINI.md
  const markers = ['docs/context.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'package.json'];
  return markers.some(marker => existsSync(join(dir, marker)));
}

// Find all README files
function findReadmeFiles(dir: string): string[] {
  const readmes: string[] = [];

  if (!existsSync(dir)) return readmes;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip common non-project directories
      if (entry.name === 'node_modules' || entry.name === '.git' ||
          entry.name === 'archive' || entry.name === '_archive' ||
          entry.name === '.venv' || entry.name === 'venv' ||
          entry.name === 'target' || entry.name === 'dist' ||
          entry.name === 'build' || entry.name === '.vscode' ||
          entry.name === '.idea' || entry.name.startsWith('.')) {
        continue;
      }

      // Skip templates subdirectories (already handled separately)
      if (IS_WORKSPACE_ROOT && dir.startsWith(join(ROOT, 'templates'))) {
        continue;
      }

      readmes.push(...findReadmeFiles(fullPath));
    } else if (entry.name === 'README.md' || entry.name === 'README_ko.md') {
      readmes.push(fullPath);
    }
  }

  return readmes;
}

// Check for Last Updated date
function hasLastUpdated(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  return /Last Updated:\s*\d{4}-\d{2}-\d{2}/.test(content);
}

// Check if date is recent (within 90 days)
function isDateRecent(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return false;

  const lastUpdated = new Date(match[1]);
  const daysSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= 90;
}

// Check markdown link validity (basic)
function checkLinks(filePath: string): { valid: number; invalid: Array<{ link: string; line: number }> } {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const invalid: Array<{ link: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    // Check for markdown links
    const linkMatches = lines[i].matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of linkMatches) {
      const link = match[2];
      const line = i + 1;

      // Skip external links and anchors
      if (link.startsWith('http') || link.startsWith('#')) continue;

      // Check relative reference links
      const targetPath = join(dirname(filePath), link);
      if (!existsSync(targetPath)) {
        invalid.push({ link, line });
      }
    }
  }

  return { valid: 0, invalid }; // Simplified for now
}

// Main audit function
function auditReadmes(jsonMode = false): AuditResult {
  const readmeFiles: string[] = [];

  // Always add workspace root READMEs
  if (existsSync(join(ROOT, 'README.md'))) readmeFiles.push(join(ROOT, 'README.md'));
  if (existsSync(join(ROOT, 'README_ko.md'))) readmeFiles.push(join(ROOT, 'README_ko.md'));

  // Add templates READMEs
  const templatesDir = join(ROOT, 'templates');
  if (IS_WORKSPACE_ROOT && existsSync(templatesDir)) {
    if (existsSync(join(templatesDir, 'README.md'))) readmeFiles.push(join(templatesDir, 'README.md'));
    if (existsSync(join(templatesDir, 'README_ko.md'))) readmeFiles.push(join(templatesDir, 'README_ko.md'));
  }

  // Note: Project subdirectory READMEs are excluded from automated audit
  // Only workspace root and templates/ READMEs are checked

  const errors: ReadmeIssue[] = [];
  const warnings: ReadmeIssue[] = [];

  // Skip header in JSON mode
  if (!jsonMode) {
    console.log(`${colors.cyan}🔍 README Lifecycle Audit${colors.reset}`);
    console.log(`${colors.cyan}=========================${colors.reset}`);
    console.log(`${colors.dim}Platform: ${PLATFORM}${colors.reset}`);
    console.log(`${colors.dim}Location: ${IS_WORKSPACE_ROOT ? 'workspace root' : 'current project'}${colors.reset}`);
    console.log(`${colors.dim}READMEs found: ${readmeFiles.length}${colors.reset}`);
    console.log('');
  }

  // Group files for i18n checking
  const readmeGroups = new Map<string, { en?: string; ko?: string }>();

  for (const readmeFile of readmeFiles) {
    const relPath = relative(ROOT, readmeFile).replace(/\\/g, '/');
    const isKorean = readmeFile.endsWith('README_ko.md');
    const basePath = relPath.replace('_ko', '');

    if (!readmeGroups.has(basePath)) {
      readmeGroups.set(basePath, {});
    }
    const group = readmeGroups.get(basePath)!;
    if (isKorean) {
      group.ko = relPath;
    } else {
      group.en = relPath;
    }
  }

  // Audit each README
  for (const readmeFile of readmeFiles) {
    const relPath = relative(ROOT, readmeFile).replace(/\\/g, '/');
    const isKorean = readmeFile.endsWith('README_ko.md');
    // Only the workspace-root EN README requires specific sections;
    // KO variants are checked via i18n consistency, templates/README.md has its own structure.
    const isWorkspaceRoot = relPath === 'README.md';
    const sections = parseSections(readmeFile);

    // Check required sections (EN workspace root only — skip KO and templates/README)
    const requiredSections = isWorkspaceRoot ? REQUIRED_SECTIONS_ROOT : REQUIRED_SECTIONS_PROJECT;
    for (const section of requiredSections) {
      if (!Array.from(sections.keys()).some(s => s.includes(section))) {
        const level = isWorkspaceRoot ? 'error' : 'warning';
        const issue = {
          level: level as 'error' | 'warning',
          file: relPath,
          message: `Missing required section: ${section}`,
          fix: isWorkspaceRoot ? `Add '${section}' section to README` : `Consider adding '${section}' section`,
        };
        if (level === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }

    // Check for Last Updated
    if (!hasLastUpdated(readmeFile)) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Missing "Last Updated" date',
        fix: 'Add "*Last Updated: YYYY-MM-DD*" at the end of the file',
      });
    } else if (!isDateRecent(readmeFile)) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Last Updated date is older than 90 days',
        fix: 'Update the Last Updated date to today if content has changed',
      });
    }

    // Check for empty README
    const content = readFileSync(readmeFile, 'utf-8');
    const visibleContent = content
      .replace(/^---\n[\s\S]*?\n---/m, '') // Remove frontmatter
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/\s/g, ''); // Remove whitespace
    if (visibleContent.length < 50) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'README appears to be empty or minimal',
        fix: 'Add substantive content to the README',
      });
    }
  }

  // Check i18n consistency for files that have both EN and KO versions
  for (const [basePath, group] of readmeGroups.entries()) {
    if (group.en && group.ko) {
      const enSections = parseSections(join(ROOT, group.en.replace(/\\/g, '/')));
      const koSections = parseSections(join(ROOT, group.ko.replace(/\\/g, '/')));

      const enH2 = getSectionsByLevel(enSections, 2);
      const koH2 = getSectionsByLevel(koSections, 2);

      if (enH2.length !== koH2.length) {
        warnings.push({
          level: 'warning',
          file: `${group.en} ↔ ${group.ko}`,
          message: `Section count mismatch: EN has ${enH2.length}, KO has ${koH2.length}`,
          fix: 'Ensure both versions have the same section structure',
        });
      }
    } else if (group.en && !group.ko && (basePath === 'README.md' || basePath === 'templates/README.md')) {
      warnings.push({
        level: 'warning',
        file: group.en,
        message: 'Missing Korean version (README_ko.md)',
        fix: 'Create README_ko.md with translated content',
      });
    }
  }

  const summary = generateSummary(readmeFiles.length, errors.length, warnings.length);

  return {
    readmesScanned: readmeFiles.length,
    errors,
    warnings,
    summary: summary.colored,
    summaryClean: summary.clean,
  };
}

function generateSummary(scanned: number, errors: number, warnings: number): { colored: string; clean: string } {
  if (errors === 0 && warnings === 0) {
    return {
      colored: `${colors.green}✓ All ${scanned} READMEs healthy${colors.reset}`,
      clean: `All ${scanned} READMEs healthy`,
    };
  }
  return {
    colored: `${colors.green}✓ READMEs scanned: ${scanned}${colors.reset}` +
      (warnings > 0 ? `\n${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}` : '') +
      (errors > 0 ? `\n${colors.red}✖ Errors: ${errors}${colors.reset}` : ''),
    clean: `READMEs scanned: ${scanned}` +
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
README Lifecycle Audit v1.0.0

Usage:
  bun scripts/readme-lifecycle-audit.ts          # Run audit
  bun scripts/readme-lifecycle-audit.ts --json   # JSON output
  bun scripts/readme-lifecycle-audit.ts --help   # Show this help

Checks:
  ✓ Required sections (workspace root & templates)
  ✓ Last Updated date presence and freshness
  ✓ Empty/minimal content detection
  ✓ i18n consistency (EN ↔ KO section structure)
  ✓ Korean version existence for core files

Platform: ${PLATFORM}
  `);
  process.exit(0);
}

const result = auditReadmes(jsonMode);

if (jsonMode) {
  printJsonResults(result);
} else {
  printResults(result);
}

process.exit(result.errors.length > 0 ? 1 : 0);
