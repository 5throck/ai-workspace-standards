#!/usr/bin/env bun
// @version 1.0.0
// new-project.ts — Scaffold a new project under the workspace root
// Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|both] [--version X.Y.Z]
//
// Migrated from new-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, rmSync, readdirSync, statSync,
  readFileSync, writeFileSync, copyFileSync, appendFileSync, chmodSync,
} from 'node:fs';
import { resolve, join, dirname, basename, relative } from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { applyContextTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './helpers/template-utils.js';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectName = '';
let variant = '';
let templateVer = '';
let platform = 'both';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--version' && args[i + 1]) { templateVer = args[++i]; continue; }
  if (args[i] === '--platform' && args[i + 1]) { platform = args[++i]; continue; }
  if (!projectName && !args[i].startsWith('--')) { projectName = args[i]; continue; }
  if (projectName && !variant && !args[i].startsWith('--')) { variant = args[i]; continue; }
}

if (!projectName) {
  console.error('Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|both] [--version X.Y.Z]');
  process.exit(1);
}

// Validate project name
if (!/^[a-zA-Z0-9_/.\-]+$/.test(projectName) || projectName.includes('..')) {
  console.error(`❌ Invalid project name: '${projectName}'`);
  console.error('   Only letters, numbers, hyphens (-), underscores (_), and slashes (/) are allowed, without path traversal (..).');
  process.exit(1);
}
if (projectName.length > 64) {
  console.error(`❌ Project name too long (${projectName.length} chars). Maximum is 64 characters.`);
  process.exit(1);
}

// Validate platform
if (!['claude', 'antigravity', 'both'].includes(platform)) {
  console.error('❌ --platform must be: claude, antigravity, or both (default: both)');
  process.exit(1);
}

// ── Workspace root resolution ──────────────────────────────────────────────────
const workspaceRoot = resolve(import.meta.dir, '..');
const projectDir = join(workspaceRoot, projectName);

// ── Variant detection & validation ────────────────────────────────────────────
function getValidVariants(fromTag?: string): string[] {
  if (fromTag) {
    const result = spawnSync('git', ['-C', workspaceRoot, 'archive', fromTag, '--list'], { encoding: 'utf8' });
    if (result.status !== 0) return [];
    return result.stdout
      .split('\n')
      .filter(l => /^templates\/co-[^/]+\/variant\.json$/.test(l))
      .map(l => l.replace('templates/', '').replace('/variant.json', ''))
      .sort();
  }
  if (!existsSync(join(workspaceRoot, 'templates'))) return [];
  return readdirSync(join(workspaceRoot, 'templates'))
    .filter(d => d.startsWith('co-'))
    .sort();
}

const tag = templateVer ? `template-v${templateVer}` : '';
const validVariants = getValidVariants(tag || undefined);

if (tag && validVariants.length === 0) {
  console.error(`❌ Could not detect variants from tag '${tag}'. Tag may not exist.`);
  console.error('   To list available tags: git tag --list \'template-v*\'');
  process.exit(1);
}

if (!variant) {
  console.error('\n[INFO] No variant specified. Please choose one:');
  validVariants.forEach(v => console.error(`   ${v}`));
  console.error(`\n   Usage: bun scripts/new-project.ts "${projectName}" --variant <variant>\n`);
  process.exit(1);
}

if (!validVariants.includes(variant)) {
  console.error(`❌ Invalid variant: ${variant}`);
  console.error(`   Valid variants: ${validVariants.join(' ')}`);
  process.exit(1);
}

// ── Directory resolution (with optional git-tag extraction) ───────────────────
let commonDir = join(workspaceRoot, 'templates', 'common');
let templatesDir = join(workspaceRoot, 'templates', variant);
let tempDir = '';

