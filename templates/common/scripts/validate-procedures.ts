#!/usr/bin/env bun
/**
 * validate-procedures.ts — Repository consistency checker for Procedure Schema v1.0.
 *
 * Validates templates/<variant>/procedures/<name>/schema.yaml files across all
 * variant templates, plus the workspace-root `l0` namespace (root-level
 * lifecycle procedures in <root>/procedures/). Eight fail-closed layers (see
 * docs/designs/2026-08-29-procedure-schema-design.md §5 and
 * docs/designs/2026-08-29-procedure-coverage-and-l0-design.md):
 *   L1 YAML/schema shape          L5 skill_key referential integrity
 *   L2 required fields / enums    L6 relation type enum
 *   L3 output-type vocabulary     L7 relation target resolution
 *   L4 agent_key referential      L8 cross-reference consistency
 *
 * This script is a validator only — it never mutates procedure files.
 *
 * @usage bun scripts/validate-procedures.ts [--variant co-design|l0] [--all] [--root <dir>]
 * @version 1.1.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const RELATION_TYPES = new Set(['follows', 'enables', 'composes_with']);
const STATUSES = new Set(['draft', 'active', 'deprecated']);
// co-* variants + the L0 root namespace (workspace-root lifecycle procedures).
const PROCEDURE_ID_RE = /^(?:l0|co-[a-z0-9]+)-[a-z0-9-]+$/;
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL_KEY_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/; // nested skill paths allowed (e.g. daily/risk-assessment)
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Layout for a variant namespace. `l0` is the workspace-root pseudo-variant:
 * its procedures live at <root>/procedures and its agents/skills resolve
 * against the root assets instead of templates/.
 */
interface VariantLayout {
  procDir: string;
  agentBases: string[];
  skillBases: string[];
}

function resolveLayout(root: string, variant: string): VariantLayout {
  if (variant === 'l0') {
    return {
      procDir: join(root, 'procedures'),
      agentBases: [join(root, 'agents')],
      skillBases: [join(root, 'skills')],
    };
  }
  return {
    procDir: join(root, 'templates', variant, 'procedures'),
    agentBases: [join(root, 'templates', variant, 'agents'), join(root, 'templates', 'common', 'agents')],
    skillBases: [join(root, 'templates', variant, 'skills'), join(root, 'templates', 'common', 'skills')],
  };
}

interface Issue {
  layer: string;
  file: string;
  message: string;
}

interface OutputTypeEntry {
  description?: string;
}

interface LoadedProcedure {
  variant: string;
  dirName: string;
  file: string;
  data: any;
}

function parseYaml(text: string, file: string): any | null {
  try {
    return yamlLoad(text);
  } catch (err) {
    return { __parseError: String(err) };
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === 'string');
}

/** Discover variant namespaces: `l0` (if root procedures/ exists) + co-* templates. */
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

function listProcedureDirs(procDir: string): string[] {
  if (!existsSync(procDir)) return [];
  return readdirSync(procDir).filter(
    (name) =>
      !name.startsWith('_') && statSync(join(procDir, name)).isDirectory(),
  );
}

