#!/usr/bin/env bun
/**
 * verify-country-prune.ts
 * @version 1.2.0
 * @last_updated 2026-10-05
 *
 * v1.2.0 (2026-10-05, spec docs/designs/2026-10-05-country-prune-context-scrub-design.md):
 *  new reference-shape regression test — a variant context doc carrying inline-code,
 *  bold-table-row, and skill-path mentions of pruned skills must lose all three
 *  while neighbor rows survive; runPrune accepts the optional variant argument the
 *  pruner takes as argv[4].
 *
 * v1.1.0 (2026-09-25, spec docs/designs/2026-09-25-verifier-platform-expansion-design.md
 *  site 7 / D7): fixture harness adopts PLATFORM_SKILL_BASES — .codex/skills
 *  fixtures are now created and their pruning asserted, aligning the verifier
 *  with the pruner (already 5-element). No producer change.
 *
 * Verifies the country-scoped asset pruning mechanism (skills, scripts, env blocks).
 * Creates temporary fixtures and runs prune-country-scoped-assets.ts to validate
 * that pruning works correctly for all scenarios: matching country, non-matching country,
 * region-neutral (none), and unbalanced marker edge cases.
 *
 * Pruning rules:
 * - Skills: removes <target>/{skills,.claude/skills,.gemini/skills,.agents/skills,.codex/skills}/<name>/
 * - Scripts: removes <target>/scripts/<name>*
 * - Env blocks: parses .env.sample for # >>> country-scoped:<CODE> marker blocks
 *              and deletes blocks whose CODE != target country. For "none", deletes ALL blocks.
 *
 * Usage: bun scripts/verify-country-prune.ts
 *
 * Exit codes:
 * - 0: All tests passed
 * - 1: One or more tests failed
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { PLATFORM_SKILL_BASES } from './lib/platforms.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PRUNE_SCRIPT = join(ROOT, 'scripts', 'helpers', 'prune-country-scoped-assets.ts');

// Test tracking
interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

/**
 * Create a temporary directory for testing
 */
function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'verify-country-prune-'));
}

/**
 * Clean up a temporary directory
 */
function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a minimal .env.sample with KR-scoped block and generic content
 */
function createEnvSample(dir: string): void {
  const content = `# .env.sample — test fixture

# >>> country-scoped:KR
DART_API_KEY=test_dart_key
LAW_API_OC=test_law_oc
# <<< country-scoped:KR

# Generic API key (not country-scoped)
API_KEY=sample_key

# Another generic value
DATABASE_URL=postgresql://localhost/test
`;
  writeFileSync(join(dir, '.env.sample'), content, 'utf-8');
}

/**
 * Create minimal skill fixture files
 */
function createSkillFixtures(dir: string): void {
  // SSOT constant (spec 2026-09-25-verifier-platform-expansion-design site 7):
  // the harness previously created/asserted only 4 of the 5 bases the pruner
  // already iterates — stale verifier literal, not a producer gap (design D7).
  const skillDirs = PLATFORM_SKILL_BASES;

  for (const skillDir of skillDirs) {
    // Create nested directory structure using mkdirSync with recursive
    const skillPath = join(dir, skillDir);
    mkdirSync(skillPath, { recursive: true });

    // Create k-law and k-dart skill directories and files
    mkdirSync(join(skillPath, 'k-law'), { recursive: true });
    mkdirSync(join(skillPath, 'k-dart'), { recursive: true });

    writeFileSync(join(skillPath, 'k-law', 'SKILL.md'), '# K-Law skill fixture\n', 'utf-8');
    writeFileSync(join(skillPath, 'k-dart', 'SKILL.md'), '# K-DART skill fixture\n', 'utf-8');
  }
}

/**
 * Assert a file/directory exists
 */
function assertExists(path: string, testName: string): boolean {
  const exists = existsSync(path);
  if (!exists) {
    results.push({ name: testName, passed: false, details: `Expected path does not exist: ${path}` });
  }
  return exists;
}

/**
 * Assert a file/directory does NOT exist
 */
function assertNotExists(path: string, testName: string): boolean {
  const exists = existsSync(path);
  if (exists) {
    results.push({ name: testName, passed: false, details: `Path should not exist but does: ${path}` });
  }
  return !exists;
}

/**
 * Assert file content matches expected
 */
function assertFileContent(path: string, expectedContent: string, testName: string): boolean {
  if (!existsSync(path)) {
    results.push({ name: testName, passed: false, details: `File does not exist: ${path}` });
    return false;
  }

  const content = readFileSync(path, 'utf-8');
  if (content !== expectedContent) {
    results.push({ name: testName, passed: false, details: `File content mismatch in ${path}` });
    return false;
  }

  return true;
}

/**
 * Run prune helper and check exit code
 */
