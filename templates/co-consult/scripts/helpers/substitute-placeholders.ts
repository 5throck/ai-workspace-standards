#!/usr/bin/env bun
/**
 * substitute-placeholders.ts — Replace placeholders in all text files
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/substitute-placeholders.ts <project-dir> <project-name> [description] [characteristics]
 *
 * Replaces:
 *   [Project Name] → <project-name>
 *   {{PROJECT_NAME}} → <project-name>
 *   {{PROJECT_DESCRIPTION}} → "A new project" (or custom)
 *   {{PROJECT_CHARACTERISTICS}} → "" (or custom)
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const projectDir = args[0];
const projectName = args[1] || '';
const description = args[2] || 'A new project';
const characteristics = args[3] || '';

if (!projectDir || !projectName) {
  console.error('Usage: bun substitute-placeholders.ts <project-dir> <project-name> [description] [characteristics]');
  process.exit(1);
}

// Find all text files
const textExtensions = ['.md', '.json', '.sh', '.ps1', '.toml', '.yaml', '.yml', '.sample'];

function getTextFiles(dir: string, relPath = ''): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const relativePath = relPath ? join(relPath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push(...getTextFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.'));
      if (textExtensions.includes(ext)) {
        files.push(relativePath);
      }
    }
  }

  return files;
}

try {
  const files = getTextFiles(projectDir);

  for (const file of files) {
    const fullPath = join(projectDir, file);
    const content = readFileSync(fullPath, 'utf-8');
    let modified = content;

    modified = modified.replace(/\[Project Name\]/g, projectName);
    modified = modified.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    modified = modified.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, description);
    modified = modified.replace(/\{\{PROJECT_CHARACTERISTICS\}\}/g, characteristics);

    if (modified !== content) {
      writeFileSync(fullPath, modified, 'utf-8');
    }
  }

  process.exit(0);
} catch (error) {
  console.error(`Error: ${error}`);
  process.exit(1);
}
