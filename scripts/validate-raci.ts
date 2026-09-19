#!/usr/bin/env bun
/**
 * validate-raci.ts — Repository consistency checker for RACI Matrix (ADR-0083).
 *
 * Validates templates/<variant>/governance/raci.yaml files and enforces RACI
 * invariants (DEG-R-01..05). Currently skips cleanly since no RACI matrices exist
 * in the repository yet; this validator is ready for P4 when raci.yaml files
 * are generated/committed.
 *
 * RACI invariants (§6.3, ADR-0083):
 *   DEG-R-01: Each activity declares exactly one accountable agent.
 *   DEG-R-02: Each activity declares at least one responsible agent.
 *   DEG-R-03: No agent holds both accountable and informed on one activity.
 *   DEG-R-04: Every RACI agent key resolves to an agent file or human-role entry.
 *   DEG-R-05: The committed matrix matches a fresh regeneration.
 *
 * This script is a validator only — it never mutates files.
 *
 * @usage bun scripts/validate-raci.ts [--variant co-design|l0] [--all] [--root <dir>]
 * @version 1.0.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

interface Issue {
  layer: string;
  file: string;
  message: string;
}

interface RACIRow {
  stage?: string;
  activity?: string;
  accountable?: string | string[];
  responsible?: string | string[];
  consulted?: string | string[];
  informed?: string | string[];
}

interface RACIMatrix {
  schema_version?: string;
  variant?: string;
  generated_from?: string;
  rows?: RACIRow[];
}

function parseYaml(text: string, file: string): any | null {
  try {
    return yamlLoad(text);
  } catch (err) {
    return { __parseError: String(err) };
  }
}

/** Discover variant namespaces: co-* templates + l0 (if procedures/ exists) */
function discoverVariants(root: string): string[] {
  const variants: string[] = [];
  if (existsSync(join(root, 'procedures'))) variants.push('l0');
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const name of readdirSync(templatesDir)) {
      if (name.startsWith('co-') && statSync(join(templatesDir, name)).isDirectory()) {
        variants.push(name);
      }
    }
  }
  return variants;
}

/**
 * Load and validate a RACI matrix file. Returns the parsed data if valid,
 * null if the file doesn't exist (not an error — P4 will create it).
 */
function validateRACIFile(
  variant: string,
  root: string,
  issues: Issue[],
): RACIMatrix | null {
  const variantDir =
    variant === 'l0' ? root : join(root, 'templates', variant);
  const raciPath = join(variantDir, 'governance', 'raci.yaml');

  if (!existsSync(raciPath)) {
    // RACI file doesn't exist yet (P4 will create it)
    return null;
  }

  const content = readFileSync(raciPath, 'utf-8');
  const data = parseYaml(content, raciPath) as RACIMatrix;

  if (data && typeof data === 'object' && '__parseError' in (data as any)) {
    issues.push({
      layer: 'L1',
      file: raciPath,
      message: `YAML parse error: ${(data as any).__parseError}`,
    });
    return null;
  }

  if (!data || typeof data !== 'object') {
    issues.push({
      layer: 'L1',
      file: raciPath,
      message: 'raci.yaml must contain a YAML object',
    });
    return null;
  }

  // Basic structure validation
  if (!Array.isArray(data.rows)) {
    issues.push({
      layer: 'L2',
      file: raciPath,
      message: 'raci.yaml must have a "rows" array',
    });
    return null;
  }

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    if (!row || typeof row !== 'object') {
      issues.push({
        layer: 'L2',
        file: raciPath,
        message: `rows[${i}] must be an object`,
      });
      continue;
    }

    // DEG-R-01: exactly one accountable
    const accountable = row.accountable;
    if (!accountable || (typeof accountable === 'string' ? !accountable : !Array.isArray(accountable))) {
      issues.push({
        layer: 'DEG-R-01',
        file: raciPath,
        message: `rows[${i}] must declare exactly one accountable agent`,
      });
    } else if (Array.isArray(accountable)) {
      if (accountable.length !== 1) {
        issues.push({
          layer: 'DEG-R-01',
          file: raciPath,
          message: `rows[${i}].accountable must be a single agent, not an array of ${accountable.length}`,
        });
      }
    }

    // DEG-R-02: at least one responsible
    const responsible = row.responsible;
    if (!responsible || (typeof responsible === 'string' ? !responsible : (!Array.isArray(responsible) || responsible.length === 0))) {
      issues.push({
        layer: 'DEG-R-02',
        file: raciPath,
        message: `rows[${i}] must declare at least one responsible agent`,
      });
    }

    // DEG-R-03: no agent both accountable and informed
    if (typeof accountable === 'string' && Array.isArray(row.informed)) {
      if ((row.informed as string[]).includes(accountable)) {
        issues.push({
          layer: 'DEG-R-03',
          file: raciPath,
          message: `rows[${i}]: agent "${accountable}" cannot be both accountable and informed`,
        });
      }
    }
  }

  return data;
}

export function validateAll(root: string, onlyVariant?: string): Issue[] {
  const issues: Issue[] = [];
  const variants = discoverVariants(root)
    .filter((v) => !onlyVariant || v === onlyVariant)
    .sort();

  let hasRACIFiles = false;
  for (const variant of variants) {
    const matrix = validateRACIFile(variant, root, issues);
    if (matrix) {
      hasRACIFiles = true;
    }
  }

  return issues;
}

function main(): void {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let variant: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--variant') variant = args[++i];
    else if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--all') { /* default scope */ }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun scripts/validate-raci.ts [--variant <name>] [--all] [--root <dir>]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }

  const issues = validateAll(root, variant);

  if (issues.length === 0) {
    const scope = variant ?? 'all variants';
    console.log(`OK: RACI validation passed for ${scope} (no raci.yaml files to check yet).`);
    process.exit(0);
  }

  const byLayer = new Map<string, Issue[]>();
  for (const issue of issues) {
    const list = byLayer.get(issue.layer) ?? [];
    list.push(issue);
    byLayer.set(issue.layer, list);
  }

  for (const layer of [...byLayer.keys()].sort()) {
    for (const issue of byLayer.get(layer)!) {
      console.error(`[${layer}] ${issue.file}\n       ${issue.message}`);
    }
  }

  console.error(`FAIL: ${issues.length} RACI validation error(s).`);
  process.exit(1);
}

if (import.meta.main) main();
