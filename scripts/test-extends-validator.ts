#!/usr/bin/env -S bun
/**
 * Test script for ADR-0033 circular reference prevention implementation
 * @version 1.0.0
 *
 * Tests the extends-validator.ts module with various scenarios:
 * - Normal extends chains (depth 2-3)
 * - Excessive depth (4+)
 * - Large files (100KB+)
 * - Circular references (A extends B extends A)
 */

import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { safeValidateExtends } from './helpers/extends-validator.js';

const TEST_DIR = resolve('.test-extends-validator-temp');

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupTestDir(): void {
  mkdirSync(TEST_DIR, { recursive: true });
}

function teardownTestDir(): void {
  try {
    unlinkSync(resolve(TEST_DIR, 'l0-pm.md'));
    unlinkSync(resolve(TEST_DIR, 'l1-pm.md'));
    unlinkSync(resolve(TEST_DIR, 'l2-pm.md'));
    unlinkSync(resolve(TEST_DIR, 'l3-pm.md'));
    unlinkSync(resolve(TEST_DIR, 'circular-a.md'));
    unlinkSync(resolve(TEST_DIR, 'circular-b.md'));
    unlinkSync(resolve(TEST_DIR, 'large-file.md'));
  } catch (error) {
    // Ignore if files don't exist
  }
}

function createTestFile(name: string, content: string): void {
  writeFileSync(resolve(TEST_DIR, name), content, 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────────────────────

console.log('🧪 Testing ADR-0033 Circular Reference Prevention\n');

setupTestDir();

// Test 1: Normal extends chain (depth 2: L2→L1→L0)
console.log('Test 1: Normal extends chain (depth 2: L2→L1→L0)');

createTestFile('l0-pm.md', `---
name: pm
role: "Project Manager"
---

# Workspace PM

L0 workspace root PM definition.
`);

createTestFile('l1-pm.md', `---
extends: ./l0-pm.md
---

# Common Template PM

L1 common template PM extends L0.
`);

createTestFile('l2-pm.md', `---
extends: ./l1-pm.md
variant: co-design
---

# Variant PM

L2 variant PM extends L1.
`);

const test1Result = safeValidateExtends(resolve(TEST_DIR, 'l2-pm.md'));
console.log(`Result: ${test1Result.valid ? '✅ PASS' : '❌ FAIL'}`);
if (test1Result.valid) {
  console.log(`  Chain depth: ${test1Result.depth}`);
  console.log(`  Extends chain: ${test1Result.chain.join(' → ')}`);
} else {
  console.log(`  Error: ${test1Result.message}`);
}
console.log();

// Test 2: Excessive depth (4+ levels)
console.log('Test 2: Excessive depth (4 levels: L3→L2→L1→L0)');

createTestFile('l3-pm.md', `---
extends: ./l2-pm.md
variant: co-deep-variant
---

# Deep Variant PM

L3 variant PM extends L2 (exceeds MAX_EXTENDS_DEPTH=3).
`);

const test2Result = safeValidateExtends(resolve(TEST_DIR, 'l3-pm.md'));
console.log(`Result: ${!test2Result.valid && test2Result.error_type === 'depth_exceeded' ? '✅ PASS' : '❌ FAIL'}`);
if (!test2Result.valid) {
  console.log(`  Error type: ${test2Result.error_type}`);
  console.log(`  Message: ${test2Result.message}`);
  console.log(`  Current depth: ${test2Result.current_value}`);
  console.log(`  Max depth: ${test2Result.limit}`);
}
console.log();

// Test 3: Circular reference (A extends B extends A)
console.log('Test 3: Circular reference (A extends B extends A)');

createTestFile('circular-a.md', `---
extends: ./circular-b.md
---

# File A

Extends B, which extends A (circular).
`);

createTestFile('circular-b.md', `---
extends: ./circular-a.md
---

# File B

Extends A, which extends B (circular).
`);

const test3Result = safeValidateExtends(resolve(TEST_DIR, 'circular-a.md'));
console.log(`Result: ${!test3Result.valid && test3Result.error_type === 'circular_reference' ? '✅ PASS' : '❌ FAIL'}`);
if (!test3Result.valid) {
  console.log(`  Error type: ${test3Result.error_type}`);
  console.log(`  Message: ${test3Result.message}`);
  console.log(`  Circular path: ${test3Result.chain.join(' → ')}`);
}
console.log();

// Test 4: Large file (100KB+)
console.log('Test 4: Large file (100KB+)');

const largeContent = `---
extends: ./l0-pm.md
---

# Large File

${'x'.repeat(101_000)} // 101KB content
`;

createTestFile('large-file.md', largeContent);

const test4Result = safeValidateExtends(resolve(TEST_DIR, 'large-file.md'));
console.log(`Result: ${!test4Result.valid && test4Result.error_type === 'file_size_exceeded' ? '✅ PASS' : '❌ FAIL'}`);
if (!test4Result.valid) {
  console.log(`  Error type: ${test4Result.error_type}`);
  console.log(`  Message: ${test4Result.message}`);
  console.log(`  File size: ${test4Result.current_value} bytes`);
  console.log(`  Max size: ${test4Result.limit} bytes`);
}
console.log();

// Test 5: Missing extends file (file_not_found)
console.log('Test 5: Missing extends file');

createTestFile('missing-extends.md', `---
extends: ./non-existent-file.md
---

# Missing Extends

Extends a file that doesn't exist.
`);

const test5Result = safeValidateExtends(resolve(TEST_DIR, 'missing-extends.md'));
console.log(`Result: ${!test5Result.valid && test5Result.error_type === 'file_not_found' ? '✅ PASS' : '❌ FAIL'}`);
if (!test5Result.valid) {
  console.log(`  Error type: ${test5Result.error_type}`);
  console.log(`  Message: ${test5Result.message}`);
}
console.log();

// Test 6: No extends field (terminating case)
console.log('Test 6: No extends field (terminating case)');

const test6Result = safeValidateExtends(resolve(TEST_DIR, 'l0-pm.md'));
console.log(`Result: ${test6Result.valid ? '✅ PASS' : '❌ FAIL'}`);
if (test6Result.valid) {
  console.log(`  Chain depth: ${test6Result.depth}`);
  console.log(`  Chain terminates at: ${test6Result.chain[test6Result.chain.length - 1]}`);
}
console.log();

// Cleanup
teardownTestDir();

// Summary
console.log('═══════════════════════════════════════════════════════════════');
console.log('All tests completed. Review results above.');
console.log('═══════════════════════════════════════════════════════════════');
