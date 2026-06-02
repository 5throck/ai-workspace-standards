#!/usr/bin/env bun
// qa-gate.ts - QA Gate Automation - Phase 6
// Run by Consistency Auditor to verify workspace standards

/** @version 1.0.2 */

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

console.log(`${GREEN}✅ QA PASS${RESET}`);
console.log('==========');
process.exit(0);
