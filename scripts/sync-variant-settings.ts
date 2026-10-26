#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-10-26, T-20261026-016): SyncResult gains `pruned` — empty groups left by
//           removals set changed=true without touching any entry counter, so --check read
//           them as in-sync; drifts() now counts prunes and check mode reports them.
// v1.1.1 (2026-10-22, drift repair — spec 2026-10-17-pm-dispatch-gate-design §7 Addendum):
//           VARIANTS gains 'co-learning' (variant added in 89b39266 after the v1.1.0
//           list was written, so its settings never received the managed sync; both
//           its .claude PreToolUse and .gemini BeforeTool pm-dispatch-gate entries
//           were missing). No logic changes.
// v1.1.0 (2026-10-18, PM dispatch gate propagation — spec 2026-10-17-pm-dispatch-gate-design §7):
//           MANAGED_SUBSTRINGS gains 'pm-dispatch-gate'; the managed-entry sync generalizes from
//           SessionStart/.claude-only to all managed entries across events
//           {claude: SessionStart, PreToolUse} and {gemini: SessionStart, BeforeTool} over all 13
//           variant settings files. Gemini SessionStart legitimately mixes flat hook entries and
//           group objects (identical to L0 — not drift): managed entries are group-wrapped, and
//           flat non-managed entries are preserved byte-for-value. `syncManagedSessionStart` is
//           retained as a SessionStart wrapper so the v1.0.0 test contract carries over.
// v1.0.0 (2026-10-02, T-20261002-011): sync MANAGED SessionStart hook entries from
//           templates/common/.claude/settings.json into every variant's
//           .claude/settings.json. JSON files cannot host marker zones (no comments),
//           so this is a dedicated structured sync instead of a propagation-map
//           marker-inject domain. Entries are matched by a stable command substring
//           (MANAGED_SUBSTRINGS); everything else in the variant file is untouched.
//           `--check` reports drift and exits 1 (audit gate); default applies.
// @l2-propagate: false
// Design: docs/designs/2026-10-17-pm-dispatch-gate-design.md §7 (v1.1.0);
//         docs/designs/2026-10-02-upstream-review-backlog-remediations-design.md §C2 (v1.0.0)

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');

const VARIANTS = [
  'co-abap', 'co-consult', 'co-deck', 'co-design', 'co-develop', 'co-export',
  'co-game', 'co-hr', 'co-learning', 'co-news', 'co-price', 'co-safety',
  'co-security', 'co-work',
] as const;

type Platform = 'claude' | 'gemini';

/** The events this script manages, per platform. A pair (platform, event) names one
 * managed channel: common's managed entries for that event are the sync source. */
export const SYNC_TARGETS: ReadonlyArray<{ platform: Platform; event: string }> = [
  { platform: 'claude', event: 'SessionStart' },
  { platform: 'claude', event: 'PreToolUse' },
  { platform: 'gemini', event: 'SessionStart' },
  { platform: 'gemini', event: 'BeforeTool' },
];

/** A variant hook entry is "managed" when its command contains one of these
 * substrings — the stable identity used to pair common and variant entries. */
export const MANAGED_SUBSTRINGS: readonly string[] = ['pm-role-bootstrap', 'pm-dispatch-gate'];

export function isManaged(command: string): boolean {
  return MANAGED_SUBSTRINGS.some((s) => command.includes(s));
}

interface HookEntry { type?: string; command?: string; timeout?: number; [k: string]: unknown }
interface HookGroup { matcher?: string; hooks?: HookEntry[]; [k: string]: unknown }
interface Settings { hooks?: { [event: string]: unknown }; [k: string]: unknown }

/** Managed hook entries living under one event channel of a settings file.
 * Only group-shaped entries (`hooks` array) are scanned: managed entries are
 * group-wrapped by contract (v1.1.0), so a flat sibling entry is never treated
 * as a managed source. */
function managedEntries(settings: Settings, event: string): HookEntry[] {
  const out: HookEntry[] = [];
  const list = settings.hooks?.[event];
  if (!Array.isArray(list)) return out;
  for (const group of list as HookGroup[]) {
    if (!Array.isArray(group.hooks)) continue; // flat entry — not a managed channel
    for (const hook of group.hooks) {
      if (typeof hook.command === 'string' && isManaged(hook.command)) out.push(hook);
    }
  }
  return out;
}

export interface SyncResult {
  changed: boolean;
  settings: Settings;
  added: number;
  updated: number;
  removed: number;
  /** T-20261026-016: group-shaped entries emptied by removals and pruned — a
   * prune changes the file without touching any entry counter, so check mode
   * must count it as drift or an emptied group stays silently unpruned. */
  pruned: number;
}

/** Stable-prefix family test kept identical to v1.0.0 (`command.slice(0, 30)`):
 * a stale managed entry is a "same family" when its command embeds the wanted
 * command's 30-char prefix. The two managed commands (`pm-role-bootstrap.ts`,
 * `pm-dispatch-gate.ts`) do not collide at that prefix length. */
function sameFamily(wanted: string, seen: string): boolean {
  return seen.includes(wanted.slice(0, 30));
}

/** Merges the common file's managed entries for ONE event channel into a variant's
 * settings: managed entries must EQUAL the source (JSON-wise); stale variants are
 * replaced in place, missing ones appended as a new matcher group, extraneous managed
 * duplicates removed. Flat entries and all non-managed content are preserved
 * byte-for-value; empty groups left by removals are pruned (flat entries never are). */
