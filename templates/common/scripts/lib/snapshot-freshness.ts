// @version 1.0.0
// v1.0.0 (2026-11-23, T-20261123-008 intent — spec
//          docs/designs/2026-11-23-fleet-graph-machinery-batch-design.md §3): pure
//          snapshot-freshness assessment behind the audit gate. The 2026-11-20
//          Friday FULL runner produced its manifest but silently skipped the
//          fleet-report sweep; 11-21 and 11-23 produced no runner artifacts at
//          all — the absence was invisible until a human opened the dashboard.
//          This module carries the semantics that make staleness mechanical on
//          every audit invocation (WARN > 8 days, FAIL > 15 days, missing or
//          zero-snapshot dir FAIL) with no gate-level test debt.
//
// One derivation, two callers (the spec-landing.ts discipline —
// scripts/lib/spec-landing.ts:8-12):
//   scripts/audit.ts skill-graph snapshot freshness gate (root-only,
//   auto-activating — inserted immediately after the skill-graph drift gate) and
//   tests/unit/snapshot-freshness.test.ts (fixture dirs + an INJECTED todayIso —
//   this module never reads the clock, so the suite is deterministic).

import { existsSync, readdirSync } from "node:fs";

/** WARN threshold — one full missed week of the daily 03:00 sweep, +1 day
 * grace (travel/weekend noise must not warn; a missed WEEK must). */
export const WARN_AFTER_DAYS = 8;

/** FAIL threshold — two missed weeks ≈ sustained runner failure, not noise. */
export const FAIL_AFTER_DAYS = 15;

/** Snapshot filename contract (fleet-report v2.5.0 writer):
 * `snapshot-YYYY-MM-DD.json`, one per local (KST) calendar date. Anything else
 * in the directory is ignored deterministically — a malformed name is not a
 * snapshot and never contributes to the freshness signal. */
const SNAPSHOT_NAME = /^snapshot-(\d{4}-\d{2}-\d{2})\.json$/;

/** One freshness verdict. `latest`/`ageDays` are null exactly when no snapshot
 * was found (missing dir or zero snapshots); `detail` is the human-readable
 * body the audit gate composes into its greppable message. */
export interface SnapshotFreshness {
  status: "ok" | "warn" | "fail";
  /** Latest snapshot date (YYYY-MM-DD), or null when none was found. */
  latest: string | null;
  /** Calendar-day difference between todayIso and the latest date, or null. */
  ageDays: number | null;
  /** e.g. "latest snapshot is 9 days old (snapshot-2026-11-14.json, WARN threshold 8)" */
  detail: string;
}

/**
 * Assess how stale the newest snapshot in `dir` is against `todayIso`.
 *
 * Freshness signal = committed FILENAME date, never mtime — mtimes are not
 * stable across clones (a fresh clone would false-FAIL); committed filenames
 * are facts. Latest = lexicographic maximum of the matching filename dates
 * (ISO dates sort correctly as strings). Boundary spelling (ticket language
 * "older than 8/15"): exactly 8 days → ok, 9 → warn, exactly 15 → warn,
 * 16 → fail.
 *
 * `todayIso` is injected by the caller (pure/testable); the audit call site
 * passes the KST calendar date — snapshot filenames are written in local (KST)
 * calendar dates by fleet-report.
 *
 * Failure states: directory absent → fail; zero `snapshot-YYYY-MM-DD.json`
 * entries (empty dir, or only non-matching names) → fail.
 */
export function assessSnapshotFreshness(opts: {
  dir: string;
  todayIso: string;
  warnAfterDays?: number;
  failAfterDays?: number;
}): SnapshotFreshness {
  const warnAfter = opts.warnAfterDays ?? WARN_AFTER_DAYS;
  const failAfter = opts.failAfterDays ?? FAIL_AFTER_DAYS;
  if (!existsSync(opts.dir)) {
    return {
      status: "fail",
      latest: null,
      ageDays: null,
      detail: `missing snapshot directory ${opts.dir}`,
    };
  }
  const dates: string[] = [];
  for (const entry of readdirSync(opts.dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const m = SNAPSHOT_NAME.exec(entry.name);
    if (m?.[1]) dates.push(m[1]);
  }
  if (dates.length === 0) {
    return {
      status: "fail",
      latest: null,
      ageDays: null,
      detail: `zero snapshots in ${opts.dir}`,
    };
  }
  const latest = dates.sort()[dates.length - 1]!;
  const ageDays = calendarDaysBetween(opts.todayIso, latest);
  if (ageDays > failAfter) {
    return {
      status: "fail",
      latest,
      ageDays,
      detail: `latest snapshot is ${ageDays} days old (snapshot-${latest}.json, FAIL threshold ${failAfter})`,
    };
  }
  if (ageDays > warnAfter) {
    return {
      status: "warn",
      latest,
      ageDays,
      detail: `latest snapshot is ${ageDays} days old (snapshot-${latest}.json, WARN threshold ${warnAfter})`,
    };
  }
  return {
    status: "ok",
    latest,
    ageDays,
    detail: `latest snapshot is ${ageDays} days old (snapshot-${latest}.json)`,
  };
}

/** Calendar-day difference `a - b` for two YYYY-MM-DD dates (UTC-parsed, so
 * the arithmetic never depends on the host timezone or DST). */
function calendarDaysBetween(a: string, b: string): number {
  const aMs = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const bMs = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((aMs - bMs) / 86_400_000);
}
