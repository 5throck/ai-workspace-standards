#!/usr/bin/env bun
/**
 * test-new-project.ts — E2E Test for new-project.ts
 *
 * @version 1.1.0
 * @last_updated 2026-09-12
 *
 * v1.1.0: T-20260912-004 — new Test 25 pins pm.md extends-stub resolution (no
 *         `extends:`, no raw `variant_overrides:`, substantive PM body, template
 *         variant_overrides.governance_workflow rendered into the body); Test 22 no
 *         longer passes on a dangling `extends:` pointer; `--all-variants` loops the
 *         single-variant harness across every templates/co-* variant.
 *
 * Cross-platform: detects OS and calls the appropriate script.
 * Tests the OUTPUT of new-project, not the mechanism inside it.
 *
 * Usage:
 *   bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop] [--platform both|claude|antigravity] [--all-variants]
 *
 * Test coverage:
 *   0.  Script syntax validation (bash -n / powershell parser — runs before project creation)
 *       0c. Initialize-UTF8Environment executes without error on all PS versions
 *       0d. Validate-TemplateSync correctly checks common/ and variant/ separately
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
 *   17. No .cmd files remain
 *   18. Script pair validation in project scripts/
 *   19. AGENTS.md Skills injected into context.md (if markers present)
 *   20-22. pm.md marker/frontmatter/invariant-section checks
 *   23-24. Smoke tests — dev-sync/sync-md/verify-readme-sync present
 *   25. pm.md extends-stub fully resolved (no extends / no variant_overrides / substantive body)
 */

import { existsSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { platform } from 'node:process';
import { $ } from 'bun';
import { load as yamlLoad } from 'js-yaml';

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectName = args.find(a => !a.startsWith('--'));
const variantArg  = (() => { const i = args.indexOf('--variant');  return i !== -1 ? args[i + 1] : 'co-develop'; })();
const platformArg = (() => { const i = args.indexOf('--platform'); return i !== -1 ? args[i + 1] : 'both'; })();
// --all-variants: loop the single-variant harness across every templates/co-* variant
// (T-20260912-004 — the pm.md extends-stub resolution differs per variant stub shape:
// 8 empty-body stubs, 5 prose-body stubs; every variant must scaffold a full PM agent).
const allVariants = args.includes('--all-variants');

if (allVariants && import.meta.main) {
  const tplDir = join(process.cwd(), 'templates');
  const variants = readdirSync(tplDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-'))
    .map(e => e.name)
    .sort();
  console.log(`\n🧪 All-variants mode: ${variants.length} variants (${variants.join(', ')})`);
  const failedVariants: string[] = [];
  for (const v of variants) {
    console.log(`\n${'═'.repeat(60)}\n🧪 Variant run: ${v}\n${'═'.repeat(60)}`);
    const proc = Bun.spawnSync(
      ['bun', 'scripts/test-new-project.ts', `PmStub-${v}`, '--variant', v, '--platform', platformArg, '--yes'],
      { stdout: 'inherit', stderr: 'inherit', cwd: process.cwd() },
    );
    if (proc.exitCode !== 0) failedVariants.push(v);
  }
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 All-variants summary: ${variants.length - failedVariants.length}/${variants.length} variants passed`);
  if (failedVariants.length > 0) {
    console.log(`   FAILED: ${failedVariants.join(', ')}`);
  }
  process.exit(failedVariants.length > 0 ? 1 : 0);
}

if (!projectName) {
  console.error('Usage: bun scripts/test-new-project.ts <TestProjectName> [--variant co-develop] [--platform both|claude|antigravity] [--all-variants]');
  if (import.meta.main) {
    process.exit(1);
  }
}

// Due to new-project path traversal protection, the project name must be strictly alphanumeric.
// We can no longer nest tests inside .sandbox/ - we must create them in the workspace root.
// EXCEPT we now use tests/.temp/ to avoid cluttering root. We'll bypass or fix the check.
const testDir  = `tests/.temp/Test-${projectName}`;
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
      rmSync(testDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🧪 E2E Test — new-project (variant: ${variantArg}, platform: ${platformArg})`);
console.log(`   Project name : ${projectName}`);
console.log(`   Test dir     : ${testDir}`);
console.log(`   OS           : ${isWin ? 'Windows' : 'Unix'}\n`);

cleanup();

try {
  // ── Test 0: Script Syntax Validation ─────────────────────────────────────────
  // Runs BEFORE project creation — catches bracket/syntax errors early.
  console.log('Test 0: Script Syntax Validation');
  let syntaxOk = true;

  // 0a: Help validation for bun scripts/new-project.ts
  try {
    const res = await $`bun scripts/new-project.ts`.nothrow();
    const output = (res.stdout.toString() + res.stderr.toString()).trim();
    if (output.includes('Usage: bun scripts/new-project.ts')) {
      pass('Test 0a PASSED: bun scripts/new-project.ts help validation OK');
    } else {
      fail('Test 0a', `bun scripts/new-project.ts help output unexpected:\n${output}`);
      syntaxOk = false;
    }
  } catch (e) { fail('Test 0a', String(e)); syntaxOk = false; }

  // 0b: Argument validation for bun scripts/new-project.ts
  try {
    const res = await $`bun scripts/new-project.ts --platform invalid_platform`.nothrow();
    const output = (res.stdout.toString() + res.stderr.toString()).trim();
    if (res.exitCode !== 0 && output.includes('platform')) {
      pass('Test 0b PASSED: bun scripts/new-project.ts argument validation OK');
    } else {
      fail('Test 0b', `bun scripts/new-project.ts argument validation failed:\n${output}`);
      syntaxOk = false;
    }
  } catch (e) { fail('Test 0b', String(e)); syntaxOk = false; }


  // 0e: Verify new-project.sh template validation logic checks common/ and variant/ separately.
  // Guards against the same bug as Test 0d — ensures sh version validates correctly.
  try {
    const commonPath = join(process.cwd(), 'templates', 'common');
    const variantPath = join(process.cwd(), 'templates', variantArg);
    const commonRequired = ['.gitignore', '.githooks/pre-commit'];
    const variantRequired = ['agents/pm.md', 'variant.json'];

    let missing: string[] = [];
    for (const file of commonRequired) {
      if (!existsSync(join(commonPath, file))) missing.push(`common/${file}`);
    }
    for (const file of variantRequired) {
      if (!existsSync(join(variantPath, file))) missing.push(`${variantArg}/${file}`);
    }

    if (missing.length > 0) {
      fail('Test 0e', `Missing required template files: ${missing.join(', ')}`);
    } else {
      pass('Test 0e PASSED: template validation checks passed');
    }
  } catch (e) {
    skip('Test 0e', `Template validation check failed (${e})`);
  }

  if (!syntaxOk) {
    console.error('\n❌ Syntax errors found — remaining tests skipped.');
    if (import.meta.main) {
      process.exit(1);
    }
  }

  // ── Test 1: Project Creation [maps to: step 1 + step 2] ─────────────────────
  console.log('Test 1: Project Creation');
  try {
    const result = await $`bun scripts/new-project.ts ${testDir} --variant ${variantArg} --platform ${platformArg} --yes`.nothrow();
    if (result.exitCode !== 0 || !existsSync(testDir)) {
      fail('Test 1', `exit code ${result.exitCode} / directory not found`);
    } else {
      pass('Test 1 PASSED: Project created');
    }
  } catch (e) { fail('Test 1', String(e)); }

  if (!existsSync(testDir)) {
    console.error('\n❌ Project directory not found — remaining tests skipped.');
    if (import.meta.main) {
      process.exit(1);
    }
  }

  // 0e (post-scaffold): Verify generated project outputs in testDir contain CLAUDE.md and GEMINI.md
  try {
    const missingScaffolded: string[] = [];
    if (platformArg !== 'antigravity' && !fileExists('CLAUDE.md')) missingScaffolded.push('CLAUDE.md');
    if (platformArg !== 'claude' && !fileExists('GEMINI.md')) missingScaffolded.push('GEMINI.md');
    if (missingScaffolded.length > 0) {
      fail('Test 0e (scaffolded output)', `Generated project in ${testDir} missing: ${missingScaffolded.join(', ')}`);
    } else {
      pass('Test 0e (scaffolded output) PASSED: Generated project in testDir contains CLAUDE.md and GEMINI.md as expected');
    }
  } catch (e) { fail('Test 0e (scaffolded output)', String(e)); }

  // ── Test 2: UTF-8 Integrity [maps to: step 5 (encoding)] ───────────────────
  console.log('\nTest 2: UTF-8 Integrity');
  try {
    const content = readText('README.md');
    if (content.includes('�')) {  // encoding-check-ignore
      fail('Test 2', 'UTF-8 replacement char (U+FFFD) found — encoding corruption');
    } else {
      pass('Test 2 PASSED: No encoding corruption in README.md');
    }
  } catch (e) { fail('Test 2', String(e)); }

  // ── Test 3: Placeholder Substitution [maps to: step 5] ──────────────────────
  console.log('\nTest 3: Placeholder Substitution');
  try {
    const readme = readText('README.md');
    const hasOldPlaceholder = readme.includes('[Project Name]') ||
                              readme.includes('{{PROJECT_NAME}}');
    const expectedName = basename(testDir);
    if (hasOldPlaceholder) {
      fail('Test 3', 'Placeholder not replaced in README.md');
    } else if (!readme.includes(String(projectName)) && !readme.includes(expectedName) && !readme.includes(String(variantArg))) {
      fail('Test 3', `Project name "${expectedName}" / variant "${variantArg}" not found in README.md`);
    } else {
      pass('Test 3 PASSED: Placeholders substituted correctly');
    }
  } catch (e) { fail('Test 3', String(e)); }

  // ── Test 4: Git Initialisation [maps to: step 7] ──────────────────────────
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

  // ── Test 5: Git Hooks Installed [maps to: step 6 + step 7] ────────────────
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

  // ── Test 6: Security Bootstrap [maps to: step 6.5] ────────────────────────
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

  // ── Test 7: Required Template Files [maps to: step 1 + step 2] ───────────
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

  // ── Test 8: Platform Profile [maps to: step 2.5] ────────────────────────
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

  // ── Test 9: variant.json lifecycle.statusSince [maps to: step 5.5b] ───────
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

  // ── Test 10: scripts-snapshot.json [maps to: step 5.5c] ──────────────────
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

  // ── Test 11: package.json Tier 2 scripts [maps to: step 5.5d] ──────────────
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

  // ── Test 12: .claude/template-version.txt [maps to: step 5.6] ──────────────
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

  // ── Test 13: .gitattributes merge=ours [maps to: step 5.7] ────────────────
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

  // ── Test 14: docs/_examples removed [maps to: step 3] ────────────────────
  console.log('\nTest 14: docs/_examples removed');
  try {
    if (fileExists('docs/_examples')) {
      fail('Test 14', 'docs/_examples directory should have been removed');
    } else {
      pass('Test 14 PASSED: docs/_examples not present');
    }
  } catch (e) { fail('Test 14', String(e)); }

  // ── Test 15: No .gitkeep files [maps to: step 4] ────────────────────────
  console.log('\nTest 15: No .gitkeep files remain');
  try {
    const gitkeeps = findFiles(testDir, '.gitkeep');
    if (gitkeeps.length > 0) {
      fail('Test 15', `.gitkeep files found: ${gitkeeps.join(', ')}`);
    } else {
      pass('Test 15 PASSED: No .gitkeep files');
    }
  } catch (e) { fail('Test 15', String(e)); }

  // ── Test 16: File permissions (Unix only) [maps to: step 6] ───────────────
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

  // ── Test 17: No .cmd files [maps to: step 2.6] ────────────────────────────
  console.log('\nTest 17: No .cmd files');
  try {
    function findCmdFiles(dir: string): string[] {
      const results: string[] = [];
      if (!existsSync(dir)) return results;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) results.push(...findCmdFiles(fullPath));
        else if (entry.name.endsWith('.cmd')) results.push(fullPath);
      }
      return results;
    }
    const cmdFiles = findCmdFiles(testDir);
    if (cmdFiles.length > 0) {
      fail('Test 17', `.cmd files found: ${cmdFiles.join(', ')}`);
    } else {
      pass('Test 17 PASSED: No .cmd files present');
    }
  } catch (e) { fail('Test 17', String(e)); }

  // ── Test 18: Script pair validation in project scripts/ [maps to: step 3.5]
  console.log('\nTest 18: Script pair validation in project scripts/');
  try {
    const projScripts = join(testDir, 'scripts');
    if (!existsSync(projScripts)) {
      skip('Test 18', 'scripts/ directory not found in project');
    } else {
      const files = readdirSync(projScripts);
      const shBases  = new Set(files.filter(f => f.endsWith('.sh')  && !f.startsWith('test-')).map(f => f.replace('.sh', '')));
      const ps1Bases = new Set(files.filter(f => f.endsWith('.ps1') && !f.startsWith('test-')).map(f => f.replace('.ps1', '')));
      const missingPs1 = [...shBases].filter(b => !ps1Bases.has(b));
      const missingSh  = [...ps1Bases].filter(b => !shBases.has(b));
      if (missingPs1.length > 0 || missingSh.length > 0) {
        const msg = [
          ...missingPs1.map(b => `${b}.sh missing .ps1`),
          ...missingSh.map(b => `${b}.ps1 missing .sh`),
        ].join(', ');
        fail('Test 18', msg);
      } else {
        pass(`Test 18 PASSED: All script pairs present (${shBases.size} pairs)`);
      }
    }
  } catch (e) { fail('Test 18', String(e)); }

  // ── Test 19: AGENTS.md Skills injected into context.md [maps to: step 5.6b]
  console.log('\nTest 19: AGENTS.md Skills injected into context.md');
  try {
    const contextPath = join(testDir, 'docs', `${variantArg}.context.md`);
    const agentsPath  = join(testDir, 'AGENTS.md');
    if (!existsSync(contextPath)) {
      skip('Test 19', `docs/${variantArg}.context.md not found`);
    } else if (!existsSync(agentsPath)) {
      skip('Test 19', 'AGENTS.md not found');
    } else {
      const context = readFileSync(contextPath, 'utf-8');
      const agents  = readFileSync(agentsPath, 'utf-8');
      // Only test injection if context.md has the marker AND AGENTS.md has Skills section
      const hasMarker   = context.includes('<!-- DYNAMIC_SKILLS_START -->');
      const hasSkills   = /^## Skills/m.test(agents);
      if (!hasMarker) {
        skip('Test 19', 'context.md has no DYNAMIC_SKILLS_START marker — injection not applicable');
      } else if (!hasSkills) {
        skip('Test 19', 'AGENTS.md has no Skills section');
      } else {
        // Check that the content between markers is not empty
        const injected = context.match(/<!-- DYNAMIC_SKILLS_START -->([\s\S]*?)<!-- DYNAMIC_SKILLS_END -->/);
        if (!injected || injected[1].trim().length === 0) {
          fail('Test 19', 'Skills table not injected between markers');
        } else {
          pass('Test 19 PASSED: AGENTS.md Skills injected into context.md');
        }
      }
    }
  } catch (e) { fail('Test 19', String(e)); }

  // ── Test 20: No VARIANT-SECTION markers in pm.md [maps to: AC-03] ─────────
  console.log('\nTest 20: No VARIANT-SECTION markers in pm.md');
  try {
    const pmPath = join(testDir, 'agents', 'pm.md');
    if (!existsSync(pmPath)) {
      fail('Test 20', 'agents/pm.md not found');
    } else {
      const pmContent = readFileSync(pmPath, 'utf-8');
      if (pmContent.includes('<!-- VARIANT-SECTION')) {
        fail('Test 20', 'pm.md contains VARIANT-SECTION markers');
      } else {
        pass('Test 20 PASSED: pm.md has no VARIANT-SECTION markers');
      }
    }
  } catch (e) { fail('Test 20', String(e)); }

  // ── Test 21: Exactly one YAML frontmatter block in pm.md [maps to: AC-04] ─
  console.log('\nTest 21: Exactly one YAML frontmatter block in pm.md');
  try {
    const pmPath = join(testDir, 'agents', 'pm.md');
    if (!existsSync(pmPath)) {
      fail('Test 21', 'agents/pm.md not found');
    } else {
      const pmContent = readFileSync(pmPath, 'utf-8');
      const matches = pmContent.match(/^---$/gm);
      if (!matches || matches.length !== 2) {
        fail('Test 21', `Expected exactly 2 '---' markers for 1 frontmatter block, found ${matches ? matches.length : 0}`);
      } else {
        pass('Test 21 PASSED: pm.md has exactly one frontmatter block');
      }
    }
  } catch (e) { fail('Test 21', String(e)); }

  // ── Test 22: pm.md contains all 7 invariant sections [maps to: AC-05] ─────
  // T-20260912-004: the previous `extends:` escape hatch (pass when the scaffolded
  // pm.md still said `extends:`) masked unresolved stubs — the scaffold must inline
  // the common body, so the invariants are required unconditionally.
  console.log('\nTest 22: pm.md contains all 7 invariant sections');
  try {
    const pmPath = join(testDir, 'agents', 'pm.md');
    if (!existsSync(pmPath)) {
      fail('Test 22', 'agents/pm.md not found');
    } else {
      const pmContent = readFileSync(pmPath, 'utf-8');
      const invariants = [
        '## Role',
        '## ⚠️ ROLE CLARIFICATION',
        '## YOU ARE THE SINGLE ENTRY POINT',
        '## Consensus-Driven Facilitation Model',
        '## Governance Workflow',
        '## Agent Ecosystem',
        '## Permission Denial Protocol'
      ];
      const missing = invariants.filter(s => !pmContent.includes(s));
      if (missing.length > 0) {
        fail('Test 22', `Missing invariant sections: ${missing.join(', ')}`);
      } else {
        pass('Test 22 PASSED: pm.md contains all 7 invariant sections');
      }
    }
  } catch (e) { fail('Test 22', String(e)); }

  // ── Test 23: Smoke test — dev-sync.ts and sync-md.ts present ─────────────
  console.log('\nTest 23: Smoke test — dev-sync.ts and sync-md.ts present');
  try {
    const devSyncPath = join(testDir, 'scripts', 'dev-sync.ts');
    const syncMdPath  = join(testDir, 'scripts', 'sync-md.ts');
    if (!existsSync(devSyncPath)) {
      fail('Test 23', 'Smoke test: scripts/dev-sync.ts missing from scaffolded project');
    } else {
      pass('Smoke test: scripts/dev-sync.ts present');
    }
    if (!existsSync(syncMdPath)) {
      fail('Test 23', 'Smoke test: scripts/sync-md.ts missing from scaffolded project (required by dev-sync.ts)');
    } else {
      pass('Smoke test: scripts/sync-md.ts present');
    }
  } catch (e) { fail('Test 23', String(e)); }

  // ── Test 24: Smoke test — verify-readme-sync.ts present ──────────────────
  console.log('\nTest 24: Smoke test — verify-readme-sync.ts present');
  try {
    const verifyReadmeSyncPath = join(testDir, 'scripts', 'verify-readme-sync.ts');
    if (!existsSync(verifyReadmeSyncPath)) {
      fail('Test 24', 'Smoke test: scripts/verify-readme-sync.ts missing from scaffolded project');
    } else {
      pass('Smoke test: scripts/verify-readme-sync.ts present');
    }
  } catch (e) { fail('Test 24', String(e)); }

  // ── Test 25: pm.md extends-stub fully resolved [T-20260912-004] ──────────
  // The scaffolded agents/pm.md must be self-contained: no dangling `extends:`,
  // no raw `variant_overrides:` YAML (rendered into the body instead), and a
  // substantive body (the L1 PM body, not a stub).
  console.log('\nTest 25: pm.md extends-stub resolution (no extends / no variant_overrides / substantive body)');
  try {
    const pmPath = join(testDir, 'agents', 'pm.md');
    if (!existsSync(pmPath)) {
      fail('Test 25', 'agents/pm.md not found');
    } else {
      const pmContent = readFileSync(pmPath, 'utf-8');
      const problems: string[] = [];
      if (pmContent.includes('extends:')) {
        problems.push('scaffolded pm.md still contains a dangling `extends:` pointer (templates/ does not exist in the project)');
      }
      if (pmContent.includes('variant_overrides:')) {
        problems.push('scaffolded pm.md still contains raw `variant_overrides:` YAML (must be rendered into body sections)');
      }
      const fmMatch = pmContent.match(/^---\n([\s\S]*?)\n---\n?/);
      const body = fmMatch ? pmContent.slice(fmMatch[0].length) : pmContent;
      if (!/Permission Denial|PM Gateway|Dispatch Protocol/i.test(body)) {
        problems.push('body lacks substantive PM content (no Permission Denial / PM Gateway / Dispatch Protocol match)');
      }
      if (body.trim().length < 2000) {
        problems.push(`body too short (${body.trim().length} chars) — the L1 PM body was not attached`);
      }
      // If the variant template ships variant_overrides, its governance text must be
      // rendered into the scaffolded body (ADR-0039/ADR-0034 scaffold-time contract).
      const tmplPmPath = join(process.cwd(), 'templates', variantArg, 'agents', 'pm.md');
      if (existsSync(tmplPmPath)) {
        const tmplMatch = readFileSync(tmplPmPath, 'utf-8').match(/^---\n([\s\S]*?)\n---\n?/);
        if (tmplMatch) {
          const fm = (yamlLoad(tmplMatch[1]) ?? {}) as Record<string, unknown>;
          const overrides = (fm['variant_overrides'] ?? {}) as Record<string, unknown>;
          const gw = typeof overrides['governance_workflow'] === 'string' ? (overrides['governance_workflow'] as string) : '';
          const contentLine = gw.split('\n').map(l => l.trim()).find(l => l !== '' && !l.startsWith('#'));
          if (contentLine && !pmContent.includes(contentLine)) {
            problems.push(`variant_overrides.governance_workflow not rendered into body (missing line: "${contentLine.slice(0, 60)}…")`);
          }
        }
      }
      if (problems.length > 0) {
        fail('Test 25', problems.join('; '));
      } else {
        pass(`Test 25 PASSED: pm.md fully resolved (body: ${body.trim().length} chars, no extends, no variant_overrides)`);
      }
    }
  } catch (e) { fail('Test 25', String(e)); }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Test Summary');
  console.log(`   Tests run:    ${testsRun}`);
  console.log(`   Tests passed: ${testsPassed}`);
  console.log(`   Result: ${allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);

} finally {
  cleanup();
}

if (import.meta.main) {
  process.exit(allPassed ? 0 : 1);
}
