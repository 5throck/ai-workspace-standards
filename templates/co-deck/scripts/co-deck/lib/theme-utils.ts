// theme-utils.ts — shared utilities for co-deck theme/style scripts.
//
// Extracted from validate-theme-styles.ts, generate-themes-manifest.ts,
// and scaffold-theme-style.ts to eliminate duplication.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

// Resolve workspace root — two levels above the calling script.
export function resolveWorkspaceRoot(fromPath: string): string {
  return resolve(dirname(fromPath), '../..');
}

// List theme directories (excluding _shared).
export function listThemeDirs(root: string): string[] {
  const themesRoot = join(root, 'docs/html-themes/themes');
  if (!existsSync(themesRoot)) return [];
  return readdirSync(themesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => d.name);
}

// List style directories.
export function listStyleDirs(root: string): string[] {
  const stylesRoot = join(root, 'docs/html-themes/styles');
  if (!existsSync(stylesRoot)) return [];
  return readdirSync(stylesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// Normalize a style entry (string or {name, reason?}) to its name.
export function normalizeStyleEntry(entry: any): string | null {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name;
  return null;
}

// Read and parse a JSON file.
export function readJson<T = any>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

// HTML-to-JSON slide-type vocabulary mapping.
export const SLIDE_TYPE_HTML_TO_JSON = { cover: 'title' } as const;

// Required theme package files.
export const REQUIRED_THEME_FILES = ['template.html', 'theme.json', 'theme.css', 'pdf_layout_spec.json'] as const;

// Required template injection markers.
export const REQUIRED_INJECT_MARKERS = ['INJECT:title', 'INJECT:CSS', 'INJECT:slides', 'INJECT:slideData'] as const;

// CLI arg parser — given an args array, return the value after the flag.
export function getArg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

// CLI arg parser using process.argv.
export function getCliArg(flag: string): string | undefined {
  return getArg(process.argv.slice(2), flag);
}