/** L4: agent key must resolve to agents/<key>.md in the variant (or common). */
function resolveAgentFile(root: string, variant: string, key: string): string | null {
  for (const base of resolveLayout(root, variant).agentBases) {
    const p = join(base, `${key}.md`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** L5: skill key must resolve to skills/<key>/SKILL.md in the variant (or common). */
function resolveSkillFile(root: string, variant: string, key: string): string | null {
  for (const base of resolveLayout(root, variant).skillBases) {
    const p = join(base, key, 'SKILL.md');
    if (existsSync(p)) return p;
  }
  return null;
}

function loadOutputTypes(procDir: string): Map<string, OutputTypeEntry> {
  const map = new Map<string, OutputTypeEntry>();
  const p = join(procDir, '_output-types.yaml');
  if (!existsSync(p)) return map;
  const data = parseYaml(readFileSync(p, 'utf8'), p);
  const entries = data && typeof data === 'object' ? data.output_types : null;
  if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      map.set(key, typeof value === 'object' && value !== null ? (value as OutputTypeEntry) : {});
    }
  }
  return map;
}

/** Validate a single loaded procedure. Cross-file checks (L7, L8 duplicates) run later. */
function validateProcedure(proc: LoadedProcedure, outputTypes: Set<string>, root: string, issues: Issue[]): void {
  const { variant, dirName, file, data } = proc;
  const err = (layer: string, message: string) => issues.push({ layer, file, message });

  // L1 — already handled by caller (parse failure / shape). Structural shape:
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    err('L1', 'top level must be a YAML mapping');
    return;
  }

  // L2 — required fields, enums, formats.
  const required: Array<[string, unknown]> = [
    ['schema_version', data.schema_version],
    ['procedure_id', data.procedure_id],
    ['variant', data.variant],
    ['version', data.version],
    ['title', data.title],
    ['phase', data.phase],
    ['status', data.status],
    ['owner_agent', data.owner_agent],
    ['purpose', data.purpose],
    ['inputs', data.inputs],
    ['preconditions', data.preconditions],
    ['steps', data.steps],
    ['outputs', data.outputs],
    ['relations', data.relations],
    ['quality_gates', data.quality_gates],
    ['evidence', data.evidence],
    ['failure_modes', data.failure_modes],
  ];
  const beforeCount = issues.length;
  for (const [field, value] of required) {
    if (value === undefined || value === null) err('L2', `missing required field: ${field}`);
  }
  if (issues.length > beforeCount) return; // cannot continue without core fields

  if (data.schema_version !== '1.0') err('L2', `schema_version must be "1.0", got ${JSON.stringify(data.schema_version)}`);
  if (typeof data.procedure_id !== 'string' || !PROCEDURE_ID_RE.test(data.procedure_id))
    err('L2', `procedure_id must match ^(l0|co-[a-z0-9]+)-[a-z0-9-]+$, got ${JSON.stringify(data.procedure_id)}`);
  if (data.variant !== variant) err('L8', `variant field "${data.variant}" does not match namespace "${variant}"`);
  if (typeof data.version !== 'string' || !SEMVER_RE.test(data.version))
    err('L2', `version must be semver x.y.z, got ${JSON.stringify(data.version)}`);
  if (!isNonEmptyString(data.title)) err('L2', 'title must be a non-empty string');
  if (!Number.isInteger(data.phase) || data.phase < 0 || data.phase > 6)
    err('L2', `phase must be an integer 0–6, got ${JSON.stringify(data.phase)}`);
  if (!STATUSES.has(data.status)) err('L2', `status must be draft|active|deprecated, got ${JSON.stringify(data.status)}`);
  if (!isNonEmptyString(data.owner_agent)) err('L2', 'owner_agent must be a non-empty string');
  if (!isNonEmptyString(data.purpose)) err('L2', 'purpose must be a non-empty string');

  if (!isStringArray(data.inputs)) err('L2', 'inputs must be an array of strings');
  if (!Array.isArray(data.preconditions) || data.preconditions.length === 0 || !data.preconditions.every(isNonEmptyString))
    err('L2', 'preconditions must be a non-empty array of non-empty strings');
  if (!isStringArray(data.quality_gates) || data.quality_gates.length === 0)
    err('L2', 'quality_gates must be a non-empty array of non-empty strings');
  if (!isStringArray(data.evidence)) err('L2', 'evidence must be an array of strings');
  if (!Array.isArray(data.failure_modes) || data.failure_modes.length === 0 || !data.failure_modes.every(isNonEmptyString))
    err('L2', 'failure_modes must be a non-empty array of non-empty strings');

  // procedures/<dirName>/ must match procedure_id suffix ("l0-" for the root namespace).
  const idPrefix = variant === 'l0' ? 'l0-' : `${variant}-`;
  const expectedSuffix = data.procedure_id.startsWith(idPrefix)
    ? data.procedure_id.slice(idPrefix.length)
    : data.procedure_id;
  if (dirName !== expectedSuffix)
    err('L8', `directory "${dirName}" does not match procedure_id suffix "${expectedSuffix}"`);

  // L3 — vocabulary for inputs/outputs.
  const inputs: string[] = isStringArray(data.inputs) ? data.inputs : [];
  for (const t of inputs) {
    if (!outputTypes.has(t)) err('L3', `input "${t}" is not registered in _output-types.yaml`);
  }
  const outputTypesList: string[] = [];
  if (Array.isArray(data.outputs)) {
    for (const o of data.outputs) {
      const type = o && typeof o === 'object' ? (o as any).type : o;
      if (!isNonEmptyString(type)) {
        err('L2', 'outputs[] entries must be objects with a non-empty "type"');
        continue;
      }
      outputTypesList.push(type);
      if (!outputTypes.has(type)) err('L3', `output "${type}" is not registered in _output-types.yaml`);
    }
  }

  // Steps — shape, ordering, vocabulary, referential integrity (L2/L3/L4/L5).
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    err('L2', 'steps must be a non-empty array');
  } else {
    const ids: number[] = [];
    const seenIds = new Set<string>();
    for (const [i, step] of data.steps.entries()) {
      const where = `steps[${i}]`;
      if (step === null || typeof step !== 'object') {
        err('L2', `${where} must be a mapping`);
        continue;
      }
      const id = (step as any).id;
      if (!(typeof id === 'number' && Number.isFinite(id)) && !KEBAB_RE.test(String(id))) {
        err('L2', `${where}.id must be a number or kebab-case string, got ${JSON.stringify(id)}`);
      }
      const idKey = String(id);
      if (seenIds.has(idKey)) err('L2', `duplicate step id ${idKey}`);
      seenIds.add(idKey);
      if (typeof id === 'number') ids.push(id);

      for (const field of ['agent_key', 'skill_key', 'output_type'] as const) {
        if (!isNonEmptyString((step as any)[field])) err('L2', `${where}.${field} must be a non-empty string`);
      }
      if (!isNonEmptyString((step as any).description)) err('L2', `${where}.description must be a non-empty string`);

      const outputType = (step as any).output_type;
      if (isNonEmptyString(outputType) && !outputTypes.has(outputType))
        err('L3', `${where}.output_type "${outputType}" is not registered in _output-types.yaml`);

      const agentKey = (step as any).agent_key;
      if (isNonEmptyString(agentKey) && !resolveAgentFile(root, variant, agentKey))
        err('L4', `${where}.agent_key "${agentKey}" does not resolve to agents/<key>.md`);

      const skillKey = (step as any).skill_key;
      if (isNonEmptyString(skillKey)) {
        if (!SKILL_KEY_RE.test(skillKey))
          err('L5', `${where}.skill_key "${skillKey}" is not a valid skill key`);
        else if (!resolveSkillFile(root, variant, skillKey))
          err('L5', `${where}.skill_key "${skillKey}" does not resolve to skills/<key>/SKILL.md`);
      }
    }
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] <= ids[i - 1]) err('L2', `step ids must be in ascending order (${ids[i - 1]} then ${ids[i]})`);
    }
  }

  // owner_agent referential integrity (L4).
  if (isNonEmptyString(data.owner_agent) && !resolveAgentFile(root, variant, data.owner_agent))
    err('L4', `owner_agent "${data.owner_agent}" does not resolve to agents/<key>.md`);

  // L6 — relation types; L7 target resolution happens cross-file (see validateAll).
  if (!Array.isArray(data.relations)) {
    err('L2', 'relations must be an array');
  } else {
    for (const [i, rel] of data.relations.entries()) {
      if (rel === null || typeof rel !== 'object') {
        err('L6', `relations[${i}] must be a mapping`);
        continue;
      }
      const { type, target } = rel as any;
      if (!RELATION_TYPES.has(type)) err('L6', `relations[${i}].type must be follows|enables|composes_with, got ${JSON.stringify(type)}`);
      if (!isNonEmptyString(target)) err('L7', `relations[${i}].target must be a non-empty string`);
    }
  }
}

