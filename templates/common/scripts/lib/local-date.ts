#!/usr/bin/env bun
// @version 1.0.0
/**
 * local-date.ts — shared local-calendar date formatter.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC-based: on hosts west of UTC an
 * evening run lands on the *next* UTC day, and a run just after local midnight
 * can still resolve to the *previous* UTC day. Anything that names a calendar
 * file or stamps a `Last Updated:` line must use the host's local calendar day
 * instead (T-20260910-030).
 *
 * Canonical users: pre-commit.ts date rewrites, dev-sync.ts memlog routing
 * (dev-sync.ts predates this helper and keeps its inline copy — consolidating it
 * is out of scope here).
 */

/** Local calendar date as `yyyy-MM-dd`. */
export function localDateISO(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
