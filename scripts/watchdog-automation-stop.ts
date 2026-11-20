#!/usr/bin/env bun
// @version 1.1.0
// watchdog-automation-stop.ts — the out-of-process degraded-mode kill-switch for
// the unified 03:00 batch runner (T-20261112-002; ADR-0105 Decision 4; design
// docs/designs/2026-11-12-unified-batch-runner-design.md §4.5, AC-6).
//
// v1.0.0 (2026-11-12): every rail inside the runner is self-judged by the agent
// (preserved dissent S5, meeting 2026-11-12) — the 13:00 wall, the
// >2-unexpected-gate-failures stop, and degraded mode all need an enforcement
// point OUTSIDE the runner process. This script is that point: it writes the
// stop-file `.pipeline-state/automation-stop` (JSON: reason, ISO timestamp, pid)
// that the runner checks at its step boundaries. Presence of the file = degraded
// mode: no further merges; in-flight atomic units finish; the watchdog on the
// host (crontab 13:00 KST) and the runner's own stop conditions both write it.
//
// v1.1.0 (2026-11-20, RUN-ID SCOPING — T-20261120-002 second scope item; design
//   docs/designs/2026-11-20-runner-hardening-integrity-design.md §T-20261120-002 3c):
//   v1.0.0 appended an unconditional event on EVERY invocation, so the daily
//   13:00 heartbeat made the stop file present at 03:00 every day (6-event
//   growth observed) and automation-stop.history.jsonl grew one heartbeat row
//   per day forever. Now the watchdog reads the automation lock
//   (.pipeline-state/automation-unified-automation.lock, LockRecord
//   name/pid/hostname from automation-lock.ts): a LIVE same-host holder
//   (name === "unified-automation", pid alive) → append the stop event tagged
//   `run: "unified-automation"` as before; NO live run → NO stop-file write and
//   NO history row (an idle-night wall is not evidence of anything) — one
//   stdout line for the launchd capture instead. Stop events[] cap and the
//   atomic-write contract are unchanged; stop-gate.ts semantics are unchanged
//   (a pre-run stale record still acknowledges; a live tag still aborts).
//   Effect: the stop file is ABSENT at 03:00 by default and the history file
//   stops its daily growth. Degraded-mode kill-switch intent preserved: a run
//   that ignores deadlines past 13:00 keeps its lock live, so the wall still
//   fires against it (ADR-0105 Decision 4).
//
// Usage:
//   bun scripts/watchdog-automation-stop.ts <reason>
//   bun scripts/watchdog-automation-stop.ts --state-dir <dir> <reason>   (tests/ops redirect)
//
// Exit codes: 0 (stop-file written/updated on a live run, OR idle-night skip —
// both are success outcomes for launchd), 1 (usage error — missing/empty
// reason), 2 (unrecoverable write error).
//
// Safety contract (design R11 / AC-6):
// - MERGE-SAFE: a non-empty existing stop-file is never truncated mid-write.
//   Every write goes to a temp file in the same directory and is moved into
//   place with an atomic rename, so a concurrent runner reading the stop-file
//   sees either the complete previous content or the complete new content —
//   never a torn file.
// - IDEMPOTENT: repeated invocations are safe. Each invocation appends an
//   event to the `events` array (newest first, capped at 50) and refreshes the
//   top-level reason/timestamp/pid with the latest signal, so history survives
//   repeated wall hits across a long-running night.
// - EVIDENCE-PRESERVING: an existing file that does not parse as JSON is never
//   silently destroyed — it is renamed aside (automation-stop.corrupt-<ts>)
//   before the fresh record is written, so the bytes stay available for the
//   run report.
// - RUN-SCOPED (v1.1.0): writes only when the unified-automation lock is live
//   on this host; every written event carries `run: "unified-automation"`.
//
// Non-goals: the script never kills a process and never clears the stop-file —
// killing past deadline + 15 minutes and stamping the automation lock dead are
// operator/watchdog-loop duties (design R11); clearing the stop-file is the
// runner's STEP-0 acknowledgment. No cross-host signaling — single-operator
// workspace, same rationale as automation-lock.ts D4 (a foreign-host lock
// record is treated as not-live here, matching that ruling).

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, statSync } from "node:fs";
import { hostname } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ErrorPhase, withSyncErrorHandling } from "./lib/error-handling.ts";
import { pidAlive, readLock, type LockRecord } from "./automation-lock.ts";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STATE_DIR = join(WORKSPACE_ROOT, ".pipeline-state");
const STOP_FILE_NAME = "automation-stop";
const MAX_EVENTS = 50;
const RUNNER_LOCK_NAME = "unified-automation";

