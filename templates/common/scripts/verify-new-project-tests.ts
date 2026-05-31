#!/usr/bin/env bun
/**
 * verify-new-project-tests.ts — Test Coverage Sync Verifier
 *
 * @version 1.0.2
 * @last_updated 2026-05-31
 *
 * Checks that TEST: comments in new-project.sh/.ps1 align with
 * test headers in test-new-project.ts.
 *
 * Rules:
 *   1. Every "# TEST: Test N" in new-project.sh must have a matching
 *      "// ── Test N:" header in test-new-project.ts → ERROR if missing
 *   2. new-project.sh and new-project.ps1 must have identical TEST: numbers → ERROR if mismatch
 *   3. Steps with "# TEST: none" are exempt from test requirement → INFO only
 *   4. Steps without any TEST: comment → WARN (unlinked step)
 *
 * Exit codes:
 *   0 = all checks passed (errors = 0)
 *   1 = one or more errors found
 */

import { readFileSync, existsSync } from 'node:fs';

const SH_PATH   = 'scripts/new-project.sh';
const PS1_PATH  = 'scripts/new-project.ps1';
const TEST_PATH = 'scripts/test-new-project.ts';

// Extract TEST: numbers from a script file
// Matches lines like: # ── step name ─── # TEST: Test N
// or: # ── step name ─── # TEST: Test N, Test M  (multiple tests)
// or: # ── step name ─── # TEST: none
function extractTestTags(content: string): { step: string; testNum: number | null; line: number }[] {
  const results: { step: string; testNum: number | null; line: number }[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^#\s*[-─]+\s*(.+?)\s*#\s*TEST:\s*(.+)/i);
    if (!match) continue;
    const step = match[1].replace(/─+/g, '').trim();
    const tag  = match[2].trim();
    if (/^none$/i.test(tag)) {
      results.push({ step, testNum: null, line: i + 1 });
    } else {
      // Support "Test N" or "Test N, Test M" (comma-separated)
      const nums = [...tag.matchAll(/Test\s*(\d+)/gi)].map(m => parseInt(m[1]));
      for (const num of nums) {
        results.push({ step, testNum: num, line: i + 1 });
      }
    }
  }
  return results;
}

// Extract Test N numbers from test-new-project.ts
// Matches lines like: // ── Test N: description [maps to: ...]
function extractTestHeaders(content: string): Set<number> {
  const nums = new Set<number>();
  for (const line of content.split('\n')) {
    const match = line.match(/\/\/\s*──\s*Test\s+(\d+):/i);
    if (match) nums.add(parseInt(match[1]));
  }
  return nums;
}

// Check for steps without any TEST: comment
function extractUnlinkedSteps(content: string): { step: string; line: number }[] {
  const results: { step: string; line: number }[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Step comment without TEST: tag
    if (/^#\s*──\s*.+────/.test(line) && !line.includes('# TEST:')) {
      results.push({ step: line.replace(/^#\s*──\s*/, '').replace(/─+/g, '').trim(), line: i + 1 });
    }
  }
  return results;
}

let errors = 0;
let warnings = 0;

console.log('=== verify-new-project-tests.ts ===\n');

// Load files
if (!existsSync(SH_PATH) || !existsSync(PS1_PATH) || !existsSync(TEST_PATH)) {
  console.error(`❌ Required files missing. Expected: ${SH_PATH}, ${PS1_PATH}, ${TEST_PATH}`);
  process.exit(1);
}

const shContent   = readFileSync(SH_PATH, 'utf-8');
const ps1Content  = readFileSync(PS1_PATH, 'utf-8');
const testContent = readFileSync(TEST_PATH, 'utf-8');

const shTags   = extractTestTags(shContent);
const ps1Tags  = extractTestTags(ps1Content);
const testNums = extractTestHeaders(testContent);

// Rule 1: Every TEST: Test N in sh must exist in test-new-project.ts
console.log('Check 1: sh TEST: numbers exist in test-new-project.ts');
const shTestNums = new Set(shTags.filter(t => t.testNum !== null).map(t => t.testNum as number));
for (const num of [...shTestNums].sort((a, b) => a - b)) {
  if (!testNums.has(num)) {
    console.error(`  ❌ new-project.sh references Test ${num} but no "// ── Test ${num}:" found in test-new-project.ts`);
    errors++;
  }
}
if (errors === 0) console.log(`  ✅ All ${shTestNums.size} TEST: references found in test-new-project.ts`);

// Rule 2: sh and ps1 TEST: numbers must match
console.log('\nCheck 2: sh and ps1 TEST: numbers are identical');
const ps1TestNums = new Set(ps1Tags.filter(t => t.testNum !== null).map(t => t.testNum as number));
const onlyInSh  = [...shTestNums].filter(n => !ps1TestNums.has(n));
const onlyInPs1 = [...ps1TestNums].filter(n => !shTestNums.has(n));
if (onlyInSh.length > 0) {
  console.error(`  ❌ TEST: numbers in sh but not ps1: ${onlyInSh.join(', ')}`);
  errors++;
}
if (onlyInPs1.length > 0) {
  console.error(`  ❌ TEST: numbers in ps1 but not sh: ${onlyInPs1.join(', ')}`);
  errors++;
}
if (onlyInSh.length === 0 && onlyInPs1.length === 0) {
  console.log(`  ✅ sh and ps1 have identical TEST: numbers (${shTestNums.size} tests mapped)`);
}

// Rule 3: Unlinked steps (steps without TEST: tag) — warning
console.log('\nCheck 3: Steps without TEST: comment (unlinked steps)');
const unlinked = extractUnlinkedSteps(shContent);
if (unlinked.length > 0) {
  for (const u of unlinked) {
    console.warn(`  ⚠️  Line ${u.line}: "${u.step}" has no TEST: comment — add "# TEST: Test N" or "# TEST: none"`);
    warnings++;
  }
} else {
  console.log('  ✅ All steps have TEST: comments');
}

// Summary
console.log(`\n${'─'.repeat(40)}`);
if (errors > 0) {
  console.error(`❌ ${errors} error(s), ${warnings} warning(s) — pre-commit blocked`);
  process.exit(1);
} else {
  console.log(`✅ All checks passed (${warnings} warning(s))`);
  process.exit(0);
}