/** Resolve relation targets (L7) and workspace-wide duplicates (L8). */
function validateCrossFile(
  all: LoadedProcedure[],
  root: string,
  issues: Issue[],
): void {
  const knownProcedureIds = new Set(all.map((p) => p.data?.procedure_id).filter((v): v is string => typeof v === 'string'));

  for (const proc of all) {
    const data = proc.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.relations)) continue;
    for (const [i, rel] of data.relations.entries()) {
      const target = (rel as any)?.target;
      if (!isNonEmptyString(target)) continue;
      const procMatch = /^procedure\.([a-z0-9-]+)\.([a-z0-9-]+)$/.exec(target);
      if (procMatch) {
        const [, variant, name] = procMatch;
        const expectedId = `${variant}-${name}`;
        if (!knownProcedureIds.has(expectedId)) {
          issues.push({
            layer: 'L7',
            file: proc.file,
            message: `relations[${i}].target "${target}" does not resolve to any procedure (expected id "${expectedId}")`,
          });
        }
        continue;
      }
      const skillMatch = /^skill\.([a-z0-9-]+(\/[a-z0-9-]+)*)$/.exec(target);
      if (skillMatch) {
        if (!resolveSkillFile(root, proc.variant, skillMatch[1])) {
          issues.push({ layer: 'L7', file: proc.file, message: `relations[${i}].target "${target}" does not resolve to skills/<key>/SKILL.md` });
        }
        continue;
      }
      issues.push({
        layer: 'L7',
        file: proc.file,
        message: `relations[${i}].target "${target}" must be "procedure.<variant>.<name>" or "skill.<key>"`,
      });
    }
  }

  const byId = new Map<string, string>();
  for (const proc of all) {
    const id = proc.data?.procedure_id;
    if (typeof id !== 'string') continue;
    if (byId.has(id)) {
      issues.push({ layer: 'L8', file: proc.file, message: `duplicate procedure_id "${id}" (also in ${byId.get(id)})` });
    } else {
      byId.set(id, proc.file);
    }
  }
}

