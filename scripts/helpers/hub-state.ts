#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §3 Phase 3.5): hub lifecycle state file — read/write/transition the
//          hub-local `.pipeline-state/hub-<name>.state.json` with a sha256
//          hash-chained state_history journal, TTL leases for operational
//          declarations, and edge-enforcing applyTransition for the two-enum
//          state machine (bootstrap_states linear forward-only; operational
//          states incl. AVAILABLE<->DEGRADED, AVAILABLE/DEGRADED->UNAVAILABLE,
//          UNAVAILABLE->RECOVERY->AVAILABLE). Writes are atomic (tmp + rename,
//          same pattern as ticket-store.ts writeTicketAtomic). Registry enum
//          cross-check rides scripts/helpers/hub-topology.ts loadHubTopology.
// hub-state.ts — hub lifecycle state file helper (design §3.6).
//
// State authority split (design §3.1/§3.2): bootstrap_states are declared by
// hub-bootstrap.ts infra verification ONLY; operational_states are declared by
// the hub PM at session start under a TTL lease. History rewriting is
// forbidden (§3.5): entries are append-only and hash-chained; validateChain
// detects any tamper. The root NEVER writes this file — the weekly probe
// (scripts/hub-probe.ts) is read-only.
//
// Consumers: scripts/hub-bootstrap.ts (init/journal on bootstrap), scripts/
// hub-probe.ts (read-only observation), scripts/ticket.ts (UNAVAILABLE gate on
// delegated ticket creation). Every function takes an explicit directory so
// callers never assume a fixed workspace location (same discipline as
// ticket-store.ts); all exports are deterministic given their inputs, which
// keeps the unit suite on mkdtempSync fixtures (FILE_TIME_BUDGETS 60s).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { loadHubTopology, type HubTopology } from './hub-topology.ts';

// ── Enums (design §3.1/§3.2; cross-checked against the registry) ─────────────

export const BOOTSTRAP_STATES = ['BOOTSTRAPPED', 'VALIDATED', 'READY'] as const;
export const OPERATIONAL_STATES = ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'RECOVERY'] as const;

export type BootstrapState = (typeof BOOTSTRAP_STATES)[number];
export type OperationalState = (typeof OPERATIONAL_STATES)[number];

/** Default TTL for an operational declaration: one working session (8h).
 * Re-attest before expiry or consumers read the hub as UNAVAILABLE (§3.3). */
export const DEFAULT_LEASE_MS = 8 * 3_600_000;

// ── State machine edges ──────────────────────────────────────────────────────

/** Legal bootstrap edges: linear forward only (§3.1). init = null -> BOOTSTRAPPED.
 * Skipping a step (null->VALIDATED, BOOTSTRAPPED->READY) and any backward edge
 * are illegal. */
const BOOTSTRAP_EDGES: ReadonlyArray<readonly [BootstrapState | null, BootstrapState]> = [
  [null, 'BOOTSTRAPPED'],
  ['BOOTSTRAPPED', 'VALIDATED'],
  ['VALIDATED', 'READY'],
];

/** Legal operational edges (§3.2–§3.4).
 * - init: null -> AVAILABLE | DEGRADED | UNAVAILABLE (a first declaration of
 *   RECOVERY is illegal — RECOVERY is post-unavailability by definition, so
 *   there is nothing to recover from yet).
 * - AVAILABLE <-> DEGRADED (the §3.4 capability-matrix round trip).
 * - AVAILABLE / DEGRADED -> UNAVAILABLE (blocks ticket creation + spawns).
 * - UNAVAILABLE -> RECOVERY (recovery entered).
 * - RECOVERY -> AVAILABLE (requires probe re-verification, §3.4 glossary) and
 *   RECOVERY -> UNAVAILABLE (the recovery attempt failed — without this edge
 *   a failed recovery would wedge the machine in RECOVERY forever).
 * - Same-state re-attest (X -> X) refreshes the TTL lease (§3.3) without a
 *   semantic transition; it is journal-append like any other edge. */
const OPERATIONAL_EDGES: ReadonlyArray<readonly [OperationalState | null, OperationalState]> = [
  [null, 'AVAILABLE'],
  [null, 'DEGRADED'],
  [null, 'UNAVAILABLE'],
  ['AVAILABLE', 'AVAILABLE'],
  ['AVAILABLE', 'DEGRADED'],
  ['AVAILABLE', 'UNAVAILABLE'],
  ['DEGRADED', 'AVAILABLE'],
  ['DEGRADED', 'DEGRADED'],
  ['DEGRADED', 'UNAVAILABLE'],
  ['UNAVAILABLE', 'UNAVAILABLE'],
  ['UNAVAILABLE', 'RECOVERY'],
  ['RECOVERY', 'AVAILABLE'],
  ['RECOVERY', 'UNAVAILABLE'],
];

