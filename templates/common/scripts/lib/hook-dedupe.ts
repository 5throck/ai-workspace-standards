/**
 * Hook-entry dedupe + drift analysis for `.claude/settings.json` (L0+L1).
 *
 * U-20261031-008 (spec docs/designs/2026-10-31-template-security-hardening-design.md
 * R2.6): variant `.claude/settings.json` files accumulated duplicate hook entries —
 * `graft install` appends hook blocks and the upgrade JSON_MERGE pass (array union)
 * does not dedupe (co-consult / co-deck carried 5 SessionStart entries where the
 * template has 2). Two consumers:
 *
 *   1. `dedupeClaudeSettingsHooks()` — upgrade-project's JSON_MERGE pass collapses
 *      exact-duplicate (event, matcher, command) entries before the merged payload
 *      lands, so the merge can no longer accumulate. First occurrence wins; distinct
 *      commands are preserved. This also heals already-accumulated files on their
 *      next upgrade visit.
 *   2. `analyzeClaudeHookDrift()` — lifecycle-sync-audit (Check I) reports, WARN-first
 *      per ADR-0055: (a) an exact-duplicate (event, matcher, command) pair within one
 *      event, and (b) an event whose entry count exceeds the common-template count.
 *
 * Deduplication is WITHIN-EVENT only: the intentional cross-event pairs (SessionStart
 * vs WorktreeCreate both carrying `git config core.hooksPath .githooks`; PostToolUse vs
 * TeammateIdle both carrying post-write-lifecycle-check) are never flagged or merged.
 *
 * Key semantics: matcher is normalized to '' when absent; an entry is identified by
 * its (matcher, command-sequence) — only byte-equal repeats are exact duplicates.
 *
 * @version 1.0.0
 */

/** One duplicated hook command, located by event + normalized matcher. */
export interface HookRef {
  /** Hook event name, e.g. `SessionStart`. */
  event: string;
  /** Normalized matcher ('' when the entry declares none). */
  matcher: string;
  /** The duplicated command string. */
  command: string;
}

export interface DedupeResult {
  /** The settings object with exact-duplicate hook entries collapsed. */
  settings: Record<string, unknown>;
  /** One ref per command carried by a removed (duplicate) entry. */
  removed: HookRef[];
}

export interface HookDuplicateGroup {
  /** Hook event name. */
  event: string;
  /** Commands that appear more than once within this event (deduped, first-seen order). */
  commands: string[];
}

export interface HookOverCount {
  /** Hook event name. */
  event: string;
  /** Entry count in the local (project/workspace) settings. */
  localCount: number;
  /** Entry count in the common template (0 when the event is template-absent). */
  templateCount: number;
  /** Commands present locally whose (matcher, command) the template lacks. */
  excessCommands: string[];
}