export function validateAll(root: string, onlyVariant?: string): Issue[] {
  const issues: Issue[] = [];
  const variants = discoverVariants(root).filter((v) => !onlyVariant || v === onlyVariant).sort();
  const all: LoadedProcedure[] = [];

  for (const variant of variants) {
    const layout = resolveLayout(root, variant);
    const outputTypeMap = loadOutputTypes(layout.procDir);
    const outputTypes = new Set(outputTypeMap.keys());
    const procDirs = listProcedureDirs(layout.procDir).sort();

    if (procDirs.length > 0 && outputTypeMap.size === 0) {
      issues.push({
        layer: 'L3',
        file: join(layout.procDir, '_output-types.yaml'),
        message: 'variant has procedures but _output-types.yaml is missing or has no output_types mapping',
      });
    }

    for (const dirName of procDirs) {
      const file = join(layout.procDir, dirName, 'schema.yaml');
      if (!existsSync(file)) {
        issues.push({ layer: 'L1', file, message: 'schema.yaml not found in procedure directory' });
        continue;
      }
      const data = parseYaml(readFileSync(file, 'utf8'), file);
      if (data && typeof data === 'object' && '__parseError' in (data as any)) {
        issues.push({ layer: 'L1', file, message: `YAML parse error: ${(data as any).__parseError}` });
        continue;
      }
      const proc: LoadedProcedure = { variant, dirName, file, data };
      all.push(proc);
      validateProcedure(proc, outputTypes, root, issues);
    }
  }

  validateCrossFile(all, root, issues);
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
      console.log('Usage: bun scripts/validate-procedures.ts [--variant <name>] [--all] [--root <dir>]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }

  const issues = validateAll(root, variant);
  if (issues.length === 0) {
    const scope = variant ?? 'all variants';
    console.log(`OK: procedure validation passed for ${scope}.`);
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
  console.error(`FAIL: ${issues.length} procedure validation error(s).`);
  process.exit(1);
}

if (import.meta.main) main();
