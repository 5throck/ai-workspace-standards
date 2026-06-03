#!/usr/bin/env bun
/**
 * update-variant-lifecycle.ts — Update lifecycle.statusSince and lastTransition in variant.json
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/update-variant-lifecycle.ts <project-dir> <date> <variant>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];
const date = args[1];
const variant = args[2];

if (!projectDir || !date || !variant) {
  console.error('Usage: bun update-variant-lifecycle.ts <project-dir> <date> <variant>');
  process.exit(1);
}

const variantJsonPath = join(projectDir, 'variant.json');

try {
  const content = readFileSync(variantJsonPath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.lifecycle) {
    data.lifecycle = {};
  }

  data.lifecycle.statusSince = date;
  const currentStatus = data.status || 'unknown';
  data.lifecycle.lastTransition = `initial → ${currentStatus} on ${date}`;

  writeFileSync(variantJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  ✅ variant.json lifecycle.statusSince set to ${date}`);

  process.exit(0);
} catch (error) {
  console.error(`Error: ${error}`);
  process.exit(1);
}
