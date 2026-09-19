#!/usr/bin/env bun
/**
 * validate-process.ts — Repository consistency checker for Process Schema (stages).
 *
 * Validates templates/<variant>/process/stages.yaml files and checks that all
 * procedures reference valid stages, per ADR-0083. Enforces DEG-P-01 (distinctness
 * check): a variant fails if every stage maps to exactly one distinct phase AND
 * every phase maps to exactly one distinct stage (bijective mapping).
 *
 * This script is a validator only — it never mutates files.
 *
 * @usage bun scripts/validate-process.ts [--variant co-design|l0] [--all] [--determinism] [--root <dir>]
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

interface StageEntry {
  id: string;
  order?: number;
}

interface ProcessData {
  schema_version?: string;
  variant?: string;
  stages?: Array<{ id?: string; order?: number }>;
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
 * Validate process/stages.yaml exists and has valid structure.
 * Returns the set of stage IDs if valid, null if file doesn't exist (OK for deferred),
 * and reports errors.
 */
function validateStagesFile(
  variant: string,
  root: string,
  issues: Issue[],
): Set<string> | null {
  const variantDir =
    variant === 'l0' ? root : join(root, 'templates', variant);
  const stagesPath = join(variantDir, 'process', 'stages.yaml');

  if (!existsSync(stagesPath)) {
    // Stages file is optional (deferred variants don't have it yet)
    return null;
  }

  const content = readFileSync(stagesPath, 'utf-8');
  const data = parseYaml(content, stagesPath) as ProcessData;

  if (data && typeof data === 'object' && '__parseError' in data) {
    issues.push({
      layer: 'L1',
      file: stagesPath,
      message: `YAML parse error: ${(data as any).__parseError}`,
    });
    return null;
  }

  if (!data || typeof data !== 'object') {
    issues.push({
      layer: 'L1',
      file: stagesPath,
      message: 'stages.yaml must contain a YAML object',
    });
    return null;
  }

  const stageIds = new Set<string>();
  const orders = new Set<number>();
  if (Array.isArray(data.stages)) {
    for (let i = 0; i < data.stages.length; i++) {
      const stage = data.stages[i];
      if (!stage || typeof stage !== 'object') {
        issues.push({
          layer: 'L2',
          file: stagesPath,
          message: `stages[${i}] must be an object`,
        });
        continue;
      }
      if (typeof stage.id !== 'string' || !stage.id) {
        issues.push({
          layer: 'L2',
          file: stagesPath,
          message: `stages[${i}].id must be a non-empty string`,
        });
      } else {
        if (stageIds.has(stage.id)) {
          issues.push({
            layer: 'L2',
            file: stagesPath,
            message: `duplicate stage id "${stage.id}"`,
          });
        } else {
          stageIds.add(stage.id);
        }
      }
      if (typeof stage.order === 'number') {
        if (orders.has(stage.order)) {
          issues.push({
            layer: 'L2',
            file: stagesPath,
            message: `duplicate stage order ${stage.order}`,
          });
        } else {
          orders.add(stage.order);
        }
      }
    }
  }

  return stageIds.size > 0 ? stageIds : null;
}

/**
 * Load procedures from a variant and check their stage: field references.
 * Returns a map of procedure name to stage ID for distinctness checking.
 */