if (tag) {
  // Verify tag exists
  const tagCheck = spawnSync('git', ['-C', workspaceRoot, 'tag', '-l', tag], { encoding: 'utf8' });
  if (!tagCheck.stdout.trim()) {
    console.error(`❌ Template version not found: ${tag}`);
    console.error('   Run: bun scripts/list-template-versions.ts');
    process.exit(1);
  }
  // Extract from tag into temp dir
  const mktemp = spawnSync('mktemp', ['-d'], { encoding: 'utf8' });
  tempDir = mktemp.stdout.trim();
  const extract = spawnSync(
    'bash', ['-c', `git -C "${workspaceRoot}" archive "${tag}" "templates/common/" "templates/${variant}/" | tar -x -C "${tempDir}"`],
    { encoding: 'utf8' }
  );
  if (extract.status !== 0) {
    console.error(`❌ Failed to extract template version ${tag}`);
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }
  commonDir = join(tempDir, 'templates', 'common');
  templatesDir = join(tempDir, 'templates', variant);
  if (!existsSync(templatesDir)) {
    console.error(`❌ Variant '${variant}' not found in template version ${tag}`);
    rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }
  console.log(`📦 Using template version: ${tag}`);
}

// Register cleanup on exit
if (tempDir) {
  process.on('exit', () => { try { rmSync(tempDir, { recursive: true, force: true }); } catch {} });
  process.on('SIGINT', () => { rmSync(tempDir, { recursive: true, force: true }); process.exit(130); });
}

// ── Pre-flight checks ──────────────────────────────────────────────────────────
if (existsSync(projectDir)) {
  console.error(`❌ Directory already exists: ${projectDir}`);
  process.exit(1);
}
if (!existsSync(templatesDir)) {
  console.error(`❌ Template variant not found: ${templatesDir}`);
  console.error(`   Available variants: ${validVariants.join(' ')}`);
  process.exit(1);
}

// Variant status check
const variantJsonPath = join(templatesDir, 'variant.json');
if (existsSync(variantJsonPath)) {
  const vj = JSON.parse(readFileSync(variantJsonPath, 'utf8'));
  if (vj.status && vj.status !== 'stable') {
    console.log(`⚠️  Variant '${variant}' has status: ${vj.status}`);
    console.log('   This variant may not be fully implemented.');
    const answer = prompt('   Continue anyway? [y/N] ') ?? '';
    if (!['y', 'Y'].includes(answer)) {
      console.log('Aborted.');
      process.exit(1);
    }
  }
}

// ── Lifecycle governance pre-check ────────────────────────────────────────────
const governanceJson = join(workspaceRoot, 'docs', 'templates', 'lifecycle-governance.json');
if (existsSync(join(workspaceRoot, 'scripts', 'validate-templates.ts')) && existsSync(governanceJson)) {
  console.log(`\nRunning lifecycle governance pre-check for variant '${variant}'…`);
  const govResult = spawnSync('bun', [join(workspaceRoot, 'scripts', 'helpers', 'lifecycle-governance.ts')], { encoding: 'utf8' });
  const mandatoryDomains = govResult.status === 0 ? govResult.stdout.trim() : 'variant,agent,skill';

  const validateResult = spawnSync(
    'bun', [join(workspaceRoot, 'scripts', 'validate-templates.ts'), '--variant', variant, '--json'],
    { encoding: 'utf8' }
  );
  const validateOutput = validateResult.stdout || '{"errors":[{"check":"validate-failed","message":"validate-templates.ts failed to run"}]}';

  const validateCheck = spawnSync(
    'bun', [join(workspaceRoot, 'scripts', 'helpers', 'validate-output.ts'), mandatoryDomains, validateOutput],
    { encoding: 'utf8' }
  );
  if (validateCheck.status !== 0) {
    console.error(`\n❌ Lifecycle governance pre-check FAILED for variant '${variant}'.`);
    console.error('   Fix the issues above before creating a project from this variant.');
    console.error(`   Run: bun scripts/validate-templates.ts --variant ${variant}`);
    process.exit(1);
  }
  console.log(`  ✅ Lifecycle governance pre-check passed (mandatory domains: ${mandatoryDomains})`);
}