export function syncManagedEntries(common: Settings, variant: Settings, event: string): SyncResult {
  const wanted = managedEntries(common, event);
  const result: SyncResult = { changed: false, settings: variant, added: 0, updated: 0, removed: 0, pruned: 0 };
  const hooks = variant.hooks ?? (variant.hooks = {});
  const list: HookGroup[] = Array.isArray(hooks[event]) ? (hooks[event] as HookGroup[]) : (hooks[event] = []);

  for (const group of list) {
    if (!Array.isArray(group.hooks)) continue; // flat entry — preserve verbatim
    for (let i = group.hooks.length - 1; i >= 0; i--) {
      const hook = group.hooks[i];
      if (typeof hook.command !== 'string' || !isManaged(hook.command)) continue;
      const match = wanted.find((w) => JSON.stringify(w) === JSON.stringify(hook));
      if (match) {
        wanted.splice(wanted.indexOf(match), 1); // satisfied verbatim
      } else if (wanted.some((w) => typeof w.command === 'string' && sameFamily(w.command!, hook.command!))) {
        const w = wanted.find((x) => typeof x.command === 'string' && sameFamily(x.command!, hook.command!))!;
        group.hooks[i] = w; // stale → replace in place
        wanted.splice(wanted.indexOf(w), 1);
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
    list.push({ hooks: [...wanted] });
    result.added = wanted.length;
    result.changed = true;
  }
  // drop group-shaped entries the removals may have emptied; flat entries are kept
  const isLiveGroup = (g: HookGroup): boolean => !Array.isArray(g.hooks) || g.hooks.length > 0;
  const dead = list.filter((g) => !isLiveGroup(g)).length;
  if (dead > 0) {
    result.pruned = dead;
    result.changed = true;
  }
  (variant.hooks as Record<string, unknown>)[event] = (list as HookGroup[]).filter(isLiveGroup);
  return result;
}

/** v1.0.0 API retained as a wrapper: managed SessionStart entries only. */
export function syncManagedSessionStart(common: Settings, variant: Settings): SyncResult {
  return syncManagedEntries(common, variant, 'SessionStart');
}

function settingsPath(rootDir: string, variant: string, platform: Platform): string {
  return join(rootDir, 'templates', variant, `.${platform}`, 'settings.json');
}

export function drifts(rootDir: string): string[] {
  const out: string[] = [];
  for (const platform of ['claude', 'gemini'] as const) {
    const commonPath = settingsPath(rootDir, 'common', platform);
    if (!existsSync(commonPath)) { out.push(`templates/common/.${platform}/settings.json missing`); continue; }
    const common = JSON.parse(readFileSync(commonPath, 'utf-8')) as Settings;
    for (const v of VARIANTS) {
      const p = settingsPath(rootDir, v, platform);
      if (!existsSync(p)) { out.push(`templates/${v}/.${platform}/settings.json missing`); continue; }
      let total = { added: 0, updated: 0, removed: 0, pruned: 0 };
      const variant = JSON.parse(readFileSync(p, 'utf-8')) as Settings;
      for (const { event } of SYNC_TARGETS.filter((t) => t.platform === platform)) {
        const merged = syncManagedEntries(common, JSON.parse(JSON.stringify(variant)), event);
        total = { added: total.added + merged.added, updated: total.updated + merged.updated, removed: total.removed + merged.removed, pruned: total.pruned + merged.pruned };
      }
      if (total.added + total.updated + total.removed + total.pruned > 0) {
        out.push(`templates/${v}/.${platform}/settings.json drifts (added ${total.added}, updated ${total.updated}, removed ${total.removed}, pruned ${total.pruned})`);
      }
    }
  }
  return out;
}

function main(): void {
  const check = process.argv.includes('--check');
  const root = process.env.TICKET_WORKSPACE_ROOT ?? WORKSPACE_ROOT; // test seam, same pattern as ticket.ts
  if (check) {
    const found = drifts(root);
    if (found.length > 0) {
      console.error(`❌ variant settings.json managed-hook drift (${found.length}):`);
      for (const f of found) console.error(`   ${f}`);
      console.error('   Remedy: bun scripts/sync-variant-settings.ts');
      process.exit(1);
    }
    console.log(`✅ variant settings.json managed hooks: ${VARIANTS.length} variants × ${SYNC_TARGETS.length} channels in sync with templates/common.`);
    return;
  }
  let touched = 0;
  for (const platform of ['claude', 'gemini'] as const) {
    const commonPath = settingsPath(root, 'common', platform);
    if (!existsSync(commonPath)) { console.log(`  ⚠️  templates/common/.${platform}/settings.json missing, skipping ${platform}`); continue; }
    const common = JSON.parse(readFileSync(commonPath, 'utf-8')) as Settings;
    for (const v of VARIANTS) {
      const p = settingsPath(root, v, platform);
      if (!existsSync(p)) { console.log(`  ⚠️  templates/${v}/.${platform}/settings.json missing, skipping`); continue; }
      const variant = JSON.parse(readFileSync(p, 'utf-8')) as Settings;
      let res = { added: 0, updated: 0, removed: 0, changed: false };
      for (const { event } of SYNC_TARGETS.filter((t) => t.platform === platform)) {
        const r = syncManagedEntries(common, variant, event);
        res = { added: res.added + r.added, updated: res.updated + r.updated, removed: res.removed + r.removed, changed: res.changed || r.changed };
      }
      if (res.changed) {
        const tmp = `${p}.tmp-${process.pid}`;
        writeFileSync(tmp, JSON.stringify(variant, null, 2) + '\n', 'utf-8');
        renameSync(tmp, p);
        console.log(`  ✓ templates/${v}/.${platform}/settings.json — added ${res.added}, updated ${res.updated}, removed ${res.removed}`);
        touched++;
      } else {
        console.log(`  —  templates/${v}/.${platform}/settings.json in sync`);
      }
    }
  }
  console.log(`\n${touched === 0 ? 'All variant settings in sync.' : `${touched} variant file(s) updated.`}`);
}

if (import.meta.main) main();
