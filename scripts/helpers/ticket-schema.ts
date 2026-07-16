#!/usr/bin/env bun
// @version 1.0.0
// @l2-propagate: false
// ticket-schema.ts — Pure schema types, state machine, and validation for the
// Phase A Service Ticket + Kanban system. No file I/O here (see ticket-store.ts).
// Design: docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md

export const CURRENT_SCHEMA_VERSION = 1;

export type Status = 'backlog' | 'waiting' | 'running' | 'review' | 'done' | 'failed';
export type Kind = 'service' | 'manual';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type RunType = 'skill' | 'script';

export interface RunDef {
  type: RunType;
  ref: string;
}

export interface ServiceDef {
  id: string;
  name: string;
  description?: string;
  run: RunDef;
  inputs?: string[];
}

export interface ScheduleEntry {
  service: string;
  cron: string;
}

export interface Catalog {
  schemaVersion: number;
  services: ServiceDef[];
  schedule?: ScheduleEntry[];
}

export interface HistoryEntry {
  at: string;
  from: Status | null;
  to: Status;
}

export interface Ticket {
  schemaVersion: number;
  id: string;
  kind: Kind;
  service?: string;
  title?: string;
  inputs?: Record<string, string>;
  priority: Priority;
  status: Status;
  attempts: number;
  created_at: string;
  history: HistoryEntry[];
  result: string | null;
  error: string | null;
}

/** Adjacency-only state machine. `--force` in the CLI bypasses this; every other
 * caller (schema validation, `next`, `ticket-run`) must go through canTransition. */
export const TRANSITIONS: Record<Status, Status[]> = {
  backlog: ['waiting'],
  waiting: ['running', 'review'], // running: pulled by `next` (service). review: manual ticket picked up directly by a human.
  running: ['review', 'failed'],
  review: ['done'],
  failed: ['waiting'],
  done: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const ID_PATTERN = /^[a-z0-9-]+$/;
// Allowlist for run.ref — must match one of these depending on run.type.
const SCRIPT_REF_PATTERN = /^scripts\/[a-z0-9-]+\.ts$/;
const SKILL_REF_PATTERN = /^[a-z0-9-]+$/;
const INPUT_NAME_PATTERN = /^[a-z0-9_-]+$/;

function fail(msg: string): never {
  throw new Error(`[ticket-schema] ${msg}`);
}

export function validateCatalog(obj: unknown): asserts obj is Catalog {
  if (typeof obj !== 'object' || obj === null) fail('catalog must be an object');
  const c = obj as Record<string, unknown>;
  if (c.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fail(`catalog schemaVersion must be ${CURRENT_SCHEMA_VERSION} (got: ${JSON.stringify(c.schemaVersion)})`);
  }
  if (!Array.isArray(c.services)) fail('catalog.services must be an array');
  const seenIds = new Set<string>();
  for (const [i, svc] of (c.services as unknown[]).entries()) {
    if (typeof svc !== 'object' || svc === null) fail(`services[${i}] must be an object`);
    const s = svc as Record<string, unknown>;
    if (typeof s.id !== 'string' || !ID_PATTERN.test(s.id)) fail(`services[${i}].id invalid: ${JSON.stringify(s.id)}`);
    if (seenIds.has(s.id as string)) fail(`duplicate service id: ${s.id}`);
    seenIds.add(s.id as string);
    if (typeof s.name !== 'string' || s.name.length === 0) fail(`services[${i}].name must be a non-empty string`);
    if (typeof s.run !== 'object' || s.run === null) fail(`services[${i}].run must be an object`);
    const run = s.run as Record<string, unknown>;
    if (run.type !== 'skill' && run.type !== 'script') fail(`services[${i}].run.type must be 'skill' or 'script'`);
    if (typeof run.ref !== 'string') fail(`services[${i}].run.ref must be a string`);
    const refPattern = run.type === 'script' ? SCRIPT_REF_PATTERN : SKILL_REF_PATTERN;
    if (!refPattern.test(run.ref as string)) fail(`services[${i}].run.ref fails allowlist for type '${run.type}': ${JSON.stringify(run.ref)}`);
    if (s.inputs !== undefined) {
      if (!Array.isArray(s.inputs) || !(s.inputs as unknown[]).every(x => typeof x === 'string' && INPUT_NAME_PATTERN.test(x))) {
        fail(`services[${i}].inputs must be an array of ^[a-z0-9_-]+$ strings`);
      }
    }
  }
}

export function validateTicket(obj: unknown): asserts obj is Ticket {
  if (typeof obj !== 'object' || obj === null) fail('ticket must be an object');
  const t = obj as Record<string, unknown>;
  if (t.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fail(`ticket schemaVersion must be ${CURRENT_SCHEMA_VERSION} (got: ${JSON.stringify(t.schemaVersion)})`);
  }
  if (typeof t.id !== 'string' || t.id.length === 0) fail('ticket.id must be a non-empty string');
  if (t.kind !== 'service' && t.kind !== 'manual') fail(`ticket.kind must be 'service' or 'manual'`);
  if (t.kind === 'manual' && t.service !== undefined) {
    fail('manual tickets must not carry a service field — a manual ticket is never executable');
  }
  if (t.kind === 'service' && (typeof t.service !== 'string' || t.service.length === 0)) {
    fail('service tickets must declare a non-empty service field referencing the catalog');
  }
  const validPriorities: Priority[] = ['low', 'normal', 'high', 'urgent'];
  if (!validPriorities.includes(t.priority as Priority)) fail(`ticket.priority invalid: ${JSON.stringify(t.priority)}`);
  const validStatuses: Status[] = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'];
  if (!validStatuses.includes(t.status as Status)) fail(`ticket.status invalid: ${JSON.stringify(t.status)}`);
  if (typeof t.attempts !== 'number' || t.attempts < 0) fail('ticket.attempts must be a non-negative number');
  if (!Array.isArray(t.history)) fail('ticket.history must be an array');
  if (t.inputs !== undefined) {
    if (typeof t.inputs !== 'object' || t.inputs === null) fail('ticket.inputs must be an object');
    for (const key of Object.keys(t.inputs as Record<string, unknown>)) {
      if (!INPUT_NAME_PATTERN.test(key)) fail(`ticket.inputs key fails allowlist: ${JSON.stringify(key)}`);
    }
  }
}