export type StateHistoryEntry = {
  from: BootstrapState | OperationalState | null;
  to: BootstrapState | OperationalState;
  actor: string;
  timestamp: string; // ISO-8601
  reason: string;
  prev_hash: string | null; // hash of the previous entry; null on the first
  hash: string; // sha256(canonicalJson(entry minus hash) + prev_hash)
};

export interface TtlLease {
  declared_at: string;
  expires_at: string;
}

/** The hub-local state file (design §3.6). operational_state stays null until
 * the hub PM's first declaration — readers treat null as "not yet in service". */
export interface HubStateFile {
  hub: string;
  bootstrap_state: BootstrapState | null;
  operational_state: OperationalState | null;
  degraded_capabilities: string[];
  ttl_lease: TtlLease | null;
  state_history: StateHistoryEntry[];
  head_hash: string | null;
  /** Bootstrap approval record (§4.2 pinned approval): actor is always 'user';
   * the --yes flag on hub-bootstrap.ts IS the recorded approval. */
  approval?: { actor: 'user'; remote: string; sha: string; at: string } | null;
}

export class HubStateError extends Error {
  constructor(message: string) {
    super(`[hub-state] ${message}`);
    this.name = 'HubStateError';
  }
}

// ── Paths + atomic I/O ───────────────────────────────────────────────────────

/** The hub-local state file path: `<dir>/.pipeline-state/hub-<hub>.state.json`
 * (design §3.6, gitignored local-state convention). */
export function stateFilePath(dir: string, hub: string): string {
  if (!/^co-[a-z0-9-]{1,40}$/.test(hub)) {
    throw new HubStateError(`invalid hub name: ${JSON.stringify(hub)} — expected co-<slug>`);
  }
  return join(dir, '.pipeline-state', `hub-${hub}.state.json`);
}

function writeStateAtomic(path: string, state: HubStateFile): void {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, path);
}

/** Read the hub state file. Absent file -> null (the caller decides what
 * "no state" means — the probe reports NOT-BOOTSTRAPPED, the ticket gate
 * allows). A present-but-corrupt file throws fail-closed (a silently-accepted
 * corrupt state is exactly the drift class the hash chain exists to catch). */
export function readState(dir: string, hub: string): HubStateFile | null {
  const path = stateFilePath(dir, hub);
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    throw new HubStateError(`state file is not valid JSON: ${path} (${e instanceof Error ? e.message : String(e)})`);
  }
  const s = parsed as Partial<HubStateFile>;
  if (s.hub !== hub) {
    throw new HubStateError(`state file hub mismatch: expected ${hub}, got ${JSON.stringify(s.hub)} in ${path}`);
  }
  if (!Array.isArray(s.state_history)) {
    throw new HubStateError(`state file is missing state_history[]: ${path}`);
  }
  return {
    hub: s.hub,
    bootstrap_state: (s.bootstrap_state ?? null) as HubStateFile['bootstrap_state'],
    operational_state: (s.operational_state ?? null) as HubStateFile['operational_state'],
    degraded_capabilities: Array.isArray(s.degraded_capabilities) ? s.degraded_capabilities : [],
    ttl_lease: (s.ttl_lease ?? null) as HubStateFile['ttl_lease'],
    state_history: s.state_history as StateHistoryEntry[],
    head_hash: (s.head_hash ?? null) as HubStateFile['head_hash'],
    approval: (s.approval ?? null) as HubStateFile['approval'],
  };
}

// ── Hash chain (design §3.5) ─────────────────────────────────────────────────

/** Canonical JSON: keys sorted recursively so the hash is stable across
 * writers (the same discipline as the schema hash-parity canonicalization). */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** entry.hash = sha256(canonicalJson(entry minus hash) + prev_hash). */
export function entryHash(entry: Omit<StateHistoryEntry, 'hash'>): string {
  const { hash: _omit, ...rest } = entry as StateHistoryEntry;
  return createHash('sha256').update(canonicalJson(rest) + (entry.prev_hash ?? '')).digest('hex');
}

/** Verify prev_hash linkage + hash recomputation over the whole journal.
 * ok=false names the first bad entry — the tamper-detection contract. */
