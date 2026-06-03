#!/usr/bin/env bun
// @version 1.0.0
// tag-template.ts - Publish a new template version git tag

import { $ } from 'bun';
import * as path from 'node:path';
import * as fs from 'node:fs';

const GREEN    = '\x1b[32m';
const YELLOW   = '\x1b[33m';
const RED      = '\x1b[31m';
const CYAN     = '\x1b[36m';
const DARKGRAY = '\x1b[90m';
const RESET    = '\x1b[0m';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');
const isDryRun      = process.argv.includes('--dry-run');

// 1. Read templates/VERSION
const versionFile = path.join(workspaceRoot, 'templates', 'VERSION');
const vf = Bun.file(versionFile);
if (!(await vf.exists())) {
  console.error(`${RED}✗ templates/VERSION not found at ${versionFile}${RESET}`);
  process.exit(1);
}
const version = (await vf.text()).trim();
const tagName = `template-v${version}`;

// 2. Check if tag already exists locally
const existingTags = await $`git -C ${workspaceRoot} tag -l ${tagName}`.quiet().nothrow();
const tagExists = existingTags.stdout.toString().trim() === tagName;
if (tagExists) {
  console.log(`${GREEN}✅ tag ${tagName} already exists. Nothing to do.${RESET}`);
  process.exit(0);
}

// 3. List variant folders under templates/ (exclude non-variant entries)
const EXCLUDED = new Set(['common', 'VERSION', 'CHANGELOG.md', 'README.md', 'README_ko.md']);
const templatesDir = path.join(workspaceRoot, 'templates');
const entries = fs.readdirSync(templatesDir);
const variants = entries.filter((e) => !EXCLUDED.has(e));

// 4. Check each variant exists
const variantStatus: { name: string; exists: boolean }[] = variants.map((v) => ({
  name: v,
  exists: fs.existsSync(path.join(templatesDir, v)),
}));

// 5. Print summary table
console.log('');
console.log(`${CYAN}Template version : ${version}${RESET}`);
console.log(`${CYAN}Tag to publish   : ${tagName}${RESET}`);
console.log('');
console.log(`${CYAN}Variants included:${RESET}`);
for (const { name, exists } of variantStatus) {
  if (exists) {
    console.log(`  ${GREEN}✓ ${name}${RESET}`);
  } else {
    console.log(`  ${RED}✗ ${name}  ${DARKGRAY}(folder missing — check templates/${name})${RESET}`);
  }
}
console.log('');

// 6. Dry-run exit
if (isDryRun) {
  console.log(`${YELLOW}Dry run — no tag created.${RESET}`);
  process.exit(0);
}

// 7. Create and push the tag
const createResult = await $`git -C ${workspaceRoot} tag ${tagName}`.quiet().nothrow();
if (createResult.exitCode !== 0) {
  const stderr = createResult.stderr.toString().trim();
  console.error(`${RED}✗ Failed to create tag ${tagName}: ${stderr}${RESET}`);
  process.exit(1);
}

const pushResult = await $`git -C ${workspaceRoot} push origin ${tagName}`.quiet().nothrow();
if (pushResult.exitCode === 0) {
  console.log(`${GREEN}✅ Published ${tagName}${RESET}`);
} else {
  const stderr = pushResult.stderr.toString().trim();
  console.log(`${YELLOW}⚠ Tag created locally but push failed: ${stderr}${RESET}`);
  console.log(`${YELLOW}  Run: git push origin ${tagName}${RESET}`);
}

// 8. Remind user to bump version for the next release
console.log('');
console.log(`${DARKGRAY}Reminder: update templates/VERSION to the next version before your next release.${RESET}`);
