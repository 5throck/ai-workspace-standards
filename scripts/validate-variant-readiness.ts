// @version 1.1.0
/**
 * validate-variant-readiness.ts
 *
 * Variant Readiness Gate (VRG).
 *
 * A variant MUST pass this gate before it is considered a valid, usable variant.
 * The gate is enforced from three lifecycle perspectives:
 *
 *   1. variant-ization   (scripts/project-to-variant.ts, scripts/l3-to-variant-pipeline.ts)
 *      -> a freshly generated variant must be READY before it is accepted/merged.
 *   2. new-project       (scripts/new-project.ts)
 *      -> a project may only be scaffolded from a READY variant.
 *   3. upgrade-project   (scripts/upgrade-project.ts)
 *      -> a project may only be upgraded against a READY template variant.
 *
 * This prevents improperly variant-ized templates (e.g. flat agent `file` paths
 * that do not resolve, missing PROMOTION_CHECKLIST.md, missing README/AGENTS.md,
 * inconsistent country_config) from being reflected, scaffolded, or upgraded.
 *
 * Usage:
 *   bun scripts/validate-variant-readiness.ts --variant co-safety
 *   bun scripts/validate-variant-readiness.ts --dir templates/co-safety
 *   bun scripts/validate-variant-readiness.ts --variant co-safety --json
 *
 * Exit code: 0 = READY (no blocking errors), 1 = NOT READY (blocking errors found).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = path.resolve(import.meta.dir, '..');
const TEMPLATES_DIR = path.join(WORKSPACE_ROOT, 'templates');

const VALID_STATUS = ['stable', 'planned', 'deprecated', 'draft', 'beta'];

type Severity = 'error' | 'warn';
interface Finding {
  severity: Severity;
  code: string;
  message: string;
}

const findings: Finding[] = [];
function err(code: string, message: string): void {
  findings.push({ severity: 'error', code, message });
}
function warn(code: string, message: string): void {
  findings.push({ severity: 'warn', code, message });
}

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const JSON_OUT = args.includes('--json');
const variantArg = getArg('--variant');
const dirArg = getArg('--dir');

let variantDir: string;
if (dirArg) {
  variantDir = path.isAbsolute(dirArg) ? dirArg : path.join(WORKSPACE_ROOT, dirArg);
} else if (variantArg) {
  variantDir = path.join(TEMPLATES_DIR, variantArg);
} else {
  console.error(`${RED}Usage: bun scripts/validate-variant-readiness.ts --variant <name> | --dir <path> [--json]${RESET}`);
  process.exit(2);
}

// ---- A. Variant manifest (variant.json) ----

const variantJsonPath = path.join(variantDir, 'variant.json');
if (!fs.existsSync(variantJsonPath)) {
  err('variant-json-missing', `templates/${path.relative(WORKSPACE_ROOT, variantDir)}/variant.json is missing`);
  // Without a manifest there is nothing else to validate.
  finish();
}

const vj = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;

const requiredFields = ['name', 'description', 'status'];
const missingFields = requiredFields.filter((k) => !vj[k]);
if (missingFields.length) {
  err('variant-json-fields', `variant.json missing required field(s): ${missingFields.join(', ')}`);
}

if (typeof vj.status === 'string' && !VALID_STATUS.includes(vj.status)) {
  err('variant-status', `variant.json status "${vj.status}" is invalid (allowed: ${VALID_STATUS.join(', ')})`);
}

// Promotion hold — governance gate (v1.1.0, 2026-08-29). A project may declare
// `promotionHold: { hold: true, ... }` in variant.json to block variant
// promotion until the user grants explicit permission. Technical readiness
// (all other checks) never overrides this: green checks ≠ an approval. The
// L3→variant pipeline runs this gate, so a hold blocks promotion mechanically.
const hold = vj.promotionHold as { hold?: boolean; reason?: string } | undefined;
if (hold && hold.hold === true) {
  err(
    'promotion-hold',
    `promotion is ON HOLD by the project owner — explicit user permission is required before promoting${hold.reason ? `: ${hold.reason}` : ''}`,
  );
}

const agents = Array.isArray(vj.agents) ? (vj.agents as Array<{ name?: string; file?: string }>) : [];
if (!Array.isArray(vj.agents)) {
  warn('agents-missing', 'variant.json has no agents array');
}
for (const a of agents) {
  if (!a.file) {
    err('agent-file-missing', `agent "${a.name ?? '?'}" has no file field`);
    continue;
  }
  if (!fs.existsSync(path.join(variantDir, a.file))) {
    err('agent-file-unresolved', `agent "${a.name ?? '?'}" file does not resolve: ${a.file}`);
  }
}

const skills = Array.isArray(vj.skills) ? (vj.skills as Array<{ name?: string; file?: string }>) : [];
for (const s of skills) {
  if (!s.file) {
    err('skill-file-missing', `skill "${s.name ?? '?'}" has no file field`);
    continue;
  }
  if (!fs.existsSync(path.join(variantDir, s.file))) {
    err('skill-file-unresolved', `skill "${s.name ?? '?'}" file does not resolve: ${s.file}`);
  }
}

// A6. promotionChecklist field must reference an existing file (advisory).
if (typeof vj.promotionChecklist === 'string') {
  if (!fs.existsSync(path.join(variantDir, vj.promotionChecklist))) {
    warn('promotion-checklist-ref', `variant.json promotionChecklist references missing file: ${vj.promotionChecklist}`);
  }
}

// ---- B. Required variant files ----

// B1. PROMOTION_CHECKLIST.md is mandatory for a valid variant (blocking).
if (!fs.existsSync(path.join(variantDir, 'PROMOTION_CHECKLIST.md'))) {
  err('promotion-checklist-missing', 'PROMOTION_CHECKLIST.md is required for a valid variant');
}

// B2. README.md is mandatory.
if (!fs.existsSync(path.join(variantDir, 'README.md'))) {
  err('readme-missing', 'README.md is required for a valid variant');
}

// B3. AGENTS.md must exist, be non-stub, and carry injection markers.
const agentsMdPath = path.join(variantDir, 'AGENTS.md');
if (!fs.existsSync(agentsMdPath)) {
  err('agents-md-missing', 'AGENTS.md is required for a valid variant');
} else {
  const content = fs.readFileSync(agentsMdPath, 'utf-8');
  if (content.trim().length < 50) {
    err('agents-md-empty', 'AGENTS.md appears to be an empty stub');
  } else if (!/<!--\s*VARIANT-AGENTS-START\s*-->/.test(content)) {
    warn('agents-md-markers', 'AGENTS.md is missing VARIANT-* injection markers (regenerate with scripts/regenerate-agents-md.ts)');
  }
}

// ---- C. Country consistency (only when docs/countries exists) ----

const countriesDir = path.join(variantDir, 'docs', 'countries');
if (fs.existsSync(countriesDir)) {
  const profiles = fs
    .readdirSync(countriesDir)
    .filter((f) => f.endsWith('.md') && f !== 'ACTIVE.md' && !f.startsWith('_'));
  const cc = vj.country_config as
    | { profiles_dir?: string; supported?: string[]; default?: string | null }
    | undefined;
  if (!cc) {
    err('country-config-missing', `docs/countries has ${profiles.length} profile(s) but variant.json country_config is missing`);
  } else {
    if (!cc.profiles_dir) warn('country-config-profiles_dir', 'country_config.profiles_dir is missing');
    if (!Array.isArray(cc.supported) || cc.supported.length === 0) {
      err('country-config-supported', 'country_config.supported is empty');
    } else {
      const missingProfiles = profiles
        .map((p) => p.replace('.md', ''))
        .filter((p) => !cc.supported!.includes(p));
      if (missingProfiles.length) {
        err('country-config-mismatch', `country_config.supported missing profile(s): ${missingProfiles.join(', ')}`);
      }
    }
    if (!cc.default) warn('country-config-default', 'country_config.default is not set');
  }
}

// ---- D. Manifest/disk consistency (advisory) ----

// Orphan agent files (on disk but not declared in the manifest).
const agentsDir = path.join(variantDir, 'agents');
if (fs.existsSync(agentsDir)) {
  const onDisk: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md') && !/^README(_ko)?\.md$/.test(e.name)) {
        onDisk.push(path.relative(agentsDir, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(agentsDir);
  const declared = new Set(agents.map((a) => a.file?.replace(/^agents\//, '')));
  const orphans = onDisk.filter((f) => !declared.has(f));
  if (orphans.length) warn('agent-orphans', `agent file(s) on disk not declared in variant.json: ${orphans.join(', ')}`);
}

finish();

function finish(): void {
  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');
  const label = path.basename(variantDir);

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        { variant: label, ready: errors.length === 0, errors: errors.length, warnings: warns.length, findings },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n${CYAN}=== Variant Readiness Gate: ${label} ===${RESET}`);
    for (const f of errors) console.log(`${RED}[ERROR]${RESET} ${f.code}: ${f.message}`);
    for (const f of warns) console.log(`${YELLOW}[WARN ]${RESET} ${f.code}: ${f.message}`);
    if (findings.length === 0) console.log(`${GREEN}All checks passed.${RESET}`);
    else {
      console.log(`\n${errors.length > 0 ? RED : YELLOW}Result: ${errors.length} error(s), ${warns.length} warning(s).${RESET}`);
      console.log(errors.length > 0 ? `${RED}NOT READY — variant must pass the gate.${RESET}` : `${YELLOW}READY (warnings only).${RESET}`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}
