#!/usr/bin/env bun
// normalize-registry-provenance.ts — relabel stale provenance in project script registries.
//
// Problem (fleet inspection 2026-10-07): project `scripts/SCRIPTS.md` registries carry
// rows for variant-local and project-local scripts stamped with stale provenance
// (`source=L0 | layer=common`) inherited from the era when variant scripts were
// registered in the workspace-root registry. The true L0/L1 registries no longer list
// those scripts, so the stamps mislead readers ("why does an L2 script say L0?") and no
// pipeline keeps them honest.
//
// Normalization rules (fleet conventions already in use — co-architect rows
// `L2 | L2-only`, co-abap rows `L3 | L3`):
//   1. Script exists in templates/common/scripts (L1 delivered set) → LEAVE the row
//      untouched (its L0/L0+L1 provenance is correct).
//   2. Script is a variant-overlay path `co-<variant>/...` AND exists in
//      templates/<variant>/scripts/<path> → source=L2, layer=L2-only.
//   3. Script exists only in the project's scripts/ tree → source=L3, layer=L3.
//   4. Script exists nowhere → reported as a ghost (no auto-edit; human decides).
//
// Versions, statuses, dates and notes columns are never touched — only provenance.
// Idempotent: a second run on a normalized registry reports 0 rows.
//
// Usage:
//   bun scripts/normalize-registry-provenance.ts [--dry] [--root <project-dir>]
//     --dry   preview only (default writes scripts/SCRIPTS.md in place)
//     --root  target project (default: current working directory)
//
// Exit codes: 0 = normalized or nothing to do; 1 = fatal (no registry, ghost rows
// reported and --strict passed, or snapshot unreadable).
//
// @version 1.1.0 (2026-10-07, same spec, co-newbiz review follow-up):
//          explicit nonstandard-vocabulary handling + duplicate-row report. Rows whose
//          shape matches a registry row but whose source/layer vocabulary is a per-repo
//          convention (e.g. co-newbiz's `co-newbiz | L3-only (<prose>)` — truthful, zero
//          variant-delivered scripts) are now SKIPPED AND REPORTED explicitly instead of
//          falling out of the parse regex silently; duplicate script keys across parseable
//          rows are reported (report-only, no auto-edit — the co-newbiz dedup was done by
//          hand: 5 paste-duplicates + 1 --fix fossil).
// @version 1.0.0 (2026-10-07, spec docs/designs/2026-10-07-registry-provenance-normalization-design.md):
//          initial release — relabels fossil `L0|common` provenance in inherited project
//          registries (60 rows in co-deck); wired into upgrade-project.ts as a
//          non-fatal post-upgrade step so relabeled provenance stays truthful after
//          every future template delivery.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { ErrorPhase, fatalError, logError } from './lib/error-handling.ts';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry');
const STRICT = ARGS.includes('--strict');
const rootIdx = ARGS.indexOf('--root');
const PROJECT = rootIdx >= 0
  ? resolve(ARGS[rootIdx + 1])
  : resolve(process.cwd());

// Locate the workspace root: nearest ancestor containing templates/common/scripts.
function findWorkspaceRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'templates', 'common', 'scripts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const WS = findWorkspaceRoot(PROJECT);
if (!WS) {
  logError(fatalError(
    ErrorPhase.CLI_PARSING,
    'REGISTRY_PROVENANCE_NO_WORKSPACE_ROOT',
    `cannot locate workspace root (templates/common/scripts) above ${PROJECT}`,
    undefined,
    'Run the script from inside the workspace (a directory whose ancestor contains templates/common/scripts).',
  ));
  process.exit(1);
}

const REG = join(PROJECT, 'scripts', 'SCRIPTS.md');
if (!existsSync(REG)) {
  logError(fatalError(
    ErrorPhase.FILE_IO,
    'REGISTRY_PROVENANCE_NO_REGISTRY',
    `no scripts/SCRIPTS.md at ${REG}`,
    undefined,
    'Pass --root <project-dir> pointing at a scaffolded variant project.',
  ));
  process.exit(1);
}
const variantName = basename(PROJECT); // e.g. co-deck
const L1 = join(WS, 'templates', 'common', 'scripts');
const L2v = join(WS, 'templates', variantName, 'scripts');

