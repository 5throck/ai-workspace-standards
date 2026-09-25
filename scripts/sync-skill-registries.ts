#!/usr/bin/env bun
/**
 * sync-skill-registries.ts — converge every skill registry table with the
 * SKILL.md frontmatter it documents (spec
 * 2026-09-25-registry-policy-completeness-design.md W5/R5.2).
 *
 * Surfaces (all under --root, default: cwd):
 *   1. root skills/SKILLS.md Workspace Skills rows      vs root skills dirs' SKILL.md
 *   2. root skills/SKILLS.md Variant-Exclusive catalog  vs templates/<co-variant> skills frontmatter
 *   3. templates/common/skills/SKILLS.md (seed)         vs common dirs
 *   4. templates/<co-variant>/skills/SKILLS.md          vs each variant's own dirs
 *
 * Modes:
 *   (default)   apply  — rewrite drifted tables in place (exit 0; drift is
 *                        the script's job, non-zero exit means crash)
 *   --check     gate   — report findings, exit 1 on any drift (VA-08/CI mode)
 *   --dry-run   preview— print the planned changes without writing
 *   --root DIR  target — operate on a fixture root (tests)
 *
 * Never edits SKILL.md files, frontmatter, notes cells, or prose. Rows whose
 * SKILL.md lacks a parseable version are kept and reported (`unparseable`).
 * Multi-variant skills with divergent frontmatter are reported
 * (`catalog-divergent`) and left untouched. Idempotent: a second run changes
 * nothing. Pure reconcile logic lives in scripts/helpers/skills-registry.ts.
 *
 * Wired as dev-sync Step 4.63 (apply mode, workspace root, after the 4.62
 * cascade re-publish) so every /sync re-converges the registries.
 *
 * @version 1.0.0
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  collectCatalogDrift,
  collectCatalogEntries,
  collectRegistryDrift,
  collectDeliveredSkills,
  collectWorkspaceRegistryFindings,
  listSkillDirs,
  splitRootRegistry,
  syncGenericRegistry,
  syncVariantExclusiveCatalog,
  type RegistrySyncFinding,
} from './helpers/skills-registry.ts';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface SurfacePlan {
  label: string;
  path: string;
  before: string;
  after: string;
  findings: RegistrySyncFinding[];
}

function parseArgs(argv: string[]): { check: boolean; dryRun: boolean; root: string } {
  let check = false;
  let dryRun = false;
  let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--root') root = argv[++i] ?? root;
    else {
      console.error(`${RED}Unknown argument: ${argv[i]}${RESET}`);
      console.error('Usage: bun scripts/sync-skill-registries.ts [--check] [--dry-run] [--root DIR]');
      process.exit(2);
    }
  }
  return { check, dryRun, root: resolve(root) };
}

/** Plan surface 1+2: the root registry's workspace section and its catalog. */
function planRootRegistry(root: string): SurfacePlan | null {
  const registryPath = join(root, 'skills', 'SKILLS.md');
  if (!existsSync(registryPath)) return null;
  const before = readFileSync(registryPath, 'utf-8');
  const { workspace, catalog } = splitRootRegistry(before);

  const rootSkillsDir = join(root, 'skills');
  const rootDirs = listSkillDirs(rootSkillsDir);
  const rootDelivered = collectDeliveredSkills(rootSkillsDir);

  const catalogScan = collectCatalogEntries(join(root, 'templates'), new Set(rootDirs));
  const catalogSync = syncVariantExclusiveCatalog(catalog, catalogScan.entries, catalogScan.divergentSkills, catalogScan.skippedSkills);

  const findings: RegistrySyncFinding[] = [
    ...collectRegistryDrift('skills/SKILLS.md (Workspace Skills)', workspace, rootDelivered, rootDirs),
    ...catalogScan.findings,
    ...collectCatalogDrift('skills/SKILLS.md (Variant-Exclusive)', catalog, catalogScan.entries, catalogScan.divergentSkills, catalogScan.skippedSkills),
  ];

  return {
    label: 'skills/SKILLS.md (workspace rows + Variant-Exclusive catalog)',
    path: registryPath,
    before,
    after: syncGenericRegistry(workspace, rootSkillsDir).after + catalogSync.content,
    findings,
  };
}