export interface HookDriftReport {
  /** Arm (a): events carrying exact-duplicate (matcher, command) pairs. */
  duplicates: HookDuplicateGroup[];
  /** Arm (b): events whose entry count exceeds the template count (template known only). */
  overCount: HookOverCount[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface NormalizedHookEntry {
  matcher: string;
  /** Command strings of the entry's inner hooks, in order ('' for hooks without a command). */
  commands: string[];
}

function normalizeEntries(eventValue: unknown): NormalizedHookEntry[] {
  if (!Array.isArray(eventValue)) return [];
  const entries: NormalizedHookEntry[] = [];
  for (const entry of eventValue) {
    if (!isPlainObject(entry)) continue;
    const matcher = typeof entry.matcher === 'string' ? entry.matcher : '';
    const inner = Array.isArray(entry.hooks) ? entry.hooks : [];
    const commands = inner.map((h) => (isPlainObject(h) && typeof h.command === 'string' ? h.command : ''));
    entries.push({ matcher, commands });
  }
  return entries;
}

/** Identity of one entry: matcher + full command sequence (exact duplicates only). */
function entrySignature(e: NormalizedHookEntry): string {
  return JSON.stringify([e.matcher, e.commands]);
}

/** Identity of one command within an event (arm-(a) duplicate key). */
function commandKey(matcher: string, command: string): string {
  return JSON.stringify([matcher, command]);
}

/**
 * Collapse exact-duplicate hook entries in a parsed `.claude/settings.json`.
 * Keyed on (event, matcher, command sequence); first occurrence wins; distinct
 * commands are preserved. Everything outside `hooks` is returned untouched.
 * Pure — returns a new object; never mutates the input.
 */
export function dedupeClaudeSettingsHooks(settings: unknown): DedupeResult {
  const removed: HookRef[] = [];
  if (!isPlainObject(settings) || !isPlainObject(settings.hooks)) {
    return { settings: isPlainObject(settings) ? settings : {}, removed };
  }
  const hooks = settings.hooks;
  const nextHooks: Record<string, unknown> = { ...hooks };
  for (const [event, eventValue] of Object.entries(hooks)) {
    if (!Array.isArray(eventValue)) continue;
    const seen = new Set<string>();
    const kept: unknown[] = [];
    for (const entry of eventValue) {
      if (!isPlainObject(entry)) {
        kept.push(entry);
        continue;
      }
      const matcher = typeof entry.matcher === 'string' ? entry.matcher : '';
      const inner = Array.isArray(entry.hooks) ? entry.hooks : [];
      const commands = inner.map((h) => (isPlainObject(h) && typeof h.command === 'string' ? h.command : ''));
      const sig = entrySignature({ matcher, commands });
      if (seen.has(sig)) {
        for (const command of commands) removed.push({ event, matcher, command });
        continue; // exact duplicate — first occurrence wins
      }
      seen.add(sig);
      kept.push(entry);
    }
    nextHooks[event] = kept;
  }
  return { settings: { ...settings, hooks: nextHooks }, removed };
}

/**
 * Drift analysis for lifecycle-sync-audit Check I (pure; fixture-testable).
 *
 * Arm (a) — `duplicates`: per event, any (matcher, command) appearing in more
 * than one place within the event. Cross-event repeats are intentional and
 * never reported.
 *
 * Arm (b) — `overCount`: per event, the local entry count vs the template
 * entry count; reported when local exceeds template. Pass `template = null`
 * when no common-template settings file exists (L1 context) — arm (b) is then
 * skipped entirely and only arm (a) runs.
 */
export function analyzeClaudeHookDrift(local: unknown, template: unknown | null): HookDriftReport {
  const report: HookDriftReport = { duplicates: [], overCount: [] };
  if (!isPlainObject(local) || !isPlainObject(local.hooks)) return report;

  // Arm (a): within-event exact-duplicate (matcher, command) pairs.
  for (const [event, eventValue] of Object.entries(local.hooks)) {
    const entries = normalizeEntries(eventValue);
    const counts = new Map<string, { n: number; command: string }>();
    for (const e of entries) {
      for (const command of e.commands) {
        const key = commandKey(e.matcher, command);
        const hit = counts.get(key);
        if (hit) hit.n += 1;
        else counts.set(key, { n: 1, command });
      }
    }
    const dupCommands = [...counts.values()].filter((c) => c.n > 1).map((c) => c.command);
    if (dupCommands.length > 0) {
      report.duplicates.push({ event, commands: dupCommands });
    }
  }

  // Arm (b): per-event entry count exceeding the common-template count.
  if (template !== null && isPlainObject(template) && isPlainObject(template.hooks)) {
    for (const [event, eventValue] of Object.entries(local.hooks)) {
      const localEntries = normalizeEntries(eventValue);
      if (localEntries.length === 0) continue;
      const templateEntries = normalizeEntries(template.hooks[event]);
      if (localEntries.length <= templateEntries.length) continue;
      const templateKeys = new Set(templateEntries.flatMap((e) => e.commands.map((c) => commandKey(e.matcher, c))));
      const excess = [...new Set(
        localEntries.flatMap((e) => e.commands.filter((c) => !templateKeys.has(commandKey(e.matcher, c)))),
      )];
      report.overCount.push({
        event,
        localCount: localEntries.length,
        templateCount: templateEntries.length,
        excessCommands: excess,
      });
    }
  }

  return report;
}
