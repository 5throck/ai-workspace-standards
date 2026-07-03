#!/usr/bin/env bun
/**
 * Wave 1.5 — Agent/Skill Normalizer
 *
 * Detects skill content embedded in agent files, extracts it into proper
 * skill files, and normalizes skill frontmatter/body section names to match
 * the canonical variant specialist structure.
 *
 * @version 1.0.1
 * @phase 1.5: Agent/Skill Normalization
 *
 * See: docs/adr/0042-l2-variant-pipeline-wave15-golden-reference.md
 * See: docs/designs/variant-specialist-skill-structure.md
 *
 * Dependencies:
 * - helpers/scan-l2-project.ts (L2ScanResult, FileClassification)
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 */

import { join, dirname, basename } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { L2ScanResult } from './scan-l2-project.ts';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.ts';
import { warningError, ErrorPhase } from '../lib/error-handling.ts';

// ============================================================================
// TYPES
// ============================================================================

export type SkillConfidence = 'high' | 'medium' | 'low';

export interface DetectedSkillPattern {
  /** Section header that triggered detection */
  header: string;
  /** Starting line index in the file */
  lineIndex: number;
  /** Confidence level */
  confidence: SkillConfidence;
}

export interface ExtractedSkill {
  /** Skill slug derived from agent name + section */
  slug: string;
  /** Full path where the skill file should be written */
  targetPath: string;
  /** Content for the new SKILL.md */
  content: string;
  /** Source agent file */
  sourceAgentPath: string;
  /** Confidence that led to extraction */
  confidence: SkillConfidence;
}

export interface NormalizedFile {
  /** Source path of the file */
  sourcePath: string;
  /** Whether the file was modified */
  modified: boolean;
  /** Updated content (same as original if not modified) */
  content: string;
}

export interface NormalizationWarning {
  level: 'warn' | 'info';
  filePath: string;
  message: string;
}

export interface NormalizationResult {
  /** Agent files after normalization (skill content removed) */
  normalizedAgents: NormalizedFile[];
  /** Skill files after frontmatter/section normalization */
  normalizedSkills: NormalizedFile[];
  /** New skill files extracted from agent bodies */
  extractedSkills: ExtractedSkill[];
  /** MEDIUM confidence detections awaiting user approval */
  pendingApprovals: DetectedSkillPattern & { agentPath: string }[];
  /** Warnings and info messages */
  warnings: NormalizationWarning[];
}

// ============================================================================
// SKILL PATTERN DETECTION
// ============================================================================

/**
 * Patterns by confidence level.
 * HIGH → auto-extract. MEDIUM → flag for approval. LOW → ignore.
 */
const SKILL_PATTERNS: Record<SkillConfidence, RegExp[]> = {
  high: [
    /^## Step \d+/m,
    /^## 절차/m,
    /^## Process Steps/m,
    /^## Execution Steps/m,
    /Next Step:/m,
    /^## Stage \d+/m,
  ],
  medium: [
    /^## Process$/m,
    /^## How To/m,
    /^## Procedure/m,
  ],
  low: [
    // LOW patterns are intentionally not auto-extracted
    /^## Tools$/m,
  ],
};

/**
 * Section headers that are valid in BOTH agent and skill files — do not flag these.
 */
const AMBIGUOUS_HEADERS = new Set([
  '## Output Format',
  '## Constraints',
  '## Tools',
  '## Related Skills',
]);

/**
 * Canonical agent body sections (Layer 1) — must be present in agent files.
 * Source: docs/designs/variant-specialist-agent-structure.md
 */
export const AGENT_REQUIRED_SECTIONS = [
  '## Role',
  '## ⚠️ PM-ONLY INVOCATION',
  '## Responsibilities',
  '## Output Format',
  '## Constraints',
  '## Meeting Participation',
  '## Dispatch Protocol',
];

/**
 * Canonical skill body sections (Layer 1).
 * Source: docs/designs/variant-specialist-skill-structure.md
 */
