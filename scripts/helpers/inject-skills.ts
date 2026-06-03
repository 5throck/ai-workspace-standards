#!/usr/bin/env bun
/**
 * inject-skills.ts
 * @version 1.0.0
 * inject-skills.ts — Inject AGENTS.md Skills table into context.md
 *
 * Usage:
 *   bun scripts/helpers/inject-skills.ts <project-dir>
 *
 * Looks for <!-- DYNAMIC_SKILLS_START --> and <!-- DYNAMIC_SKILLS_END --> markers
 * in docs/<variant>.context.md and replaces content with Skills table from AGENTS.md.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];

if (!projectDir) {
  console.error('Usage: bun inject-skills.ts <project-dir>');
  process.exit(1);
}

// Try to find variant context file
const variants = ['co-develop', 'co-design', 'co-work', 'co-security', 'co-consult'];
let contextMdPath: string | null = null;

for (const variant of variants) {
  const path = join(projectDir, 'docs', `${variant}.context.md`);
  if (existsSync(path)) {
    contextMdPath = path;
    break;
  }
}

// Fallback to generic context.md
if (!contextMdPath) {
  const genericPath = join(projectDir, 'docs', 'context.md');
  if (existsSync(genericPath)) {
    contextMdPath = genericPath;
  }
}

if (!contextMdPath) {
  process.exit(0); // No context file found, not an error
}

const agentsMdPath = join(projectDir, 'AGENTS.md');

if (!existsSync(agentsMdPath)) {
  process.exit(0); // AGENTS.md not found, not an error
}

try {
  const agentsContent = readFileSync(agentsMdPath, 'utf-8');
  const contextContent = readFileSync(contextMdPath, 'utf-8');

  // Extract Skills table from AGENTS.md
  const skillsMatch = agentsContent.match(/^## Skills\s*(\| Skill .*?)(?=\n---|\Z)/ms);
  if (!skillsMatch) {
    process.exit(0); // No skills table found, not an error
  }

  const skillsTable = skillsMatch[1].trim();

  // Replace content between markers
  const newContextContent = contextContent.replace(
    /(<!-- DYNAMIC_SKILLS_START -->).*?(<!-- DYNAMIC_SKILLS_END -->)/s,
    `$1\n${skillsTable}\n$2`
  );

  if (newContextContent !== contextContent) {
    writeFileSync(contextMdPath, newContextContent, 'utf-8');
    console.log('  ✅ Injected dynamic skills from AGENTS.md into docs/context.md');
  }

  process.exit(0);
} catch (error) {
  console.error(`Error: ${error}`);
  process.exit(1);
}