// ── Template validation ────────────────────────────────────────────────────────
const templateValidationHelper = join(workspaceRoot, 'scripts', 'helpers', 'template-validation.ts');
if (existsSync(templateValidationHelper)) {
  console.log('Validating template integrity…');
  const result = spawnSync('bun', [templateValidationHelper, variant, commonDir, templatesDir], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }
}

// ── Helper: copy directory recursively ────────────────────────────────────────
function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

// ── Helper: make all files in directory user-writable ─────────────────────────
// Template files may have read-only bits set (e.g. scripts/README.md).
// This ensures subsequent write steps (merge-package-scripts, write-scripts-snapshot)
// can open them without EPERM. This is NOT security permission manipulation —
// it only restores the default user-writable state that OS-created files have.
function makeWritable(dir: string): void {
  for (const f of walkFiles(dir)) {
    try {
      const mode = statSync(f).mode;
      if (!(mode & 0o200)) chmodSync(f, mode | 0o200);
    } catch { /* best-effort */ }
  }
}

// ── Helper: walk all files in a directory ─────────────────────────────────────
function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkFiles(full);
    else yield full;
  }
}

// ── 1. Copy common/ (shared infrastructure) ───────────────────────────────────
if (!existsSync(commonDir)) {
  console.error(`❌ Common templates directory not found: ${commonDir}`);
  process.exit(1);
}

console.log(`🚀 Scaffolding new project: ${projectName}`);
mkdirSync(projectDir, { recursive: true });

// Workspace-only files that must NOT be copied into new projects
const WORKSPACE_ONLY_FILES = ['package.json', 'package-lock.json', 'bun.lock', 'bun.lockb', 'propagation-map.json', 'variant.json'];
copyDir(commonDir, projectDir);
// Ensure all copied files are user-writable (template storage may set read-only bits)
makeWritable(projectDir);
for (const f of WORKSPACE_ONLY_FILES) {
  const fp = join(projectDir, f);
  if (existsSync(fp)) { rmSync(fp); console.log(`  🗑️  Excluded workspace-only file: ${f}`); }
}

// L1-only agent files
const L1_ONLY_AGENTS = ['agents/lifecycle-manager.md', 'agents/_COMMON.md', 'agents/pm.md.backup'];
for (const a of L1_ONLY_AGENTS) {
  const fp = join(projectDir, a);
  if (existsSync(fp)) { rmSync(fp); console.log(`  🗑️  Excluded L1-only agent: ${a}`); }
}

// L1-only directories
const L1_ONLY_DIRS = ['docs/_templates', 'docs/_examples', 'docs/adr', 'docs/specs', 'docs/variants'];
for (const d of L1_ONLY_DIRS) {
  const dp = join(projectDir, d);
  if (existsSync(dp)) { rmSync(dp, { recursive: true }); console.log(`  🗑️  Excluded L1-only directory: ${d}`); }
}

// Clear memory log files (new projects start with empty memory/)
const memoryDir = join(projectDir, 'memory');
if (existsSync(memoryDir)) {
  for (const f of walkFiles(memoryDir)) {
    if (f.endsWith('.md')) rmSync(f);
  }
  console.log('  🗑️  Cleared memory/*.md (new projects start with empty memory/)');
}

// ── 2. Overlay variant/ on top ────────────────────────────────────────────────
if (!existsSync(templatesDir)) {
  console.error(`❌ Variant templates directory not found: ${templatesDir}`);
  process.exit(1);
}

console.log('📝 Copying variant templates...');
for (const srcFile of walkFiles(templatesDir)) {
  const relPath = relative(templatesDir, srcFile);
  const destFile = join(projectDir, relPath);
  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(srcFile, destFile);
}
// Ensure variant-overlaid files are also writable
makeWritable(projectDir);
console.log('  ✅ Variant templates copied');

