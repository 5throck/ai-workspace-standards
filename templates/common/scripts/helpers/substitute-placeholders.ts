#!/usr/bin/env bun
/**
 * substitute-placeholders.ts — Replace placeholders in all text files
 * @version 1.3.0
 *
 * v1.3.0 (2026-09-23, adopt-project conversion — spec
 *          2026-09-23-adopt-project-conversion): extracted the substitution map into
 *          exported pure functions (applySubstitutions / substituteFiles) so the
 *          adopt-project settling pass can run placeholder replacement SCOPED to the
 *          delivered-file list instead of an unscoped whole-tree sweep (foreign trees
 *          may contain unrelated content matching the tokens, non-UTF-8 files, or
 *          .git/ internals). CLI behavior unchanged.
 *
 * Usage:
 *   bun scripts/helpers/substitute-placeholders.ts <project-dir> <project-name> [description] [characteristics] [variant] [country]
 *
 * Replaces:
 *   [Project Name] → <project-name>
 *   {{PROJECT_NAME}} → <project-name>
 *   {{PROJECT_DESCRIPTION}} → "A new project" (or custom)
 *   {{PROJECT_CHARACTERISTICS}} → "" (or custom)
 *   {{COUNTRY}} → <country display name> or "the applicable jurisdiction" (region-neutral)
 *   <variant-name> → <variant> (in docs/context.md)
 *   <variant> → <variant> (in docs/context.md, within backtick paths only)
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLACEHOLDER_TEXT_EXTENSIONS = ['.md', '.json', '.sh', '.ps1', '.toml', '.yaml', '.yml', '.sample'];

export interface SubstitutionParams {
  projectName: string;
  description: string;
  characteristics: string;
  variantName: string;
  countryDisplayName: string;
}

/** Apply the scaffold placeholder map to one file's content. Pure. */
export function applySubstitutions(content: string, p: SubstitutionParams): string {
  let modified = content;
  modified = modified.replace(/\[Project Name\]/g, p.projectName);
  modified = modified.replace(/\{\{PROJECT_NAME\}\}/g, p.projectName);
  modified = modified.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, p.description);
  modified = modified.replace(/\{\{PROJECT_CHARACTERISTICS\}\}/g, p.characteristics);
  // Replace {{COUNTRY}} with display name or fallback
  const countryReplacement = p.countryDisplayName || 'the applicable jurisdiction';
  modified = modified.replace(/\{\{COUNTRY\}\}/g, countryReplacement);
  // Replace variant placeholders in docs/context.md
  modified = modified.replace(/<variant-name>/g, p.variantName);
  // Replace <variant> only inside backtick paths (e.g. `docs/<variant>.context.md`)
  modified = modified.replace(/`([^`]*)<variant>([^`]*)`/g, `\`$1${p.variantName}$2\``);
  return modified;
}

/**
 * Substitute across an explicit file list (v1.3.0) — the scoped variant used by
 * adopt-project. Files that fail a strict UTF-8 decode are skipped untouched
 * (binary-safe), and only files whose content actually changed are rewritten.
 * @returns the relative paths that were rewritten
 */
export function substituteFiles(files: string[], baseDir: string, p: SubstitutionParams): string[] {
  const rewritten: string[] = [];
  for (const rel of files) {
    if (!PLACEHOLDER_TEXT_EXTENSIONS.some(ext => rel.endsWith(ext))) continue;
    const fullPath = join(baseDir, rel);
    let content: string;
    try {
      // strict UTF-8: fatal decode on invalid sequences — skip binary look-alikes
      const bytes = readFileSync(fullPath);
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
    const modified = applySubstitutions(content, p);
    if (modified !== content) {
      writeFileSync(fullPath, modified, 'utf-8');
      rewritten.push(rel);
    }
  }
  return rewritten;
}

// ── CLI mode (behavior unchanged; the unscoped whole-tree sweep stays scaffold-only) ──
// v1.3.0: guarded by import.meta.main — imported use calls substituteFiles() directly
// (the previous top-level execution made the module unimportable).
if (import.meta.main) {
  const args = process.argv.slice(2);
  const projectDir = args[0];
  const projectName = args[1] || '';
  const description = args[2] || 'A new project';
  const characteristics = args[3] || '';
  const variantName = args[4] || projectName;
  const countryDisplayName = args[5] || '';

  if (!projectDir || !projectName) {
    console.error('Usage: bun substitute-placeholders.ts <project-dir> <project-name> [description] [characteristics] [variant] [country]');
    process.exit(1);
  }

  // Find all text files
  function getTextFiles(dir: string, relPath = ''): string[] {
    const files: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const relativePath = relPath ? join(relPath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        files.push(...getTextFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
        if (PLACEHOLDER_TEXT_EXTENSIONS.includes(ext)) {
          files.push(relativePath);
        }
      }
    }

    return files;
  }

  try {
    const files = getTextFiles(projectDir);
    substituteFiles(files, projectDir, {
      projectName,
      description,
      characteristics,
      variantName,
      countryDisplayName,
    });
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