export function validateChain(state: Pick<HubStateFile, 'state_history' | 'head_hash'>): { ok: true; head: string | null } | { ok: false; at: number; error: string } {
  let prev: string | null = null;
  for (let i = 0; i < state.state_history.length; i++) {
    const e = state.state_history[i];
    if (e.prev_hash !== prev) {
      return { ok: false, at: i, error: `prev_hash mismatch: expected ${prev ?? 'null'}, got ${e.prev_hash ?? 'null'}` };
    }
    const { hash: _h, ...rest } = e;
    const expected = entryHash(rest as Omit<StateHistoryEntry, 'hash'>);
    if (e.hash !== expected) {
      return { ok: false, at: i, error: `hash mismatch: entry content does not hash to its recorded hash (expected ${expected.slice(0, 12)}…, got ${(e.hash ?? '').slice(0, 12)}…)` };
    }
    prev = e.hash;
  }
  const head = prev;
  if (state.head_hash !== head) {
    return { ok: false, at: state.state_history.length, error: `head_hash mismatch: file says ${state.head_hash ?? 'null'}, chain computes ${head ?? 'null'}` };
  }
  return { ok: true, head };
}

// ── TTL lease (design §3.3) ──────────────────────────────────────────────────

/** True when a lease exists and has not expired. No lease -> false (an
 * operational declaration without a lease is not attestable). */
export function isLeaseValid(state: Pick<HubStateFile, 'ttl_lease'>, nowMs: number = Date.now()): boolean {
  const lease = state.ttl_lease;
  if (!lease || typeof lease.expires_at !== 'string') return false;
  const exp = Date.parse(lease.expires_at);
  if (Number.isNaN(exp)) return false;
  return exp > nowMs;
}

/** The operational state a CONSUMER should act on: an expired (or missing)
 * lease on any declaration reads as UNAVAILABLE until the next declaration or
 * probe (§3.3: "a hub that does not re-attest before expiry is treated as
 * UNAVAILABLE by consumers"). null operational_state -> null ("not yet in
 * service" — the bootstrap-only state; the ticket gate allows it, per the
 * Phase 3.5 wiring: only UNAVAILABLE refuses). */
export function effectiveOperationalState(state: Pick<HubStateFile, 'operational_state' | 'ttl_lease'>, nowMs: number = Date.now()): OperationalState | null {
  if (state.operational_state === null) return null;
  if (!isLeaseValid(state, nowMs)) return 'UNAVAILABLE';
  return state.operational_state;
}

// ── Registry enum cross-check ────────────────────────────────────────────────

export interface RegistryEnums {
  bootstrap_states: string[];
  operational_states: string[];
  capability_enum: Record<string, unknown>;
  /** The hub's declared capability keys (hubs[].capabilities); null when the
   * registry carries no row for this hub yet. */
  declaredCapabilities: string[] | null;
}

/** Resolve the enum vocabulary from the hub_topology registry (design §3.4:
 * degraded_capabilities are a subset of the hub's DECLARED capabilities, and
 * capability names must exist in the root capability_enum). Falls back to the
 * design-pinned enums when the registry section is absent (legacy checkouts),
 * with an EMPTY capability vocabulary (fail-closed for DEGRADED). */
export function resolveRegistryEnums(topology: HubTopology | null): RegistryEnums {
  if (!topology) {
    return {
      bootstrap_states: [...BOOTSTRAP_STATES],
      operational_states: [...OPERATIONAL_STATES],
      capability_enum: {},
      declaredCapabilities: null,
    };
  }
  return {
    bootstrap_states: Array.isArray(topology.bootstrap_states) ? topology.bootstrap_states : [...BOOTSTRAP_STATES],
    operational_states: Array.isArray(topology.operational_states) ? topology.operational_states : [...OPERATIONAL_STATES],
    capability_enum: (topology.capability_enum && typeof topology.capability_enum === 'object' && !Array.isArray(topology.capability_enum))
      ? (topology.capability_enum as Record<string, unknown>)
      : {},
    declaredCapabilities: null,
  };
}

/** Per-hub enum resolution: name-aware (picks hubs[].capabilities for THIS
 * hub). `topology` may be null (legacy checkout) — then the design-pinned
 * enums apply and no capability declarations exist (null). */
