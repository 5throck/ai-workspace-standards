#!/usr/bin/env bun
/**
 * test-new-project.ts — E2E Test for new-project.sh / new-project.ps1
 *
 * Cross-platform replacement for the former test-new-project.ps1.
 * Runs via Bun on Windows, macOS, and Linux.
 *
 * Usage:
 *   bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop]
 *
 * Tests:
 *   1. Project creation (new-project.sh/.ps1 exits 0, directory exists)
 *   2. UTF-8 integrity (README.md readable, no garbled characters)
 *   3. Git hooks installation (.git/ + .githooks/pre-commit present)
 *   4. Template synchronization (required files present)
 *   5. File permissions (.sh files executable on Unix)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:process';
import { $ } from 'bun';

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectName = args.find(a => !a.startsWith('--'));
const variantArg = (() => { const i = args.indexOf('--variant'); return i !== -1 ? args[i + 1] : 'co-develop'; })();

if (!projectName) {
  console.error('Usage: bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop]');
  process.exit(1);
}

const testDir = `Test-${projectName}`;
const isWindows = platform === 'win32';

// ── Helpers ──────────────────────────────────────────────────────────────────

let testsRun = 0;
let testsPassed = 0;
let allPassed = true;

function pass(label: string) {
  console.log(`✅ ${label}`);
  testsPassed++;
  testsRun++;
}

function fail(label: string, reason: string) {
  console.error(`❌ ${label}: ${reason}`);
  allPassed = false;
  testsRun++;
}

function skip(label: string, reason: string) {
  console.log(`⚠️  ${label} SKIPPED: ${reason}`);
  testsPassed++;
  testsRun++;
}

function cleanup() {
  if (existsSync(testDir)) {
    console.log(`\n🧹 Cleaning up ${testDir}...`);
    try { $.sync`rm -rf ${testDir}`; } catch { /* ignore */ }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`🧪 E2E Test — new-project (variant: ${variantArg})`);
console.log(`   Test project: ${testDir}\n`);

try {
  // ── Test 1: Project Creation ────────────────────────────────────────────
  console.log('Test 1: Project Creation');
  try {
    const script = isWindows
      ? `pwsh -NoProfile -File scripts/new-project.ps1 ${testDir} --variant ${variantArg}`
      : `bash scripts/new-project.sh "${testDir}" --variant ${variantArg}`;

    const result = await $`${{ raw: script }}`.nothrow();

    if (result.exitCode !== 0 || !existsSync(testDir)) {
      fail('Test 1', `Project creation failed (exit ${result.exitCode})`);
    } else {
      pass('Test 1 PASSED: Project created successfully');
    }
  } catch (e) {
    fail('Test 1', String(e));
  }

  // ── Test 2: UTF-8 Integrity ─────────────────────────────────────────────
  console.log('\nTest 2: UTF-8 Integrity');
  try {
    const readmePath = join(testDir, 'README.md');
    if (!existsSync(readmePath)) {
      fail('Test 2', 'README.md not found in project');
    } else {
      const content = readFileSync(readmePath, 'utf-8');
      // Check for replacement character (U+FFFD) which indicates encoding corruption
      if (content.includes('�')) {
        fail('Test 2', 'UTF-8 corruption detected (replacement character found)');
      } else {
        pass('Test 2 PASSED: UTF-8 integrity OK');
      }
    }
  } catch (e) {
    fail('Test 2', String(e));
  }

  // ── Test 3: Git Hooks Installation ─────────────────────────────────────
  console.log('\nTest 3: Git Hooks Installation');
  try {
    const gitDir = join(testDir, '.git');
    const githooksDir = join(testDir, '.githooks');
    const preCommit = join(githooksDir, 'pre-commit');

    if (!existsSync(gitDir)) {
      fail('Test 3', 'Git repository not initialized');
    } else if (!existsSync(githooksDir)) {
      fail('Test 3', '.githooks/ directory not found');
    } else if (!existsSync(preCommit)) {
      fail('Test 3', '.githooks/pre-commit not found');
    } else {
      pass('Test 3 PASSED: Git hooks installed correctly');
    }
  } catch (e) {
    fail('Test 3', String(e));
  }

  // ── Test 4: Template Synchronization ───────────────────────────────────
  console.log('\nTest 4: Template Synchronization');
  try {
    const requiredFiles = [
      'CLAUDE.md',
      'GEMINI.md',
      '.gitignore',
      '.githooks/pre-commit',
      'agents/pm.md',
    ];

    const missing = requiredFiles.filter(f => !existsSync(join(testDir, f)));

    if (missing.length > 0) {
      fail('Test 4', `Missing required files: ${missing.join(', ')}`);
    } else {
      pass('Test 4 PASSED: All required template files present');
    }
  } catch (e) {
    fail('Test 4', String(e));
  }

  // ── Test 5: File Permissions ────────────────────────────────────────────
  console.log('\nTest 5: File Permissions');
  if (isWindows) {
    skip('Test 5', 'execute permission check not applicable on Windows');
  } else {
    try {
      const githooksDir = join(testDir, '.githooks');
      if (!existsSync(githooksDir)) {
        skip('Test 5', '.githooks/ not found');
      } else {
        const hooks = readdirSync(githooksDir).filter(f => !f.endsWith('.ps1'));
        const notExecutable = hooks.filter(h => {
          const mode = statSync(join(githooksDir, h)).mode;
          return !(mode & 0o111); // check any execute bit
        });
        if (notExecutable.length > 0) {
          fail('Test 5', `Hooks missing execute permission: ${notExecutable.join(', ')}`);
        } else {
          pass('Test 5 PASSED: Hook files are executable');
        }
      }
    } catch (e) {
      fail('Test 5', String(e));
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n📊 Test Summary');
  console.log(`   Tests run:    ${testsRun}`);
  console.log(`   Tests passed: ${testsPassed}`);
  console.log(`   Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

} finally {
  cleanup();
}

process.exit(allPassed ? 0 : 1);