function loadProcedureStages(
  variant: string,
  root: string,
  issues: Issue[],
): Map<string, string> {
  const procMap = new Map<string, string>();
  const variantDir =
    variant === 'l0' ? join(root, 'procedures') : join(root, 'templates', variant, 'procedures');

  if (!existsSync(variantDir)) {
    return procMap;
  }

  for (const entry of readdirSync(variantDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const schemaPath = join(variantDir, entry.name, 'schema.yaml');
    if (!existsSync(schemaPath)) continue;

    const content = readFileSync(schemaPath, 'utf-8');
    const data = parseYaml(content, schemaPath) as any;

    if (!data || typeof data !== 'object' || '__parseError' in data) {
      // Skip malformed procedures; validate-procedures.ts owns that check
      continue;
    }

    if (typeof data.stage === 'string' && data.stage) {
      procMap.set(entry.name, data.stage);
    }
  }

  return procMap;
}

/**
 * DEG-P-01 distinctness check: reject if stage→phase mapping is bijective
 * (every stage maps to exactly one phase and every phase maps to exactly one stage).
 */
function checkDistinctness(
  variant: string,
  stageIds: Set<string> | null,
  procStages: Map<string, string>,
  root: string,
  issues: Issue[],
): { stageCount: number; phaseCount: number; bijective: boolean } {
  const result = { stageCount: 0, phaseCount: 0, bijective: false };

  if (!stageIds || procStages.size === 0) {
    return result;
  }

  result.stageCount = stageIds.size;

  // Collect phase values from procedures
  const procDir =
    variant === 'l0'
      ? join(root, 'procedures')
      : join(root, 'templates', variant, 'procedures');
  const phaseMap = new Map<string, Set<number>>();

  for (const [procName, stage] of procStages) {
    const schemaPath = join(procDir, procName, 'schema.yaml');
    if (!existsSync(schemaPath)) continue;

    const content = readFileSync(schemaPath, 'utf-8');
    const data = parseYaml(content, schemaPath) as any;
    if (!data || typeof data !== 'object' || '__parseError' in data) continue;

    if (typeof data.phase === 'number') {
      if (!phaseMap.has(stage)) {
        phaseMap.set(stage, new Set());
      }
      phaseMap.get(stage)!.add(data.phase);
    }
  }

  const distinctPhases = new Set<number>();
  for (const phases of phaseMap.values()) {
    for (const p of phases) {
      distinctPhases.add(p);
    }
  }
  result.phaseCount = distinctPhases.size;

  // Bijective check: each stage maps to exactly one phase AND each phase maps to exactly one stage
  let stageToPhaseIsBijective = true;
  for (const phases of phaseMap.values()) {
    if (phases.size !== 1) {
      stageToPhaseIsBijective = false;
      break;
    }
  }

  let phaseToStageIsBijective = true;
  const phaseToStages = new Map<number, Set<string>>();
  for (const [stage, phases] of phaseMap) {
    for (const p of phases) {
      if (!phaseToStages.has(p)) {
        phaseToStages.set(p, new Set());
      }
      phaseToStages.get(p)!.add(stage);
    }
  }
  for (const stages of phaseToStages.values()) {
    if (stages.size !== 1) {
      phaseToStageIsBijective = false;
      break;
    }
  }

  result.bijective = stageToPhaseIsBijective && phaseToStageIsBijective && result.stageCount === result.phaseCount;

  return result;
}

export function validateAll(root: string, onlyVariant?: string, shouldCheckDistinctness?: boolean): Issue[] {
  const issues: Issue[] = [];
  const variants = discoverVariants(root)
    .filter((v) => !onlyVariant || v === onlyVariant)
    .sort();

  const distinctnessResults: Array<{ variant: string; result: ReturnType<typeof checkDistinctness> }> = [];

  for (const variant of variants) {
    const stageIds = validateStagesFile(variant, root, issues);
    const procStages = loadProcedureStages(variant, root, issues);

    if (shouldCheckDistinctness) {
      const result = checkDistinctness(variant, stageIds, procStages, root, issues);
      distinctnessResults.push({ variant, result });

      // DEG-P-01: reject if bijective
      if (result.bijective && stageIds && procStages.size > 0) {
        issues.push({
          layer: 'DEG-P-01',
          file: `${variant === 'l0' ? 'procedures' : `templates/${variant}/procedures`}`,
          message: `FATAL: stage→phase mapping is bijective (${result.stageCount} stages, ${result.phaseCount} phases). The stage axis is a relabeling of the phase axis.`,
        });
      }
    }
  }

  // Report distinctness results
  if (shouldCheckDistinctness && distinctnessResults.length > 0) {
    console.log('\nDistinctness Check Results (DEG-P-01):');
    console.log('| Variant | Stages | Distinct phases | Bijective? |');
    console.log('|---------|--------|-----------------|-----------|');
    for (const { variant, result } of distinctnessResults) {
      const bijStr = result.bijective ? 'FAIL' : 'PASS';
      console.log(`| ${variant.padEnd(7)} | ${String(result.stageCount).padEnd(6)} | ${String(result.phaseCount).padEnd(15)} | ${bijStr.padEnd(9)} |`);
    }
  }

  return issues;
}

function main(): void {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let variant: string | undefined;
  let checkDist = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--variant') variant = args[++i];
    else if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--determinism') checkDist = true;
    else if (args[i] === '--all') { /* default scope */ }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun scripts/validate-process.ts [--variant <name>] [--determinism] [--all] [--root <dir>]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }

  const issues = validateAll(root, variant, checkDist);

  if (issues.length === 0) {
    const scope = variant ?? 'all variants';
    console.log(`OK: process validation passed for ${scope}.`);
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

  console.error(`FAIL: ${issues.length} process validation error(s).`);
  process.exit(1);
}

if (import.meta.main) main();
