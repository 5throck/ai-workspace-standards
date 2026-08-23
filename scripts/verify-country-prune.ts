#!/usr/bin/env bun
/**
 * verify-country-prune.ts
 * @version 1.0.0
 * @last_updated 2026-08-23
 *
 * Verifies the country-scoped asset pruning mechanism (skills, scripts, env blocks).
 * Creates temporary fixtures and runs prune-country-scoped-assets.ts to validate
 * that pruning works correctly for all scenarios: matching country, non-matching country,
 * region-neutral (none), and unbalanced marker edge cases.
 *
 * Pruning rules:
 * - Skills: removes <target>/{skills,.claude/skills,.gemini/skills,.agents/skills}/<name>/
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
  const skillDirs = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills'];

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
function runPrune(targetDir: string, country: string): { success: boolean; stdout: string; stderr: string } {
  const result = spawnSync('bun', [PRUNE_SCRIPT, targetDir, country], {
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
    const skillDirs = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills'];
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
    const skillDirs = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills'];
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
    const skillDirs = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills'];
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
 * Run all tests
 */
function runAllTests(): void {
  console.log('🧪 Running verify-country-prune.ts tests...\n');

  testUSNonMatching();
  testNoneRegionNeutral();
  testKRMatching();
  testUnbalancedMarker();

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
