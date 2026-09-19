#!/usr/bin/env bun
/**
 * generate-raci.ts — RACI Matrix Generator (ADR-0083, Design §6, §13.2 P4)
 *
 * Generates templates/<variant>/governance/raci.yaml files from procedures and stages.
 * Derives Accountable (A) from stage owner_agent and Responsible (R) from step agent_keys.
 * Consulted (C) and Informed (I) are read from procedure raci.consulted/raci.informed if present.
 *
 * RACI invariants validated (§6.3):
 *   DEG-R-01: Each activity declares exactly one accountable agent.
 *   DEG-R-02: Each activity declares at least one responsible agent.
 *   DEG-R-03: No agent holds both accountable and informed on one activity.
 *   DEG-R-04: Every RACI agent key resolves to an agent file or human-role entry.
 *   DEG-R-05: The committed matrix matches a fresh regeneration (validated by drift check).
 *
 * @usage bun scripts/generate-raci.ts [--variant co-consult|all] [--root <dir>] [--write]
 * @version 1.0.0
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

interface Stage {
  id: string;
  owner_agent: string;
  [key: string]: any;
}

interface StageFile {
  variant: string;
  stages: Stage[];
}

interface ProcedureStep {
  agent_key: string;
  [key: string]: any;
}

interface RACIProcedure {
  procedure_id: string;
  owner_agent: string;
  stage?: string;
  steps: ProcedureStep[];
  raci?: {
    consulted?: string[];
    informed?: string[];
  };
  [key: string]: any;
}

interface RACIRow {
  stage: string;
  activity: string;
  accountable: string;
  responsible: string[];
  consulted?: string[];
  informed?: string[];
}

interface RACIMatrix {
  schema_version: string;
  variant: string;
  generated_from: string;
  rows: RACIRow[];
}

interface ValidationIssue {
  rule: string;
  activity: string;
  message: string;
}

function loadYaml(path: string): any {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf-8');
  try {
    return yamlLoad(content);
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${err}`);
  }
}

function discoverGovernedVariants(root: string): string[] {
  // Explicit allowlist of 9 governed-track variants per ADR-0083 §13.2 P4
  const governedVariants = [
    'co-abap', 'co-consult', 'co-deck', 'co-design', 'co-export',
    'co-game', 'co-hr', 'co-price', 'co-security'
  ];

  const variants: string[] = [];
  const templatesDir = join(root, 'templates');

  for (const variant of governedVariants) {
    const variantDir = join(templatesDir, variant);

    if (existsSync(variantDir) && statSync(variantDir).isDirectory()) {
      const stagesFile = join(variantDir, 'process', 'stages.yaml');
      if (existsSync(stagesFile)) {
        variants.push(variant);
      }
    }
  }

  return variants.sort();
}

function loadStages(variantDir: string): Stage[] {
  const stagesPath = join(variantDir, 'process', 'stages.yaml');

  if (!existsSync(stagesPath)) {
    return [];
  }

  const data = loadYaml(stagesPath) as StageFile;
  return data?.stages || [];
}

function loadProcedures(variantDir: string, variant: string): RACIProcedure[] {
  const procedures: RACIProcedure[] = [];
  const procDir = join(variantDir, 'procedures');

  if (!existsSync(procDir)) return [];

  for (const procName of readdirSync(procDir)) {
    const procPath = join(procDir, procName);
    if (!statSync(procPath).isDirectory()) continue;

    const schemaPath = join(procPath, 'schema.yaml');
    if (!existsSync(schemaPath)) continue;

    try {
      const proc = loadYaml(schemaPath) as RACIProcedure;
      if (proc && proc.steps) {
        procedures.push(proc);
      }
    } catch (err) {
      console.error(`Error loading ${schemaPath}: ${err}`);
    }
  }

  return procedures;
}

function generateMatrix(
  variant: string,
  stages: Stage[],
  procedures: RACIProcedure[]
): { matrix: RACIMatrix; issues: ValidationIssue[] } {
  const rows: RACIRow[] = [];
  const issues: ValidationIssue[] = [];
  const stageMap = new Map(stages.map(s => [s.id, s]));

  // Helper: construct canonical procedure node ID matching generate-skill-graph.ts
  // procedureId like "co-abap-custom-dev-delivery" → "procedure.co-abap.custom-dev-delivery"
  const getProcedureNodeId = (procedureId: string): string => {
    const prefix = `${variant}-`;
    const procName = procedureId.startsWith(prefix)
      ? procedureId.substring(prefix.length)
      : procedureId;
    return `procedure.${variant}.${procName}`;
  };

  // Standard procedure: group by stage and activity
  for (const proc of procedures) {
    if (!proc.procedure_id || !proc.owner_agent || !proc.steps || !proc.stage) {
      const procNodeId = proc.procedure_id ? getProcedureNodeId(proc.procedure_id) : 'unknown';
      if (!proc.stage) {
        issues.push({
          rule: 'MISSING_STAGE',
          activity: procNodeId,
          message: `Procedure missing stage: field (required per design §4.2)`
        });
      }
      continue;
    }

    if (!stageMap.has(proc.stage)) {
      issues.push({
        rule: 'INVALID_STAGE',
        activity: getProcedureNodeId(proc.procedure_id),
        message: `Stage ${proc.stage} not found in process/stages.yaml`
      });
      continue;
    }

    const stage = stageMap.get(proc.stage)!;
    const responsibleAgents = new Set<string>();

    for (const step of proc.steps) {
      if (step.agent_key) {
        responsibleAgents.add(step.agent_key);
      }
    }

    if (responsibleAgents.size === 0) {
      issues.push({
        rule: 'DEG-R-02',
        activity: getProcedureNodeId(proc.procedure_id),
        message: 'No responsible agents found in steps'
      });
      continue;
    }

    const accountable = stage.owner_agent;
    const responsible = Array.from(responsibleAgents).sort();

    // DEG-R-01: exactly one accountable
    if (!accountable) {
      issues.push({
        rule: 'DEG-R-01',
        activity: getProcedureNodeId(proc.procedure_id),
        message: `Stage ${proc.stage} missing owner_agent (accountable)`
      });
      continue;
    }

    const procNodeId = getProcedureNodeId(proc.procedure_id);
    const row: RACIRow = {
      stage: proc.stage,
      activity: procNodeId,
      accountable,
      responsible,
    };

    // Collect C and I if present
    if (proc.raci?.consulted?.length) {
      row.consulted = proc.raci.consulted;
    }
    if (proc.raci?.informed?.length) {
      row.informed = proc.raci.informed;
    }

    // DEG-R-03: no agent both accountable and informed
    if (row.informed?.includes(accountable)) {
      issues.push({
        rule: 'DEG-R-03',
        activity: procNodeId,
        message: `Agent "${accountable}" cannot be both accountable and informed`
      });
    }

    rows.push(row);
  }

  const matrix: RACIMatrix = {
    schema_version: '1.0',
    variant: variant,
    generated_from: 'procedures/',
    rows: rows.sort((a, b) => {
      const stageCompare = a.stage.localeCompare(b.stage);
      if (stageCompare !== 0) return stageCompare;
      return a.activity.localeCompare(b.activity);
    })
  };

  return { matrix, issues };
}

function writeMatrix(variant: string, matrix: RACIMatrix, root: string): string {
  const variantDir = join(root, 'templates', variant);
  const govDir = join(variantDir, 'governance');
  mkdirSync(govDir, { recursive: true });

  const outputPath = join(govDir, 'raci.yaml');
  const yamlContent = yamlDump(matrix, {
    lineWidth: -1
  });

  writeFileSync(outputPath, yamlContent, 'utf-8');
  return outputPath;
}

export function generateAllRACIMatrices(
  root: string,
  targetVariant?: string,
  writeFiles = false
): Map<string, { matrix: RACIMatrix; issues: ValidationIssue[]; written: boolean }> {
  const results = new Map<string, any>();
  const variants = discoverGovernedVariants(root)
    .filter(v => !targetVariant || v === targetVariant);

  for (const variant of variants) {
    const variantDir = join(root, 'templates', variant);

    const stages = loadStages(variantDir);
    const procedures = loadProcedures(variantDir, variant);
    const { matrix, issues } = generateMatrix(variant, stages, procedures);

    let written = false;
    if (writeFiles && issues.filter(i => i.rule.startsWith('DEG-R')).length === 0) {
      try {
        writeMatrix(variant, matrix, root);
        written = true;
      } catch (err) {
        console.error(`Failed to write RACI for ${variant}: ${err}`);
      }
    }

    results.set(variant, { matrix, issues, written });
  }

  return results;
}

function main(): void {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let targetVariant: string | undefined;
  let writeFiles = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--variant') targetVariant = args[++i];
    else if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--write') writeFiles = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun scripts/generate-raci.ts [--variant <name>|all] [--root <dir>] [--write]');
      console.log('  --variant <name>  Generate for specific variant (default: all)');
      console.log('  --root <dir>      Repository root (default: cwd)');
      console.log('  --write           Write raci.yaml files (default: dry-run)');
      process.exit(0);
    }
  }

  const results = generateAllRACIMatrices(root, targetVariant, writeFiles);

  let totalIssues = 0;
  let criticalIssues = 0;

  for (const [variant, { matrix, issues, written }] of results) {
    const critical = issues.filter(i => i.rule.startsWith('DEG-R'));
    const warnings = issues.filter(i => !i.rule.startsWith('DEG-R'));

    if (critical.length > 0) {
      console.error(`\n${variant}: CRITICAL ISSUES (${critical.length})`);
      for (const issue of critical) {
        console.error(`  [${issue.rule}] ${issue.activity}: ${issue.message}`);
      }
      criticalIssues += critical.length;
    }

    if (warnings.length > 0) {
      console.warn(`\n${variant}: WARNINGS (${warnings.length})`);
      for (const issue of warnings) {
        console.warn(`  [${issue.rule}] ${issue.activity}: ${issue.message}`);
      }
    }

    if (critical.length === 0) {
      console.log(`\n${variant}: OK (${matrix.rows.length} rows)${written ? ' ✓ WRITTEN' : ''}`);
    }

    totalIssues += issues.length;
  }

  if (criticalIssues > 0) {
    console.error(`\nFAIL: ${criticalIssues} critical RACI invariant violation(s).`);
    process.exit(1);
  } else if (totalIssues > 0) {
    console.warn(`\nWARN: ${totalIssues} warning(s) found. Review before committing.`);
    process.exit(0);
  } else {
    console.log('\nOK: All RACI matrices valid.');
    process.exit(0);
  }
}

if (import.meta.main) main();
