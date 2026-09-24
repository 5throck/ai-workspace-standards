#!/usr/bin/env bun
/**
 * generate-scripts-mirror.ts — L1 SCRIPTS.md registry-table generator (L0-only)
 * @version 1.0.0
 *
 * Regenerates the registry-table span of templates/common/scripts/SCRIPTS.md
 * from the root registry (scripts/SCRIPTS.md) plus the template scripts tree.
 * The mirror is a derived PROJECTION, not a byte copy (T-20260924-001; spec
 * docs/designs/2026-09-25-propagation-engine-batch-design.md §6-D6 as amended
 * by §14 Amendment 1 — PM ruling Option (b)).
 *
 * Row rules (§6-D6, amended):
 * - R1-rule: a root registry row with normalizeLayer(layer) != "L0" (i.e.
 *   L0+L1 / L0+L1+L2 / common) is mirrored byte-for-byte, all columns
 *   including the annotation.
 * - R2-rule: the generated span contains NO L0-layer row, ever. Root rows with
 *   layer L0/L0-only are excluded — and so are the mirror's legacy L0 rows
 *   (shared root rows whose files have no template-tree copy): they are not
 *   derivable from this generator's inputs and are deleted by the one-time
 *   normalization (§14). This rule proves itself: this script is registered
 *   L0-only and must never appear in its own output.
 * - R3-rule: a .ts file under templates/common/scripts/ (recursive, keys
 *   relative to that dir, `_`-prefixed basenames excluded = test-fixture
 *   policy) with no root registry row gets a synthesized row
 *   `` | `<key>` | L0 | <@version> | active | — | — | common | — | ``. The
 *   version comes from the file's `// @version` header; unparseable → hard
 *   error.
 * - R4-rule (canonical ordering): surviving R1 rows keep root file order; the
 *   R3 synthesized group is a sorted block inserted before the first R1 row
 *   whose key is lexicographically greater than the group's keys (appended at
 *   the end of the table if none).
 * - R5-rule: one-time normalization — the FIRST run deletes the legacy L0 rows
 *   and applies the ordering corrections (a reviewed PR artifact); every
 *   subsequent run is byte-stable.
 *
 * Span definition (R15): the `| script |` header row through the last table
 * row before the next `## ` heading. All prose sections stay hand-maintained.
 *
 * Wiring: dev-sync Step 2.6 runs this in write mode (Step 2.5 idiom);
 * lifecycle-sync-audit Check B's projection arm imports the pure builder and
 * byte-compares the projection so out-of-band hand edits fail loudly with
 * `bun scripts/generate-scripts-mirror.ts` as the fix hint.
 *
 * Usage:
 *   bun scripts/generate-scripts-mirror.ts           # regenerate (write)
 *   bun scripts/generate-scripts-mirror.ts --check   # compare only; exit 0 =
 *                                                    # byte-identical, exit 1 =
 *                                                    # drift (summary printed)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolveRoot(__dirname);

function resolveRoot(dir: string): string {
  // The script lives at scripts/generate-scripts-mirror.ts → root is one up.
  return join(dir, '..');
}

const MIRROR_PATH = join(ROOT, 'templates', 'common', 'scripts', 'SCRIPTS.md');
const ROOT_SCRIPTS_MD = join(ROOT, 'scripts', 'SCRIPTS.md');
const TEMPLATE_SCRIPTS_DIR = join(ROOT, 'templates', 'common', 'scripts');

// ============================================================================
// PURE BUILDER (exported for lifecycle-sync-audit Check B projection arm)
// ============================================================================

/** One registry data row, kept byte-verbatim. */
export interface RegistryRow {
  /** Script key (backtick-stripped cell-1 value), e.g. "helpers/markers.ts". */
  key: string;
  /** The full `| ... |` line, byte-verbatim. */
  line: string;
}

/** Header + separator + data rows of a registry table (byte-verbatim lines). */
export interface RegistryTable {
  header: string;
  separator: string;
  rows: RegistryRow[];
}

/**
 * Extract the registry-table span from a SCRIPTS.md content string
 * (R15): the `| script |` header row through the last consecutive table row.
 * Returns null when no `| script |` header row exists.
 * Pure: no filesystem access.
 */
export function extractRegistrySpan(content: string): string | null {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.startsWith('| script |'));
  if (start === -1) return null;
  let end = start; // inclusive index of the last table row
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('|')) end = i;
    else break;
  }
  return lines.slice(start, end + 1).join('\n');
}

/**
 * Parse the registry table (header/separator/rows) from a SCRIPTS.md content
 * string. Mirrors the column conventions of scripts/helpers/layer-filter.ts
 * (script | source | version | status | removal-date | security-advisory |
 * layer | pair) with dynamic header-column resolution.
 * Pure: no filesystem access.
 */