export function resolveRegistryEnumsForHub(topology: HubTopology | null, hub: string): RegistryEnums {
  const base = resolveRegistryEnums(topology);
  if (!topology) return base;
  const row = (Array.isArray(topology.hubs) ? topology.hubs : []).find(
    h => h && typeof h === 'object' && (h as Record<string, unknown>)['name'] === hub,
  ) as Record<string, unknown> | undefined;
  if (!row) return { ...base, declaredCapabilities: null };
  const caps = row['capabilities'];
  base.declaredCapabilities = Array.isArray(caps) ? caps.map(String) : null;
  return base;
}

/** Convenience: load the registry from a workspace root and resolve enums for
 * one hub. Absent registry section -> design-pinned defaults (same fallback
 * as resolveRegistryEnums(null)). */
export function loadRegistryEnums(rootDir: string, hub: string): RegistryEnums {
  const loaded = loadHubTopology(rootDir);
  return resolveRegistryEnumsForHub(loaded.ok ? loaded.topology! : null, hub);
}

// ── Transition engine ────────────────────────────────────────────────────────

export interface TransitionInput {
  kind: 'bootstrap' | 'operational';
  to: BootstrapState | OperationalState;
  actor: string;
  reason: string;
  /** Test seam: ISO timestamp for the journal entry (default: now). */
  at?: string;
  /** Operational declarations: lease length in ms (default DEFAULT_LEASE_MS).
   * Ignored for bootstrap transitions. */
  leaseMs?: number;
  /** DEGRADED declarations: the reduced capability set (§3.4). Validated as a
   * subset of the hub's declared capabilities, with every name required to
   * exist in the capability_enum and no never_in_degraded capability allowed. */
  degradedCapabilities?: string[];
  /** DEGRADED only: false reuses existing degraded_capabilities. */
  replaceCapabilities?: boolean;
}

export interface ApplyOptions {
  /** Registry enums for the cross-check (loadRegistryEnums / hand-built for
   * tests). When omitted, the design-pinned enums apply and capability
   * validation runs against an empty vocabulary (fail-closed for DEGRADED). */
  enums?: RegistryEnums;
  /** Test seam: wall clock for lease math. */
  nowMs?: number;
}

function currentOf(state: HubStateFile, kind: 'bootstrap' | 'operational'): BootstrapState | OperationalState | null {
  return kind === 'bootstrap' ? state.bootstrap_state : state.operational_state;
}

function edgeAllowed(kind: 'bootstrap' | 'operational', from: string | null, to: string): boolean {
  const edges = kind === 'bootstrap' ? BOOTSTRAP_EDGES : OPERATIONAL_EDGES;
  return edges.some(([f, t]) => f === from && t === to);
}

/** Validate a DEGRADED capability set (design §3.4): every name must exist in
 * the registry capability_enum, must be declared by the hub
 * (hubs[].capabilities), and must not be never_in_degraded. Returns violation
 * strings (empty = valid). enums.declaredCapabilities === null means the
 * registry carries no hub row — any non-empty set is "a capability it never
 * declared" (fail-closed). */
export function validateDegradedCapabilities(caps: string[], enums: RegistryEnums): string[] {
  const violations: string[] = [];
  const declared = enums.declaredCapabilities;
  for (const cap of caps) {
    if (!(cap in enums.capability_enum)) {
      violations.push(`capability "${cap}" is not a hub_topology.capability_enum key — a hub cannot invent capability names the schema does not know`);
      continue;
    }
    const meta = enums.capability_enum[cap];
    if (meta && typeof meta === 'object' && (meta as Record<string, unknown>)['never_in_degraded'] === true) {
      violations.push(`capability "${cap}" is never_in_degraded (the never-in-DEGRADED floor) — it cannot appear in degraded_capabilities`);
      continue;
    }
    if (declared === null || !declared.includes(cap)) {
      violations.push(`capability "${cap}" is not declared by this hub (hubs[].capabilities${declared === null ? ' — no registry row for this hub' : `: [${declared.join(', ')}]`}) — a hub cannot degrade into a capability it never declared`);
    }
  }
  return violations;
}

/** Enforce one legal state-machine edge and append it to the hash-chained
 * journal, atomically rewriting the state file. Illegal edges throw
 * HubStateError (the caller's contract: never guess, never force — bootstrap
 * back-steps and history rewrites have no legitimate caller). */
