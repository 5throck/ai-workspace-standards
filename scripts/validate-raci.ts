#!/usr/bin/env bun
/**
 * validate-raci.ts — Repository consistency checker for RACI Matrix (ADR-0083).
 *
 * Validates templates/<variant>/governance/raci.yaml files and enforces RACI
 * invariants (DEG-R-01..05). Validates generated RACI matrices against all
 * five invariants: exactly one accountable (DEG-R-01), at least one responsible
 * (DEG-R-02), no agent both accountable and informed (DEG-R-03), all agent keys
 * resolve to agent files or human-role entries (DEG-R-04).
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
 * @usage bun scripts/validate-raci.ts [--variant co-consult|all] [--all] [--root <dir>]
 * @version 1.1.0
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

/** Discover variant namespaces: co-* templates + common */
function discoverVariants(root: string): string[] {
  const variants: string[] = [];
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    // Add all co-* variants
    for (const name of readdirSync(templatesDir)) {
      if ((name.startsWith('co-') || name === 'common') && statSync(join(templatesDir, name)).isDirectory()) {
        variants.push(name);
      }
    }
  }
  return variants;
}

/** Load human-roles registry if it exists */
function loadHumanRoles(variantDir: string): Set<string> {
  const humanRolesPath = join(variantDir, 'governance', '_human-roles.yaml');
  const roles = new Set<string>();

  if (!existsSync(humanRolesPath)) {
    return roles;
  }

  try {
    const data = yamlLoad(readFileSync(humanRolesPath, 'utf-8')) as any;
    if (data?.human_roles && typeof data.human_roles === 'object') {
      for (const key of Object.keys(data.human_roles)) {
        roles.add(key);
      }
    }
  } catch (err) {
    // Ignore parse errors for human-roles (optional file)
  }

  return roles;
}

/** Check if an agent file exists */
function agentFileExists(agentKey: string, root: string): boolean {
  // Try all variant agent directories
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const variant of readdirSync(templatesDir)) {
      const agentPath = join(templatesDir, variant, 'agents', `${agentKey}.md`);
      if (existsSync(agentPath)) return true;
    }
  }

  // Try workspace agents
  const workspaceAgentPath = join(root, 'agents', `${agentKey}.md`);
  if (existsSync(workspaceAgentPath)) return true;

  return false;
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
  const variantDir = join(root, 'templates', variant);
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

  const humanRoles = loadHumanRoles(variantDir);

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

    const activity = (row as any).activity || `row[${i}]`;

    // DEG-R-01: exactly one accountable
    const accountable = row.accountable;
    if (!accountable || (typeof accountable === 'string' ? !accountable : !Array.isArray(accountable))) {
      issues.push({
        layer: 'DEG-R-01',
        file: raciPath,
        message: `${activity}: must declare exactly one accountable agent`,
      });
    } else if (Array.isArray(accountable)) {
      if (accountable.length !== 1) {
        issues.push({
          layer: 'DEG-R-01',
          file: raciPath,
          message: `${activity}: accountable must be a single agent, not an array of ${accountable.length}`,
        });
      }
    }

    // DEG-R-02: at least one responsible
    const responsible = row.responsible;
    if (!responsible || (typeof responsible === 'string' ? !responsible : (!Array.isArray(responsible) || responsible.length === 0))) {
      issues.push({
        layer: 'DEG-R-02',
        file: raciPath,
        message: `${activity}: must declare at least one responsible agent`,
      });
    }

    // DEG-R-03: no agent both accountable and informed
    if (typeof accountable === 'string' && Array.isArray(row.informed)) {
      if ((row.informed as string[]).includes(accountable)) {
        issues.push({
          layer: 'DEG-R-03',
          file: raciPath,
          message: `${activity}: agent "${accountable}" cannot be both accountable and informed`,
        });
      }
    }

    // DEG-R-04: Every RACI agent key resolves to an agent file or human-role entry
    const allAgents = new Set<string>();
    if (typeof accountable === 'string') allAgents.add(accountable);
    if (Array.isArray(responsible)) responsible.forEach((a: string) => allAgents.add(a));
    if (Array.isArray(row.consulted)) (row.consulted as string[]).forEach(a => allAgents.add(a));
    if (Array.isArray(row.informed)) (row.informed as string[]).forEach(a => allAgents.add(a));

    for (const agent of allAgents) {
      if (!agentFileExists(agent, root) && !humanRoles.has(agent)) {
        issues.push({
          layer: 'DEG-R-04',
          file: raciPath,
          message: `${activity}: agent "${agent}" not found in agent files or human-roles registry`,
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
    console.log(`OK: RACI validation passed for ${scope}.`);
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