export function parseRegistryTable(content: string): RegistryTable | null {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.startsWith('| script |'));
  if (start === -1) return null;

  const header = lines[start];
  const separator = lines[start + 1] ?? '';
  if (!separator.startsWith('|')) return null;

  // Dynamic column resolution from the header row (same convention as
  // lifecycle-sync-audit parseScriptsMdRegistry).
  const headerCols = header.split('|').map((c) => c.trim());
  let layerColIdx = -1;
  for (let i = 1; i < headerCols.length; i++) {
    if (headerCols[i].toLowerCase() === 'layer') layerColIdx = i;
  }

  const rows: RegistryRow[] = [];
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) break; // end of the contiguous table
    const cells = line.split('|').map((c) => c.trim());
    const rawName = cells[1] ?? '';
    if (!rawName.startsWith('`')) continue; // not a data row
    rows.push({ key: rawName.replace(/`/g, '').trim(), line });
    void layerColIdx; // layer read happens per-row below
  }
  return { header, separator, rows };
}

/** Read a row's layer cell and normalize it (layer-filter.ts semantics). */
function normalizeLayer(rowLine: string): string {
  const cells = rowLine.split('|').map((c) => c.trim());
  // Fixed layout per the registry contract: [ '', script, source, version,
  // status, removal-date, security-advisory, layer, pair, '' ].
  const raw = cells[7] ?? '';
  if (raw === 'L0' || raw === 'L0-only') return 'L0';
  return raw; // L0+L1 / L0+L1+L2 / common — anything non-L0 mirrors (R1)
}

/** Extract the version from a `// @version X.Y.Z` header. Hard error if absent. */
function requireFileVersion(filePath: string, key: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/@version\s+([\d.]+)/);
  if (!match) {
    throw new Error(
      `[generate-scripts-mirror] template-tree file has no parseable '// @version' header: ${key} (${filePath}) — add the header or register the script in scripts/SCRIPTS.md`
    );
  }
  return match[1];
}

/** Recursively collect template-tree .ts keys (R3 scan; `_`-prefixed excluded). */
function collectTemplateTsKeys(dir: string, baseDir: string, out: string[], depth = 0): void {
  if (depth > 8) return; // runaway-recursion bound (T-20260910-026 convention)
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTemplateTsKeys(fullPath, baseDir, out, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (entry.name.startsWith('_')) continue; // R17: test-fixture policy
      out.push(relative(baseDir, fullPath).split('\\').join('/'));
    }
  }
}

/** Exact byte format of a synthesized mirror-only row (§6-D6 R3-rule). */
export function synthesizeMirrorRow(key: string, version: string): string {
  return `| \`${key}\` | L0 | ${version} | active | — | — | common | — |`;
}

/**
 * Build the generated registry-table span for templates/common/scripts/SCRIPTS.md
 * from the root registry content plus the template scripts directory.
 *
 * Pure and deterministic (R18): identical inputs produce byte-identical output.
 * Pure in the filesystem-read sense: it reads `templateScriptsDir` (a declared
 * input, not hidden state) and never writes.
 *
 * Rules: §6-D6 R1–R5 as amended by §14 Amendment 1 (see module docblock).
 */
export function buildMirrorRegistrySpan(rootContent: string, templateScriptsDir: string): string {
  const table = parseRegistryTable(rootContent);
  if (!table) {
    throw new Error('[generate-scripts-mirror] no `| script |` header row found in root SCRIPTS.md content');
  }

  // R1-rule + R2-rule: keep non-L0 root rows byte-for-byte, in root file order.
  const surviving: RegistryRow[] = table.rows.filter((r) => normalizeLayer(r.line) !== 'L0');
  const rootKeys = new Set(table.rows.map((r) => r.key));

  // R3-rule: template-tree .ts files with no root registry row → synthesized rows.
  const templateKeys: string[] = [];
  collectTemplateTsKeys(templateScriptsDir, templateScriptsDir, templateKeys);
  const mirrorOnly = templateKeys
    .filter((k) => !rootKeys.has(k))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const synthesized: RegistryRow[] = mirrorOnly.map((k) => ({
    key: k,
    line: synthesizeMirrorRow(k, requireFileVersion(join(templateScriptsDir, k), k)),
  }));

  // R4-rule (canonical ordering): insert the sorted R3 block before the first
  // R1 row whose key is lexicographically greater than the group's keys.
  const result = [...surviving];
  if (synthesized.length > 0) {
    const groupMax = synthesized[synthesized.length - 1].key;
    const insertIdx = result.findIndex((r) => r.key > groupMax);
    const at = insertIdx === -1 ? result.length : insertIdx;
    result.splice(at, 0, ...synthesized);
  }

  return [table.header, table.separator, ...result.map((r) => r.line)].join('\n');
}

// ============================================================================
// CLI (import-safe: dispatch under import.meta.main)
// ============================================================================

interface DriftSummary {
  changed: boolean;
  /** Keys present in the actual span but absent from the projection. */
  removed: string[];
  /** Keys present in the projection but absent from the actual span. */
  added: string[];
  /** Keys whose row line differs between the two spans. */
  modified: string[];
  /** True when the row sets are equal but their order differs (relocations). */
  reordered: boolean;
}

function summarizeDrift(actual: string, expected: string): DriftSummary {
  const rowsOf = (span: string): Map<string, string> => {
    const map = new Map<string, string>();
    for (const line of span.split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      const raw = cells[1] ?? '';
      if (raw.startsWith('`')) map.set(raw.replace(/`/g, '').trim(), line);
    }
    return map;
  };
  const orderOf = (span: string): string[] =>
    span.split('\n')
      .map((line) => {
        const raw = line.split('|')[1]?.trim() ?? '';
        return raw.startsWith('`') ? raw.replace(/`/g, '').trim() : '';
      })
      .filter((k) => k !== '' && k !== 'script');
  const a = rowsOf(actual);
  const e = rowsOf(expected);
  const removed: string[] = [];
  const modified: string[] = [];
  for (const [key, line] of a) {
    if (!e.has(key)) removed.push(key);
    else if (e.get(key) !== line) modified.push(key);
  }
  const added = [...e.keys()].filter((k) => !a.has(k));
  const reordered =
    removed.length === 0 && added.length === 0 && modified.length === 0 &&
    orderOf(actual).join('\u0000') !== orderOf(expected).join('\u0000');
  return { changed: actual !== expected, removed, added, modified, reordered };
}

function printDriftSummary(summary: DriftSummary): void {
  const cap = (keys: string[]) => keys.slice(0, 10).join(', ') + (keys.length > 10 ? `, … +${keys.length - 10} more` : '');
  console.error(`Registry span drift: ${summary.removed.length} row(s) on disk not in projection, ${summary.added.length} row(s) in projection not on disk, ${summary.modified.length} modified row(s)${summary.reordered ? ', row order differs (relocation pending)' : ''}.`);
  if (summary.removed.length > 0) console.error(`  on-disk only (${summary.removed.length}): ${cap(summary.removed)}`);
  if (summary.added.length > 0) console.error(`  projection only (${summary.added.length}): ${cap(summary.added)}`);
  if (summary.modified.length > 0) console.error(`  modified (${summary.modified.length}): ${cap(summary.modified)}`);
  console.error(`Drift region: the | script | registry-table span of templates/common/scripts/SCRIPTS.md (header row through the last table row).`);
}

export async function runCli(args: string[]): Promise<number> {
  const checkOnly = args.includes('--check');

  if (!existsSync(ROOT_SCRIPTS_MD)) {
    console.error(`[generate-scripts-mirror] root registry not found: ${ROOT_SCRIPTS_MD}`);
    return 1;
  }
  if (!existsSync(TEMPLATE_SCRIPTS_DIR)) {
    console.error(`[generate-scripts-mirror] template scripts dir not found: ${TEMPLATE_SCRIPTS_DIR}`);
    return 1;
  }

  const rootContent = readFileSync(ROOT_SCRIPTS_MD, 'utf-8');
  let expected: string;
  try {
    expected = buildMirrorRegistrySpan(rootContent, TEMPLATE_SCRIPTS_DIR);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  if (!existsSync(MIRROR_PATH)) {
    console.error(`[generate-scripts-mirror] mirror not found: ${MIRROR_PATH}`);
    return 1;
  }
  const mirrorContent = readFileSync(MIRROR_PATH, 'utf-8');
  const actual = extractRegistrySpan(mirrorContent);
  if (actual === null) {
    console.error(`[generate-scripts-mirror] no \`| script |\` header row found in ${MIRROR_PATH} — cannot locate the generated span`);
    return 1;
  }

  if (actual === expected) {
    console.log(`✓ templates/common/scripts/SCRIPTS.md registry span matches the projection (${expected.split('\n').length - 2} rows)${checkOnly ? '' : ' — nothing to write'}`);
    return 0;
  }

  const summary = summarizeDrift(actual, expected);
  if (checkOnly) {
    console.error(`✗ templates/common/scripts/SCRIPTS.md registry span drifted from the projection.`);
    printDriftSummary(summary);
    console.error(`Fix: bun scripts/generate-scripts-mirror.ts`);
    return 1;
  }

  // Write mode: splice the generated span in place of the actual span,
  // preserving every byte outside it (prose sections stay hand-maintained).
  const lines = mirrorContent.split('\n');
  const start = lines.findIndex((l) => l.startsWith('| script |'));
  let end = start;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('|')) end = i;
    else break;
  }
  lines.splice(start, end - start + 1, ...expected.split('\n'));
  writeFileSync(MIRROR_PATH, lines.join('\n'), 'utf-8');
  console.log(`✅ templates/common/scripts/SCRIPTS.md registry span regenerated: ${summary.removed.length} removed, ${summary.added.length} added, ${summary.modified.length} modified row(s) → ${expected.split('\n').length - 2} rows`);
  return 0;
}

if (import.meta.main) {
  process.exit(await runCli(process.argv.slice(2)));
}