export const SKILL_REQUIRED_SECTIONS = [
  '## Context',
  '## When to Use',
  '## Execution Steps',
  '## Output Format',
  '## Related Skills',
];

/**
 * Detect skill content patterns in an agent body.
 */
function detectSkillPatterns(body: string): DetectedSkillPattern[] {
  const detected: DetectedSkillPattern[] = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('## ')) continue;
    if (AMBIGUOUS_HEADERS.has(line.trim())) continue;

    for (const [level, patterns] of Object.entries(SKILL_PATTERNS) as [SkillConfidence, RegExp[]][]) {
      if (level === 'low') continue;
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          detected.push({ header: line.trim(), lineIndex: i, confidence: level });
          break;
        }
      }
    }
  }

  return detected;
}

// ============================================================================
// FRONTMATTER PARSING / MANIPULATION
// ============================================================================

interface ParsedFrontmatter {
  fields: Record<string, string>;
  body: string;
  raw: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const [, fm, body] = match;
  const fields: Record<string, string> = {};

  for (const line of fm.split('\n')) {
    const kv = line.match(/^([a-z_][a-z0-9_-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }

  return { fields, body, raw: fm };
}

function rebuildFrontmatter(fields: Record<string, string>, raw: string, body: string): string {
  let fm = raw;
  for (const [key, value] of Object.entries(fields)) {
    const linePattern = new RegExp(`^${key}:.*$`, 'm');
    if (linePattern.test(fm)) {
      fm = fm.replace(linePattern, `${key}: ${value}`);
    } else {
      fm += `\n${key}: ${value}`;
    }
  }
  return `---\n${fm.replace(/^\n+/, '').replace(/\n+$/, '')}\n---\n${body}`;
}

// ============================================================================
// AGENT FILE NORMALIZATION
// ============================================================================

/**
 * Normalize a single agent file.
 * - Detects embedded skill patterns
 * - HIGH confidence: extracts to skill file, inserts reference pointer
 * - MEDIUM confidence: returns as pending approval
 * - Emits warnings for missing required sections
 */
function normalizeAgentFile(
  filePath: string,
  content: string,
  agentName: string,
  l2ProjectPath: string,
  auto: boolean,
): {
  normalized: NormalizedFile;
  extracted: ExtractedSkill[];
  pending: (DetectedSkillPattern & { agentPath: string })[];
  warnings: NormalizationWarning[];
} {
  const extracted: ExtractedSkill[] = [];
  const pending: (DetectedSkillPattern & { agentPath: string })[] = [];
  const warnings: NormalizationWarning[] = [];

  const fmMatch = content.match(/^(---\n[\s\S]*?\n---\n?)/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const body = fmMatch ? content.slice(frontmatter.length) : content;

  const detected = detectSkillPatterns(body);
  let updatedBody = body;
  let modified = false;

  for (const pattern of detected) {
    if (pattern.confidence === 'high' || (auto && pattern.confidence === 'medium')) {
      // Extract section content
      const lines = updatedBody.split('\n');
      const startIdx = pattern.lineIndex;

      // Find end of section (next ## at same or higher level, or EOF)
      let endIdx = lines.length;
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].match(/^## /)) {
          endIdx = i;
          break;
        }
      }

      const sectionLines = lines.slice(startIdx, endIdx);
      const sectionContent = sectionLines.join('\n').trimEnd();

      // Derive skill slug from agent name
      const headerSlug = pattern.header
        .replace(/^## /, '')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      const slug = `${agentName}-${headerSlug}`;
      const targetPath = join(l2ProjectPath, 'skills', slug, 'SKILL.md');

      const skillContent = `---
name: ${slug}
description: >
  Extracted from ${agentName} agent. ${pattern.header.replace(/^## /, '')}.
version: 1.0.0
status: active
owner: ${agentName}
last_reviewed: ${new Date().toISOString().split('T')[0]}
prerequisites: none
---

## Context

Extracted from \`agents/${agentName}.md\`. See the agent file for dispatch context.

## When to Use

- When \`${agentName}\` agent is dispatched to this stage

## Execution Steps

${sectionContent}

## Output Format

<!-- Define the output artifact produced by this execution -->

## Related Skills

<!-- Link related skills here -->
`;

      extracted.push({
        slug,
        targetPath,
        content: skillContent,
        sourceAgentPath: filePath,
        confidence: pattern.confidence,
      });

      // Remove extracted section from agent body; add reference pointer
      const pointer = `\nFull instructions: see \`skills/${slug}/SKILL.md\`.\n`;
      const before = lines.slice(0, startIdx).join('\n');
      const after = lines.slice(endIdx).join('\n');
      updatedBody = `${before}\n${pointer}\n${after}`;
      modified = true;

    } else if (pattern.confidence === 'medium') {
      pending.push({ ...pattern, agentPath: filePath });
    }
  }

  // Check required sections
  for (const section of AGENT_REQUIRED_SECTIONS) {
    if (!updatedBody.includes(section)) {
      warnings.push({
        level: 'warn',
        filePath,
        message: `Missing required agent section: "${section}"`,
      });
    }
  }

  return {
    normalized: {
      sourcePath: filePath,
      modified,
      content: modified ? `${frontmatter}${updatedBody}` : content,
    },
    extracted,
    pending,
    warnings,
  };
}

// ============================================================================
// SKILL FILE NORMALIZATION
// ============================================================================

/**
 * Normalize a single skill file.
 * - Adds missing frontmatter fields (status, owner, last_reviewed, prerequisites)
 * - Renames non-standard section headers to canonical names
 * - Adds ## Related Skills stub if absent
 * - Emits warnings for still-missing required sections
 */
function normalizeSkillFile(
  filePath: string,
  content: string,
): { normalized: NormalizedFile; warnings: NormalizationWarning[] } {
  const warnings: NormalizationWarning[] = [];
  let modified = false;

  // Frontmatter normalization
  const parsed = parseFrontmatter(content);
  let updatedContent = content;

  if (parsed) {
    const additions: Record<string, string> = {};
    if (!parsed.fields['status']) additions['status'] = 'active';
    if (!parsed.fields['owner']) additions['owner'] = 'pm';
    if (!parsed.fields['last_reviewed'])
      additions['last_reviewed'] = new Date().toISOString().split('T')[0];
    if (!parsed.fields['prerequisites']) additions['prerequisites'] = 'none';

    if (Object.keys(additions).length > 0) {
      updatedContent = rebuildFrontmatter(
        { ...parsed.fields, ...additions },
        parsed.raw,
        parsed.body,
      );
      modified = true;
    }
  }

  // Section header renaming
  const sectionRenames: [RegExp, string][] = [
    [/^## Role$/m, '## Context'],
    [/^## When to Invoke$/m, '## When to Use'],
    [/^## When to Invoke \(.*?\)$/m, '## When to Use'],
  ];

  for (const [pattern, replacement] of sectionRenames) {
    if (pattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(pattern, replacement);
      modified = true;
    }
  }

  // Add ## Related Skills stub if absent
  if (!updatedContent.includes('## Related Skills')) {
    updatedContent = updatedContent.trimEnd() + '\n\n## Related Skills\n\n<!-- Link related skills here -->\n';
    modified = true;
  }

  // Check required sections
  for (const section of SKILL_REQUIRED_SECTIONS) {
    if (!updatedContent.includes(section)) {
      warnings.push({
        level: 'warn',
        filePath,
        message: `Missing required skill section: "${section}"`,
      });
    }
  }

  return {
    normalized: { sourcePath: filePath, modified, content: updatedContent },
    warnings,
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run Wave 1.5 normalization over the L2 scan result.
 *
 * @param scanResult - Output from Wave 1 (scan-l2-project.ts)
 * @param l2ProjectPath - Absolute path to the L2 project root
 * @param options.auto - Treat MEDIUM-confidence skill patterns same as HIGH (no approval gate)
 * @param options.dryRun - Compute results but do not write any files
 */
export function normalizeAgentSkills(
  scanResult: L2ScanResult,
  l2ProjectPath: string,
  options: { auto?: boolean; dryRun?: boolean } = {},
): NormalizationResult {
  const { auto = false, dryRun = false } = options;

  const result: NormalizationResult = {
    normalizedAgents: [],
    normalizedSkills: [],
    extractedSkills: [],
    pendingApprovals: [],
    warnings: [],
  };

  for (const file of scanResult.files) {
    const isAgentFile =
      file.relativePath.match(/^agents\//) &&
      file.relativePath.endsWith('.md') &&
      !['pm.md', 'README.md', 'README_ko.md'].includes(basename(file.relativePath));

    const isSkillFile =
      file.relativePath.match(/^skills\//) &&
      basename(file.relativePath) === 'SKILL.md';

    if (!existsSync(file.relativePath)) continue;

    const content = readUTF8File(file.relativePath);

    if (isAgentFile) {
      const agentName = basename(file.relativePath, '.md');
      const { normalized, extracted, pending, warnings } = normalizeAgentFile(
        file.relativePath,
        content,
        agentName,
        l2ProjectPath,
        auto,
      );
      result.normalizedAgents.push(normalized);
      result.extractedSkills.push(...extracted);
      result.pendingApprovals.push(...pending);
      result.warnings.push(...warnings);

    } else if (isSkillFile) {
      const { normalized, warnings } = normalizeSkillFile(file.relativePath, content);
      result.normalizedSkills.push(normalized);
      result.warnings.push(...warnings);
    }
  }

  // Write files unless dry run
  if (!dryRun) {
    for (const agent of result.normalizedAgents) {
      if (agent.modified) {
        writeUTF8File(agent.sourcePath, agent.content);
      }
    }
    for (const skill of result.normalizedSkills) {
      if (skill.modified) {
        writeUTF8File(skill.sourcePath, skill.content);
      }
    }
    for (const extracted of result.extractedSkills) {
      const dir = dirname(extracted.targetPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeUTF8File(extracted.targetPath, extracted.content);
    }
  }

  return result;
}

/**
 * Format normalization result as a human-readable report string.
 */
export function formatNormalizationReport(result: NormalizationResult): string {
  const lines: string[] = [
    '=== Wave 1.5 — Agent/Skill Normalization Report ===',
    '',
    `Agent files processed : ${result.normalizedAgents.length}`,
    `  Modified            : ${result.normalizedAgents.filter(f => f.modified).length}`,
    `Skill files processed : ${result.normalizedSkills.length}`,
    `  Modified            : ${result.normalizedSkills.filter(f => f.modified).length}`,
    `Skills extracted      : ${result.extractedSkills.length}`,
    `Pending approvals     : ${result.pendingApprovals.length}`,
    `Warnings              : ${result.warnings.filter(w => w.level === 'warn').length}`,
    '',
  ];

  if (result.extractedSkills.length > 0) {
    lines.push('Extracted skills:');
    for (const s of result.extractedSkills) {
      lines.push(`  [${s.confidence.toUpperCase()}] ${s.slug} → ${s.targetPath}`);
    }
    lines.push('');
  }

  if (result.pendingApprovals.length > 0) {
    lines.push('Pending user approval (MEDIUM confidence):');
    for (const p of result.pendingApprovals) {
      lines.push(`  ${p.agentPath}: "${p.header}" (line ${p.lineIndex})`);
    }
    lines.push('  Re-run with --auto to extract these automatically.');
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of result.warnings) {
      lines.push(`  [${w.level.toUpperCase()}] ${w.filePath}: ${w.message}`);
    }
  }

  return lines.join('\n');
}
