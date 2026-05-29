#!/usr/bin/env bun
/**
 * test-new-project.ts — E2E Test for new-project.sh / new-project.ps1
 *
 * Cross-platform: detects OS and calls the appropriate script.
 * Tests the OUTPUT of new-project, not the mechanism inside it.
 *
 * Usage:
 *   bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop] [--platform both|claude|antigravity]
 *
 * Test coverage:
 *   1.  Project creation
 *   2.  UTF-8 integrity (no replacement chars)
 *   3.  Placeholder substitution ([Project Name] replaced)
 *   4.  Git initialisation (core.hooksPath = .githooks)
 *   5.  Git hooks installed and executable
 *   6.  Security bootstrap (.gitleaks.toml, .gitattributes eol=lf, .gitignore .env)
 *   7.  Template files present (CLAUDE.md, GEMINI.md, agents/pm.md, …)
 *   8.  Platform profile (--platform claude removes GEMINI.md, antigravity removes CLAUDE.md)
 *   9.  variant.json lifecycle.statusSince set to today
 *   10. scripts-snapshot.json created
 *   11. package.json has Tier 2 scripts (audit, dev-sync, sync-md)
 *   12. .claude/template-version.txt created with correct fields
 *   13. .gitattributes has docs/context.md merge=ours
 *   14. docs/_examples removed
 *   15. No .gitkeep files remain
 *   16. File permissions (.sh hooks executable on Unix)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:process';
import { $ } from 'bun';

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectName = args.find(a => !a.startsWith('--'));
const variantArg  = (() => { const i = args.indexOf('--variant');  return i !== -1 ? args[i + 1] : 'co-develop'; })();
const platformArg = (() => { const i = args.indexOf('--platform'); return i !== -1 ? args[i + 1] : 'both'; })();

if (!projectName) {
  console.error('Usage: bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop] [--platform both|claude|antigravity]');
  process.exit(1);
}

const testDir  = `Test-${projectName}`;
const isWin    = platform === 'win32';
const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ── Helpers ──────────────────────────────────────────────────────────────────

let testsRun = 0, testsPassed = 0;
let allPassed = true;

function pass(label: string)                    { console.log(`  ✅ ${label}`); testsPassed++; testsRun++; }
function fail(label: string, reason: string)   { console.error(`  ❌ ${label}: ${reason}`); allPassed = false; testsRun++; }
function skip(label: string, reason: string)   { console.log(`  ⚠️  ${label} SKIPPED: ${reason}`); testsPassed++; testsRun++; }

function readText(rel: string): string {
  return readFileSync(join(testDir, rel), 'utf-8');
}
function fileExists(rel: string): boolean {
  return existsSync(join(testDir, rel));
}
function findFiles(dir: string, name: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const f of readdirSync(dir, { withFileTypes: true, recursive: true } as Parameters<typeof readdirSync>[1])) {
    if ((f as any).name === name) results.push(join((f as any).path ?? dir, (f as any).name));
  }
  return results;
}

function cleanup() {
  if (existsSync(testDir)) {
    console.log(`\n🧹 Cleaning up ${testDir}...`);
    try {
      if (isWin) $.sync`pwsh -NoProfile -Command "Remove-Item -Recurse -Force ${testDir}"`;
      else       $.sync`rm -rf ${testDir}`;
    } catch { /* ignore */ }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🧪 E2E Test — new-project (variant: ${variantArg}, platform: ${platformArg})`);
console.log(`   Project name : ${projectName}`);
console.log(`   Test dir     : ${testDir}`);
console.log(`   OS           : ${isWin ? 'Windows (ps1)' : 'Unix (sh)'}\n`);

try {
  // ── Test 1: Project Creation ──────────────────────────────────────────────
  console.log('Test 1: Project Creation');
  try {
    let result;
    if (isWin) {
      result = await $`pwsh -NoProfile -File scripts/new-project.ps1 -ProjectName ${testDir} -Variant ${variantArg} -Platform ${platformArg}`.nothrow();
    } else {
      result = await $`bash scripts/new-project.sh ${testDir} --variant ${variantArg} --platform ${platformArg}`.nothrow();
    }
    if (result.exitCode !== 0 || !existsSync(testDir)) {
      fail('Test 1', `exit code ${result.exitCode} / directory not found`);
    } else {
      pass('Test 1 PASSED: Project created');
    }
  } catch (e) { fail('Test 1', String(e)); }

  if (!existsSync(testDir)) {
    console.error('\n❌ Project directory not found — remaining tests skipped.');
    process.exit(1);
  }

  // ── Test 2: UTF-8 Integrity ───────────────────────────────────────────────
  console.log('\nTest 2: UTF-8 Integrity');
  try {
    const content = readText('README.md');
    if (content.includes('�')) {
      fail('Test 2', 'UTF-8 replacement char (U+FFFD) found — encoding corruption');
    } else {
      pass('Test 2 PASSED: No encoding corruption in README.md');
    }
  } catch (e) { fail('Test 2', String(e)); }

  // ── Test 3: Placeholder Substitution ─────────────────────────────────────
  console.log('\nTest 3: Placeholder Substitution');
  try {
    const readme = readText('README.md');
    const hasOldPlaceholder = readme.includes('[Project Name]') ||
                              readme.includes('{{PROJECT_NAME}}');
    if (hasOldPlaceholder) {
      fail('Test 3', 'Placeholder not replaced in README.md');
    } else if (!readme.includes(projectName)) {
      fail('Test 3', `Project name "${projectName}" not found in README.md`);
    } else {
      pass('Test 3 PASSED: Placeholders substituted correctly');
    }
  } catch (e) { fail('Test 3', String(e)); }

  // ── Test 4: Git Initialisation ────────────────────────────────────────────
  console.log('\nTest 4: Git Initialisation');
  try {
    if (!fileExists('.git')) {
      fail('Test 4', '.git directory not found');
    } else {
      const r = await $`git -C ${testDir} config core.hooksPath`.nothrow();
      const hooksPath = r.stdout.toString().trim();
      if (!hooksPath.includes('.githooks')) {
        fail('Test 4', `core.hooksPath = "${hooksPath}" (expected .githooks)`);
      } else {
        pass('Test 4 PASSED: git init + core.hooksPath configured');
      }
    }
  } catch (e) { fail('Test 4', String(e)); }

  // ── Test 5: Git Hooks Installed ───────────────────────────────────────────
  console.log('\nTest 5: Git Hooks Installed');
  try {
    const required = ['pre-commit', 'pre-push'];
    const missing  = required.filter(h => !fileExists(`.githooks/${h}`));
    if (missing.length > 0) {
      fail('Test 5', `Missing hooks: ${missing.join(', ')}`);
    } else {
      pass('Test 5 PASSED: Required hooks present');
    }
  } catch (e) { fail('Test 5', String(e)); }

  // ── Test 6: Security Bootstrap ────────────────────────────────────────────
  console.log('\nTest 6: Security Bootstrap');
  const secChecks: [string, () => boolean][] = [
    ['.gitleaks.toml present',          () => fileExists('.gitleaks.toml')],
    ['.gitattributes has eol=lf',       () => fileExists('.gitattributes') && readText('.gitattributes').includes('eol=lf')],
    ['.gitignore excludes .env',        () => fileExists('.gitignore') && readText('.gitignore').includes('.env')],
    ['.githooks/pre-commit exists',     () => fileExists('.githooks/pre-commit')],
  ];
  let secOk = true;
  for (const [label, check] of secChecks) {
    try {
      if (check()) { pass(label); }
      else         { fail('Test 6', label); secOk = false; }
    } catch (e)    { fail('Test 6', `${label}: ${e}`); secOk = false; }
  }

  // ── Test 7: Required Template Files ──────────────────────────────────────
  console.log('\nTest 7: Required Template Files');
  try {
    const required = ['AGENTS.md', 'agents/pm.md', '.gitignore', '.githooks/pre-commit'];
    // CLAUDE.md/GEMINI.md depend on --platform
    if (platformArg !== 'antigravity') required.push('CLAUDE.md');
    if (platformArg !== 'claude')      required.push('GEMINI.md');
    const missing = required.filter(f => !fileExists(f));
    if (missing.length > 0) {
      fail('Test 7', `Missing: ${missing.join(', ')}`);
    } else {
      pass('Test 7 PASSED: All required files present');
    }
  } catch (e) { fail('Test 7', String(e)); }

  // ── Test 8: Platform Profile ──────────────────────────────────────────────
  console.log('\nTest 8: Platform Profile');
  try {
    if (platformArg === 'claude') {
      if (fileExists('GEMINI.md'))  fail('Test 8', 'GEMINI.md should be removed for --platform claude');
      else                          pass('Test 8 PASSED: GEMINI.md removed for claude platform');
    } else if (platformArg === 'antigravity') {
      if (fileExists('CLAUDE.md'))  fail('Test 8', 'CLAUDE.md should be removed for --platform antigravity');
      else                          pass('Test 8 PASSED: CLAUDE.md removed for antigravity platform');
    } else {
      const hasClaude = fileExists('CLAUDE.md');
      const hasGemini = fileExists('GEMINI.md');
      if (!hasClaude || !hasGemini) fail('Test 8', `Both files expected: CLAUDE.md=${hasClaude} GEMINI.md=${hasGemini}`);
      else                          pass('Test 8 PASSED: Both CLAUDE.md and GEMINI.md present for platform=both');
    }
  } catch (e) { fail('Test 8', String(e)); }

  // ── Test 9: variant.json lifecycle.statusSince ────────────────────────────
  console.log('\nTest 9: variant.json lifecycle.statusSince');
  try {
    if (!fileExists('variant.json')) {
      skip('Test 9', 'variant.json not found');
    } else {
      const vj = JSON.parse(readText('variant.json'));
      if (vj?.lifecycle?.statusSince === today) {
        pass(`Test 9 PASSED: lifecycle.statusSince = ${today}`);
      } else {
        fail('Test 9', `lifecycle.statusSince = "${vj?.lifecycle?.statusSince}", expected "${today}"`);
      }
    }
  } catch (e) { fail('Test 9', String(e)); }

  // ── Test 10: scripts-snapshot.json ───────────────────────────────────────
  console.log('\nTest 10: scripts-snapshot.json');
  try {
    if (!fileExists('scripts-snapshot.json')) {
      fail('Test 10', 'scripts-snapshot.json not found');
    } else {
      const snap = JSON.parse(readText('scripts-snapshot.json'));
      if (!snap.created || !snap.variant || !snap.scripts) {
        fail('Test 10', `Missing required fields: created=${!!snap.created} variant=${!!snap.variant} scripts=${!!snap.scripts}`);
      } else {
        pass(`Test 10 PASSED: scripts-snapshot.json present (${Object.keys(snap.scripts).length} scripts)`);
      }
    }
  } catch (e) { fail('Test 10', String(e)); }

  // ── Test 11: package.json Tier 2 scripts ─────────────────────────────────
  console.log('\nTest 11: package.json Tier 2 scripts');
  try {
    if (!fileExists('package.json')) {
      skip('Test 11', 'package.json not found');
    } else {
      const pkg = JSON.parse(readText('package.json'));
      const required = ['audit', 'dev-sync', 'sync-md'];
      const missing  = required.filter(k => !pkg?.scripts?.[k]);
      if (missing.length > 0) {
        fail('Test 11', `Missing package.json scripts: ${missing.join(', ')}`);
      } else {
        pass('Test 11 PASSED: Tier 2 scripts in package.json');
      }
    }
  } catch (e) { fail('Test 11', String(e)); }

  // ── Test 12: .claude/template-version.txt ────────────────────────────────
  console.log('\nTest 12: .claude/template-version.txt');
  try {
    const tvPath = '.claude/template-version.txt';
    if (!fileExists(tvPath)) {
      fail('Test 12', '.claude/template-version.txt not found');
    } else {
      const content = readText(tvPath);
      const hasVariant  = content.includes('variant=');
      const hasVersion  = content.includes('version=');
      const hasPlatform = content.includes('platform=');
      const hasCreated  = content.includes('created=');
      if (!hasVariant || !hasVersion || !hasPlatform || !hasCreated) {
        fail('Test 12', `Missing fields: variant=${hasVariant} version=${hasVersion} platform=${hasPlatform} created=${hasCreated}`);
      } else {
        pass('Test 12 PASSED: template-version.txt has all required fields');
      }
    }
  } catch (e) { fail('Test 12', String(e)); }

  // ── Test 13: .gitattributes merge=ours ───────────────────────────────────
  console.log('\nTest 13: .gitattributes merge=ours for context.md');
  try {
    if (!fileExists('.gitattributes')) {
      fail('Test 13', '.gitattributes not found');
    } else {
      const content = readText('.gitattributes');
      if (!content.includes('merge=ours')) {
        fail('Test 13', 'merge=ours not set in .gitattributes');
      } else {
        pass('Test 13 PASSED: .gitattributes has merge=ours');
      }
    }
  } catch (e) { fail('Test 13', String(e)); }

  // ── Test 14: docs/_examples removed ──────────────────────────────────────
  console.log('\nTest 14: docs/_examples removed');
  try {
    if (fileExists('docs/_examples')) {
      fail('Test 14', 'docs/_examples directory should have been removed');
    } else {
      pass('Test 14 PASSED: docs/_examples not present');
    }
  } catch (e) { fail('Test 14', String(e)); }

  // ── Test 15: No .gitkeep files ────────────────────────────────────────────
  console.log('\nTest 15: No .gitkeep files remain');
  try {
    const gitkeeps = findFiles(testDir, '.gitkeep');
    if (gitkeeps.length > 0) {
      fail('Test 15', `.gitkeep files found: ${gitkeeps.join(', ')}`);
    } else {
      pass('Test 15 PASSED: No .gitkeep files');
    }
  } catch (e) { fail('Test 15', String(e)); }

  // ── Test 16: File permissions (Unix only) ─────────────────────────────────
  console.log('\nTest 16: Hook file permissions');
  if (isWin) {
    skip('Test 16', 'file permission check not applicable on Windows (git index chmod used instead)');
  } else {
    try {
      const hooksDir = join(testDir, '.githooks');
      if (!existsSync(hooksDir)) {
        skip('Test 16', '.githooks/ not found');
      } else {
        const hooks = readdirSync(hooksDir).filter(f => !f.endsWith('.ps1'));
        const notExec = hooks.filter(h => !(statSync(join(hooksDir, h)).mode & 0o111));
        if (notExec.length > 0) {
          fail('Test 16', `Not executable: ${notExec.join(', ')}`);
        } else {
          pass(`Test 16 PASSED: All ${hooks.length} hooks are executable`);
        }
      }
    } catch (e) { fail('Test 16', String(e)); }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Test Summary');
  console.log(`   Tests run:    ${testsRun}`);
  console.log(`   Tests passed: ${testsPassed}`);
  console.log(`   Result: ${allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);

} finally {
  cleanup();
}

process.exit(allPassed ? 0 : 1);
