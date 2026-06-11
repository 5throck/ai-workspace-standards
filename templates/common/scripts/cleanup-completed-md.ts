#!/usr/bin/env bun
// @version 1.0.0
// cleanup-completed-md.ts — Move completed task plans from memory/ to memory/completed/
// Usage: bun scripts/cleanup-completed-md.ts

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const COMPLETED_MARKER = '## Task Status: Completed';
const FINAL_SYNTHESIS_MARKER = '## Synthesis';
const MEETING_COMPLETE_MARKER = '✅  MEETING CLOSED';

const memoryDir = 'memory';
const completedDir = join(memoryDir, 'completed');

let moved = 0;
let skipped = 0;

console.log('🧹 Cleaning up completed memory files...\n');

if (!existsSync(memoryDir)) {
  console.log('ℹ️  memory/ directory not found — nothing to clean.');
  process.exit(0);
}

mkdirSync(completedDir, { recursive: true });

const files = readdirSync(memoryDir).filter(f => {
  const fullPath = join(memoryDir, f);
  return f.endsWith('.md') && statSync(fullPath).isFile();
});

for (const filename of files) {
  const filePath = join(memoryDir, filename);

  // Skip daily logs (YYYY-MM-DD.md)
  if (/^\d{4}-\d{2}-\d{2}\.md$/.test(filename)) {
    skipped++;
    continue;
  }

  // Skip files already prefixed with completed-
  if (filename.startsWith('completed-')) {
    skipped++;
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  let isCompleted = false;

  if (content.includes(COMPLETED_MARKER)) isCompleted = true;
  if (content.includes(MEETING_COMPLETE_MARKER)) isCompleted = true;

  // Meeting transcripts with final synthesis
  if (content.includes('## Transcript') && content.includes(FINAL_SYNTHESIS_MARKER)) {
    if (content.includes(MEETING_COMPLETE_MARKER)) isCompleted = true;
  }

  if (isCompleted) {
    const dest = join(completedDir, `completed-${filename}`);
    renameSync(filePath, dest);
    console.log(`✅ Moved: ${filename} → completed-${filename}`);
    moved++;
  } else {
    skipped++;
  }
}

console.log('\n📊 Cleanup Summary:');
console.log(`   Files moved: ${moved}`);
console.log(`   Files skipped (still active): ${skipped}`);

if (moved > 0) {
  console.log(`\n✅ Cleanup complete: ${moved} file(s) moved to memory/completed/`);
} else {
  console.log('\nℹ️  No completed files found to move');
}
