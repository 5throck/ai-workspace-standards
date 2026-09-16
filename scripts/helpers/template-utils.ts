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
 * @version 1.2.0
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
 *
 * T-20260915-012 (M13): the map must cover EVERY current variant — an absent
 * key silently renders the generic fallback into a variant's context.md.
 * Each description is derived from that variant template's actual PM role
 * (templates/co-<x>/agents/pm.md variant_overrides; for pure extends stubs,
 * the variant's AGENTS.md roster + docs/<variant>.context.md workflow).
 * A unit test asserts the keys stay identical to the templates/co-* set.
 *
 * @version 1.2.0: completed from 5 to all 13 variants (co-abap, co-deck,
 *          co-export, co-game, co-hr, co-news, co-price, co-safety added;
 *          map alphabetized).
 */
export const DEFAULT_PM_ROLE_DESCRIPTIONS: Record<string, string> = {
  'co-abap':     'SAP ABAP delivery orchestration, module analysis dispatch, transport and QA gates',
  'co-consult':  'Engagement orchestration, client interface, final decisions',
  'co-deck':     'Deck pipeline orchestration, stage gate approvals, export readiness',
  'co-design':   'Design process management, creative direction, quality review',
  'co-develop':  'Workflow management, task dispatch, quality gates',
  'co-export':   'Trade engagement coordination, compliance approval gates, final sign-off',
  'co-game':     'Game pipeline orchestration, genre-based dispatch, test and debug gates',
  'co-hr':       'HR engagement coordination, people-domain dispatch, client approval gates',
  'co-news':     'Newsroom pipeline gating, editorial approval, publication readiness',
  'co-price':    'Pricing engagement governance, method dispatch, executive synthesis',
  'co-safety':   'Safety governance, regulatory evidence gates, deliverable closeout approval',
  'co-security': 'Security governance, threat modeling, compliance review',
  'co-work':     'Content workflow management, editorial oversight, quality gates',
};
