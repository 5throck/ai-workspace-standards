#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md §5.2,
//          Phase 3a kanban core): priority governance for the delegation kanban alias
//          layer — actor grammar (user | hub-pm | spoke-pm:NAME), the pure cap check
//          (P0 user-only; spoke raises +1 level per ticket per 24h, never to urgent;
//          hub-pm unrestricted within the enum), and the 3-strike ledger (gitignored
//          .pipeline-state/hub-reprioritize-strikes.json keyed by requesting project;
//          3 violations set frozen=true and further raises from that project are
//          refused pending user review). Pure policy + ledger I/O only — the ticket
//          mutation itself lives in ticket-store.ts reprioritizeTicket().
// @l2-propagate: false
// reprioritize.ts — Pure policy + strike ledger for the delegation kanban priority
// governance. No ticket I/O here (see ticket-store.ts).

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { Priority } from './ticket-schema.ts';

/** Who is asking for a priority change.
 * - `user` — the human operator (unrestricted, including urgent/P0).
 * - `hub-pm` — the workspace hub PM agent (unrestricted within the enum EXCEPT urgent/P0).
 * - `spoke-pm:NAME` — a spoke project's PM agent (+1 level per ticket per 24h, never urgent/P0). */
export type ReprioritizeActor = 'user' | 'hub-pm' | `spoke-pm:${string}`;

const SPOKE_ACTOR_RE = /^spoke-pm:([a-z0-9-]{1,64})$/;

/** Parses the --actor grammar; null on a malformed actor token. */
export function parseActor(raw: string): ReprioritizeActor | null {
  if (raw === 'user' || raw === 'hub-pm') return raw;
  const m = SPOKE_ACTOR_RE.exec(raw);
  return m ? (`spoke-pm:${m[1]}` as ReprioritizeActor) : null;
}

/** Strike-ledger key for an actor: user actions are never counted (null);
 * spoke actors are keyed by their project name, hub-pm by the literal 'hub-pm'. */
export function strikeKeyFor(actor: ReprioritizeActor): string | null {
  if (actor === 'user') return null;
  if (actor === 'hub-pm') return 'hub-pm';
  return actor.slice('spoke-pm:'.length);
}

/** Rank toward urgent: higher level = more urgent. A "raise" is a positive delta. */
export const PRIORITY_LEVEL: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

export const REPRIORITIZE_RAISE_WINDOW_MS = 24 * 3_600_000;

export type ReprioritizeRefusalCode = 'no-op' | 'p0-user-only' | 'raise-cap' | 'raise-window';

export type ReprioritizeVerdict =
  | { allowed: true }
  | { allowed: false; violation: boolean; code: ReprioritizeRefusalCode; reason: string };

/**
 * Pure cap check (design §5.2). `lastRaiseAt` is the `at` of the most recent
 * reprioritize action entry on the ticket (any actor) — a raise within the 24h
 * window of a previous raise is refused. `nowMs` is a test seam.
 *
 * A refused call carries `violation: true` when it counts toward the 3-strike
 * ledger (cap abuse); `no-op` refusals (priority unchanged) are usage errors,
 * not abuse.
 */
