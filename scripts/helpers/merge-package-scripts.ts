#!/usr/bin/env bun
/**
 * merge-package-scripts.ts — Merge workspace scripts into project package.json
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/merge-package-scripts.ts <project-dir>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];

if (!projectDir) {
  console.error('Usage: bun merge-package-scripts.ts <project-dir>');
  process.exit(1);
}

const pkgJsonPath = join(projectDir, 'package.json');

try {
  const content = readFileSync(pkgJsonPath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.scripts) {
    data.scripts = {};
  }

  const workspaceScripts = {
    audit: 'bun scripts/audit.ts',
    'dev-sync': 'bun scripts/dev-sync.ts',
    'sync-md': 'bun scripts/sync-md.ts',
  };

  for (const [key, value] of Object.entries(workspaceScripts)) {
    if (!(key in data.scripts)) {
      data.scripts[key] = value;
    }
  }

  writeFileSync(pkgJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log('  ✅ Tier 2 scripts merged into package.json');

  process.exit(0);
} catch (error) {
  console.error(`Error: ${error}`);
  process.exit(1);
}