/** Plan surface 3 or 4: a generic single-table registry vs its own skills dir. */
function planGenericSurface(label: string, registryPath: string, skillsDir: string): SurfacePlan | null {
  if (!existsSync(registryPath)) return null;
  const before = readFileSync(registryPath, 'utf-8');
  const findings = collectRegistryDrift(label, before, collectDeliveredSkills(skillsDir), listSkillDirs(skillsDir));
  return { label, path: registryPath, before, after: syncGenericRegistry(before, skillsDir).after, findings };
}

function planSurfaces(root: string): SurfacePlan[] {
  const plans: SurfacePlan[] = [];
  const rootPlan = planRootRegistry(root);
  if (rootPlan) plans.push(rootPlan);

  const commonRegistryPath = join(root, 'templates', 'common', 'skills', 'SKILLS.md');
  const commonPlan = planGenericSurface('templates/common/skills/SKILLS.md', commonRegistryPath, join(root, 'templates', 'common', 'skills'));
  if (commonPlan) plans.push(commonPlan);

  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const variant of readdirSync(templatesDir).sort()) {
      if (!variant.startsWith('co-')) continue;
      const label = `templates/${variant}/skills/SKILLS.md`;
      const plan = planGenericSurface(label, join(templatesDir, variant, 'skills', 'SKILLS.md'), join(templatesDir, variant, 'skills'));
      if (plan) plans.push(plan);
    }
  }
  return plans;
}

function describeChange(before: string, after: string): string[] {
  const beforeRows = new Map<string, string>();
  for (const line of before.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) beforeRows.set(m[1], line);
  }
  const afterRows = new Map<string, string>();
  for (const line of after.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) afterRows.set(m[1], line);
  }
  const notes: string[] = [];
  const added = [...afterRows.keys()].filter((k) => !beforeRows.has(k));
  const pruned = [...beforeRows.keys()].filter((k) => !afterRows.has(k));
  const updated = [...afterRows.keys()].filter((k) => beforeRows.has(k) && beforeRows.get(k) !== afterRows.get(k));
  if (updated.length) notes.push(`   ${YELLOW}🔄 UPDATED ${updated.length} row(s):${RESET} ${updated.join(', ')}`);
  if (added.length) notes.push(`   ${GREEN}➕ ADDED ${added.length} row(s):${RESET} ${added.join(', ')}`);
  if (pruned.length) notes.push(`   ${RED}✂️  PRUNED ${pruned.length} row(s):${RESET} ${pruned.join(', ')}`);
  return notes;
}

async function main(): Promise<number> {
  const { check, dryRun, root } = parseArgs(process.argv.slice(2));

  if (check) {
    console.log(`🔎 ${CYAN}Skill registry sync check${RESET} ${DIM}(root: ${root})${RESET}`);
    const findings = collectWorkspaceRegistryFindings(root);
    for (const f of findings) {
      console.log(`  ${RED}✗ [${f.kind}]${RESET} ${f.message}`);
    }
    if (findings.length > 0) {
      console.log(`${RED}❌ ${findings.length} registry finding(s) — run: bun scripts/sync-skill-registries.ts${RESET}`);
      return 1;
    }
    console.log(`${GREEN}✅ All skill registry surfaces converged (0 findings)${RESET}`);
    return 0;
  }

  console.log(`🔎 ${CYAN}Skill registry sync${RESET} ${DIM}(root: ${root}${dryRun ? ', dry-run' : ''})${RESET}`);
  const plans = planSurfaces(root);
  let changed = 0;
  let totalFindings = 0;
  for (const plan of plans) {
    totalFindings += plan.findings.length;
    if (plan.after === plan.before) {
      console.log(`  ${GREEN}✓${RESET} ${plan.label} ${DIM}— already converged${RESET}`);
      continue;
    }
    changed++;
    console.log(`  ${CYAN}📝 ${plan.label}${RESET}`);
    for (const note of describeChange(plan.before, plan.after)) console.log(note);
    if (!dryRun) writeFileSync(plan.path, plan.after, 'utf-8');
  }

  const verb = dryRun ? 'would change' : 'changed';
  if (changed === 0) {
    console.log(`${GREEN}✅ ${plans.length} surface(s) scanned — all converged, 0 ${verb}${RESET}`);
  } else {
    console.log(`${GREEN}✅ ${plans.length} surface(s) scanned, ${changed} ${verb}${RESET} ${DIM}(${totalFindings} finding(s) resolved)${RESET}`);
    if (dryRun) console.log(`${YELLOW}ℹ️  dry-run — no files written. Re-run without --dry-run to apply.${RESET}`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