export interface StopEvent {
  reason: string;
  timestamp: string;
  pid: number;
  /** v1.1.0 run tag: the lock name of the live run this event was scoped to. */
  run?: string;
}

export interface StopFile {
  reason: string;
  timestamp: string;
  pid: number;
  events: StopEvent[];
}

export interface StopWriteResult {
  ok: boolean;
  state: "written" | "corrupt-archived";
  file: string;
  record: StopFile;
  message: string;
}

function isStopEvent(value: unknown): value is StopEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.reason === "string" && typeof v.timestamp === "string" && typeof v.pid === "number";
}

/**
 * Write (or update) the automation stop-file atomically.
 *
 * - stateDir override exists for tests and operator redirects; defaults to
 *   <workspace>/.pipeline-state.
 * - now/pid overrides exist for tests; default to the live clock and pid.
 * - run (v1.1.0) tags the event with the live run's lock name; callers that
 *   resolved the run via isLiveAutomationRun pass RUNNER_LOCK_NAME here.
 */
export function writeAutomationStop(options: {
  reason: string;
  stateDir?: string;
  now?: Date;
  pid?: number;
  run?: string;
}): StopWriteResult {
  const { reason } = options;
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error("usage: a non-empty reason is required");
  }
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR;
  const now = options.now ?? new Date();
  const pid = options.pid ?? process.pid;
  const timestamp = now.toISOString();
  const stopPath = join(stateDir, STOP_FILE_NAME);

  mkdirSync(stateDir, { recursive: true });

  const seedEvent: StopEvent = { reason, timestamp, pid };
  if (options.run !== undefined) seedEvent.run = options.run;
  const record: StopFile = { reason, timestamp, pid, events: [seedEvent] };

  let corruptArchived = false;
  if (existsSync(stopPath)) {
    const raw = readFileSync(stopPath, "utf8");
    if (raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        const asRecord = parsed as { events?: unknown } | null;
        if (typeof parsed === "object" && parsed !== null && Array.isArray(asRecord?.events)) {
          // Full-record shape: concatenate the prior event history.
          for (const ev of asRecord.events as unknown[]) {
            if (isStopEvent(ev)) {
              const carried: StopEvent = { reason: ev.reason, timestamp: ev.timestamp, pid: ev.pid };
              if (ev.run !== undefined) carried.run = ev.run;
              record.events.push(carried);
            }
          }
        } else if (isStopEvent(parsed)) {
          // Legacy/flat shape (first-generation stop-file): carry it as the seed event.
          const carried: StopEvent = { reason: parsed.reason, timestamp: parsed.timestamp, pid: parsed.pid };
          if (parsed.run !== undefined) carried.run = parsed.run;
          record.events.push(carried);
        }
        // Any other parseable-but-unrecognized shape: history is dropped, but the
        // file was valid JSON — not the corrupt-archive path.
      } catch {
        // Unparseable non-empty content: archive the bytes aside, never destroy them.
        const archivePath = join(stateDir, `${STOP_FILE_NAME}.corrupt-${timestamp.replace(/[:.]/g, "-")}`);
        renameSync(stopPath, archivePath);
        corruptArchived = true;
      }
    }
  }

  if (record.events.length > MAX_EVENTS) record.events = record.events.slice(0, MAX_EVENTS);

  // MERGE-SAFE write path: temp file in the SAME directory (rename is atomic
  // within one filesystem), then a single rename over the live stop-file. A
  // concurrent reader sees the complete old content or the complete new
  // content — never a truncated file.
  const tmpPath = join(stateDir, `${STOP_FILE_NAME}.tmp-${pid}-${timestamp.replace(/[:.]/g, "-")}`);
  writeFileSync(tmpPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(tmpPath, stopPath);

  return {
    ok: true,
    state: corruptArchived ? "corrupt-archived" : "written",
    file: stopPath,
    record,
    message: corruptArchived
      ? `stop-file updated; previous unparseable content archived at ${join(stateDir, STOP_FILE_NAME)}.corrupt-*`
      : `stop-file updated (${record.events.length} event(s) on record)`,
  };
}

/** Read the current stop-file, if present and parseable. (null when absent/empty.) */
export function readAutomationStop(stateDir?: string): StopFile | null {
  const stopPath = join(stateDir ?? DEFAULT_STATE_DIR, STOP_FILE_NAME);
  if (!existsSync(stopPath)) return null;
  const raw = readFileSync(stopPath, "utf8");
  if (raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const asRecord = parsed as { events?: unknown } | null;
    if (typeof parsed === "object" && parsed !== null && Array.isArray(asRecord?.events)) {
      return parsed as StopFile;
    }
    if (isStopEvent(parsed)) return { ...parsed, events: [parsed] };
    return null;
  } catch {
    return null;
  }
}

