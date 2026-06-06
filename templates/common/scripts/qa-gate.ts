#!/usr/bin/env bun
// qa-gate.ts - QA Gate Automation - Phase 6
// Run by Consistency Auditor to verify workspace standards

/** @version 1.0.3 */

import { $ } from 'bun';

const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

console.log(`${CYAN}🔬 QA Gate - Phase 6${RESET}`);
console.log('=====================');

// 1. Workspace audit
console.log('Step 1: Workspace standards audit...');
const auditRes = await $`bun scripts/audit.ts`.nothrow();

if (auditRes.exitCode !== 0) {
  console.log(`${RED}❌ FAIL: audit.sh failed${RESET}`);
  process.exit(1);
}

// 2. Project-specific tests (if package.json exists)
const pkgFile = Bun.file('package.json');
if (await pkgFile.exists()) {
  console.log('Step 2: Running project tests...');
  const pkg = await pkgFile.json();
  if (pkg.scripts && 'test' in pkg.scripts) {
    const testRes = await $`bun run test`.nothrow();
    if (testRes.exitCode !== 0) {
      console.log(`${RED}❌ FAIL: Tests failed${RESET}`);
      process.exit(1);
    }
  } else {
    console.log(`${YELLOW}⚠️  SKIP: No test script found in package.json${RESET}`);
  }
}

// 3. Documentation consistency checks
console.log('Step 3: Checking documentation consistency...');

// Check AGENTS.md exists
if (!(await Bun.file('AGENTS.md').exists())) {
  console.log(`${RED}❌ FAIL: AGENTS.md not found${RESET}`);
  process.exit(1);
}

// Check README.md has Korean pair (for templates only)
const hasTemplateReadme = await Bun.file('templates/README.md').exists();
const hasTemplateReadmeKo = await Bun.file('templates/README_ko.md').exists();
if (hasTemplateReadme && !hasTemplateReadmeKo) {
  console.log(`${RED}❌ FAIL: templates/README.md exists but templates/README_ko.md missing${RESET}`);
  process.exit(1);
}

// 4. Verify Lifecycle Manager deployment
console.log('Step 4: Verifying lifecycle-manager deployment (L0 vs L1 sync)...');

let syncFailed = false;

// Helper to calculate SHA256
const { createHash } = await import('node:crypto');
const fs = await import('node:fs');
const path = await import('node:path');

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

// Check scripts/ vs templates/common/scripts/
const l0Scripts = 'scripts';
const l1Scripts = 'templates/common/scripts';
if (fs.existsSync(l0Scripts) && fs.existsSync(l1Scripts)) {
  const scripts = fs.readdirSync(l0Scripts).filter(f => f.endsWith('.ts'));
  for (const s of scripts) {
    if (fs.existsSync(path.join(l1Scripts, s))) {
      const h0 = sha256(fs.readFileSync(path.join(l0Scripts, s), 'utf-8'));
      const h1 = sha256(fs.readFileSync(path.join(l1Scripts, s), 'utf-8'));
      if (h0 !== h1) {
        console.log(`${RED}❌ FAIL: ${s} differs from templates/common/scripts/${s}. Lifecycle Manager deployment not run!${RESET}`);
        syncFailed = true;
      }
    }
  }
}

// Check skills/ vs templates/common/skills/
const l0Skills = 'skills';
const l1Skills = 'templates/common/skills';
if (fs.existsSync(l0Skills) && fs.existsSync(l1Skills)) {
  const skills = fs.readdirSync(l0Skills).filter(f => fs.statSync(path.join(l0Skills, f)).isDirectory());
  for (const skill of skills) {
    if (fs.existsSync(path.join(l1Skills, skill, 'SKILL.md'))) {
      const h0 = sha256(fs.readFileSync(path.join(l0Skills, skill, 'SKILL.md'), 'utf-8'));
      const h1 = sha256(fs.readFileSync(path.join(l1Skills, skill, 'SKILL.md'), 'utf-8'));
      if (h0 !== h1) {
        console.log(`${RED}❌ FAIL: Skill ${skill} differs from templates/common/skills/${skill}. Lifecycle Manager deployment not run!${RESET}`);
        syncFailed = true;
      }
    }
  }
}

if (syncFailed) {
  process.exit(1);
}

// 5. Validate variant.json schema
console.log('Step 5: Validating variant.json schema...');
const templatesDir = 'templates';
if (fs.existsSync(templatesDir)) {
  const variants = fs.readdirSync(templatesDir).filter(f => fs.statSync(path.join(templatesDir, f)).isDirectory() && f.startsWith('co-'));
  for (const variant of variants) {
    const variantJsonPath = path.join(templatesDir, variant, 'variant.json');
    if (fs.existsSync(variantJsonPath)) {
      try {
        const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
        const skillExt = variantJson.skill_manifest?.external;
        if (skillExt && !Array.isArray(skillExt)) {
           console.log(`${RED}❌ FAIL: ${variant}/variant.json skill_manifest.external is not an array${RESET}`);
           process.exit(1);
        }
        const scriptExt = variantJson.script_manifest?.external;
        if (scriptExt && !Array.isArray(scriptExt)) {
           console.log(`${RED}❌ FAIL: ${variant}/variant.json script_manifest.external is not an array${RESET}`);
           process.exit(1);
        }
      } catch (e) {
        console.log(`${RED}❌ FAIL: Could not parse ${variantJsonPath}: ${e}${RESET}`);
        process.exit(1);
      }
    }
  }
}

console.log(`${GREEN}✔ QA PASS${RESET}`);
console.log('==========');
process.exit(0);
