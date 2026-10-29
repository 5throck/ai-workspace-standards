#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-30, U-20261029-008): preserve project-only [[rules]] blocks —
//           v1.0.0 handled only the `regexes`/`paths` allowlist ARRAYS, so
//           custom project rules authored as TOML array-of-tables entries
//           (co-abap's 9 co-abap-* patterns, the U-20261028-004 adjudication's
//           prescribed location) were silently dropped by every template
//           re-merge. Rules match by `id`: same-id blocks keep the TEMPLATE
//           copy (template authoritative); a project block whose id the
//           template does not carry (or an id-less block whose text the
//           template does not contain verbatim) is appended verbatim after the
//           template content under the same preserved-comment convention as
//           the arrays. Blocks are extracted header-to-next-`[`-header, so
//           nested sub-tables ([rules.allowlists]) stay inside their parent.
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
/** One `[[rules]]` block: from its header line to the next `[`-header or EOF,
 *  with trailing blank lines trimmed off (separators are not block content).
 *  Nested sub-tables ([rules.allowlists]) stay inside the parent — any line
 *  starting with `[` that is NOT the block's own header ends it. */
export interface GitleaksRulesBlock {
  id: string | null;   // the block's `id = "..."` field, or null when absent
  text: string;        // verbatim block text (header line included)
}

/** A top-level TOML table header: any `[`-starting line that is NOT a rules
 *  sub-table. Sub-tables of a rule (`[rules.allowlists]`, `[[rules.allowlists]]`)
 *  begin with `rules.` after the bracket(s) and stay INSIDE their parent block;
 *  `[[rules]]` (the next element) and `[allowlist]`-style tables end it. */
function isTopLevelHeader(line: string): boolean {
  return /^\[(?!\[?rules\.)/.test(line);
}

/** Extract the `[[rules]]` array-of-tables blocks from TOML content. */
export function extractRulesBlocks(content: string): GitleaksRulesBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: GitleaksRulesBlock[] = [];
  let start = -1;
  for (let i = 0; i <= lines.length; i++) {
    const boundary = i === lines.length || (lines[i].startsWith('[') && isTopLevelHeader(lines[i]));
    if (boundary && start >= 0) {
      let blockEnd = i;
      while (blockEnd > start + 1 && lines[blockEnd - 1].trim() === '') blockEnd--;
      const text = lines.slice(start, blockEnd).join('\n');
      const id = text.match(/^id\s*=\s*"([^"]*)"\s*$/m)?.[1] ?? null;
      blocks.push({ id, text });
      start = -1;
    }
    if (i < lines.length && /^\[\[rules\]\]/.test(lines[i])) start = i;
  }
  return blocks;
}

/** True when the template's rule set already covers this project block:
 *  same-id blocks keep the TEMPLATE copy (template authoritative); an
 *  id-less project block survives unless the template carries its exact text. */
export function templateCoversRule(project: GitleaksRulesBlock, template: GitleaksRulesBlock[]): boolean {
  if (project.id !== null) return template.some(t => t.id === project.id);
  return template.some(t => t.id === null && t.text === project.text);
}

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
  const templateRules = extractRulesBlocks(srcContent);
  const projectOnlyRules = extractRulesBlocks(destContent).filter(r => !templateCoversRule(r, templateRules));

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
  if (projectOnlyRules.length > 0) {
    // Raw concatenation, not replace(): rule bodies are external data and a
    // `$''`-anchored regex inside a replacement STRING has the same
    // text-after-match hazard the array path fixed in v1.0.0.
    merged +=
      '\n\n# Preserved from this project\'s prior .gitleaks.toml (not in the current common template):\n' +
      projectOnlyRules.map(r => r.text).join('\n\n') + '\n';
    console.log(`  ⚠️  Preserved ${projectOnlyRules.length} project-specific [[rules]] block${projectOnlyRules.length === 1 ? '' : 's'} that the template overwrite would have dropped`);
  }
  if (!dryRun) writeFileSync(dest, merged, 'utf8');
  console.log(`  ${dryRun ? '[DRY RUN] ' : ''}WROTE: .gitleaks.toml`);
}
