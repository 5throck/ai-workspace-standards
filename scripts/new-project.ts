#!/usr/bin/env bun
// @version 1.2.0
// new-project.ts — Scaffold a new project under the workspace root
// Usage: bun scripts/new-project.ts "<project-name>" [--variant <variant>] [--platform claude|antigravity|both] [--version X.Y.Z]
//
// Migrated from new-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, rmSync, readdirSync, statSync,
  readFileSync, writeFileSync, copyFileSync, appendFileSync, chmodSync,
} from 'node:fs';
import { resolve, join, dirname, basename, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyContextTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './helpers/template-utils.js';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectName = '';
let variant = '';
let templateVer = '';
let platform = 'both';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--version' && args[i + 1]) {
    templateVer = args[++i];
    // Strict allowlist: only alphanumeric, dots, hyphens, underscores — no shell metacharacters
    if (!/^[a-zA-Z0-9._-]+$/.test(templateVer)) {
      console.error(`❌ Invalid --version value: '${templateVer}'. Only letters, numbers, dots, hyphens, underscores allowed.`);
      process.exit(1);
    }
    continue;
  }
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
  // Extract from tag into temp dir (shell-free: no bash -c interpolation)
  const mktemp = spawnSync('mktemp', ['-d'], { encoding: 'utf8' });
  tempDir = mktemp.stdout.trim();
  const archivePath = join(tempDir, '_archive.tar');
  const archiveRes = spawnSync(
    'git', ['-C', workspaceRoot, 'archive', '--output', archivePath, tag, 'templates/common/', `templates/${variant}/`],
    { encoding: 'utf8' }
  );
  const extract = archiveRes.status === 0
    ? spawnSync('tar', ['-x', '-C', tempDir, '-f', archivePath], { encoding: 'utf8' })
    : archiveRes;
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

