#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-08, ticket KST unification): Korea Standard Time (UTC+09:00, no DST)
//          date/timestamp helpers for ticket and upstream request ids and timestamps.
//          The offset is applied arithmetically, so results never depend on the machine TZ.
// Design: docs/designs/2026-10-08-ticket-kst-timezone-design.md

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST calendar date as YYYY-MM-DD. */
export function kstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO-8601 timestamp with milliseconds and an explicit +09:00 offset. */
export function kstIso(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, -1) + '+09:00';
}