// ── 2.5. Strip L1-B metadata from agents/pm.md ────────────────────────────────
const pmMd = join(projectDir, 'agents', 'pm.md');
if (existsSync(pmMd)) {
  const yaml = require('js-yaml');
  let content = readFileSync(pmMd, 'utf8');
  content = content.replace(/^# @resolved-from:.*\n/, '');
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (match) {
    const fm: Record<string, unknown> = yaml.load(match[1]) || {};
    delete fm.lifecycle;
    delete fm.formal_name;
    delete fm.variant;
    const newFm = '---\n' + (yaml.dump(fm) as string).trimEnd() + '\n---\n';
    content = newFm + content.slice(match[0].length);
  }
  writeFileSync(pmMd, content, 'utf8');
  console.log('  ✅ agents/pm.md: stripped L1-B metadata (@resolved-from, lifecycle, formal_name, variant)');
}

// ── 2.6. Flatten docs/_common/ → docs/ ───────────────────────────────────────
const commonDocs = join(projectDir, 'docs', '_common');
if (existsSync(commonDocs)) {
  copyDir(commonDocs, join(projectDir, 'docs'));
  rmSync(commonDocs, { recursive: true });
  console.log('  ✅ docs/_common/ → docs/ (flattened)');
}

// ── 2.6b. Remove template-only docs/ subdirs (may be re-added by variant overlay)
for (const d of ['docs/adr', 'docs/specs', 'docs/variants', 'docs/_templates', 'docs/_examples']) {
  const dp = join(projectDir, d);
  if (existsSync(dp)) { rmSync(dp, { recursive: true }); console.log(`  🗑️  Removed template-only dir: ${d}`); }
}

// ── 2.7. Apply platform profile ───────────────────────────────────────────────
if (platform === 'claude') { const f = join(projectDir, 'GEMINI.md'); if (existsSync(f)) rmSync(f); }
if (platform === 'antigravity') { const f = join(projectDir, 'CLAUDE.md'); if (existsSync(f)) rmSync(f); }

// Remove .cmd files
for (const f of walkFiles(projectDir)) {
  if (f.endsWith('.cmd')) rmSync(f);
}

// ── 3.6. Agent Override Merge (VARIANT-SECTION substitution) ──────────────────
if (existsSync(variantJsonPath)) {
  spawnSync('bun', ['-', commonDir, templatesDir, projectDir], {
    encoding: 'utf8',
    stdio: 'inherit',
    input: `
const fs = require('fs');
const path = require('path');
const [,, commonDir, variantDir, projectDir] = process.argv;
const variantJsonPath = path.join(variantDir, 'variant.json');
if (!fs.existsSync(variantJsonPath)) process.exit(0);
const variant = JSON.parse(fs.readFileSync(variantJsonPath, 'utf8'));
const overrides = variant.agent_overrides || {};
for (const [agentName, override] of Object.entries(overrides)) {
  if (override.type !== 'additive') continue;
  const skeletonFile = path.join(commonDir, 'agents', agentName + '.md');
  const variantFile = path.join(variantDir, 'agents', agentName + '.md');
  const outFile = path.join(projectDir, 'agents', agentName + '.md');
  if (!fs.existsSync(skeletonFile) || !fs.existsSync(variantFile) || !fs.existsSync(outFile)) continue;
  const variantContent = fs.readFileSync(variantFile, 'utf8');
  if (variantContent.match(/^---\\n[\\s\\S]*?^extends:/m)) {
    console.log('  [SKIP-ADDITIVE] agents/' + agentName + '.md (uses extends pattern)');
    continue;
  }
  let skeleton = fs.readFileSync(skeletonFile, 'utf8');
  const yaml = require('js-yaml');
  function parseFrontmatter(content) {
    const match = content.match(/^---\\n([\\s\\S]*?)\\n---\\n?/);
    if (!match) return { fm: {}, body: content };
    try { return { fm: yaml.load(match[1]) || {}, body: content.slice(match[0].length) }; }
    catch { return { fm: {}, body: content }; }
  }
  const { fm: skelFm, body: skelBody } = parseFrontmatter(skeleton);
  const { fm: varFm, body: varBody } = parseFrontmatter(variantContent);
  const mergedFm = { ...skelFm, ...varFm };
  const hasFm = Object.keys(mergedFm).length > 0;
  const fmStr = hasFm ? '---\\n' + yaml.dump(mergedFm).trimEnd() + '\\n---\\n' : '';
  skeleton = fmStr + skelBody;
  const allSections = {};
  const lines = varBody.split('\\n');
  let cur = null, curLines = [];
  for (const line of lines) {
    if (line.startsWith('## ')) { if (cur) allSections[cur] = curLines.join('\\n'); cur = line.slice(3).trim(); curLines = [line]; } else if (cur) curLines.push(line);
  }
  if (cur) allSections[cur] = curLines.join('\\n');
  const headingMap = { 'agent-roster': 'Agent Roster', 'governance-workflow': 'Governance Workflow', 'dispatch-protocol': 'Dispatch Protocol' };
  skeleton = skeleton.replace(/<!-- VARIANT-SECTION: ([\\w-]+) -->([\\s\\S]*?)<!-- END VARIANT-SECTION -->/g, (m, id) => {
    const h = headingMap[id]; return (h && allSections[h]) ? allSections[h] : '';
  });
  fs.writeFileSync(outFile, skeleton, 'utf8');
  console.log('  [SECTION-MERGE] agents/' + agentName + '.md');
}
`,
  });
}

// ── 4. Remove .gitkeep placeholders ───────────────────────────────────────────
for (const f of walkFiles(projectDir)) {
  if (basename(f) === '.gitkeep') rmSync(f);
}

// ── 5. Substitute placeholders ────────────────────────────────────────────────
const substitutePlaceholders = join(workspaceRoot, 'scripts', 'helpers', 'substitute-placeholders.ts');
if (existsSync(substitutePlaceholders)) {
  spawnSync('bun', [substitutePlaceholders, projectDir, projectName, 'A new project', '', variant], { stdio: 'inherit' });
} else {
  console.log('⚠️  Placeholder substitution skipped (helper missing)');
}

// ── 5.5b. Update lifecycle.statusSince in variant.json ────────────────────────
const projectDate = new Date().toISOString().slice(0, 10);
const projVariantJson = join(projectDir, 'variant.json');
if (existsSync(projVariantJson)) {
  const helper = join(workspaceRoot, 'scripts', 'helpers', 'update-variant-lifecycle.ts');
  if (existsSync(helper)) {
    spawnSync('bun', [helper, projectDir, projectDate, variant], { stdio: 'inherit' });
  }
}

// ── 5.5c. Write scripts-snapshot.json ─────────────────────────────────────────
const scriptsMd = join(workspaceRoot, 'scripts', 'SCRIPTS.md');
if (existsSync(scriptsMd)) {
  const helper = join(workspaceRoot, 'scripts', 'helpers', 'write-scripts-snapshot.ts');
  if (existsSync(helper)) {
    spawnSync('bun', [helper, projectDir, projectDate, variant, 'templates/common/scripts'], { stdio: 'inherit' });
  }
}

// ── 5.5d. Merge workspace scripts into package.json ───────────────────────────
const pkgJson = join(projectDir, 'package.json');
if (existsSync(pkgJson)) {
  const helper = join(workspaceRoot, 'scripts', 'helpers', 'merge-package-scripts.ts');
  if (existsSync(helper)) {
    spawnSync('bun', [helper, projectDir], { stdio: 'inherit' });
  }
}

// ── 5.5. Record template provenance ───────────────────────────────────────────
const versionFile = join(workspaceRoot, 'templates', 'VERSION');
const templateVersion = templateVer || (existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'unknown');
const variantContextMd = join(projectDir, 'docs', `${variant}.context.md`);

// Regenerate context.md from canonical template (SSOT: templates/common/docs/variant.context.template.md)
const contextTemplatePath = join('templates', 'common', 'docs', 'variant.context.template.md');
if (existsSync(contextTemplatePath)) {
  applyContextTemplate(contextTemplatePath, variantContextMd, {
    variantName: variant,
    version: '1.0',
    pmRoleDescription: DEFAULT_PM_ROLE_DESCRIPTIONS[variant] ?? 'Workflow management, dispatch, quality gates',
  });
  console.log(`  ✅ context.md generated from canonical template`);
}

if (existsSync(variantContextMd)) {
  const ctx = readFileSync(variantContextMd, 'utf8');
  if (!ctx.includes('Template-Version:')) {
    appendFileSync(variantContextMd, `\n## Template Provenance\n\n- **Template-Version**: ${templateVersion}\n- **Template-Variant**: ${variant}\n`);
  }
}

// ── 5.6. Write .claude/template-version.txt ───────────────────────────────────
const claudeDir = join(projectDir, '.claude');
mkdirSync(claudeDir, { recursive: true });
writeFileSync(
  join(claudeDir, 'template-version.txt'),
  `variant=${variant}\nversion=${templateVersion}\nplatform=${platform}\ncreated=${new Date().toISOString()}\n`
);

// ── 5.6b. Inject AGENTS.md Skills into docs/context.md ───────────────────────
const injectSkills = join(workspaceRoot, 'scripts', 'helpers', 'inject-skills.ts');
if (existsSync(injectSkills)) {
  spawnSync('bun', [injectSkills, projectDir], { stdio: 'inherit' });
}

// ── 5.7. Protect context.md from accidental overwrites ────────────────────────
const gitattributes = join(projectDir, '.gitattributes');
if (existsSync(gitattributes)) {
  const ga = readFileSync(gitattributes, 'utf8');
  if (!ga.includes('docs/context.md')) {
    appendFileSync(gitattributes, '\ndocs/context.md merge=ours\n');
  }
} else {
  writeFileSync(gitattributes, 'docs/context.md merge=ours\n');
}

// ── 6. Cleanup Strictly L0 Files ──────────────────────────────────────────────
const layerFilter = join(workspaceRoot, 'scripts', 'helpers', 'layer-filter.ts');
let l0Scripts: string[] = [];
if (existsSync(layerFilter)) {
  const result = spawnSync('bun', [layerFilter, '--scripts-l0-only', '--format=list'], { encoding: 'utf8' });
  if (result.status === 0) {
    l0Scripts = result.stdout.split('\n').filter(Boolean);
  }
} else {
  l0Scripts = ['publish-to-template.ts', 'validate-templates.ts', 'create-l2-scaffold.ts', 'l2-to-variant-pipeline.ts', 'fix-script-versions.ts'];
}
for (const s of l0Scripts) {
  if (s.includes('/')) continue;
  const f1 = join(projectDir, 'scripts', s);
  const f2 = join(projectDir, 'scripts', 'helpers', s);
  if (existsSync(f1)) rmSync(f1);
  if (existsSync(f2)) rmSync(f2);
}
// Always remove helpers/ (L0 pipeline internals)
const helpersDir = join(projectDir, 'scripts', 'helpers');
if (existsSync(helpersDir)) rmSync(helpersDir, { recursive: true });

// Remove workspace-only artifacts
const cleanupFiles = [
  'scripts/propagation-map.json',
  'variant.json',
  'agents/pm.md.backup',
];
for (const f of cleanupFiles) {
  const fp = join(projectDir, f);
  if (existsSync(fp)) rmSync(fp);
}

// Remove L0 skills
const L0_SKILLS = ['simulate-project-creation'];
for (const skill of L0_SKILLS) {
  for (const base of ['skills', '.claude/skills', '.gemini/skills']) {
    const dp = join(projectDir, base, skill);
    if (existsSync(dp)) rmSync(dp, { recursive: true });
  }
}

// ── 7. Initialize git ──────────────────────────────────────────────────────────
process.chdir(projectDir);
spawnSync('git', ['init'], { stdio: 'inherit' });
spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });

