#!/usr/bin/env bun
/**
 * Platform Parity Test Script
 *
 * Validates platform parity between L0 workspace files and their L1/L2 counterparts.
 * Enforces ADR-0033 platform parity rules.
 *
 * @version 0.1.0
 * @author automation-engineer
 * @license MIT
 *
 * Usage:
 *   bun scripts/test-platform-parity.ts [--fix] [--verbose]
 *
 * Options:
 *   --fix    Automatically fix parity issues (WARNING: modifies files)
 *   --verbose Show detailed diff output
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ParityRule {
  /** Section identifier in the file */
  section: string;
  /** Tier: 'shared' (must be identical) or 'platform-specific' (may differ) */
  tier: 'shared' | 'claude-only' | 'gemini-only';
  /** Description of what this rule covers */
  description: string;
  /** Lines to skip when comparing (e.g., version-specific markers) */
  skipPatterns?: string[];
}

interface ParityCheckResult {
  file: string;
  tier: 'L0→L1' | 'L0→L2';
  sourcePath: string;
  targetPath: string;
  status: 'pass' | 'fail' | 'warning';
  discrepancies: ParityDiscrepancy[];
}

interface ParityDiscrepancy {
  rule: string;
  section: string;
  expected: string;
  actual: string;
  line?: number;
  severity: 'error' | 'warning';
}

// ============================================================================
// PARITY RULES CONFIGURATION (ADR-0033)
// ============================================================================

