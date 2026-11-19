#!/usr/bin/env bun
// @version 1.0.0
// stop-gate.ts — run-id scoped kill-switch gate (meeting 2026-11-20, issue B)
//
// v1.0.0 (2026-11-20, meeting-2026-11-20-batch-runner-hardening): the watchdog
//   appends one "13:00 KST wall reached" event to .pipeline-state/automation-stop
//   EVERY day regardless of whether a run is active, so the file is always present
//   at 03:00. Two runs in a row burned judgment re-deriving stale-vs-live ("STOP-FILE
//   STALE-RECORD CONSUMPTION EXECUTED"), and a genuine pre-run stop order became
//   indistinguishable from the daily heartbeat. This gate makes the decision
//   mechanical: events older than the run start are acknowledged (moved to
//   automation-stop.history.jsonl); any event at or after the run start aborts.
//
// Usage:
//   bun scripts/stop-gate.ts --run-start <ISO8601>   # exit 1 = live stop, abort the run
//   bun scripts/stop-gate.ts --status                # report without mutating
//
// Exit codes: 0 no live stop · 1 live stop present · 2 unreadable/corrupt stop file
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATE_DIR = ".pipeline-state";
const STOP = join(STATE_DIR, "automation-stop");
const HISTORY = join(STATE_DIR, "automation-stop.history.jsonl");

type StopEvent = { reason?: string; timestamp?: string; pid?: number; run?: string };

function die(msg: string, code = 1): never {
  console.error(`✗ stop-gate: ${msg}`);
  process.exit(code);
}

function eventsOf(raw: unknown): StopEvent[] {
  if (Array.isArray(raw)) return raw as StopEvent[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events)) {
    const o = raw as { events: StopEvent[]; reason?: string; timestamp?: string; pid?: number };
    if (o.events.length > 0) return o.events;
    return [{ reason: o.reason, timestamp: o.timestamp, pid: o.pid }];
  }
  return [];
}

const argv = process.argv.slice(2);
const flag = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (!existsSync(STOP)) {
  console.log("✓ stop-gate: no stop file — run may proceed");
  process.exit(0);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(STOP, "utf8"));
} catch (e) {
  die(`stop file unparsable (${(e as Error).message}) — treating as a live stop`, 2);
}

const events = eventsOf(raw).filter((e) => typeof e.timestamp === "string");
const live = events.filter((e) => !Number.isNaN(Date.parse(e.timestamp ?? "")));

if (argv.includes("--status")) {
  console.log(`stop file: ${STOP} — ${live.length} event(s)`);
  for (const e of live.slice(-5)) console.log(`  ${e.timestamp} ${e.reason ?? ""}`);
  process.exit(0);
}

const runStartRaw = flag("run-start");
if (!runStartRaw) die("requires --run-start <ISO8601> or --status");
const runStart = Date.parse(runStartRaw);
if (Number.isNaN(runStart)) die(`--run-start '${runStartRaw}' is not a parseable timestamp`);

const liveStops = live.filter((e) => Date.parse(e.timestamp ?? "") >= runStart);
const acknowledged = live.filter((e) => Date.parse(e.timestamp ?? "") < runStart);

// Acknowledge the pre-run heartbeat records: they are historical, not orders.
if (acknowledged.length > 0) {
  writeFileSync(
    HISTORY,
    acknowledged.map((e) => JSON.stringify({ ...e, acknowledgedAt: new Date().toISOString() })).join("\n") + "\n",
    { flag: "a" },
  );
}

if (liveStops.length > 0) {
  console.error(`✗ stop-gate: ${liveStops.length} stop event(s) at/after run start ${runStartRaw}`);
  for (const e of liveStops) console.error(`   ${e.timestamp} ${e.reason ?? ""}`);
  console.error("   → graceful abort: write the report, do not merge anything further.");
  process.exit(1);
}

if (acknowledged.length > 0) {
  // Rewrite the file with only the unacknowledged residue (normally empty).
  const residue = live.filter((e) => !acknowledged.includes(e));
  if (residue.length === 0) {
    renameSync(STOP, `${STOP}.acknowledged`);
  } else {
    writeFileSync(STOP, JSON.stringify({ events: residue }, null, 1));
  }
  console.log(
    `✓ stop-gate: ${acknowledged.length} stale pre-run record(s) acknowledged → ${HISTORY}; ` +
      `${residue.length} live event(s) at/after run start`,
  );
} else {
  console.log(`✓ stop-gate: ${live.length} event(s), none at/after run start`);
}
