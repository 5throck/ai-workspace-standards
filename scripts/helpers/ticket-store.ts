#!/usr/bin/env bun
// @version 1.0.0
// @l2-propagate: false
// ticket-store.ts — Atomic file I/O for the Phase A ticket queue. Every function
// takes an explicit directory/path so callers (CLI, skill, tests) never assume a
// fixed workspace location.
// Design: docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, statSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { load, dump, JSON_SCHEMA } from 'js-yaml';
import {
  CURRENT_SCHEMA_VERSION,
  canTransition,
  validateCatalog,
  validateTicket,
  type Catalog,
  type Kind,
  type Priority,
  type Status,
  type Ticket,
} from './ticket-schema.ts';

const MAX_YAML_BYTES = 64 * 1024;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function nowIso(): string {
  return new Date().toISOString();
}

function loadYamlCapped<T>(path: string): T {
  const stat = statSync(path);
  if (stat.size > MAX_YAML_BYTES) throw new Error(`[ticket-store] refusing to parse oversized YAML (${stat.size} bytes): ${path}`);
  return load(readFileSync(path, 'utf-8'), { schema: JSON_SCHEMA }) as T;
}

function ticketPath(dir: string, id: string): string {
  return join(dir, `${id}.yaml`);
}

function writeTicketAtomic(dir: string, ticket: Ticket): void {
  mkdirSync(dir, { recursive: true });
  const finalPath = ticketPath(dir, ticket.id);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, dump(ticket), 'utf-8');
  renameSync(tmpPath, finalPath);
}

export function readTicket(dir: string, id: string): Ticket {
  const path = ticketPath(dir, id);
  if (!existsSync(path)) throw new Error(`[ticket-store] ticket not found: ${id}`);
  const obj = loadYamlCapped<unknown>(path);
  validateTicket(obj);
  return obj;
}

export function listTickets(dir: string, filter?: { status?: Status; kind?: Kind }): Ticket[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.yaml') && !f.includes('.tmp-'));
  const tickets = files.map(f => {
    const obj = loadYamlCapped<unknown>(join(dir, f));
    validateTicket(obj);
    return obj;
  });
  return tickets.filter(t =>
    (filter?.status === undefined || t.status === filter.status) &&
    (filter?.kind === undefined || t.kind === filter.kind)
  );
}

function todayPrefix(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `T-${yyyy}${mm}${dd}`;
}

function nextSeqGuess(dir: string, prefix: string): number {
  if (!existsSync(dir)) return 1;
  const existing = readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.yaml'))
    .map(f => parseInt(f.slice(prefix.length + 1, prefix.length + 4), 10))
    .filter(n => !Number.isNaN(n));
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

export interface CreateTicketInput {
  kind: Kind;
  service?: string;
  title?: string;
  inputs?: Record<string, string>;
  priority: Priority;
}

/** Creates a ticket file with a collision-safe ID: computes a candidate seq from a
 * directory scan, then attempts an exclusive (`wx`) create, retrying on EEXIST. */
export function createTicket(dir: string, input: CreateTicketInput): Ticket {
  mkdirSync(dir, { recursive: true });
  const prefix = todayPrefix();
  const MAX_ATTEMPTS = 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seq = nextSeqGuess(dir, prefix) + attempt;
    const id = `${prefix}-${String(seq).padStart(3, '0')}`;
    const path = ticketPath(dir, id);
    let fd: number;
    try {
      fd = openSync(path, 'wx');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    closeSync(fd);
    const ticket: Ticket = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      kind: input.kind,
      service: input.kind === 'service' ? input.service : undefined,
      title: input.title,
      inputs: input.inputs,
      priority: input.priority,
      status: 'backlog',
      attempts: 0,
      created_at: nowIso(),
      history: [{ at: nowIso(), from: null, to: 'backlog' }],
      result: null,
      error: null,
    };
    validateTicket(ticket);
    writeTicketAtomic(dir, ticket); // overwrite the empty wx-created file with real content
    return ticket;
  }
  throw new Error(`[ticket-store] could not allocate a ticket id after ${MAX_ATTEMPTS} attempts`);
}

export interface MoveOptions {
  force?: boolean;
  error?: string;
}

export function moveTicket(dir: string, id: string, to: Status, opts: MoveOptions = {}): Ticket {
  const ticket = readTicket(dir, id);
  const from = ticket.status;
  if (!opts.force && !canTransition(from, to)) {
    throw new Error(`[ticket-store] transition ${from} -> ${to} is not allowed for ${id} (use --force to override)`);
  }
  ticket.status = to;
  ticket.history.push({ at: nowIso(), from, to });
  if (from === 'failed' && to === 'waiting') ticket.attempts += 1;
  if (to === 'failed' && opts.error !== undefined) ticket.error = opts.error;
  writeTicketAtomic(dir, ticket);
  return ticket;
}

/** Pulls the highest-priority waiting service ticket (urgent > high > normal > low,
 * then creation order) and atomically moves it to `running`. Never returns a manual ticket. */
export function nextServiceTicket(dir: string): Ticket | null {
  const candidates = listTickets(dir, { status: 'waiting', kind: 'service' })
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at));
  if (candidates.length === 0) return null;
  return moveTicket(dir, candidates[0].id, 'running', { force: false });
}

export function staleRunningTickets(dir: string, thresholdMinutes: number): Ticket[] {
  const now = Date.now();
  return listTickets(dir, { status: 'running' }).filter(t => {
    const runningSince = [...t.history].reverse().find(h => h.to === 'running')?.at ?? t.created_at;
    const ageMinutes = (now - new Date(runningSince).getTime()) / 60000;
    return ageMinutes > thresholdMinutes;
  });
}

export function loadCatalog(catalogPath: string): Catalog {
  const obj = loadYamlCapped<unknown>(catalogPath);
  validateCatalog(obj);
  return obj;
}

export interface ResolvedService {
  type: 'skill' | 'script';
  ref: string;
  absPath: string;
}

/** Looks up a service by id in an already-loaded, already-validated catalog and
 * re-asserts the resolved path stays under `workspaceRoot` (defense in depth —
 * validateCatalog already enforced the ref pattern at load time). */
export function resolveServiceRef(catalog: Catalog, serviceId: string, workspaceRoot: string): ResolvedService {
  const svc = catalog.services.find(s => s.id === serviceId);
  if (!svc) throw new Error(`[ticket-store] unknown service id: ${serviceId}`);
  const base = svc.run.type === 'script' ? svc.run.ref : join('skills', svc.run.ref);
  const root = resolve(workspaceRoot);
  const absPath = resolve(root, base);
  const rel = relative(root, absPath);
  if (rel === '' ? false : rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`[ticket-store] resolved service ref escapes workspace root: ${absPath}`);
  }
  return { type: svc.run.type, ref: svc.run.ref, absPath };
}
