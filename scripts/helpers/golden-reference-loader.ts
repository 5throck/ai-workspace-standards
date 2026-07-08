#!/usr/bin/env bun
/**
 * Golden Reference Loader — Wave 3 structural comparison
 *
 * Returns the expected section structure (Layer 1 + Layer 2) for variant
 * specialist agent and skill files. Used by generate-variant.ts to detect
 * structural gaps in generated files.
 *
 * @version 1.0.1
 * @phase 3: Variant Generation (structural comparison)
 *
 * See: docs/adr/0042-l2-variant-pipeline-wave15-golden-reference.md
 * See: docs/designs/variant-specialist-agent-structure.md
 * See: docs/designs/variant-specialist-skill-structure.md
 *
 * Dependencies:
 * - lib/encoding-utils.ts (UTF-8 handling)
 */

import { join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import { readUTF8File } from '../lib/encoding-utils.ts';
import type { VariantType } from './registries/variant-type-registry.ts';
import { getValidationPolicy } from './registries/validation-policy.ts';

// Re-export for downstream consumers
export type { VariantType } from './registries/variant-type-registry.ts';

export interface GoldenStructure {
  /** Required sections present in all variants (Layer 1) */
  requiredSections: string[];
  /** Optional variantType-specific sections (Layer 2) */
  optionalSections: string[];
}

export interface StructuralGapReport {
  /** File path that was checked */
  filePath: string;
  /** File type */
  fileType: 'agent' | 'skill';
  /** Missing Layer 1 (required) sections */
  missingSections: string[];
  /** Missing Layer 2 (optional, informational only) sections */
  missingOptionalSections: string[];
  /** Whether the file passed Layer 1 check */
  passed: boolean;
}

// ============================================================================
// LAYER 1 — COMMON REQUIRED SECTIONS
// ============================================================================

/**
 * Required sections for all variant specialist agent files.
 * Source: docs/designs/variant-specialist-agent-structure.md
 */
export const AGENT_LAYER1_SECTIONS: string[] = [
  '## Role',
  '## ⚠️ PM-ONLY INVOCATION',
  '## Responsibilities',
  '## Output Format',
  '## Constraints',
  '## Meeting Participation',
  '## Dispatch Protocol',
];

/**
 * Required sections for all variant specialist skill files.
 * Source: docs/designs/variant-specialist-skill-structure.md
 */
export const SKILL_LAYER1_SECTIONS: string[] = [
  '## Context',
  '## When to Use',
  '## Execution Steps',
  '## Output Format',
  '## Related Skills',
];

// ============================================================================
// LAYER 2 — VARIANT-TYPE SPECIFIC SECTIONS
// ============================================================================

/**
 * Layer 2 sections are now sourced from the centralized validation-policy registry.
 * Use `getValidationPolicy(type).optionalAgentSections` and
 * `getValidationPolicy(type).optionalSkillSections` for per-type lookups.
 *
 * @see scripts/helpers/registries/validation-policy.ts
 */

// ============================================================================
// DYNAMIC LAYER 2 LOADING
// ============================================================================

const TEMPLATES_ROOT = join(process.cwd(), 'templates');

/**
 * Map variantType to template directory name (best effort).
 */
const VARIANT_TYPE_TO_DIR: Partial<Record<VariantType, string>> = {
  development: 'co-develop',
  security: 'co-security',
  consulting: 'co-consult',
  lecture: 'co-deck',
};

/**
 * Dynamically extract section headers from all agent files in an existing variant.
 * Returns headers that appear in MORE THAN HALF the agent files (variant-specific pattern).
 */
function loadDynamicLayer2Agents(variantType: VariantType): string[] {
  const dirName = VARIANT_TYPE_TO_DIR[variantType];
  if (!dirName) return [];

  const agentsDir = join(TEMPLATES_ROOT, dirName, 'agents');
  if (!existsSync(agentsDir)) return [];

  const agentFiles = readdirSync(agentsDir)
    .filter(f => f.endsWith('.md') && !['pm.md', 'README.md'].includes(f));

  if (agentFiles.length === 0) return [];

  const sectionCounts: Record<string, number> = {};

  for (const file of agentFiles) {
    const content = readUTF8File(join(agentsDir, file));
    const headers = content.match(/^## .+$/gm) ?? [];
    for (const h of headers) {
      const normalized = h.trim();
      // Skip Layer 1 sections
      if (AGENT_LAYER1_SECTIONS.includes(normalized)) continue;
      sectionCounts[normalized] = (sectionCounts[normalized] ?? 0) + 1;
    }
  }

  const threshold = Math.max(1, Math.floor(agentFiles.length / 2));
  return Object.entries(sectionCounts)
    .filter(([, count]) => count >= threshold)
    .map(([section]) => section);
}

/**
 * Dynamically extract section headers from all skill files in an existing variant.
 */
function loadDynamicLayer2Skills(variantType: VariantType): string[] {
  const dirName = VARIANT_TYPE_TO_DIR[variantType];
  if (!dirName) return [];

  const skillsDir = join(TEMPLATES_ROOT, dirName, 'skills');
  if (!existsSync(skillsDir)) return [];

  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(skillsDir, d.name, 'SKILL.md'))
    .filter(p => existsSync(p));

  if (skillDirs.length === 0) return [];

  const sectionCounts: Record<string, number> = {};

  for (const skillPath of skillDirs) {
    const content = readUTF8File(skillPath);
    const headers = content.match(/^## .+$/gm) ?? [];
    for (const h of headers) {
      const normalized = h.trim();
      if (SKILL_LAYER1_SECTIONS.includes(normalized)) continue;
      sectionCounts[normalized] = (sectionCounts[normalized] ?? 0) + 1;
    }
  }

  const threshold = Math.max(1, Math.floor(skillDirs.length / 2));
  return Object.entries(sectionCounts)
    .filter(([, count]) => count >= threshold)
    .map(([section]) => section);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns the expected section structure for a variant specialist agent file.
 *
 * Layer 1: always required (from canonical spec)
 * Layer 2: variantType-specific (from existing variant or hardcoded fallback)
 *
 * @param variantType - Type of the variant being generated
 * @param useDynamic - Whether to load Layer 2 dynamically from existing template (default: true)
 */
export function getAgentGoldenStructure(
  variantType: VariantType,
  useDynamic = true,
): GoldenStructure {
  const layer1 = [...AGENT_LAYER1_SECTIONS];
  const validationPolicy = getValidationPolicy(variantType);
  const hardcoded = [...(validationPolicy.optionalAgentSections ?? [])];
  const dynamic = useDynamic ? loadDynamicLayer2Agents(variantType) : [];

  // Merge hardcoded + dynamic, deduplicate, remove Layer 1 overlaps
  const layer2 = [...new Set([...hardcoded, ...dynamic])].filter(
    s => !layer1.includes(s),
  );

  return { requiredSections: layer1, optionalSections: layer2 };
}

/**
 * Returns the expected section structure for a variant specialist skill file.
 */
export function getSkillGoldenStructure(
  variantType: VariantType,
  useDynamic = true,
): GoldenStructure {
  const layer1 = [...SKILL_LAYER1_SECTIONS];
  const validationPolicy = getValidationPolicy(variantType);
  const hardcoded = [...(validationPolicy.optionalSkillSections ?? [])];
  const dynamic = useDynamic ? loadDynamicLayer2Skills(variantType) : [];

  const layer2 = [...new Set([...hardcoded, ...dynamic])].filter(
    s => !layer1.includes(s),
  );

  return { requiredSections: layer1, optionalSections: layer2 };
}

/**
 * Check a single file's content against a golden structure and return a gap report.
 *
 * @param filePath - Path for display in the report
 * @param content - File content to check
 * @param golden - Golden structure from getAgentGoldenStructure / getSkillGoldenStructure
 * @param fileType - 'agent' or 'skill'
 */
export function checkStructuralGaps(
  filePath: string,
  content: string,
  golden: GoldenStructure,
  fileType: 'agent' | 'skill',
): StructuralGapReport {
  const missingSections = golden.requiredSections.filter(s => !content.includes(s));
  const missingOptionalSections = golden.optionalSections.filter(s => !content.includes(s));

  return {
    filePath,
    fileType,
    missingSections,
    missingOptionalSections,
    passed: missingSections.length === 0,
  };
}

/**
 * Format a list of gap reports as a human-readable report section.
 */
export function formatGapReport(reports: StructuralGapReport[]): string {
  const lines: string[] = ['=== Wave 3 — Golden Reference Structural Gap Report ===', ''];

  const failed = reports.filter(r => !r.passed);
  const passed = reports.filter(r => r.passed);

  lines.push(`Files checked : ${reports.length}`);
  lines.push(`Passed        : ${passed.length}`);
  lines.push(`Warnings      : ${failed.length}`);
  lines.push('');

  for (const report of failed) {
    lines.push(`[WARN] ${report.filePath} (${report.fileType})`);
    for (const s of report.missingSections) {
      lines.push(`       Missing Layer 1 section: "${s}"`);
    }
  }

  for (const report of reports.filter(r => r.missingOptionalSections.length > 0)) {
    for (const s of report.missingOptionalSections) {
      lines.push(`[INFO] ${report.filePath}: Missing Layer 2 section: "${s}"`);
    }
  }

  return lines.join('\n');
}
