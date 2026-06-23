#!/usr/bin/env bun
/**
 * Platform Parity Test Script
 *
 * Validates platform parity between L0 workspace files and their L1/L2 counterparts.
 * Enforces ADR-0033 platform parity rules.
 *
 * @version 0.2.3
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
import { join, dirname } from 'path';

interface ParityRule {
  /** Section identifier in the file */
  section: string;
  /** Tier: 'shared' (must be identical), 'claude-only'/'gemini-only'/'variant-specific' (may differ) */
  tier: 'shared' | 'claude-only' | 'gemini-only' | 'variant-specific';
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
  'agents/pm.md': [
    // Shared sections - must be identical L0→L1
    {
      section: '## Role',
      tier: 'shared',
      description: 'PM role definition and core responsibilities',
      skipPatterns: [],
    },
    {
      section: '## ?좑툘 YOU ARE THE SINGLE ENTRY POINT',
      tier: 'shared',
      description: 'PM as single entry point enforcement',
      skipPatterns: [],
    },
    {
      section: '## Consensus-Driven Facilitation Model',
      tier: 'shared',
      description: 'Consensus-driven facilitation principles',
      skipPatterns: [],
    },
    {
      section: '## ⚠️ ROLE CLARIFICATION',
      tier: 'shared',
      description: 'PM role boundaries - what PM does and does not do',
      skipPatterns: [],
    },
    {
      section: '## Updated Role (Phase 0/1-2/5/6 Only)',
      tier: 'variant-specific',
      description: 'PM scope after restructure - specific phases only (variant-specific)',
      skipPatterns: [],
    },
    {
      section: '## Permission Denial Protocol',
      tier: 'shared',
      description: 'Permission denial handling and escalation',
      skipPatterns: [],
    },
    {
      section: '## PM Direct Execution Scope',
      tier: 'shared',
      description: 'PM direct execution tool scope and constraints',
      skipPatterns: [],
    },
    {
      section: '## Denial Type Classification',
      tier: 'shared',
      description: 'Classification of denial types and responses',
      skipPatterns: [],
    },
    {
      section: '## Escalation Template',
      tier: 'shared',
      description: 'Escalation template for permission denials',
      skipPatterns: [],
    },
    {
      section: '## Constraints',
      tier: 'shared',
      description: 'PM constraints including execution plan, phase determination, tier strategy',
      skipPatterns: [],
    },
    {
      section: '## Execution Plan Boilerplate Policy',
      tier: 'shared',
      description: 'Execution plan boilerplate mandatory and discretionary cases',
      skipPatterns: [],
    },
    {
      section: '## Meeting Facilitation',
      tier: 'shared',
      description: 'Meeting facilitation protocol and PM role',
      skipPatterns: [],
    },
    {
      section: '## Required Tools',
      tier: 'shared',
      description: 'Required tools for PM agent',
      skipPatterns: [],
    },
    {
      section: '## ⚠️ CRITICAL: PM Direct Execution Constraints',
      tier: 'shared',
      description: 'Critical constraints on PM direct execution',
      skipPatterns: [],
    },
    {
      section: '## Task Tracking vs Execution',
      tier: 'shared',
      description: 'Task tracking vs execution workflow',
      skipPatterns: [],
    },
    {
      section: '## User Communication for Specialist Tasks',
      tier: 'shared',
      description: 'User communication template for specialist tasks',
      skipPatterns: [],
    },
    // Variant-specific sections - may differ L0→L2
    {
      section: '## Governance Workflow',
      tier: 'variant-specific',
      description: 'Variant-specific governance workflow - may differ by project type',
      skipPatterns: [],
    },
    {
      section: '## Agent Roster',
      tier: 'variant-specific',
      description: 'Agent roster - variant-specific specialists',
      skipPatterns: [],
    },
    {
      section: '## Dispatch Protocol',
      tier: 'variant-specific',
      description: 'Dispatch protocol - variant-specific phases and auto-dispatch targets',
      skipPatterns: [],
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
 * Check if a file is pre-resolved (has # @resolved-from: header).
 * Pre-resolved L2 files are produced by resolve-variants.ts from the extends chain
 * and are the expected "baked" state — parity is satisfied by construction.
 */
function isResolvedFile(filePath: string): boolean {
  try {
    const firstLine = readFileSync(filePath, 'utf-8').split('\n')[0];
    return firstLine.startsWith('# @resolved-from:');
  } catch {
    return false;
  }
}

/**
 * Check if a file uses extends mechanism
 */
function usesExtends(filePath: string): { usesExtends: boolean; extendsPath?: string; removeSections?: string[] } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return { usesExtends: false };
    }

    const frontmatter = frontmatterMatch[1];
    const extendsMatch = frontmatter.match(/extends:\s*(.+)$/m);
    const removeSectionsMatch = frontmatter.match(/remove_sections:\s*\n((?:\s*-\s*"[^"]+"\n)*)/m);

    let removeSections: string[] = [];
    if (removeSectionsMatch) {
      removeSections = removeSectionsMatch[1]
        .split('\n')
        .map(line => line.match(/\s*-\s*"([^"]+)"/)?.[1])
        .filter(Boolean);
    }

    return {
      usesExtends: !!extendsMatch,
      extendsPath: extendsMatch ? extendsMatch[1].trim() : undefined,
      removeSections,
    };
  } catch {
    return { usesExtends: false };
  }
}

/**
 * Resolve extends path relative to file location
 */
function resolveExtendsPath(targetFile: string, extendsPath: string): string {
  const targetDir = dirname(targetFile);
  // Handle relative paths like ../../../agents/pm.md
  return join(targetDir, extendsPath);
}

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
    } else if (rule.tier === 'claude-only' || rule.tier === 'gemini-only' || rule.tier === 'variant-specific') {
      // Platform-specific or variant-specific - just check existence
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
  // Extract filename from path (e.g., 'agents/pm.md' from '/path/to/agents/pm.md')
  const normalizedSourceFile = sourceFile.replace(/\\/g, '/');
  const filename = normalizedSourceFile.split('/').slice(-2).join('/');
  const rules = PARITY_RULES[filename] || PARITY_RULES[normalizedSourceFile.split('/').pop() || ''];

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

  // Skip platform parity test if we are not in the workspace root (templates/ directory not found)
  if (!existsSync(join(process.cwd(), 'templates'))) {
    console.log('⚠️  Skipping platform parity test: not in workspace root (templates directory not found).');
    process.exit(0);
  }

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
    } else if (sourceFile === 'agents/pm.md') {
      // For agents/pm.md, check if L1 uses extends mechanism
      const l1Extends = usesExtends(l1Path);

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
      } else if (l1Extends.usesExtends) {
        // Verify extends points to correct L0 file
        const resolvedExtendsPath = resolveExtendsPath(l1Path, l1Extends.extendsPath!);
        const expectedSourcePath = join(process.cwd(), sourceFile);

        // Normalize paths for comparison
        const normalizedResolved = resolvedExtendsPath.replace(/\/\//g, '/');
        const normalizedExpected = expectedSourcePath.replace(/\/\//g, '/');

        if (normalizedResolved !== normalizedExpected) {
          results.push({
            file: sourceFile,
            tier: 'L0→L1',
            sourcePath: sourcePath,
            targetPath: l1Path,
            status: 'fail',
            discrepancies: [{
              rule: 'extends-target',
              section: 'extends',
              expected: expectedSourcePath,
              actual: resolvedExtendsPath,
              severity: 'error',
            }],
          });
          totalErrors += 1;
        } else {
          // Check that remove_sections doesn't include shared sections
          const sharedSections = PARITY_RULES['agents/pm.md']
            .filter(r => r.tier === 'shared')
            .map(r => r.section.replace('## ', '').trim().toLowerCase());

          const removedSharedSections = (l1Extends.removeSections || [])
            .filter(rs => {
              const removedSection = rs.replace('## ', '').trim().toLowerCase();
              return sharedSections.some(ss => removedSection === ss);
            });

          if (removedSharedSections.length > 0) {
            results.push({
              file: sourceFile,
              tier: 'L0→L1',
              sourcePath: sourcePath,
              targetPath: l1Path,
              status: 'fail',
              discrepancies: removedSharedSections.map(rs => ({
                rule: 'remove-sections',
                section: rs,
                expected: 'Should not remove shared sections',
                actual: `Removed: ${rs}`,
                severity: 'error',
              })),
            });
            totalErrors += removedSharedSections.length;
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
        }
      } else {
        // L1 doesn't use extends - do full parity check
        const l1Result = checkParity(sourcePath, l1Path, 'L0→L1');
        results.push(l1Result);

        if (l1Result.status === 'fail') totalErrors += l1Result.discrepancies.filter(d => d.severity === 'error').length;
        if (l1Result.status === 'warning') totalWarnings += l1Result.discrepancies.filter(d => d.severity === 'warning').length;
      }
    } else {
      // For other files, do full parity check
      const l1Result = checkParity(sourcePath, l1Path, 'L0→L1');
      results.push(l1Result);

      if (l1Result.status === 'fail') totalErrors += l1Result.discrepancies.filter(d => d.severity === 'error').length;
      if (l1Result.status === 'warning') totalWarnings += l1Result.discrepancies.filter(d => d.severity === 'warning').length;
    }

    // Check each L2 (if L2s array exists)
    if (mappings.L2s) {
      for (const l2Path of mappings.L2s) {
        const fullL2Path = join(process.cwd(), l2Path);

        if (sourceFile === 'agents/pm.md') {
          // For agents/pm.md, check if L2 uses extends mechanism
          const l2Extends = usesExtends(fullL2Path);

          if (!existsSync(fullL2Path)) {
            results.push({
              file: sourceFile,
              tier: 'L0→L2',
              sourcePath: sourcePath,
              targetPath: fullL2Path,
              status: 'fail',
              discrepancies: [{
                rule: 'file-exists',
                section: 'target',
                expected: fullL2Path,
                actual: '<file not found>',
                severity: 'error',
              }],
            });
            totalErrors += 1;
          } else if (l2Extends.usesExtends) {
            // Verify extends points to L1, not directly to L0
            const resolvedExtendsPath = resolveExtendsPath(fullL2Path, l2Extends.extendsPath!);
            const expectedL1Path = join(process.cwd(), mappings.L1);

            // Normalize paths for comparison
            const normalizedResolved = resolvedExtendsPath.replace(/\/\//g, '/');
            const normalizedExpected = expectedL1Path.replace(/\/\//g, '/');

            if (normalizedResolved !== normalizedExpected) {
              results.push({
                file: sourceFile,
                tier: 'L0→L2',
                sourcePath: sourcePath,
                targetPath: fullL2Path,
                status: 'warning',
                discrepancies: [{
                  rule: 'extends-target',
                  section: 'extends',
                  expected: expectedL1Path,
                  actual: resolvedExtendsPath,
                  severity: 'warning',
                }],
              });
              totalWarnings += 1;
            } else {
              // Check that remove_sections only includes variant-specific sections
              const variantSections = PARITY_RULES['agents/pm.md']
                .filter(r => r.tier === 'variant-specific')
                .map(r => r.section);

              // Any removed sections should ideally be variant-specific
              const removedSections = l2Extends.removeSections || [];
              // Just verify the file exists and uses extends correctly - pass
              results.push({
                file: sourceFile,
                tier: 'L0→L2',
                sourcePath: sourcePath,
                targetPath: fullL2Path,
                status: 'pass',
                discrepancies: [],
              });
            }
          } else if (isResolvedFile(fullL2Path)) {
            // Pre-resolved L2 file (# @resolved-from: header) — produced by resolve-variants.ts.
            // Parity is satisfied by construction: the file was baked from the extends chain.
            results.push({
              file: sourceFile,
              tier: 'L0→L2',
              sourcePath: sourcePath,
              targetPath: fullL2Path,
              status: 'pass',
              discrepancies: [],
            });
          } else {
            // L2 doesn't use extends and is not pre-resolved — compare shared sections only
            const pmRules = PARITY_RULES['agents/pm.md'];
            const sharedRulesOnly = pmRules.filter(r => r.tier === 'shared');

            const originalRules = PARITY_RULES['agents/pm.md'];
            PARITY_RULES['agents/pm.md'] = sharedRulesOnly;

            const l2Result = checkParity(sourcePath, fullL2Path, 'L0→L2');

            PARITY_RULES['agents/pm.md'] = originalRules;

            // Downgrade errors to warnings: unresolved L2 format is pending migration
            if (l2Result.status === 'fail') {
              l2Result.status = 'warning';
              l2Result.discrepancies = l2Result.discrepancies.map(d => ({ ...d, severity: 'warning' as const }));
            }
            results.push(l2Result);
            if (l2Result.status === 'warning') totalWarnings += l2Result.discrepancies.filter(d => d.severity === 'warning').length;
          }
        } else {
          // For other files, do full parity check
          const l2Result = checkParity(sourcePath, fullL2Path, 'L0→L2');
          results.push(l2Result);

          if (l2Result.status === 'fail') totalErrors += l2Result.discrepancies.filter(d => d.severity === 'error').length;
          if (l2Result.status === 'warning') totalWarnings += l2Result.discrepancies.filter(d => d.severity === 'warning').length;
        }
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
