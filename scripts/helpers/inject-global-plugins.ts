#!/usr/bin/env bun
/**
 * inject-global-plugins.ts
 * @version 1.0.0
 *
 * Dynamically instructs the scaffolded project to use global plugins (superpowers, ui-ux-pro-max)
 * instead of relying on statically copied skill files, reducing project bloat.
 * 
 * Usage:
 *   bun scripts/helpers/inject-global-plugins.ts <ProjectDir> [Platform]
 */

import { existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];
const platform = args[1] || 'both';

if (!projectDir) {
  console.error("❌ Missing <ProjectDir> argument.");
  process.exit(1);
}

if (!existsSync(projectDir)) {
  console.error(`❌ Project directory not found: ${projectDir}`);
  process.exit(1);
}

// 1. Remove statically copied heavy skills if they were copied from templates
const skillsToRemove = ['ui-ux-pro-max', 'superpowers'];
for (const skill of skillsToRemove) {
  const skillDir = join(projectDir, 'skills', skill);
  if (existsSync(skillDir)) {
    console.log(`🧹 Removing static skill directory: ${skillDir}`);
    rmSync(skillDir, { recursive: true, force: true });
  }
}

// 2. Generate GLOBAL_TOOLS.md to instruct agents
const docsDir = join(projectDir, 'docs');
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true });
}

const globalToolsPath = join(docsDir, 'GLOBAL_TOOLS.md');
let content = `# Global Tools Configuration\n\nThis project automatically links to global developer tools.\n`;

if (platform === 'claude' || platform === 'both') {
  content += `\n## Claude Plugins\nThe following plugins must be globally available in \`~/.claude/plugins\`:\n- superpowers\n- ui-ux-pro-max\n`;
}

if (platform === 'antigravity' || platform === 'both') {
  content += `\n## Antigravity Extensions\nThe following extensions must be globally available in \`~/.gemini/config/plugins\`:\n- superpowers\n- ui-ux-pro-max\n`;
}

writeFileSync(globalToolsPath, content, 'utf-8');
console.log(`✅ Global tools configuration injected successfully for platform: ${platform}`);