export function checkReprioritize(
  actor: ReprioritizeActor,
  from: Priority,
  to: Priority,
  opts: { nowMs?: number; lastRaiseAt?: string } = {},
): ReprioritizeVerdict {
  if (from === to) {
    return { allowed: false, violation: false, code: 'no-op', reason: `priority is already ${to} — nothing to change` };
  }
  // Hard rule (design §5.2): P0/urgent is settable by USER only — a hard error for
  // every agent actor, and it counts as a cap violation for the strike ledger.
  if (to === 'urgent' && actor !== 'user') {
    return {
      allowed: false, violation: true, code: 'p0-user-only',
      reason: 'P0/urgent is settable by actor=user only — agents (hub-pm, spoke-pm) can set P1-P3',
    };
  }
  if (actor === 'user' || actor === 'hub-pm') return { allowed: true };
  // spoke-pm: only RAISES are capped — lowering (or any non-increase) is unrestricted.
  const raise = PRIORITY_LEVEL[to] - PRIORITY_LEVEL[from];
  if (raise <= 0) return { allowed: true };
  if (raise > 1) {
    return {
      allowed: false, violation: true, code: 'raise-cap',
      reason: `spoke raises are capped at +1 level per ticket per 24h (attempted ${from} -> ${to})`,
    };
  }
  if (opts.lastRaiseAt !== undefined) {
    const last = Date.parse(opts.lastRaiseAt);
    const now = opts.nowMs ?? Date.now();
    if (!Number.isNaN(last) && now - last < REPRIORITIZE_RAISE_WINDOW_MS) {
      return {
        allowed: false, violation: true, code: 'raise-window',
        reason: `spoke raises are capped at 1 level per ticket per 24h (last raise ${opts.lastRaiseAt})`,
      };
    }
  }
  return { allowed: true };
}

// ── 3-strike ledger (design §5.2; the 2026-10-31 trust-model rule) ────────────

export const STRIKES_FILE_NAME = 'hub-reprioritize-strikes.json';
export const FROZEN_THRESHOLD = 3;

export interface StrikeRecord {
  at: string;
  actor: ReprioritizeActor;
  attempted: string;
  reason: string;
}

export interface StrikeProjectEntry {
  violations: number;
  frozen: boolean;
  updated_at: string;
  history: StrikeRecord[];
}

export interface StrikesState {
  version: 1;
  frozenThreshold: number;
  projects: Record<string, StrikeProjectEntry>;
}

function emptyStrikes(): StrikesState {
  return { version: 1, frozenThreshold: FROZEN_THRESHOLD, projects: {} };
}

/** Loads the ledger; a missing or corrupt file degrades to a fresh (empty) state —
 * the ledger is an abuse counter, not an integrity domain. */
export function loadStrikes(stateDir: string): StrikesState {
  const path = join(stateDir, STRIKES_FILE_NAME);
  if (!existsSync(path)) return emptyStrikes();
  try {
    const obj = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    if (obj.version !== 1 || typeof obj.projects !== 'object' || obj.projects === null) return emptyStrikes();
    return obj as unknown as StrikesState;
  } catch {
    return emptyStrikes();
  }
}

export function saveStrikes(stateDir: string, state: StrikesState): void {
  mkdirSync(stateDir, { recursive: true });
  const path = join(stateDir, STRIKES_FILE_NAME);
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpPath, path);
}

/** Frozen = 3 (FROZEN_THRESHOLD) recorded violations for the requesting project. */
export function isFrozen(state: StrikesState, key: string): boolean {
  return (state.projects[key]?.violations ?? 0) >= FROZEN_THRESHOLD;
}

/** Records one cap violation for `key`; the entry's `frozen` flag flips at the
 * threshold. Returns the mutated state (already persisted). */
export function recordStrike(stateDir: string, key: string, record: StrikeRecord): StrikesState {
  const state = loadStrikes(stateDir);
  const entry = state.projects[key] ?? { violations: 0, frozen: false, updated_at: record.at, history: [] };
  entry.violations += 1;
  entry.updated_at = record.at;
  entry.history.push(record);
  entry.frozen = entry.violations >= FROZEN_THRESHOLD;
  state.projects[key] = entry;
  saveStrikes(stateDir, state);
  return state;
}

/** Typed refusal — the store throws it, the CLI prints it, the MCP server maps it
 * onto a typed -32602 error carrying the machine-readable `code`. */
export class ReprioritizeRefusedError extends Error {
  constructor(message: string, public readonly code: ReprioritizeRefusalCode | 'frozen', public readonly violation: boolean) {
    super(message);
    this.name = 'ReprioritizeRefusedError';
  }
}
