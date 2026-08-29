#!/usr/bin/env bun
/**
 * Skill Lifecycle Validation Script
 * @version 1.3.1
 */
// Validates skills/*/SKILL.md files for required frontmatter
// and checks governance records in docs/lifecycle/skills/*.md
//
// Usage:
//   bun scripts/validate-skills.ts
//   bun scripts/validate-skills.ts --json

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  check: string;
  message: string;
  fix?: string;
}

interface ValidationResult {
  totalFilesChecked: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: string;
}

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();
const SKILLS_DIR = join(ROOT, 'skills');
const LIFECYCLE_DOCS_DIR = join(ROOT, 'docs', 'lifecycle', 'skills');

// Required sections in governance records (docs/lifecycle/skills/*.md)
const GOVERNANCE_REQUIRED_SECTIONS = ['## Phase History', '## Acceptance Criteria'];

// Required frontmatter fields in runtime definitions (skills/*/SKILL.md)
const FRONTMATTER_REQUIRED_FIELDS = ['name', 'status', 'description', 'owner', 'version'];

// Guard: must be run from workspace root
if (!existsSync(SKILLS_DIR)) {
  console.error(`\x1b[31m[ERROR] validate-skills.ts must be run from the workspace root.\x1b[0m`);
  console.error(`        Current directory: ${ROOT}`);
  console.error(`        Expected: a directory containing skills/`);
  console.error(`        Usage: cd <workspace-root> && bun scripts/validate-skills.ts`);
  if (import.meta.main) {
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');

const issues: ValidationIssue[] = [];
let totalFiles = 0;

function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}✅${colors.reset} ${msg}`);
}

function fail(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', file, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.red}❌${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

function warn(file: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', file, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

// Normalize content: strip BOM and normalize line endings
function normalizeContent(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Parse frontmatter fields from markdown
function parseFrontmatter(rawContent: string): Record<string, true> {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fields: Record<string, true> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Skip nested keys and list items
    if (key && !key.startsWith(' ') && !key.startsWith('-')) {
      fields[key] = true;
    }
  }
  return fields;
}

// Check field existence in frontmatter
function hasField(rawContent: string, fieldName: string): boolean {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;

  const lines = match[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      if (key === fieldName) {
        return true;
      }
    }
  }

  return false;
}

// Part 1: Validate runtime definitions (skills/*/SKILL.md)
function validateRuntimeDefinitions(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 1: Runtime Definition Validation (skills/*/SKILL.md)${colors.reset}`);

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const skillDir of skillDirs) {
    const skillFile = join(SKILLS_DIR, skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    totalFiles++;
    const rawContent = readFileSync(skillFile, 'utf-8');

    const missingFields: string[] = [];

    // Check for required frontmatter fields
    for (const field of FRONTMATTER_REQUIRED_FIELDS) {
      if (!hasField(rawContent, field)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      fail(
        skillDir,
        'frontmatter-missing',
        `${skillDir}: Missing frontmatter fields: ${missingFields.join(', ')}`,
        `Add missing fields to YAML frontmatter:\n     ---\n     name: ${skillDir}\n     status: active\n     description: >\n       Brief description of what this skill does.\n       Use when: trigger phrases or conditions.\n     owner: pm|automation-engineer\n     version: 1.0.0\n     ---`
      );
    } else {
      pass(`${skillDir}: All required frontmatter fields present`);
    }
  }
}

// Part 1b: Layer placement — variant-exclusive skills must NOT live in skills/
// (DEC-20260829-02, ADR-0032 Amendment 1: variant scope = L0+L2, owned-variant only).
// Guarded to the workspace root: scaffolded projects legitimately carry
// variant-scoped skills under skills/ (copied via the variant overlay).
function validateLayerPlacement(): void {
  if (!existsSync(join(ROOT, 'templates', 'common'))) return;
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 1b: Layer Placement Validation (variant-scoped skills must not live in skills/)${colors.reset}`);

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const skillDir of skillDirs) {
    const skillFile = join(SKILLS_DIR, skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const scope = readFileSync(skillFile, 'utf-8').match(/^scope:\s*(\S+)/m)?.[1] ?? '';
    if (scope && scope !== 'workspace' && scope !== 'common') {
      fail(
        skillDir,
        'layer-placement',
        `${skillDir}: variant-exclusive skill (scope: ${scope}) must not live in skills/`,
        `Move it to templates/${scope}/skills/${skillDir}/ — variant-exclusive skills are L0+L2 (DEC-20260829-02, ADR-0032 Amendment 1)`
      );
    }
  }
}

// Part 1c: Relation metadata validation (relates_to per ADR-0060 Amendment 3).
// Form homogeneity (all-legacy-strings or all-typed-objects, never mixed),
// typed relation vocabulary, target existence, and self-reference.
const RELATION_TYPES = ['relates_to', 'composes_with', 'follows', 'enables'];

function extractRelatesTo(rawContent: string): { entries: unknown[] } | null {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split('\n');
  let inField = false;
  const entries: unknown[] = [];
  for (const line of lines) {
    if (/^relates_to:\s*$/.test(line)) {
      inField = true;
      continue;
    }
    if (!inField) continue;
    if (/^\s*-\s+skill:\s*(\S+)\s*$/.test(line)) {
      entries.push({ skill: line.match(/^\s*-\s+skill:\s*(\S+)\s*$/)![1], kind: 'typed-start' });
      continue;
    }
    if (/^\s+type:\s*(\S+)\s*$/.test(line) && entries.length > 0) {
      const last = entries[entries.length - 1] as { type?: string };
      if (last && typeof last === 'object' && 'kind' in last) last['type'] = line.match(/^\s+type:\s*(\S+)\s*$/)![1];
      continue;
    }
    if (/^\s*-\s+(?!skill:)\S/.test(line)) {
      entries.push(line.replace(/^\s*-\s+/, '').trim());
      continue;
    }
    // Any other non-indented key ends the field
    if (/^\S/.test(line)) break;
  }
  return { entries };
}

function validateRelationMetadata(knownSkills: Set<string>): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 1c: Relation Metadata Validation (relates_to)${colors.reset}`);

  // Scan L0 (skills/) and every variant template (templates/*/skills/), including
  // nested skill directories (collected as slash-relative names).
  const scanDirs: string[] = [SKILLS_DIR];
  const templatesDir = join(ROOT, 'templates');
  const l1SkillsDir = join(templatesDir, 'common', 'skills');
  const l1Names = new Set<string>();
  if (existsSync(l1SkillsDir)) {
    for (const d of readdirSync(l1SkillsDir, { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(join(l1SkillsDir, d.name, 'SKILL.md'))) l1Names.add(d.name);
    }
  }
  if (existsSync(templatesDir)) {
    for (const dirent of readdirSync(templatesDir, { withFileTypes: true })) {
      const skillsDir = join(templatesDir, dirent.name, 'skills');
      if (dirent.isDirectory() && existsSync(skillsDir)) scanDirs.push(skillsDir);
    }
  }

  const collectSkillFiles = (base: string, rel: string, out: Array<{ name: string; file: string }>) => {
    for (const dirent of readdirSync(base, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const childRel = rel ? `${rel}/${dirent.name}` : dirent.name;
      if (existsSync(join(base, dirent.name, 'SKILL.md'))) {
        out.push({ name: childRel, file: join(base, dirent.name, 'SKILL.md') });
      } else {
        collectSkillFiles(join(base, dirent.name), childRel, out);
      }
    }
  };

  for (const baseDir of scanDirs) {
    const skillFiles: Array<{ name: string; file: string }> = [];
    collectSkillFiles(baseDir, '', skillFiles);

    for (const { name: skillDir, file: skillFile } of skillFiles) {
    const raw = readFileSync(skillFile, 'utf-8');
    if (!/^relates_to:/m.test(normalizeContent(raw))) continue;

    const extracted = extractRelatesTo(raw);
    if (!extracted || extracted.entries.length === 0) {
      warn(skillDir, 'relation-empty', `${skillDir}: relates_to present but no entries parsed`, 'Remove the empty relates_to field or add entries');
      continue;
    }

    const allStrings = extracted.entries.every(e => typeof e === 'string');
    const allTyped = extracted.entries.every(e => typeof e === 'object' && e !== null);
    if (!allStrings && !allTyped) {
      fail(
        skillDir,
        'relation-mixed-forms',
        `${skillDir}: relates_to must contain either all string entries or all typed {skill, type} objects; mixed entries are not allowed`,
        'Convert every entry to the typed form: - skill: <name>\\n  type: relates_to|composes_with|follows|enables'
      );
      continue;
    }

    if (allStrings) {
      pass(`${skillDir}: relates_to (legacy string form, ${extracted.entries.length} entries)`);
      continue;
    }

    let entryErrors = 0;
    for (const e of extracted.entries as Array<{ skill: string; type?: string }>) {
      if (!e.type || !RELATION_TYPES.includes(e.type)) {
        fail(skillDir, 'relation-type-invalid', `${skillDir}: relation to "${e.skill}" has missing/unknown type "${e.type ?? ''}"`, `Use one of: ${RELATION_TYPES.join(', ')}`);
        entryErrors++;
        continue;
      }
      if (!knownSkills.has(e.skill)) {
        fail(skillDir, 'relation-target-unknown', `${skillDir}: relates_to target skill "${e.skill}" does not exist`, 'Check the target skill name (L0 skills/ or templates/<variant>/skills/)');
        entryErrors++;
        continue;
      }
      if (e.skill === skillDir) {
        fail(skillDir, 'relation-self', `${skillDir}: relates_to references itself`, 'Remove the self-reference');
        entryErrors++;
        continue;
      }
      // Propagation-coupling guard (ADR-0060 Amendment 6B): a skill published to
      // L1 (templates/common/skills) must not relate to targets absent from L1 —
      // those edges would dangle in every propagated copy.
      const onL1Surface = baseDir === l1SkillsDir || (baseDir === SKILLS_DIR && l1Names.has(skillDir));
      if (onL1Surface && !l1Names.has(e.skill)) {
        warn(skillDir, 'relation-target-not-in-l1', `${skillDir}: relates_to target "${e.skill}" does not exist in templates/common/skills — the edge dangles in L1/L2 copies`, 'Remove the relation or pick a target that propagates');
      }
    }
    if (entryErrors === 0) {
      pass(`${skillDir}: relates_to (typed form, ${extracted.entries.length} entries)`);
    }
    }
  }
}

// Part 2: Validate governance records (docs/lifecycle/skills/*.md)
function validateGovernanceRecords(): void {
  if (!JSON_MODE) console.log(`\n${colors.cyan}📋 Part 2: Governance Record Validation (docs/lifecycle/skills/*.md)${colors.reset}`);

  if (!existsSync(LIFECYCLE_DOCS_DIR)) {
    warn(
      'docs/lifecycle/skills',
      'directory-not-found',
      'docs/lifecycle/skills/ directory not found',
      'Create docs/lifecycle/skills/ directory with governance documentation'
    );
    return;
  }

  const lifecycleDocs = readdirSync(LIFECYCLE_DOCS_DIR).filter(f => f.endsWith('.md'));

  for (const file of lifecycleDocs) {
    totalFiles++;
    const docName = file.replace('.md', '');
    const filePath = join(LIFECYCLE_DOCS_DIR, file);
    const content = normalizeContent(readFileSync(filePath, 'utf-8'));

    const missingSections: string[] = [];

    // Check for required sections
    if (!content.includes('## Phase History')) {
      missingSections.push('Phase History');
    }

    if (!content.includes('## Acceptance Criteria')) {
      missingSections.push('Acceptance Criteria');
    }

    if (missingSections.length > 0) {
      fail(
        `Governance doc ${docName}`,
        'sections-missing',
        `${docName}: Missing sections: ${missingSections.join(', ')}`,
        `Add missing sections to docs/lifecycle/skills/${file}`
      );
    } else {
      pass(`Governance doc ${docName}: All required sections present`);
    }
  }
}

// Collect every known skill name across L0 (skills/), L1 (templates/common/skills/),
// and variant templates (templates/co-*/skills/) so relation targets can be
// existence-checked. Nested skill directories (e.g. co-safety daily/<name>) are
// collected as slash-relative names.
function collectKnownSkillNames(): Set<string> {
  const names = new Set<string>();
  const walk = (base: string, rel: string) => {
    for (const dirent of readdirSync(base, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${dirent.name}` : dirent.name;
      if (!dirent.isDirectory()) continue;
      if (existsSync(join(base, dirent.name, 'SKILL.md'))) {
        names.add(childRel);
      } else {
        walk(join(base, dirent.name), childRel);
      }
    }
  };
  if (existsSync(SKILLS_DIR)) walk(SKILLS_DIR, '');
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const dirent of readdirSync(templatesDir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        const skillsDir = join(templatesDir, dirent.name, 'skills');
        if (existsSync(skillsDir)) walk(skillsDir, '');
      }
    }
  }
  return names;
}

// Main
function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}🔍 Validating skill lifecycle documentation...${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
  }

  validateRuntimeDefinitions();
  validateLayerPlacement();
  validateRelationMetadata(collectKnownSkillNames());
  validateGovernanceRecords();

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (!JSON_MODE) {
    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}📊 Validation Summary:${colors.reset}`);
    console.log(`   Total files checked: ${totalFiles}`);
    console.log(`   ${colors.red}Errors: ${errors.length}${colors.reset}`);
    console.log(`   ${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({
      totalFilesChecked: totalFiles,
      errors,
      warnings,
      summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    }, null, 2));
  } else {
    if (errors.length > 0) {
      console.log(`\n${colors.red}❌ Validation failed with ${errors.length} error(s)${colors.reset}`);
      console.log(`\n${colors.dim}Fix instructions:${colors.reset}`);
      console.log(`  1. For runtime definition errors: Add frontmatter to skills/*/SKILL.md`);
      console.log(`     Example:`);
      console.log(`     ---`);
      console.log(`     name: skill-name`);
      console.log(`     status: active`);
      console.log(`     description: >`);
      console.log(`       Brief description of what this skill does.`);
      console.log(`       Use when: trigger phrases or conditions.`);
      console.log(`     owner: pm|automation-engineer`);
      console.log(`     version: 1.0.0`);
      console.log(`     ---`);
      console.log(`  2. For governance record errors: Add missing sections to docs/lifecycle/skills/*.md`);
    } else {
      console.log(`\n${colors.green}✅ All skills validated successfully${colors.reset}`);
      console.log(`   Runtime definitions and governance records are both valid`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
