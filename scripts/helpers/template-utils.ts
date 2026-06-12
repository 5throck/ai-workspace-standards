#!/usr/bin/env bun
/**
 * template-utils.ts — Shared template application utilities
 *
 * Provides applyContextTemplate() used by both:
 *   - generate-variant.ts (L2→L1 variant promotion)
 *   - new-project.ts (L1→L2 project deployment)
 *
 * @version 1.0.0
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ContextTemplateSubstitutions {
  variantName: string;
  version: string;
  pmRoleDescription: string;
}

/**
 * Reads a template file, applies placeholder substitutions, and writes the result.
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
  if (!existsSync(templatePath)) {
    throw new Error(`applyContextTemplate: template not found at ${templatePath}`);
  }

  let content = readFileSync(templatePath, 'utf-8');

  content = content
    .replace(/\{\{VARIANT_NAME\}\}/g, substitutions.variantName)
    .replace(/\{\{VERSION\}\}/g, substitutions.version)
    .replace(/\{\{PM_ROLE_DESCRIPTION\}\}/g, substitutions.pmRoleDescription);

  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
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
