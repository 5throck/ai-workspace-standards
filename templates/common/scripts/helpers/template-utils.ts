#!/usr/bin/env bun
/**
 * template-utils.ts — Shared template application utilities
 *
 * Provides applyTemplate() (generic renderer) and applyContextTemplate()
 * (context.md convenience wrapper) used by:
 *   - generate-variant.ts (L3→L2 variant promotion: context.md + README rendering)
 *   - new-project.ts (L1→L3 project deployment: context.md)
 *   - create-l3-scaffold.ts (L3 project README stub rendering)
 *
 * @version 1.1.1
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ContextTemplateSubstitutions {
  variantName: string;
  version: string;
  pmRoleDescription: string;
}

/**
 * Generic template renderer: reads a template file, applies {{KEY}} → value
 * substitutions for every entry in `substitutions`, and writes the result.
 *
 * This is the shared core for applyContextTemplate() (variant.context.template.md)
 * and generate-variant.ts README rendering (README.template.md / README_ko.template.md).
 * Placeholders not present in the map are passed through untouched.
 *
 * @param templatePath  Absolute or CWD-relative path to the source template
 * @param outputPath    Path where the rendered file will be written
 * @param substitutions Map of placeholder name (without braces, e.g. `VARIANT_NAME`) → value
 * @returns             The outputPath that was written
 */
export function applyTemplate(
  templatePath: string,
  outputPath: string,
  substitutions: Record<string, string>
): string {
  if (!existsSync(templatePath)) {
    throw new Error(`applyTemplate: template not found at ${templatePath}`);
  }

  let content = readFileSync(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(substitutions)) {
    // Keys are identifier-like (UPPER_SNAKE_CASE); escape any regex metacharacters defensively.
    const pattern = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g');
    content = content.replace(pattern, value);
  }

  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

/**
 * Reads a context template file, applies placeholder substitutions, and writes the result.
 * Thin wrapper over applyTemplate() preserving the context.md placeholder contract.
 * Placeholders: {{VARIANT_NAME}}, {{VERSION}}, {{PM_ROLE_DESCRIPTION}}
 *
 * @param templatePath  Absolute or CWD-relative path to the source template
 * @param outputPath    Path where the rendered file will be written
 * @param substitutions Values for each placeholder
 * @returns             The outputPath that was written
 */
export function applyContextTemplate(
  templatePath: string,
  outputPath: string,
  substitutions: ContextTemplateSubstitutions
): string {
  return applyTemplate(templatePath, outputPath, {
    VARIANT_NAME: substitutions.variantName,
    VERSION: substitutions.version,
    PM_ROLE_DESCRIPTION: substitutions.pmRoleDescription,
  });
}

/**
 * Default PM role descriptions per variant type.
 * Used when the caller does not supply a custom pmRoleDescription.
 */
export const DEFAULT_PM_ROLE_DESCRIPTIONS: Record<string, string> = {
  'co-develop':  'Workflow management, task dispatch, quality gates',
  'co-consult':  'Engagement orchestration, client interface, final decisions',
  'co-security': 'Security governance, threat modeling, compliance review',
  'co-design':   'Design process management, creative direction, quality review',
  'co-work':     'Content workflow management, editorial oversight, quality gates',
};
