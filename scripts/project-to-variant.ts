// @version 1.2.0
/**
 * project-to-variant.ts
 *
 * Promotes an existing L3 project (Projects/<name>/) to a variant template (templates/<name>/).
 * Diffs against templates/common/ to keep only variant-specific files.
 *
 * Lightweight path only — for projects that diverge significantly from templates/common/
 * (see the complexity routing check below), use the Full L2 Pipeline instead:
 * l3-to-variant-pipeline.ts (ADR-referenced review, anti-swelling, platform-parity checks).
 *
 * Usage:
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal --dry-run
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal --force
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal --design-doc docs/designs/co-legal-design.md
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal --threshold-files 60 --threshold-dirs 5
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = path.resolve(import.meta.dir, '..');
const COMMON_DIR = path.join(WORKSPACE_ROOT, 'templates', 'common');

function fail(msg: string): never {
  console.error(`${RED}${msg}${RESET}`);
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const designDocArg = getArg('--design-doc');
const THRESHOLD_FILES = Number(getArg('--threshold-files') ?? 40);
const THRESHOLD_DIRS = Number(getArg('--threshold-dirs') ?? 3);
const LARGE_DIR_MIN_FILES = 15;

const sourceArg = getArg('--source');
const targetArg = getArg('--target');

if (!sourceArg || !targetArg) {
  fail('Usage: bun scripts/project-to-variant.ts --source <path> --target <variant-name> [--dry-run] [--force] [--design-doc <path>] [--threshold-files <n>] [--threshold-dirs <n>]');
}

if (!/^co-[a-z][a-z0-9-]{1,30}$/.test(targetArg)) {
  fail(`Invalid variant name "${targetArg}". Must match ^co-[a-z][a-z0-9-]{1,30}$`);
}

const sourceDir = path.isAbsolute(sourceArg) ? sourceArg : path.join(WORKSPACE_ROOT, sourceArg);
if (!fs.existsSync(sourceDir)) fail(`Source project not found: ${sourceDir}`);

const targetDir = path.join(WORKSPACE_ROOT, 'templates', targetArg);

console.log(`${CYAN}=== project-to-variant.ts ===${RESET}`);
console.log(`Source : ${path.relative(WORKSPACE_ROOT, sourceDir)}`);
console.log(`Target : templates/${targetArg}`);
if (DRY_RUN) console.log(`${YELLOW}DRY RUN${RESET}`);
console.log('');

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'archive'].includes(entry.name)) continue;
        walk(full);
      } else {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

const commonFiles = new Set(
  collectFiles(COMMON_DIR).map(f => path.relative(COMMON_DIR, f).replace(/\\/g, '/'))
);

const sourceFiles = collectFiles(sourceDir).map(f => ({
  abs: f,
  rel: path.relative(sourceDir, f).replace(/\\/g, '/'),
}));

// Load country-scoped assets registry for skill exclusion
const schemaPath = path.join(WORKSPACE_ROOT, 'docs', 'workspace-schema.json');
let scopedSkills: string[] = [];
if (fs.existsSync(schemaPath)) {
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const countryScoped = schema.country_scoped_assets as {
      skills?: Record<string, string>;
      scripts?: Record<string, string>;
    } | undefined;
    if (countryScoped?.skills) {
      scopedSkills = Object.keys(countryScoped.skills);
    }
  } catch (e) {
    // Schema read error - skip scoped skill exclusion
  }
}

const SKIP_PATTERNS = [
  /^\.git\//,
  /^node_modules\//,
  /^memory\//,
  /^docs\/countries\/ACTIVE\.md$/  // Project-specific scaffold artifact, not template content
];

function shouldSkip(rel: string): boolean {
  // Check standard skip patterns
  if (SKIP_PATTERNS.some(p => p.test(rel))) return true;

  // Check for scoped skills (e.g., skills/k-law/, .claude/skills/k-dart/, etc.)
  for (const scopedSkill of scopedSkills) {
    if (rel === `skills/${scopedSkill}/` ||
        rel.startsWith(`skills/${scopedSkill}/`) ||
        rel.startsWith(`.claude/skills/${scopedSkill}/`) ||
        rel.startsWith(`.gemini/skills/${scopedSkill}/`) ||
        rel.startsWith(`.agents/skills/${scopedSkill}/`)) {
      return true;
    }
  }

  return false;
}

function isCommonInherited(rel: string, sourceAbs: string): boolean {
  if (!commonFiles.has(rel)) return false;
  const commonAbs = path.join(COMMON_DIR, rel);
  if (!fs.existsSync(commonAbs)) return false;
  return fs.readFileSync(sourceAbs, 'utf-8') === fs.readFileSync(commonAbs, 'utf-8');
}

const variantUnique: typeof sourceFiles = [];
const commonInherited: string[] = [];
const skipped: string[] = [];

for (const f of sourceFiles) {
  if (shouldSkip(f.rel)) { skipped.push(f.rel); continue; }
  if (isCommonInherited(f.rel, f.abs)) { commonInherited.push(f.rel); }
  else { variantUnique.push(f); }
}

console.log(`Source files    : ${sourceFiles.length}`);
console.log(`Common-inherited: ${commonInherited.length}`);
console.log(`Skipped         : ${skipped.length}`);
console.log(`Variant-unique  : ${variantUnique.length}`);
console.log('');

// Complexity/divergence routing check — makes the informal "use the Full L2 Pipeline for
// anything non-trivial" judgment call (previously only documented in SKILL.md prose) an
// automated decision instead of tribal knowledge.
const commonTopDirs = new Set(
  [...commonFiles].map(f => f.split('/')[0]).filter(Boolean)
);
const variantDirCounts = new Map<string, number>();
for (const f of variantUnique) {
  const top = f.rel.split('/')[0];
  if (!top || commonTopDirs.has(top)) continue; // only dirs absent from templates/common/
  variantDirCounts.set(top, (variantDirCounts.get(top) ?? 0) + 1);
}
const largeDomainDirs = [...variantDirCounts.entries()].filter(([, count]) => count > LARGE_DIR_MIN_FILES);

if (variantUnique.length > THRESHOLD_FILES || largeDomainDirs.length > THRESHOLD_DIRS) {
  console.log(`${YELLOW}This project diverges significantly from templates/common/ ` +
    `(${variantUnique.length} variant-unique file(s), ${largeDomainDirs.length} large domain dir(s): ` +
    `${largeDomainDirs.map(([d, c]) => `${d}/ (${c})`).join(', ') || 'none'}).${RESET}`);
  console.log(`Recommended: use the Full L2 Pipeline instead of this script:`);
  console.log(`  cp -r ${sourceArg} Projects/${targetArg}/ && cd Projects/${targetArg}/ && git init && git add -A && git commit -m "initial"`);
  console.log(`  bun scripts/l3-to-variant-pipeline.ts`);
  console.log(`This gets ADR-referenced review (see docs/adr/templates/variant-creation-template.md), ` +
    `anti-swelling (validate-templates.ts WS-02) and platform-parity checks (validate-platform-parity.ts) automatically.`);
  if (!FORCE) {
    fail('Aborting — pass --force to proceed with the lightweight pipeline anyway.');
  }
  console.log(`${YELLOW}--force passed — proceeding with the lightweight pipeline despite the size warning.${RESET}\n`);
}

let copied = 0;
let errored = 0;

for (const f of variantUnique) {
  const dest = path.join(targetDir, f.rel);
  if (DRY_RUN) { console.log(`  [DRY] ${f.rel}`); copied++; continue; }
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
    copied++;
  } catch (e) {
    console.error(`${RED}  Failed to copy ${f.rel}: ${e}${RESET}`);
    errored++;
  }
}

if (!DRY_RUN) {
  console.log(`${GREEN}Copied ${copied} files to templates/${targetArg}/${RESET}`);
  if (!fs.existsSync(path.join(targetDir, 'variant.json'))) {
    const agentsDir = path.join(targetDir, 'agents');
    const skillsDir = path.join(targetDir, 'skills');
    // {name, file} shape — matches the canonical variant.json schema (see e.g. templates/co-abap/variant.json)
    // and is required by regenerate-agents-md.ts's `variant.agents.map(a => a.name)`.
    const agents = fs.existsSync(agentsDir)
      ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md') && f !== 'README.md')
          .map(f => ({ name: f.replace('.md', ''), file: `agents/${f}` }))
      : [];
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
          .map(f => ({ name: f, file: `skills/${f}/SKILL.md` }))
      : [];

    // Preserve country_config from source project if present
    let countryConfig = undefined;
    const sourceVariantJson = path.join(sourceDir, 'variant.json');
    if (fs.existsSync(sourceVariantJson)) {
      try {
        const sourceVariant = JSON.parse(fs.readFileSync(sourceVariantJson, 'utf-8')) as Record<string, unknown>;
        if (sourceVariant.country_config) {
          countryConfig = sourceVariant.country_config;
        }
      } catch (e) {
        // Source variant.json read error - skip country_config preservation
      }
    }

    // If source has country profiles (besides ACTIVE.md) but no country_config, create skeleton
    const countriesDir = path.join(sourceDir, 'docs', 'countries');
    if (!countryConfig && fs.existsSync(countriesDir)) {
      const profiles = fs.readdirSync(countriesDir).filter(f => f.endsWith('.md') && f !== 'ACTIVE.md');
      if (profiles.length > 0) {
        const supported = profiles.map(f => f.replace('.md', ''));
        countryConfig = {
          profiles_dir: 'docs/countries',
          supported: supported,
          default: null
        };
      }
    }

    const variantJson: Record<string, unknown> = {
      name: targetArg,
      extends: 'common',
      version: '0.1.0',
      agents,
      skills,
      description: `TODO: Describe the ${targetArg} variant`
    };

    if (countryConfig) {
      variantJson.country_config = countryConfig;
    }

    fs.writeFileSync(path.join(targetDir, 'variant.json'), JSON.stringify(variantJson, null, 2) + '\n', 'utf-8');
    console.log(`${GREEN}Generated templates/${targetArg}/variant.json${RESET}`);
  }
  const validateTs = path.join(WORKSPACE_ROOT, 'scripts', 'validate-templates.ts');
  if (fs.existsSync(validateTs)) {
    console.log(`\n${CYAN}Running validate-templates.ts...${RESET}`);
    try { execFileSync(process.execPath, [validateTs], { cwd: WORKSPACE_ROOT, stdio: 'inherit' }); }
    catch { console.log(`${YELLOW}Validation reported issues -- review above${RESET}`); }
  }
}

// Auto-run what doesn't require judgment: AGENTS.md roster generation is mechanical.
const regenTs = path.join(WORKSPACE_ROOT, 'scripts', 'regenerate-agents-md.ts');
if (fs.existsSync(regenTs)) {
  console.log(`\n${CYAN}${DRY_RUN ? 'Previewing' : 'Regenerating'} templates/${targetArg}/AGENTS.md roster...${RESET}`);
  const regenArgs = DRY_RUN ? ['--dry-run', '--variant', targetArg] : ['--variant', targetArg];
  try { execFileSync(process.execPath, [regenTs, ...regenArgs], { cwd: WORKSPACE_ROOT, stdio: 'inherit' }); }
  catch { console.log(`${YELLOW}AGENTS.md regeneration reported issues -- review above${RESET}`); }
}

// Auto-register the spec when the caller supplies which design doc describes this variant —
// there's no reliable way to auto-discover that, so this stays opt-in via --design-doc.
let specRegistered = false;
if (designDocArg && !DRY_RUN) {
  const specRegisterTs = path.join(WORKSPACE_ROOT, 'scripts', 'spec-register.ts');
  if (fs.existsSync(specRegisterTs)) {
    console.log(`\n${CYAN}Registering spec: ${designDocArg}...${RESET}`);
    try {
      execFileSync(process.execPath, [specRegisterTs, '--file', designDocArg, '--source', 'manual'], { cwd: WORKSPACE_ROOT, stdio: 'inherit' });
      specRegistered = true;
    } catch { console.log(`${YELLOW}Spec registration failed -- review above${RESET}`); }
  }
}

console.log(`
${CYAN}=== Manual Review Checklist ===${RESET}
  [ ] templates/${targetArg}/agents/pm.md -- verify PM overrides
  [ ] templates/${targetArg}/CLAUDE.md and GEMINI.md -- update variant context${specRegistered ? '' : `
  [ ] Register spec: bun scripts/spec-register.ts --file <design-doc> --source manual (or re-run with --design-doc <path>)`}
  [ ] templates/${targetArg}/docs/countries/ profiles contain jurisdiction knowledge (not project-specific data); ACTIVE.md excluded
  [ ] variant.json country_config.supported matches shipped profiles (validate-templates country-config check)

Run bun scripts/audit.ts after completing the checklist.
`);

if (import.meta.main) {
  if (errored > 0) { console.error(`${RED}${errored} file(s) failed to copy${RESET}`); process.exit(1); }
}