/** Size probe kept for the runner's degraded-mode check (presence + non-empty). */
export function stopFilePresent(stateDir?: string): boolean {
  const stopPath = join(stateDir ?? DEFAULT_STATE_DIR, STOP_FILE_NAME);
  if (!existsSync(stopPath)) return false;
  try {
    return statSync(stopPath).size > 0;
  } catch {
    return false;
  }
}

export interface LiveRunProbe {
  live: boolean;
  holder?: LockRecord;
  detail: string;
}

/**
 * v1.1.0 run-scoping probe (design §T-20261120-002 3c): is a unified-automation
 * run LIVE on this host right now? A live holder = lock record present with
 * name "unified-automation", matching hostname, and an alive pid. Absent,
 * corrupt, foreign-host, and dead-pid records all read as NOT live — an
 * idle-night wall must not manufacture evidence.
 */
export function isLiveAutomationRun(opts?: { stateDir?: string; hostname?: string; lockName?: string }): LiveRunProbe {
  const lockName = opts?.lockName ?? RUNNER_LOCK_NAME;
  const holder = readLock(lockName, { stateDir: opts?.stateDir });
  if (holder === null) return { live: false, detail: `no '${lockName}' lock record — idle night` };
  if (holder.name !== lockName) {
    return { live: false, holder, detail: `lock record names '${holder.name}', not '${lockName}'` };
  }
  const host = opts?.hostname ?? hostname();
  if (holder.hostname !== host) {
    return { live: false, holder, detail: `lock held on foreign host ${holder.hostname} (not-live per D4)` };
  }
  if (!pidAlive(holder.pid)) {
    return { live: false, holder, detail: `lock holder pid ${holder.pid} is dead — stale record` };
  }
  return { live: true, holder, detail: `live run: pid ${holder.pid} since ${holder.acquiredAt}` };
}

export interface ScopedStopResult {
  wrote: boolean;
  result?: StopWriteResult;
  detail: string;
}

/**
 * v1.1.0 entrypoint: scope the stop write to a live run, then write with the
 * run tag. No live run → NO stop-file write, NO history row, one stdout line
 * for the launchd capture. Everything else is v1.0.0 behavior (atomic, capped,
 * evidence-preserving), with `run: "unified-automation"` on the new event.
 */
export function writeScopedAutomationStop(options: {
  reason: string;
  stateDir?: string;
  now?: Date;
  pid?: number;
  hostname?: string;
  lockName?: string;
}): ScopedStopResult {
  const probe = isLiveAutomationRun({
    stateDir: options.stateDir,
    hostname: options.hostname,
    lockName: options.lockName,
  });
  if (!probe.live) {
    return { wrote: false, detail: `idle night — no stop-file write (${probe.detail})` };
  }
  const result = writeAutomationStop({
    reason: options.reason,
    stateDir: options.stateDir,
    now: options.now,
    pid: options.pid,
    run: options.lockName ?? RUNNER_LOCK_NAME,
  });
  return { wrote: true, result, detail: result.message };
}

const main = (): number => {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  let stateDir: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--state-dir") {
      stateDir = args[++i];
    } else if (args[i]?.startsWith("--state-dir=")) {
      stateDir = args[i]?.slice("--state-dir=".length);
    } else {
      positional.push(args[i] ?? "");
    }
  }
  const reason = positional.join(" ").trim();
  if (reason.length === 0) {
    process.stderr.write("usage: bun scripts/watchdog-automation-stop.ts [--state-dir <dir>] <reason>\n");
    return 1;
  }
  const scoped = withSyncErrorHandling(ErrorPhase.FILE_IO, () => writeScopedAutomationStop({ reason, stateDir }), {
    script: "watchdog-automation-stop",
  });
  if (!scoped.wrote) {
    // Idle night: one stdout line for the launchd capture, nothing else.
    process.stdout.write(`🔕 automation-stop (v1.1.0 run-scoped): ${scoped.detail}\n`);
    return 0;
  }
  const result = scoped.result!;
  process.stdout.write(
    `🛑 automation-stop: ${result.message}\n   reason: ${result.record.reason}\n   at: ${result.record.timestamp}\n   run: ${RUNNER_LOCK_NAME}\n`,
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