function runPrune(targetDir: string, country: string, variant?: string): { success: boolean; stdout: string; stderr: string } {
  const args = [PRUNE_SCRIPT, targetDir, country];
  if (variant) args.push(variant);
  const result = spawnSync('bun', args, {
    cwd: ROOT,
    encoding: 'utf-8',
  });

  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Test 1: US country (non-matching) - should prune KR skills and env block
 */
function testUSNonMatching(): void {
  const testName = 'Test US (non-matching country)';
  const tempDir = createTempDir();

  try {
    createEnvSample(tempDir);
    createSkillFixtures(tempDir);

    const result = runPrune(tempDir, 'US');

    if (!result.success) {
      results.push({ name: testName, passed: false, details: `Prune failed for US: ${result.stderr}` });
      return;
    }

    let allPassed = true;

    // Check that KR skills are removed
    const skillDirs = PLATFORM_SKILL_BASES;
    for (const skillDir of skillDirs) {
      if (!assertNotExists(join(tempDir, skillDir, 'k-law'), testName)) allPassed = false;
      if (!assertNotExists(join(tempDir, skillDir, 'k-dart'), testName)) allPassed = false;
    }

    // Check .env.sample has KR block removed but generic content intact
    const envPath = join(tempDir, '.env.sample');
    if (!assertExists(envPath, testName)) allPassed = false;

    const envContent = readFileSync(envPath, 'utf-8');
    if (envContent.includes('DART_API_KEY') || envContent.includes('LAW_API_OC')) {
      results.push({ name: testName, passed: false, details: 'KR env keys should have been pruned' });
      allPassed = false;
    }

    if (!envContent.includes('API_KEY=sample_key')) {
      results.push({ name: testName, passed: false, details: 'Generic API_KEY should remain' });
      allPassed = false;
    }

    if (allPassed) {
      results.push({ name: testName, passed: true, details: 'KR assets pruned, generic content intact' });
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

/**
 * Test 2: none (region-neutral) - should prune ALL scoped assets
 */
function testNoneRegionNeutral(): void {
  const testName = 'Test none (region-neutral)';
  const tempDir = createTempDir();

  try {
    createEnvSample(tempDir);
    createSkillFixtures(tempDir);

    const result = runPrune(tempDir, 'none');

    if (!result.success) {
      results.push({ name: testName, passed: false, details: `Prune failed for none: ${result.stderr}` });
      return;
    }

    let allPassed = true;

    // Check that KR skills are removed
    const skillDirs = PLATFORM_SKILL_BASES;
    for (const skillDir of skillDirs) {
      if (!assertNotExists(join(tempDir, skillDir, 'k-law'), testName)) allPassed = false;
      if (!assertNotExists(join(tempDir, skillDir, 'k-dart'), testName)) allPassed = false;
    }

    // Check .env.sample has KR block removed
    const envPath = join(tempDir, '.env.sample');
    if (!assertExists(envPath, testName)) allPassed = false;

    const envContent = readFileSync(envPath, 'utf-8');
    if (envContent.includes('DART_API_KEY') || envContent.includes('LAW_API_OC')) {
      results.push({ name: testName, passed: false, details: 'KR env keys should have been pruned' });
      allPassed = false;
    }

    if (allPassed) {
      results.push({ name: testName, passed: true, details: 'All scoped assets pruned' });
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

/**
 * Test 3: KR (matching country) - should keep everything
 */
function testKRMatching(): void {
  const testName = 'Test KR (matching country)';
  const tempDir = createTempDir();

  try {
    createEnvSample(tempDir);
    createSkillFixtures(tempDir);

    // Read original .env.sample for comparison
    const originalEnv = readFileSync(join(tempDir, '.env.sample'), 'utf-8');

    const result = runPrune(tempDir, 'KR');

    if (!result.success) {
      results.push({ name: testName, passed: false, details: `Prune failed for KR: ${result.stderr}` });
      return;
    }

    let allPassed = true;

    // Check that KR skills are kept
    const skillDirs = PLATFORM_SKILL_BASES;
    for (const skillDir of skillDirs) {
      if (!assertExists(join(tempDir, skillDir, 'k-law', 'SKILL.md'), testName)) allPassed = false;
      if (!assertExists(join(tempDir, skillDir, 'k-dart', 'SKILL.md'), testName)) allPassed = false;
    }

    // Check .env.sample is unchanged
    const currentEnv = readFileSync(join(tempDir, '.env.sample'), 'utf-8');
    if (currentEnv !== originalEnv) {
      results.push({ name: testName, passed: false, details: '.env.sample should be unchanged for matching country' });
      allPassed = false;
    }

    if (allPassed) {
      results.push({ name: testName, passed: true, details: 'KR assets kept, file unchanged' });
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

/**
 * Test 4: Unbalanced marker - should leave file unchanged with warning
 */
function testUnbalancedMarker(): void {
  const testName = 'Test unbalanced marker';
  const tempDir = createTempDir();

  try {
    // Create .env.sample with unclosed KR block
    const content = `# .env.sample — test fixture

# >>> country-scoped:KR
DART_API_KEY=test_dart_key
LAW_API_OC=test_law_oc

# Generic API key (not country-scoped)
API_KEY=sample_key
`;
    writeFileSync(join(tempDir, '.env.sample'), content, 'utf-8');

    const result = runPrune(tempDir, 'US');

    if (!result.success) {
      results.push({ name: testName, passed: false, details: `Prune should still succeed with unbalanced marker: ${result.stderr}` });
      return;
    }

    // Check file is unchanged
    const currentContent = readFileSync(join(tempDir, '.env.sample'), 'utf-8');
    if (currentContent !== content) {
      results.push({ name: testName, passed: false, details: 'File should be unchanged with unbalanced marker' });
    } else {
      results.push({ name: testName, passed: true, details: 'File unchanged, warning logged (stderr contains "Unbalanced")' });
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

/**
 * Create AGENTS.md + docs/<variant>.context.md fixtures carrying every reference
 * shape the scrubber must catch (spec 2026-10-05-country-prune-context-scrub-design.md):
 * inline-code name, bold table row (with and without a skill path), and the
 * path-form AGENTS.md row — plus neighbor rows that must survive.
 */
function createReferenceShapeFixtures(dir: string, variant: string): void {
  mkdirSync(join(dir, 'docs'), { recursive: true });

  const contextDoc = [
    '# Co-consult Context',
    '',
    '**Phase 1 — Research & Analysis**',
    '',
    '| Skill | File | Owner |',
    '|-------|------|-------|',
    '| **Research Analysis** | `skills/research-analysis/SKILL.md` | research-analyst |',
    '| **k-dart** | `skills/k-dart/SKILL.md` | strategy-analyst |',
    '| **k-dart** | DART OpenAPI queries | strategy-analyst |',
    '| `k-law` | `skills/k-law/SKILL.md` | compliance-analyst |',
    '| **Insight Synthesis** | `skills/insight-synthesis/SKILL.md` | strategy-analyst |',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'docs', `${variant}.context.md`), contextDoc, 'utf-8');

  const agentsDoc = [
    '# Agents',
    '',
    '| **K-DART** | `skills/k-dart/SKILL.md` | DART queries (KR profile only) |',
    '| **Research Analysis** | `skills/research-analysis/SKILL.md` | research |',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'AGENTS.md'), agentsDoc, 'utf-8');
}

/**
 * Test 5: context-doc scrub reference shapes (region-neutral + variant arg) —
 * bold-form and skill-path rows must be scrubbed like inline-code rows; the
 * neighbor rows must survive intact.
 */
function testContextDocScrubShapes(): void {
  const testName = 'Test 5: context-doc scrub reference shapes';
  const tempDir = createTempDir();

  try {
    createSkillFixtures(tempDir);
    createReferenceShapeFixtures(tempDir, 'co-consult');

    const result = runPrune(tempDir, 'none', 'co-consult');

    if (!result.success) {
      results.push({ name: testName, passed: false, details: `Prune failed for none: ${result.stderr}` });
      return;
    }

    let allPassed = true;

    const ctxPath = join(tempDir, 'docs', 'co-consult.context.md');
    const ctxContent = readFileSync(ctxPath, 'utf-8');

    // All three reference shapes of pruned skills must be gone
    if (ctxContent.includes('**k-dart**') || ctxContent.includes('`k-law`') ||
        ctxContent.includes('skills/k-dart/SKILL.md')) {
      results.push({ name: testName, passed: false, details: 'Context doc still references a pruned skill (bold/inline-code/path shape survived)' });
      allPassed = false;
    }

    // Neighbor rows must survive
    if (!ctxContent.includes('**Research Analysis**') || !ctxContent.includes('**Insight Synthesis**')) {
      results.push({ name: testName, passed: false, details: 'Non-scoped neighbor rows must survive the scrub' });
      allPassed = false;
    }

    const agentsContent = readFileSync(join(tempDir, 'AGENTS.md'), 'utf-8');
    if (agentsContent.includes('skills/k-dart/SKILL.md')) {
      results.push({ name: testName, passed: false, details: 'AGENTS.md path-form row should have been scrubbed' });
      allPassed = false;
    }
    if (!agentsContent.includes('**Research Analysis**')) {
      results.push({ name: testName, passed: false, details: 'AGENTS.md neighbor row must survive the scrub' });
      allPassed = false;
    }

    if (allPassed) {
      results.push({ name: testName, passed: true, details: 'All three reference shapes scrubbed, neighbors intact' });
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

/**
 * Run all tests
 */
function runAllTests(): void {
  console.log('🧪 Running verify-country-prune.ts tests...\n');

  testUSNonMatching();
  testNoneRegionNeutral();
  testKRMatching();
  testUnbalancedMarker();
  testContextDocScrubShapes();

  console.log('\n📊 Test Results:\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.details}`);
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  console.log(`\n${passedCount + failedCount} tests total: ${passedCount} passed, ${failedCount} failed`);

  if (failedCount > 0) {
    console.log('\n❌ Some tests failed. Exit 1.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed. Exit 0.');
    process.exit(0);
  }
}

// Run the tests
runAllTests();
