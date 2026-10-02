#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-02, T-20261002-011): sync MANAGED SessionStart hook entries from
//           templates/common/.claude/settings.json into every variant's
//           .claude/settings.json. JSON files cannot host marker zones (no comments),
//           so this is a dedicated structured sync instead of a propagation-map
//           marker-inject domain. Entries are matched by a stable command substring
//           (MANAGED_SUBSTRINGS); everything else in the variant file is untouched.
//           `--check` reports drift and exits 1 (audit gate); default applies.
// @l2-propagate: false
// Design: docs/designs/2026-10-02-upstream-review-backlog-remediations-design.md §C2

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');

const COMMON_SETTINGS = join('templates', 'common', '.claude', 'settings.json');
const VARIANTS = [
  'co-abap', 'co-consult', 'co-deck', 'co-design', 'co-develop', 'co-export',
  'co-game', 'co-hr', 'co-news', 'co-price', 'co-safety', 'co-security', 'co-work',
];

/** A variant hook entry is "managed" when its command contains one of these
 * substrings — the stable identity used to pair common and variant entries. */
export const MANAGED_SUBSTRINGS = ['pm-role-bootstrap'] as const;

export function isManaged(command: string): boolean {
  return MANAGED_SUBSTRINGS.some((s) => command.includes(s));
}

interface HookEntry { type?: string; command?: string; timeout?: number; [k: string]: unknown }
interface HookGroup { matcher?: string; hooks?: HookEntry[] }
interface Settings { hooks?: { SessionStart?: HookGroup[]; [event: string]: unknown }; [k: string]: unknown }

function managedEntries(settings: Settings): HookEntry[] {
  const out: HookEntry[] = [];
  for (const group of settings.hooks?.SessionStart ?? []) {
    for (const hook of group.hooks ?? []) {
      if (typeof hook.command === 'string' && isManaged(hook.command)) out.push(hook);
    }
  }
  return out;
}

export interface SyncResult { changed: boolean; settings: Settings; added: number; updated: number; removed: number }

/** Merges the common file's managed SessionStart entries into a variant's settings:
 * managed entries must EQUAL the source (JSON-wise); stale variants are replaced in
 * place, missing ones appended as a new matcher group, extraneous managed duplicates
 * removed. Non-managed content is preserved byte-for-value. */
export function syncManagedSessionStart(common: Settings, variant: Settings): SyncResult {
  const wanted = managedEntries(common);
  const result: SyncResult = { changed: false, settings: variant, added: 0, updated: 0, removed: 0 };
  const hooks = variant.hooks ?? (variant.hooks = {});
  const sessionStart: HookGroup[] = Array.isArray(hooks.SessionStart) ? hooks.SessionStart : (hooks.SessionStart = []);

  for (const group of sessionStart) {
    group.hooks = group.hooks ?? [];
    for (let i = group.hooks.length - 1; i >= 0; i--) {
      const hook = group.hooks[i];
      if (typeof hook.command !== 'string' || !isManaged(hook.command)) continue;
      const match = wanted.find((w) => JSON.stringify(w) === JSON.stringify(hook));
      if (match) {
        wanted.splice(wanted.indexOf(match), 1); // satisfied verbatim
      } else if (wanted.some((w) => typeof w.command === 'string' && hook.command!.includes(w.command!.slice(0, 30)))) {
        group.hooks[i] = wanted.find((w) => hook.command!.includes(w.command!.slice(0, 30)))!; // stale → replace in place
        wanted.splice(wanted.findIndex((w) => hook.command!.includes(w.command!.slice(0, 30))), 1);
        result.updated++;
        result.changed = true;
      } else {
        group.hooks.splice(i, 1); // managed entry with no common counterpart → drop
        result.removed++;
        result.changed = true;
      }
    }
  }
  if (wanted.length > 0) {
    sessionStart.push({ hooks: [...wanted] });
    result.added = wanted.length;
    result.changed = true;
  }
  // drop empty groups the removals may have left behind
  variant.hooks!.SessionStart = sessionStart.filter((g) => (g.hooks ?? []).length > 0);
  return result;
}

export function drifts(rootDir: string): string[] {
  const common = JSON.parse(readFileSync(join(rootDir, COMMON_SETTINGS), 'utf-8')) as Settings;
  const out: string[] = [];
  for (const v of VARIANTS) {
    const p = join(rootDir, 'templates', v, '.claude', 'settings.json');
    if (!existsSync(p)) { out.push(`templates/${v}/.claude/settings.json missing`); continue; }
    const variant = JSON.parse(readFileSync(p, 'utf-8')) as Settings;
    const merged = syncManagedSessionStart(common, JSON.parse(JSON.stringify(variant)));
    if (merged.changed) out.push(`templates/${v}/.claude/settings.json drifts (added ${merged.added}, updated ${merged.updated}, removed ${merged.removed})`);
  }
  return out;
}

function main(): void {
  const check = process.argv.includes('--check');
  const root = process.env.TICKET_WORKSPACE_ROOT ?? WORKSPACE_ROOT; // test seam, same pattern as ticket.ts
  if (check) {
    const found = drifts(root);
    if (found.length > 0) {
      console.error(`❌ variant settings.json SessionStart drift (${found.length}):`);
      for (const f of found) console.error(`   ${f}`);
      console.error('   Remedy: bun scripts/sync-variant-settings.ts');
      process.exit(1);
    }
    console.log(`✅ variant settings.json SessionStart: ${VARIANTS.length} variants in sync with templates/common.`);
    return;
  }
  const common = JSON.parse(readFileSync(join(root, COMMON_SETTINGS), 'utf-8')) as Settings;
  let touched = 0;
  for (const v of VARIANTS) {
    const p = join(root, 'templates', v, '.claude', 'settings.json');
    if (!existsSync(p)) { console.log(`  ⚠️  templates/${v}/.claude/settings.json missing, skipping`); continue; }
    const variant = JSON.parse(readFileSync(p, 'utf-8')) as Settings;
    const res = syncManagedSessionStart(common, variant);
    if (res.changed) {
      const tmp = `${p}.tmp-${process.pid}`;
      writeFileSync(tmp, JSON.stringify(variant, null, 2) + '\n', 'utf-8');
      renameSync(tmp, p);
      console.log(`  ✓ templates/${v}/.claude/settings.json — added ${res.added}, updated ${res.updated}, removed ${res.removed}`);
      touched++;
    } else {
      console.log(`  —  templates/${v}/.claude/settings.json in sync`);
    }
  }
  console.log(`\n${touched === 0 ? 'All variants in sync.' : `${touched} variant file(s) updated.`}`);
}

if (import.meta.main) main();