// Set git identity if missing
const emailCheck = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' });
if (!emailCheck.stdout.trim()) {
  spawnSync('git', ['config', 'user.email', 'scaffold-bot@local']);
  spawnSync('git', ['config', 'user.name', 'Scaffold Bot']);
}

// ── 6.5. Security Bootstrap Verification ──────────────────────────────────────
console.log('\nRunning security bootstrap verification…');
let securityOk = true;

function check(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✅ ${label}`); }
  else { console.log(`  ❌ ${label}`); securityOk = false; }
}

check('.gitleaks.toml present', existsSync(join(projectDir, '.gitleaks.toml')));
check('.githooks/pre-commit present', existsSync(join(projectDir, '.githooks', 'pre-commit')));

const gitattributesContent = existsSync(gitattributes) ? readFileSync(gitattributes, 'utf8') : '';
check('.gitattributes has eol=lf', gitattributesContent.includes('eol=lf'));

const gitignoreContent = existsSync(join(projectDir, '.gitignore')) ? readFileSync(join(projectDir, '.gitignore'), 'utf8') : '';
check('.gitignore excludes .env', gitignoreContent.includes('.env'));

const hooksPathResult = spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath'], { encoding: 'utf8' });
check('git core.hooksPath configured', hooksPathResult.stdout.includes('.githooks'));

if (!securityOk) {
  console.error('\n❌ Security bootstrap check FAILED. Fix the issues above before using this project.');
  console.error("   Run 'bun scripts/audit.ts' after fixing to verify.");
  process.exit(1);
}
console.log('  ✅ All security bootstrap checks passed');

// ── 8. Post-scaffold audit ────────────────────────────────────────────────────
console.log('\nRunning post-scaffold audit…');
process.chdir(workspaceRoot);
const auditResult = spawnSync('bun', [join(workspaceRoot, 'scripts', 'audit.ts'), '--skip-memory'], { stdio: 'inherit' });
process.chdir(projectDir);

if (auditResult.status === 0) {
  console.log(`\n✅ Project '${projectName}' scaffolded and verified at: ${projectDir}`);
} else {
  console.log('\n⚠️  Project scaffolded but audit found issues — review above before continuing.');
}

// ── 9. Environment setup ──────────────────────────────────────────────────────
console.log('\nRunning environment setup…');
const setupTs = join(projectDir, 'scripts', 'setup.ts');
const setupSh = join(projectDir, 'scripts', 'setup.sh');
if (existsSync(setupTs)) {
  const result = spawnSync('bun', [setupTs], { stdio: 'inherit', cwd: projectDir });
  if (result.status !== 0) console.log("\n⚠️  Setup encountered an error — run 'bun scripts/setup.ts' manually to retry.");
} else if (existsSync(setupSh)) {
  // Pass relative path to bash to avoid Windows path separator issues
  const result = spawnSync('bash', ['scripts/setup.sh'], { stdio: 'inherit', cwd: projectDir });
  if (result.status !== 0) console.log("\n⚠️  Setup encountered an error — run 'bash scripts/setup.sh' manually to retry.");
}

// ── Dynamic Plugin Injection ───────────────────────────────────────────────────
const injectPlugins = join(workspaceRoot, 'scripts', 'helpers', 'inject-global-plugins.ts');
if (existsSync(injectPlugins)) {
  spawnSync('bun', [injectPlugins, projectDir, platform], { stdio: 'inherit' });
}

// ── 10. Final banner ──────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\x1b[36m📂 PROJECT DIRECTORY:\x1b[0m ${projectDir}`);
console.log('');
console.log('\x1b[33m⚠️  Your shell is still at the workspace root.\x1b[0m');
console.log('   Run the following command to move into your new project:');
console.log('');
console.log(`   \x1b[32mcd "${projectDir}"\x1b[0m`);
console.log('');
console.log('   All subsequent work (git, scripts, sessions) must be run');
console.log('   from inside this directory, not the workspace root.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
if (existsSync(join(templatesDir, 'docs', '_examples'))) {
  console.log('Extension templates (ADR, analyst agent, skill, daily log):');
  console.log(`  → ${join(templatesDir, 'docs', '_examples')}/`);
}
