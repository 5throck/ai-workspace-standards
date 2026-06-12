#!/usr/bin/env bun
// @version 1.0.0
// remove-project.ts — Project deletion helper (all platforms)
// Usage: bun scripts/remove-project.ts <project-name-or-path>
//
// Safely deletes a project directory with process-detection guard.
// No permission manipulation — files are deleted as-is by the OS.

import { existsSync, rmSync } from 'node:fs';
import { resolve, isAbsolute, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as readline from 'node:readline';

const projectArg = process.argv[2];
if (!projectArg) {
  console.error('[FAIL] Usage: bun scripts/remove-project.ts <project-path>');
  process.exit(1);
}

// Resolve absolute path
const projectDir = isAbsolute(projectArg)
  ? projectArg
  : resolve(process.cwd(), projectArg);

console.log('\n============================================================');
console.log(`  REMOVE PROJECT: ${projectDir}`);
console.log('============================================================\n');

if (!existsSync(projectDir)) {
  console.error(`[FAIL] Project directory not found: ${projectDir}`);
  process.exit(1);
}

// ── Process detection ─────────────────────────────────────────────────────────
console.log('[Step 1/2] Checking for running processes...');
const processNames = ['claude', 'antigravity'];
const running: string[] = [];

for (const pname of processNames) {
  const result = spawnSync('pgrep', ['-i', pname], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    running.push(pname);
  }
}

if (running.length > 0) {
  console.log(`\n  [WARN] Running processes detected: ${running.join(', ')}`);
  console.log('  [WARN] Continuing may cause data loss for unsaved work.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question('  Continue with deletion? (Y/N): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('  Deletion cancelled.');
    process.exit(0);
  }
}
console.log('  [OK] Process check complete.');

// ── Delete project directory ──────────────────────────────────────────────────
console.log('\n[Step 2/2] Deleting project directory...');
try {
  rmSync(projectDir, { recursive: true, force: true });
  console.log('  [OK] Project deleted successfully.');
  console.log('\n============================================================');
  console.log(`  [SUCCESS] Project removed: ${projectDir}`);
  console.log('============================================================');
} catch (err) {
  console.error(`  [FAIL] Could not delete: ${projectDir}`);
  console.error(`  Error: ${(err as Error).message}`);
  process.exit(1);
}
