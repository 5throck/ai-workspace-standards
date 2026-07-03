// @version 1.0.2
/**
 * project-to-variant.ts
 *
 * Promotes an existing L2 project (Projects/<name>/) to a variant template (templates/<name>/).
 * Diffs against templates/common/ to keep only variant-specific files.
 *
 * Usage:
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal
 *   bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal --dry-run
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

const sourceArg = getArg('--source');
const targetArg = getArg('--target');

if (!sourceArg || !targetArg) {
  fail('Usage: bun scripts/project-to-variant.ts --source <path> --target <variant-name> [--dry-run]');
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

const SKIP_PATTERNS = [/^\.git\//, /^node_modules\//, /^memory\//];
function shouldSkip(rel: string): boolean { return SKIP_PATTERNS.some(p => p.test(rel)); }

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
    const agents = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md') && f !== 'README.md').map(f => f.replace('.md', '')) : [];
    const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory()) : [];
    const variantJson = { name: targetArg, extends: 'common', version: '0.1.0', agents, skills, description: `TODO: Describe the ${targetArg} variant` };
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

console.log(`
${CYAN}=== Manual Review Checklist ===${RESET}
  [ ] templates/${targetArg}/variant.json -- verify agents/skills lists
  [ ] templates/${targetArg}/AGENTS.md -- update agent roster
  [ ] templates/${targetArg}/agents/pm.md -- verify PM overrides
  [ ] templates/${targetArg}/CLAUDE.md and GEMINI.md -- update variant context
  [ ] Register spec: bun scripts/spec-register.ts --file <design-doc> --source manual

Run bun scripts/audit.ts after completing the checklist.
`);

if (import.meta.main) {
  if (errored > 0) { console.error(`${RED}${errored} file(s) failed to copy${RESET}`); process.exit(1); }
}
