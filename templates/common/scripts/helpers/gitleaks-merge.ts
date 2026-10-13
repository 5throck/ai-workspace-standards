#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-13, T-20261013-010): extracted from upgrade-project.ts —
//           mergeGitleaksToml + extractGitleaksArray as importable helpers so
//           the merge is unit-testable. The replacer must be a FUNCTION: `$'`
//           inside a replacement STRING substitutes the text-after-match,
//           which stripped the `$` anchor from a project's `$''`-terminated
//           allowlist regex and silently disabled it (co-abap 0.18.0 upgrade).
//           dryRun is parameterized (previously closure state).

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Extract every `'''...'''` (or `'...'`) string literal from a named TOML array
 * (e.g. `regexes = [ ... ]` or `paths = [ ... ]`), by array name. Comment-only lines
 * are stripped first — explanatory comments routinely contain apostrophes (e.g. "AI
 * session notes" or "they're"), which a naive single-quote match mistakes for the
 * start of a string literal and misparses everything after it.
 */
export function extractGitleaksArray(content: string, arrayName: string): string[] {
  const blockMatch = content.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`));
  if (!blockMatch) return [];
  const codeOnly = blockMatch[1]
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n');
  const entries: string[] = [];
  for (const m of codeOnly.matchAll(/'''([^']*)'''|'([^']*)'/g)) {
    entries.push(m[1] ?? m[2]);
  }
  return entries;
}

/**
 * Merge the template .gitleaks.toml over the project's copy, preserving
 * project-only `regexes`/`paths` allowlist entries by appending them into the
 * template content (a plain overwrite silently deletes them, and the next
 * `git push` fails the pre-push secret scan on findings that were already
 * known-safe).
 */
export function mergeGitleaksToml(
  dest: string,
  src: string,
  opts: { dryRun: boolean } = { dryRun: false },
): void {
  const { dryRun } = opts;
  if (!existsSync(dest)) {
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
    console.log(`  ${dryRun ? '[DRY RUN] ' : ''}WROTE: .gitleaks.toml (new)`);
    return;
  }
  const destContent = readFileSync(dest, 'utf8');
  const srcContent = readFileSync(src, 'utf8');
  const srcRegexes = new Set(extractGitleaksArray(srcContent, 'regexes'));
  const srcPaths = new Set(extractGitleaksArray(srcContent, 'paths'));
  const projectOnlyRegexes = extractGitleaksArray(destContent, 'regexes').filter(e => !srcRegexes.has(e));
  const projectOnlyPaths = extractGitleaksArray(destContent, 'paths').filter(e => !srcPaths.has(e));

  let merged = srcContent;
  if (projectOnlyRegexes.length > 0) {
    // Replacer FUNCTION, not a `$1`-interpolated string: project entries are
    // external data, and `$'` inside a replacement STRING substitutes the
    // text-after-match — a `$''`-anchored regex entry lost its anchor and
    // silently disabled the allowlist (co-abap, T-20261013-010).
    merged = merged.replace(
      /(regexes\s*=\s*\[[\s\S]*?)(\n\])/,
      (_m, g1: string, g2: string) =>
        `${g1}\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyRegexes.map(e => `  '''${e}''',`).join('\n') + g2
    );
    console.log(`  ⚠️  Preserved ${projectOnlyRegexes.length} project-specific regex allowlist entr${projectOnlyRegexes.length === 1 ? 'y' : 'ies'} that the template overwrite would have dropped`);
  }
  if (projectOnlyPaths.length > 0) {
    merged = merged.replace(
      /(paths\s*=\s*\[[\s\S]*?)(\n\])/,
      (_m, g1: string, g2: string) =>
        `${g1}\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyPaths.map(e => `  '''${e}''',`).join('\n') + g2
    );
    console.log(`  ⚠️  Preserved ${projectOnlyPaths.length} project-specific path exclusion${projectOnlyPaths.length === 1 ? '' : 's'} that the template overwrite would have dropped`);
  }
  if (!dryRun) writeFileSync(dest, merged, 'utf8');
  console.log(`  ${dryRun ? '[DRY RUN] ' : ''}WROTE: .gitleaks.toml`);
}
