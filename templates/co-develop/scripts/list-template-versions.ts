#!/usr/bin/env bun
// list-template-versions.ts - List available template versions

import { $ } from 'bun';
import * as path from 'node:path';

const CYAN     = '\x1b[36m';
const GREEN    = '\x1b[32m';
const DARKGRAY = '\x1b[90m';
const RESET    = '\x1b[0m';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');

console.log(`${CYAN}Available template versions:${RESET}`);
console.log('');

const tagsResult = await $`git -C ${workspaceRoot} tag -l ${'template-v*'}`.quiet().nothrow();
const tagsRaw = tagsResult.stdout.toString().trim();

const tags = tagsRaw
  ? tagsRaw.split('\n').filter(Boolean).sort()
  : [];

if (tags.length === 0) {
  console.log(`${DARKGRAY}  (no tagged versions found)${RESET}`);
  console.log('');
  console.log(`${DARKGRAY}  Current (untagged) version:${RESET}`);
  const versionFile = path.join(workspaceRoot, 'templates', 'VERSION');
  const vf = Bun.file(versionFile);
  if (await vf.exists()) {
    const v = (await vf.text()).trim();
    console.log(`${GREEN}  → ${v} (latest, untagged)${RESET}`);
  }
} else {
  for (const tag of tags) {
    const version = tag.replace(/^template-v/, '');
    console.log(`${GREEN}  → ${version}  (${tag})${RESET}`);
  }
}

console.log('');
if (process.platform === 'win32') {
  console.log(`${DARKGRAY}Usage: .\\scripts\\new-project.ps1 my-project -Version X.Y.Z${RESET}`);
  console.log(`${DARKGRAY}       (omit -Version to use the latest template)${RESET}`);
} else {
  console.log(`${DARKGRAY}Usage: bash scripts/new-project.sh my-project --version X.Y.Z${RESET}`);
  console.log(`${DARKGRAY}       (omit --version to use the latest template)${RESET}`);
}