const lines = readFileSync(REG, 'utf-8').split('\n');
let inRegistry = false;
let changed = 0;
const ghosts: string[] = [];
const fixes: Array<[string, string, string]> = [];
const nonstandard: string[] = [];
const rowKeyCounts = new Map<string, number>();

const out = lines.map((line) => {
  if (/^## Registry/.test(line)) { inRegistry = true; return line; }
  if (inRegistry && /^## /.test(line)) { inRegistry = false; return line; }
  if (!inRegistry) return line;

  // Bookkeeping for every registry row (also rows this tool never edits)
  if (/^\| `[^`]+` \| /.test(line)) {
    const key = line.split('|')[1].trim();
    rowKeyCounts.set(key, (rowKeyCounts.get(key) || 0) + 1);
  }

  // Row shape: | `script` | source | version | status | ... | layer | ... |
  const m = line.match(/^(\| `[^`]+` \| )(\S+)( \| \S+ \| \S+ \|[^|]*\|[^|]*\| )(\S+)( \|)/);
  if (!m) {
    if (/^\| `[^`]+` \| /.test(line)) {
      // Shape-valid row with nonstandard vocabulary (e.g. co-newbiz's
      // `co-newbiz | L3-only (<prose>)`) — a deliberate per-repo convention.
      // Leave untouched; report so the skip is a contract, not a regex accident.
      nonstandard.push(line.split('|')[1].trim());
    }
    return line;
  }
  const [, head, source, mid, layer, tail] = m;
  const script = line.match(/^`([^`]+)`/)?.[1] || line.match(/`([^`]+)`/)?.[1] || '';
  if (!script) return line;

  if (existsSync(join(L1, script))) return line; // rule 1: L1-delivered, stamp is correct

  const isVariantPath = new RegExp(`^${variantName}/`).test(script);
  const inVariantTemplate = existsSync(join(L2v, script));
  const inProject = existsSync(join(PROJECT, 'scripts', script));

  let newSource = source;
  let newLayer = layer;
  if (isVariantPath && inVariantTemplate) {           // rule 2
    newSource = 'L2';
    newLayer = 'L2-only';
  } else if (inProject) {                              // rule 3
    newSource = 'L3';
    newLayer = 'L3';
  } else {                                             // rule 4: ghost — no auto-edit
    ghosts.push(script);
    return line;
  }

  if (newSource === source && newLayer === layer) return line;
  changed++;
  fixes.push([script, `${source}|${layer}`, `${newSource}|${newLayer}`]);
  // Preserve everything after the matched span (the pair column and line tail).
  return `${head}${newSource}${mid}${newLayer}${tail}${line.slice(m[0].length)}`;
});

if (changed > 0 && !DRY) writeFileSync(REG, out.join('\n'));

console.log(`${DRY ? '[DRY] ' : ''}${basename(PROJECT)}: ${changed} row(s) normalized, ${ghosts.length} ghost(s), ${nonstandard.length} nonstandard (left untouched)`);
for (const [s, from, to] of fixes.slice(0, 8)) console.log(`  ${s}: ${from} → ${to}`);
if (fixes.length > 8) console.log(`  … +${fixes.length - 8} more`);
for (const g of ghosts) console.log(`  ⚠️ ghost (exists nowhere): ${g}`);
if (nonstandard.length > 0) {
  console.log(`  ℹ️ nonstandard row shape (per-repo convention — left untouched, review separately): ${nonstandard.slice(0, 3).join(', ')}${nonstandard.length > 3 ? ` … +${nonstandard.length - 3} more` : ''}`);
}
const dups = [...rowKeyCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
if (dups.length > 0) console.log(`  ⚠️ duplicate registry row(s) (report-only — dedup by hand): ${dups.join(', ')}`);

if (import.meta.main && STRICT && ghosts.length > 0) {
  logError(fatalError(
    ErrorPhase.AUDIT,
    'REGISTRY_PROVENANCE_GHOST_ROWS',
    `${ghosts.length} ghost row(s) exist in neither the workspace templates nor the project scripts tree`,
    ghosts.join(', '),
    'Prune the ghost rows by hand or restore the missing script files, then re-run.',
  ));
  process.exit(1);
}
