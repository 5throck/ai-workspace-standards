#!/usr/bin/env bun
/**
 * write-scripts-snapshot.ts — Write scripts-snapshot.json with L1 script version map
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/write-scripts-snapshot.ts <project-dir> <date> <variant> <l1-source>
 *
 * Reads scripts/SCRIPTS.md from workspace root and extracts script versions.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];
const date = args[1];
const variant = args[2];
const l1Source = args[3];

if (!projectDir || !date || !variant || !l1Source) {
  console.error('Usage: bun write-scripts-snapshot.ts <project-dir> <date> <variant> <l1-source>');
  process.exit(1);
}

const scriptsMdPath = join(process.cwd(), 'scripts', 'SCRIPTS.md');
const snapshotPath = join(projectDir, 'scripts-snapshot.json');

try {
  const scriptsMd = readFileSync(scriptsMdPath, 'utf-8');
  const scripts: Record<string, { version: string; status: string }> = {};

  // Extract Registry table
  const registryMatch = scriptsMd.match(/## Registry\n.*?\n\|[-| ]+\|\n(.*?)(?=\n##|\Z)/s);
  if (registryMatch) {
    const lines = registryMatch[1].trim().split('\n');
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 4) {
        const name = parts[0].replace(/`/g, '');
        const version = parts[2];
        const status = parts[3];

        // Only include if version is semantic versioning
        if (/^\d+\.\d+\.\d+$/.test(version)) {
          scripts[name] = { version, status };
        }
      }
    }
  }

  const snapshot = {
    created: date,
    variant,
    l1_source: l1Source,
    scripts,
  };

  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(`  ✅ scripts-snapshot.json written (${Object.keys(scripts).length} scripts)`);

  process.exit(0);
} catch (error) {
  console.error(`Error: ${error}`);
  process.exit(1);
}
