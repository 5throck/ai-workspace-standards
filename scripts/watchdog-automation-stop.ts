#!/usr/bin/env bun
// @version 1.0.0
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
// Usage:
//   bun scripts/watchdog-automation-stop.ts <reason>
//   bun scripts/watchdog-automation-stop.ts --state-dir <dir> <reason>   (tests/ops redirect)
//
// Exit codes: 0 (stop-file written or updated), 1 (usage error — missing/empty
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
//
// Non-goals: the script never kills a process and never clears the stop-file —
// killing past deadline + 15 minutes and stamping the automation lock dead are
// operator/watchdog-loop duties (design R11); clearing the stop-file is the
// runner's STEP-0 acknowledgment. No cross-host signaling — single-operator
// workspace, same rationale as automation-lock.ts D4.

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ErrorPhase, withSyncErrorHandling } from "./lib/error-handling.ts";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STATE_DIR = join(WORKSPACE_ROOT, ".pipeline-state");
const STOP_FILE_NAME = "automation-stop";
const MAX_EVENTS = 50;

export interface StopEvent {
  reason: string;
  timestamp: string;
  pid: number;
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
 */
export function writeAutomationStop(options: {
  reason: string;
  stateDir?: string;
  now?: Date;
  pid?: number;
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

  const record: StopFile = { reason, timestamp, pid, events: [{ reason, timestamp, pid }] };

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
            if (isStopEvent(ev)) record.events.push({ reason: ev.reason, timestamp: ev.timestamp, pid: ev.pid });
          }
        } else if (isStopEvent(parsed)) {
          // Legacy/flat shape (first-generation stop-file): carry it as the seed event.
          record.events.push({ reason: parsed.reason, timestamp: parsed.timestamp, pid: parsed.pid });
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
  const result = withSyncErrorHandling(ErrorPhase.FILE_IO, () => writeAutomationStop({ reason, stateDir }), {
    script: "watchdog-automation-stop",
  });
  process.stdout.write(
    `🛑 automation-stop: ${result.message}\n   reason: ${result.record.reason}\n   at: ${result.record.timestamp}\n`,
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