// ── 2.5b. Sanitize: remove L0 CONSTITUTION.md references from all .md files ────
// Defense-in-depth: strip lines referencing CONSTITUTION.md or docs/constitution/ paths
// that should not exist in generated L2 variant projects.
const L0_REF_PATTERN = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/i;
let sanitizedCount = 0;
for (const f of walkFiles(projectDir)) {
  if (!f.endsWith('.md')) continue;
  const original = readFileSync(f, 'utf-8');
  const cleaned = original
    .split('\n')
    .filter(line => !L0_REF_PATTERN.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  if (cleaned !== original) {
    writeFileSync(f, cleaned);
    sanitizedCount++;
  }
}
if (sanitizedCount > 0) {
  console.log(`  🧹 Sanitized ${sanitizedCount} file(s): removed L0 CONSTITUTION references`);
}

// Clear memory log files (new projects start with empty memory/)
const memoryDir = join(projectDir, 'memory');
if (existsSync(memoryDir)) {
  for (const f of walkFiles(memoryDir)) {
    if (f.endsWith('.md')) rmSync(f);
  }
  console.log('  🗑️  Cleared memory/*.md (new projects start with empty memory/)');
}

// ── 2.6. Flatten docs/_common/ → docs/ ───────────────────────────────────────
const commonDocs = join(projectDir, 'docs', '_common');
if (existsSync(commonDocs)) {
  copyDir(commonDocs, join(projectDir, 'docs'));
  rmSync(commonDocs, { recursive: true });
  console.log('  ✅ docs/_common/ → docs/ (flattened)');
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

// ── 2.3b. Create deliverables/ subdirectories (co-consult) ──────────────────────
if (variant === 'co-consult') {
  const delRoot = join(projectDir, 'deliverables');
  const delDirs = [
    { name: 'reports', desc: 'Final deliverables, client-ready reports' },
    { name: 'drafts', desc: 'Work-in-progress documents and drafts' },
    { name: 'research', desc: 'Research notes, source materials, data' },
    { name: 'presentations', desc: 'Client presentation decks' },
  ];
  for (const d of delDirs) {
    const dir = join(delRoot, d.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), [
      `# deliverables/${d.name}/`,
      '',
      d.desc + '.',
      '',
      '## Output Destination',
      '',
      'See Output Destination Mapping in `docs/co-consult.context.md` for per-agent paths and naming conventions.',
      '',
    ].join('\n'));
  }
  console.log('  ✅ deliverables/{reports,drafts,research,presentations}/ created');
}

// ── 2.5. Strip L1-B metadata from agents/pm.md ────────────────────────────────
const pmMd = join(projectDir, 'agents', 'pm.md');
if (existsSync(pmMd)) {
  const yaml = require('js-yaml');
  let content = readFileSync(pmMd, 'utf8');
  content = content.replace(/^# @resolved-from:.*\n/m, '');
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

// ── 2.6b. Remove template-only docs/ subdirs (variant overlay may re-add; removed here after overlay)
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
  const agentOverrideMerge = join(workspaceRoot, 'scripts', 'lib', 'agent-override-merge.ts');
  spawnSync('bun', [agentOverrideMerge, commonDir, templatesDir, projectDir], {
    encoding: 'utf8',
    stdio: 'inherit',
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
const contextTemplatePath = join(workspaceRoot, 'templates', 'common', 'docs', 'variant.context.template.md');
if (existsSync(contextTemplatePath) && !existsSync(variantContextMd)) {
  applyContextTemplate(contextTemplatePath, variantContextMd, {
    variantName: variant,
    version: templateVersion,
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
  l0Scripts = ['validate-templates.ts', 'create-l2-scaffold.ts', 'l2-to-variant-pipeline.ts', 'fix-script-versions.ts'];
}
for (const s of l0Scripts) {
  const fp = join(projectDir, 'scripts', s);
  if (existsSync(fp)) rmSync(fp, { recursive: true, force: true });
}

// Remove workspace-only artifacts
const cleanupFiles = [
  'scripts/propagation-map.json',
  'variant.json',
  'agents/pm.md.backup',
  'docs/variant.context.template.md',  // scaffolding-only template — generates <variant>.context.md via applyContextTemplate()
];
for (const f of cleanupFiles) {
  const fp = join(projectDir, f);
  if (existsSync(fp)) rmSync(fp);
}

// Safety-net: remove any workspace-only skills that bypassed propagation filtering
// (l2_propagate: false). Primary enforcement is in propagate-to-templates.ts via
// layer-filter.ts — this block catches manual additions to templates/common/skills/.
// Also removes legacy hardcoded L0-only skills (scope: workspace).
const LEGACY_L0_SKILLS = ['simulate-project-creation'];
for (const skill of LEGACY_L0_SKILLS) {
  for (const base of ['skills', '.claude/skills', '.gemini/skills']) {
    const dp = join(projectDir, base, skill);
    if (existsSync(dp)) rmSync(dp, { recursive: true });
  }
}
const projectSkillsDir = join(projectDir, 'skills');
if (existsSync(projectSkillsDir)) {
  for (const skillName of readdirSync(projectSkillsDir)) {
    const skillMd = join(projectSkillsDir, skillName, 'SKILL.md');
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, 'utf-8');
      if (/^l2_propagate:\s*false\b/m.test(content)) {
        rmSync(join(projectSkillsDir, skillName), { recursive: true });
        console.log(`  🗑️  Excluded L1-only skill: ${skillName}`);
      }
    }
  }
}

// Safety-net: remove any workspace-only scripts that bypassed propagation filtering
// (@l2-propagate: false header). Primary enforcement is in propagate-to-templates.ts
// via layer-filter.ts — this block catches manual additions to templates/common/scripts/.
const projectScriptsDir = join(projectDir, 'scripts');
if (existsSync(projectScriptsDir)) {
  for (const scriptName of readdirSync(projectScriptsDir)) {
    if (!scriptName.endsWith('.ts')) continue;
    const scriptPath = join(projectScriptsDir, scriptName);
    try {
      const content = readFileSync(scriptPath, 'utf-8');
      if (/^\/\/ @l2-propagate:\s*false\b/m.test(content)) {
        rmSync(scriptPath);
        console.log(`  🗑️  Excluded L1-only script: ${scriptName}`);
      }
    } catch { /* skip unreadable files */ }
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
// Run the new project's own audit to validate the scaffold result
const projectAuditScript = join(projectDir, 'scripts', 'audit.ts');
const workspaceAuditScript = join(workspaceRoot, 'scripts', 'audit.ts');
const auditScript = existsSync(projectAuditScript) ? projectAuditScript : workspaceAuditScript;
const auditResult = spawnSync('bun', [auditScript, '--skip-memory'], { stdio: 'inherit', cwd: projectDir });

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
