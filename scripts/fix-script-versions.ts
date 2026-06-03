#!/usr/bin/env tsx
/**
 * Fix Script Versions
 *
 * Add @version headers to scripts that are missing them.
 * Resolves lifecycle-sync-audit warnings.
 *
 * @version 1.0.0
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { readUTF8File, writeUTF8File } from './lib/encoding-utils.js';

const WORKSPACE_ROOT = process.cwd();
const SCRIPTS_DIR = join(WORKSPACE_ROOT, 'scripts');

// Scripts missing @version headers (from lifecycle-sync-audit.ts output)
const SCRIPTS_TO_FIX = [
  // Core scripts
  'sync-skills.ts',
  'agent-create.ts',
  'agent-delete.ts',
  'agent-list.ts',
  'agent-verify.ts',
  'verify-skills.ts',
  'verify-memory.ts',
  'generate-scripts-readme.ts',
  'dispatch.ts',
  'dispatch-parallel.ts',
  'dispatch-serial.ts',
  'retry-handler.ts',
  'sync-agent-status.ts',
  'sync-skill-status.ts',
  'translate-readme.ts',
  'verify-agent-deliverables.ts',
  'verify-scripts.ts',
  'clear-pm-approval.ts',
  'validate-agents.ts',
  'validate-doc-folder.ts',
  'verify-template-integrity.ts',
  'validate-skills.ts',
  'skill-dependency-analysis.ts',
  'test-runner.ts',
  // Helpers
  'helpers/lifecycle-governance.ts',
  'helpers/template-validation.ts',
  'helpers/inject-global-plugins.ts',
  'helpers/inject-skills.ts',
  'helpers/merge-frontmatter.ts',
  'helpers/merge-package-scripts.ts',
  'helpers/substitute-placeholders.ts',
  'helpers/update-variant-lifecycle.ts',
  'helpers/validate-output.ts',
  'helpers/write-scripts-snapshot.ts',
];

/**
 * Add @version tag to script header
 */
function addVersionTag(filePath: string): boolean {
  console.log(`Processing: ${filePath}`);

  try {
    const content = readUTF8File(filePath);

    // Skip if already has @version
    if (content.includes('@version')) {
      console.log(`  ⊘ Skipped: @version already exists`);
      return false;
    }

    // Find the file header comment block (first few lines)
    const lines = content.split('\n');
    let headerEndIndex = -1;

    // Find the end of the header comment block (first non-comment line after /**)
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }
      if (trimmed.startsWith('*') || trimmed.startsWith('*/')) {
        headerEndIndex = i;
        break;
      }
      // If we hit a non-comment line before */, no proper header
      if (!trimmed.startsWith('*') && !trimmed.startsWith('*/') && trimmed !== '' && !trimmed.startsWith('/')) {
        headerEndIndex = i;
        break;
      }
    }

    // If no proper header found, insert after first line
    if (headerEndIndex === -1 || headerEndIndex < 2) {
      headerEndIndex = 1;
    }

    // Insert @version tag before the closing */ or at the found position
    const versionLine = ' * @version 1.0.0';
    const linesArray = content.split('\n');
    linesArray.splice(headerEndIndex, 0, versionLine);

    const updatedContent = linesArray.join('\n');
    writeUTF8File(filePath, updatedContent);

    console.log(`  ✅ Added @version tag`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Process all scripts
 */
function main() {
  console.log('=== Fix Script Versions ===');
  console.log(`Workspace: ${WORKSPACE_ROOT}\n`);

  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const script of SCRIPTS_TO_FIX) {
    const scriptPath = join(SCRIPTS_DIR, script);
    if (!existsSync(scriptPath)) {
      console.log(`⚠️  File not found: ${scriptPath}`);
      failedCount++;
      continue;
    }

    const result = addVersionTag(scriptPath);
    if (result) {
      processedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (processedCount > 0) {
    console.log(`\n✅ ${processedCount} script(s) updated`);
    console.log(`Run lifecycle-sync-audit.ts to verify:\n`);
    console.log(`  bun scripts/lifecycle-sync-audit.ts`);
  } else if (failedCount === 0) {
    console.log(`\n✅ All scripts already have @version tags`);
  } else {
    console.log(`\n⚠️  Some files could not be processed`);
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