export function applyTransition(dir: string, hub: string, input: TransitionInput, opts: ApplyOptions = {}): HubStateFile {
  const enums = opts.enums ?? resolveRegistryEnums(null);
  const now = opts.nowMs ?? Date.now();
  const timestamp = input.at ?? new Date(now).toISOString();

  // Registry enum membership (design §3: state names are registry-owned).
  const enumList = input.kind === 'bootstrap' ? enums.bootstrap_states : enums.operational_states;
  if (!enumList.includes(input.to)) {
    throw new HubStateError(`"${input.to}" is not a hub_topology ${input.kind}_state (registry: [${enumList.join(', ')}])`);
  }
  if (typeof input.actor !== 'string' || input.actor.trim() === '') {
    throw new HubStateError('actor must be a non-empty string');
  }
  if (typeof input.reason !== 'string' || input.reason.trim() === '') {
    throw new HubStateError('reason must be a non-empty string — every transition is audited with its cause');
  }

  const existing = readState(dir, hub);
  const state: HubStateFile = existing ?? {
    hub,
    bootstrap_state: null,
    operational_state: null,
    degraded_capabilities: [],
    ttl_lease: null,
    state_history: [],
    head_hash: null,
    approval: null,
  };

  // Authority split (§3.1): bootstrap states are machine-declared only.
  if (input.kind === 'bootstrap' && input.actor !== 'hub-bootstrap') {
    throw new HubStateError(`bootstrap_states are declared by hub-bootstrap.ts only (got actor: ${input.actor}) — a hub PM cannot self-declare BOOTSTRAPPED/VALIDATED/READY`);
  }

  const from = currentOf(state, input.kind);
  if (!edgeAllowed(input.kind, from, input.to)) {
    throw new HubStateError(
      `illegal ${input.kind} transition ${from ?? '<init>'} -> ${input.to} — legal edges: ${
        input.kind === 'bootstrap'
          ? 'null->BOOTSTRAPPED->VALIDATED->READY (linear forward only)'
          : 'null->{AVAILABLE|DEGRADED|UNAVAILABLE}, AVAILABLE<->DEGRADED, {AVAILABLE|DEGRADED}->UNAVAILABLE, UNAVAILABLE->RECOVERY->{AVAILABLE|UNAVAILABLE}, same-state re-attest'
      }`,
    );
  }

  // DEGRADED capability matrix (§3.4) — validated BEFORE any write.
  let degraded = state.degraded_capabilities;
  if (input.to === 'DEGRADED') {
    const caps = input.degradedCapabilities ?? (input.replaceCapabilities ? [] : state.degraded_capabilities);
    const violations = validateDegradedCapabilities(caps, enums);
    if (violations.length > 0) {
      throw new HubStateError(`DEGRADED capability set refused: ${violations.join('; ')}`);
    }
    degraded = [...caps];
  } else if (input.kind === 'operational' && input.replaceCapabilities) {
    degraded = [];
  }

  // Journal append + chain (§3.5): hash = sha256(canonicalJson(entry) + prev_hash).
  const prevHash = state.state_history.length > 0 ? state.state_history[state.state_history.length - 1].hash : null;
  const entryBase = { from, to: input.to, actor: input.actor, timestamp, reason: input.reason, prev_hash: prevHash };
  const entry: StateHistoryEntry = { ...entryBase, hash: entryHash(entryBase) };
  state.state_history.push(entry);

  if (input.kind === 'bootstrap') {
    state.bootstrap_state = input.to as BootstrapState;
  } else {
    state.operational_state = input.to as OperationalState;
    const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
    state.ttl_lease = { declared_at: timestamp, expires_at: new Date(Date.parse(timestamp) + leaseMs).toISOString() };
  }
  state.degraded_capabilities = input.to === 'DEGRADED' ? degraded : (input.kind === 'operational' && input.to === 'AVAILABLE' ? [] : state.degraded_capabilities);
  state.head_hash = entry.hash;

  writeStateAtomic(stateFilePath(dir, hub), state);
  return state;
}

/** Initialize a fresh state file with the bootstrap approval record (§4.2).
 * Used by hub-bootstrap.ts inside the temp clone BEFORE the atomic move, so
 * the single rename carries state + journal together. Throws if a state file
 * already exists (an init has exactly one caller and one lifetime). */
export function initStateFile(dir: string, hub: string, approval: NonNullable<HubStateFile['approval']>): HubStateFile {
  if (readState(dir, hub) !== null) {
    throw new HubStateError(`state file already exists for ${hub} in ${dir} — init is a one-time bootstrap act`);
  }
  const state: HubStateFile = {
    hub,
    bootstrap_state: null,
    operational_state: null,
    degraded_capabilities: [],
    ttl_lease: null,
    state_history: [],
    head_hash: null,
    approval,
  };
  writeStateAtomic(stateFilePath(dir, hub), state);
  return state;
}