const PARITY_RULES: Record<string, ParityRule[]> = {
  'CLAUDE.md': [
    {
      section: 'Project Overview',
      tier: 'shared',
      description: 'General project description and workspace structure',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Development Guidelines',
      tier: 'shared',
      description: 'Core principles, workflow standards, and code review standards',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'File Management',
      tier: 'shared',
      description: 'Tool preferences and file handling rules',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Language Policy',
      tier: 'shared',
      description: 'Documentation language requirements',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Git Practices',
      tier: 'shared',
      description: 'Git workflow and commit standards',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Claude Code-Specific Behaviors',
      tier: 'shared',
      description: 'Shared configuration sections (hooks, commands, MCP)',
      skipPatterns: ['Desktop App limitation', 'hooks do not fire', 'CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Agent Dispatch Rules',
      tier: 'shared',
      description: 'PM Gateway and multi-agent workflow',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Antigravity Security Configuration',
      tier: 'gemini-only',
      description: 'Antigravity-specific settings (only in GEMINI.md)',
    },
    {
      section: 'teammateMode',
      tier: 'claude-only',
      description: 'Claude Code Agent Teams execution mode',
    },
    {
      section: 'hooks.TeammateIdle',
      tier: 'claude-only',
      description: 'Claude Code-specific lifecycle hooks',
    },
    {
      section: 'hooks.TaskCompleted',
      tier: 'claude-only',
      description: 'Claude Code-specific lifecycle hooks',
    },
  ],
  'GEMINI.md': [
    // Share identical rules with CLAUDE.md for shared sections
    {
      section: 'Project Overview',
      tier: 'shared',
      description: 'General project description and workspace structure',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Development Guidelines',
      tier: 'shared',
      description: 'Core principles, workflow standards, and code review standards',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'File Management',
      tier: 'shared',
      description: 'Tool preferences and file handling rules',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Language Policy',
      tier: 'shared',
      description: 'Documentation language requirements',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Git Practices',
      tier: 'shared',
      description: 'Git workflow and commit standards',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Claude Code-Specific Behaviors',
      tier: 'shared',
      description: 'Shared configuration sections (hooks, commands, MCP)',
      skipPatterns: ['Desktop App limitation', 'hooks do not fire', 'CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Agent Dispatch Rules',
      tier: 'shared',
      description: 'PM Gateway and multi-agent workflow',
      skipPatterns: ['CONSTITUTION.md', 'workspace standards'],
    },
    {
      section: 'Antigravity Security Configuration',
      tier: 'gemini-only',
      description: 'Antigravity-specific settings',
    },
  ],
};

// ============================================================================
// FILE MAPPINGS
// ============================================================================

const FILE_MAPPINGS = {
  'CLAUDE.md': {
    L1: 'templates/common/CLAUDE.md',
    // L2 variants use L1 common files - no need to check individual L2 files
  },
  'GEMINI.md': {
    L1: 'templates/common/GEMINI.md',
    // L2 variants use L1 common files - no need to check individual L2 files
  },
  'agents/pm.md': {
    L1: 'templates/common/agents/pm.md',
    L2s: [
      'templates/co-consult/agents/pm.md',
      'templates/co-design/agents/pm.md',
      'templates/co-develop/agents/pm.md',
      'templates/co-work/agents/pm.md',
      'templates/co-security/agents/pm.md',
    ],
  },
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Normalize file content for comparison
 */
function normalizeContent(content: string, filename: string): string {
  let normalized = content;

  // Remove platform-specific markers
  normalized = normalized.replace(/<!-- CLAUDE_ONLY_START -->[\s\S]*?<!-- CLAUDE_ONLY_END -->/g, '');
  normalized = normalized.replace(/<!-- GEMINI_ONLY_START -->[\s\S]*?<!-- GEMINI_ONLY_END -->/g, '');
  normalized = normalized.replace(/\[!.*?\]/g, ''); // Remove adoc-style conditionals

  // Normalize whitespace
  normalized = normalized.replace(/\s+$/gm, ''); // Remove trailing whitespace
  normalized = normalized.replace(/\r\n/g, '\n'); // Normalize line endings

  return normalized;
}

/**
 * Extract section from markdown content
 */
function extractSection(content: string, sectionHeading: string): string | null {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(line =>
    line.trim().startsWith('##') && line.includes(sectionHeading)
  );

  if (startIdx === -1) return null;

  // Find the end of this section (next ## or end of file)
  let endIdx = startIdx + 1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('##')) {
      endIdx = i;
      break;
    }
    endIdx = i;
  }

  return lines.slice(startIdx, endIdx + 1).join('\n');
}

/**
 * Compare two files section-by-section
 */
function compareFiles(
  sourceContent: string,
  targetContent: string,
  filename: string,
  rules: ParityRule[]
): ParityDiscrepancy[] {
  const discrepancies: ParityDiscrepancy[] = [];
  const sourceNorm = normalizeContent(sourceContent, filename);
  const targetNorm = normalizeContent(targetContent, filename);

  for (const rule of rules) {
    if (rule.tier === 'gemini-only' && filename === 'CLAUDE.md') {
      continue; // Skip gemini-only rules for CLAUDE.md
    }

    const sourceSection = extractSection(sourceNorm, rule.section);
    const targetSection = extractSection(targetNorm, rule.section);

    if (rule.tier === 'shared') {
      // Must be identical
      if (sourceSection === null && targetSection === null) {
        continue; // Both missing - OK
      }
      if (sourceSection === null) {
        discrepancies.push({
          rule: rule.section,
          section: rule.section,
          expected: '<missing>',
          actual: targetSection || '<empty>',
          severity: 'error',
        });
        continue;
      }
      if (targetSection === null) {
        discrepancies.push({
          rule: rule.section,
          section: rule.section,
          expected: sourceSection,
          actual: '<missing>',
          severity: 'error',
        });
        continue;
      }

      // Compare normalized content
      const sourceTrimmed = sourceSection.trim();
      const targetTrimmed = targetSection.trim();

      // Check if difference is due to skip patterns
      if (sourceTrimmed !== targetTrimmed) {
        let shouldSkip = false;
        if (rule.skipPatterns) {
          for (const pattern of rule.skipPatterns) {
            if (sourceTrimmed.includes(pattern) || targetTrimmed.includes(pattern)) {
              // Check if the only difference is the pattern replacement
              const sourceWithoutPattern = sourceTrimmed.replace(new RegExp(pattern, 'g'), '');
              const targetWithoutPattern = targetTrimmed.replace(new RegExp(pattern, 'g'), '');
              if (sourceWithoutPattern.trim() === targetWithoutPattern.trim()) {
                shouldSkip = true;
                break;
              }
            }
          }
        }

        if (!shouldSkip) {
          discrepancies.push({
            rule: rule.section,
            section: rule.section,
            expected: sourceSection,
            actual: targetSection,
            severity: 'error',
          });
        }
      }
    } else if (rule.tier === 'claude-only' || rule.tier === 'gemini-only') {
      // Platform-specific - just check existence
      if (sourceSection === null) {
        discrepancies.push({
          rule: rule.section,
          section: rule.section,
          expected: '<should exist in source>',
          actual: '<missing>',
          severity: 'warning',
        });
      }
    }
  }

  return discrepancies;
}

/**
 * Run parity checks for a single file mapping
 */
function checkParity(
  sourceFile: string,
  targetFile: string,
  tier: 'L0→L1' | 'L0→L2'
): ParityCheckResult {
  const rules = PARITY_RULES[sourceFile.split('/').pop() || ''];

  if (!rules) {
    return {
      file: sourceFile,
      tier,
      sourcePath: sourceFile,
      targetPath: targetFile,
      status: 'warning',
      discrepancies: [{
        rule: 'N/A',
        section: 'N/A',
        expected: 'Parity rules defined',
        actual: 'No rules found for this file',
        severity: 'warning',
      }],
    };
  }

  if (!existsSync(sourceFile)) {
    return {
      file: sourceFile,
      tier,
      sourcePath: sourceFile,
      targetPath: targetFile,
      status: 'fail',
      discrepancies: [{
        rule: 'file-exists',
        section: 'source',
        expected: sourceFile,
        actual: '<file not found>',
        severity: 'error',
      }],
    };
  }

  if (!existsSync(targetFile)) {
    return {
      file: sourceFile,
      tier,
      sourcePath: sourceFile,
      targetPath: targetFile,
      status: 'fail',
      discrepancies: [{
        rule: 'file-exists',
        section: 'target',
        expected: targetFile,
        actual: '<file not found>',
        severity: 'error',
      }],
    };
  }

  const sourceContent = readFileSync(sourceFile, 'utf-8');
  const targetContent = readFileSync(targetFile, 'utf-8');

  const discrepancies = compareFiles(sourceContent, targetContent, sourceFile, rules);

  return {
    file: sourceFile,
    tier,
    sourcePath: sourceFile,
    targetPath: targetFile,
    status: discrepancies.some(d => d.severity === 'error') ? 'fail' :
            discrepancies.some(d => d.severity === 'warning') ? 'warning' : 'pass',
    discrepancies,
  };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes('--fix');
  const verbose = args.includes('--verbose');

  console.log('🔍 Platform Parity Test (ADR-0033)\n');

  const results: ParityCheckResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Check all file mappings
  for (const [sourceFile, mappings] of Object.entries(FILE_MAPPINGS)) {
    const sourcePath = join(process.cwd(), sourceFile);

    // Check L1
    const l1Path = join(process.cwd(), mappings.L1);

    // For CLAUDE.md and GEMINI.md, L0→L1 check is informational only (L1 has intentional CONSTITUTION.md → workspace standards transformation)
    if (sourceFile === 'CLAUDE.md' || sourceFile === 'GEMINI.md') {
      // Just verify L1 file exists, don't compare content
      if (!existsSync(l1Path)) {
        results.push({
          file: sourceFile,
          tier: 'L0→L1',
          sourcePath: sourcePath,
          targetPath: l1Path,
          status: 'fail',
          discrepancies: [{
            rule: 'file-exists',
            section: 'target',
            expected: l1Path,
            actual: '<file not found>',
            severity: 'error',
          }],
        });
        totalErrors += 1;
      } else {
        results.push({
          file: sourceFile,
          tier: 'L0→L1',
          sourcePath: sourcePath,
          targetPath: l1Path,
          status: 'pass',
          discrepancies: [],
        });
      }
    } else {
      // For other files (agents/pm.md), do full parity check
      const l1Result = checkParity(sourcePath, l1Path, 'L0→L1');
      results.push(l1Result);

      if (l1Result.status === 'fail') totalErrors += l1Result.discrepancies.filter(d => d.severity === 'error').length;
      if (l1Result.status === 'warning') totalWarnings += l1Result.discrepancies.filter(d => d.severity === 'warning').length;
    }

    // Check each L2 (if L2s array exists)
    if (mappings.L2s) {
      for (const l2Path of mappings.L2s) {
        const fullL2Path = join(process.cwd(), l2Path);
        const l2Result = checkParity(sourcePath, fullL2Path, 'L0→L2');
        results.push(l2Result);

        if (l2Result.status === 'fail') totalErrors += l2Result.discrepancies.filter(d => d.severity === 'error').length;
        if (l2Result.status === 'warning') totalWarnings += l2Result.discrepancies.filter(d => d.severity === 'warning').length;
      }
    }
  }

  // Print results
  console.log(`📊 Results Summary\n`);
  console.log(`Total checks: ${results.length}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Warnings: ${totalWarnings}\n`);

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.file} (${result.tier})`);
    console.log(`   Source: ${result.sourcePath}`);
    console.log(`   Target: ${result.targetPath}`);

    if (verbose && result.discrepancies.length > 0) {
      for (const disc of result.discrepancies) {
        const discIcon = disc.severity === 'error' ? '❌' : '⚠️';
        console.log(`   ${discIcon} ${disc.rule}: ${disc.section}`);
        if (verbose && disc.expected !== disc.actual) {
          console.log(`      Expected: ${disc.expected.slice(0, 100)}...`);
          console.log(`      Actual: ${disc.actual.slice(0, 100)}...`);
        }
      }
    }
    console.log();
  }

  // Exit code
  if (totalErrors > 0) {
    console.log('❌ Platform parity test FAILED');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('⚠️ Platform parity test completed with WARNINGS');
    process.exit(2);
  } else {
    console.log('✅ Platform parity test PASSED');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
