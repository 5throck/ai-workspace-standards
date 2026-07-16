# Local Service Ticket + Kanban (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a workspace-root-only (L0) file-based service ticket queue and kanban that covers both AI-executed service requests (`kind: service`) and plain human tasks (`kind: manual`), replacing the never-implemented 2026-05-28 Kanban design.

**Architecture:** A service catalog (`services.yaml`) declares executable services by referencing existing scripts/skills. A ticket queue (`tickets/*.yaml`, one file per ticket, gitignored) tracks work through a state machine (`backlog→waiting→running→review→done|failed`) enforced by a shared validator (`scripts/helpers/ticket-schema.ts`). A CLI (`scripts/ticket.ts`) provides create/list/next/move/board/doctor. A skill (`skills/ticket-run/SKILL.md`) pulls the next service ticket and executes it safely (allowlisted ref, array-form spawn, validated inputs).

**Tech Stack:** Bun + TypeScript, `js-yaml` (already a workspace devDependency), `bun:test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md`
**Roadmap:** `docs/designs/ai-workspace-service-platform-roadmap.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/workspace-schema.json` (modify) | Add `services.yaml` to `rootAllowlist.files` and `tickets` to `rootAllowlist.dirs` so `audit.ts`'s stray-root-artifact check doesn't flag the new root file/dir |
| `scripts/helpers/ticket-schema.ts` (create) | Types, `TRANSITIONS` table, `canTransition`, `validateCatalog`, `validateTicket` — pure, no file I/O |
| `scripts/helpers/ticket-store.ts` (create) | File I/O: atomic ticket create (`wx`-flag ID collision retry), atomic status update (temp+rename), `listTickets`, `loadCatalog`, `resolveServiceRef` (allowlist + root-boundary check), stale-`running` detection — all functions take an explicit `ticketsDir`/`catalogPath` so tests never touch the real `tickets/` |
| `scripts/ticket.ts` (create) | Thin CLI: parses argv, calls `ticket-store.ts` functions, prints console/`--json`/`--html` output |
| `services.yaml` (create, root) | Seed catalog: one real service (`audit` → `scripts/audit.ts`) |
| `skills/ticket-run/SKILL.md` (create) | Pulls next `kind: service` ticket via `ticket.ts next`, executes via array-form `Bun.spawn`, moves to `review`/`failed` |
| `.gitignore` (modify) | Ignore `tickets/*.yaml`, keep `tickets/.gitkeep` tracked |
| `scripts/SCRIPTS.md` (modify) | Register `ticket.ts` (layer: `L0`, not propagated) |
| `tests/unit/ticket-schema.test.ts` (create) | Exhaustive transition-matrix + catalog/ticket validation tests |
| `tests/unit/ticket-store.test.ts` (create) | ID collision, atomic write, priority ordering, stale detection, ref-allowlist tests (all against a `tmpdir`) |

---

## Task 1: Root allowlist update

**Files:**
- Modify: `docs/workspace-schema.json:80-107` (`rootAllowlist.files` and `rootAllowlist.dirs`)

- [ ] **Step 1: Add the new root entries**

In `docs/workspace-schema.json`, inside `rootAllowlist.files`, add `"services.yaml"` (keep alphabetical grouping consistent with surrounding entries — insert near `propagation-map.json`). Inside `rootAllowlist.dirs`, add `"tickets"` (insert near `"templates"`).

- [ ] **Step 2: Verify audit.ts no longer needs these files to exist yet**

Run: `bun scripts/audit.ts 2>&1 | grep -i "stray"`
Expected: no output (no stray-artifact failures) — this check passes whether or not `services.yaml`/`tickets/` exist yet, since it only flags *unlisted* tracked items.

- [ ] **Step 3: Commit is deferred to the end of this plan (see Task 10)** — do not commit yet; this repo commits only via `/sync` and the user asked for a single commit after all tasks land.

---

## Task 2: Ticket schema — types, transitions, validation (pure logic)

**Files:**
- Create: `scripts/helpers/ticket-schema.ts`
- Test: `tests/unit/ticket-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/ticket-schema.test.ts
import { test, expect, describe } from 'bun:test';
import {
  CURRENT_SCHEMA_VERSION,
  TRANSITIONS,
  canTransition,
  validateCatalog,
  validateTicket,
  type Status,
} from '../../scripts/helpers/ticket-schema.ts';

const ALL_STATUSES: Status[] = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'];

describe('canTransition (exhaustive matrix)', () => {
  const expectedAllowed = new Set([
    'backlog->waiting',
    'waiting->running',
    'waiting->review',
    'running->review',
    'running->failed',
    'review->done',
    'failed->waiting',
  ]);

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      test(`${from} -> ${to} is ${expectedAllowed.has(`${from}->${to}`) ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expectedAllowed.has(`${from}->${to}`));
      });
    }
  }
});

describe('validateCatalog', () => {
  test('accepts a well-formed catalog', () => {
    const catalog = {
      schemaVersion: 1,
      services: [
        { id: 'audit', name: 'Workspace Audit', run: { type: 'script', ref: 'scripts/audit.ts' } },
      ],
    };
    expect(() => validateCatalog(catalog)).not.toThrow();
  });

  test('rejects missing schemaVersion', () => {
    const catalog = { services: [] };
    expect(() => validateCatalog(catalog)).toThrow(/schemaVersion/);
  });

  test('rejects a script ref outside the allowlist pattern', () => {
    const catalog = {
      schemaVersion: 1,
      services: [
        { id: 'evil', name: 'Evil', run: { type: 'script', ref: '../../.githooks/pre-commit' } },
      ],
    };
    expect(() => validateCatalog(catalog)).toThrow(/ref/i);
  });

  test('rejects an unknown run.type', () => {
    const catalog = {
      schemaVersion: 1,
      services: [{ id: 'x', name: 'X', run: { type: 'shell', ref: 'echo hi' } }],
    };
    expect(() => validateCatalog(catalog)).toThrow();
  });
});

describe('validateTicket', () => {
  const base = {
    schemaVersion: 1,
    id: 'T-20260716-001',
    priority: 'normal',
    status: 'backlog',
    attempts: 0,
    created_at: '2026-07-16T10:00:00+09:00',
    history: [],
    result: null,
    error: null,
  };

  test('accepts a well-formed service ticket', () => {
    const ticket = { ...base, kind: 'service', service: 'audit' };
    expect(() => validateTicket(ticket)).not.toThrow();
  });

  test('accepts a well-formed manual ticket with no service field', () => {
    const ticket = { ...base, kind: 'manual', title: 'Fix typo in README' };
    expect(() => validateTicket(ticket)).not.toThrow();
  });

  test('rejects a manual ticket that carries a service field', () => {
    const ticket = { ...base, kind: 'manual', service: 'audit', title: 'sneaky' };
    expect(() => validateTicket(ticket)).toThrow(/manual.*service|service.*manual/i);
  });

  test('rejects a service ticket with no service field', () => {
    const ticket = { ...base, kind: 'service' };
    expect(() => validateTicket(ticket)).toThrow(/service/i);
  });

  test('rejects missing schemaVersion', () => {
    const { schemaVersion, ...rest } = base;
    const ticket = { ...rest, kind: 'manual', title: 'x' };
    expect(() => validateTicket(ticket)).toThrow(/schemaVersion/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/ticket-schema.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/helpers/ticket-schema.ts'`

- [ ] **Step 3: Implement `scripts/helpers/ticket-schema.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/ticket-schema.test.ts`
Expected: PASS (all transition-matrix cases + catalog/ticket validation cases)

- [ ] **Step 5: Commit is deferred (see Task 10)**

---

## Task 3: Ticket store — atomic file I/O

**Files:**
- Create: `scripts/helpers/ticket-store.ts`
- Test: `tests/unit/ticket-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/ticket-store.test.ts
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTicket,
  listTickets,
  moveTicket,
  nextServiceTicket,
  staleRunningTickets,
  loadCatalog,
  resolveServiceRef,
} from '../../scripts/helpers/ticket-store.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ticket-store-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createTicket', () => {
  test('creates a service ticket with backlog status and history entry', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(t.status).toBe('backlog');
    expect(t.history).toHaveLength(1);
    expect(t.history[0].to).toBe('backlog');
    expect(t.id).toMatch(/^T-\d{8}-\d{3}$/);
  });

  test('creates a manual ticket with a title and no service field', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'Fix typo', priority: 'low' });
    expect(t.kind).toBe('manual');
    expect(t.service).toBeUndefined();
  });

  test('assigns non-colliding IDs for rapid successive creates', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const t = createTicket(dir, { kind: 'manual', title: `task ${i}`, priority: 'normal' });
      ids.add(t.id);
    }
    expect(ids.size).toBe(10);
  });
});

describe('moveTicket', () => {
  test('allows an adjacent transition without --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    const moved = moveTicket(dir, t.id, 'waiting', { force: false });
    expect(moved.status).toBe('waiting');
    expect(moved.history).toHaveLength(2);
  });

  test('rejects a non-adjacent transition without --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    expect(() => moveTicket(dir, t.id, 'done', { force: false })).toThrow();
  });

  test('allows a non-adjacent transition with --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    const moved = moveTicket(dir, t.id, 'done', { force: true });
    expect(moved.status).toBe('done');
  });

  test('failed -> waiting increments attempts', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    moveTicket(dir, t.id, 'failed', { force: false });
    const retried = moveTicket(dir, t.id, 'waiting', { force: false });
    expect(retried.attempts).toBe(1);
  });
});

describe('nextServiceTicket', () => {
  test('returns the highest-priority waiting service ticket and moves it to running', () => {
    const low = createTicket(dir, { kind: 'service', service: 'audit', priority: 'low' });
    moveTicket(dir, low.id, 'waiting', { force: false });
    const urgent = createTicket(dir, { kind: 'service', service: 'audit', priority: 'urgent' });
    moveTicket(dir, urgent.id, 'waiting', { force: false });

    const picked = nextServiceTicket(dir);
    expect(picked?.id).toBe(urgent.id);
    expect(picked?.status).toBe('running');
  });

  test('never returns a manual ticket, even if waiting', () => {
    const manual = createTicket(dir, { kind: 'manual', title: 'x', priority: 'urgent' });
    moveTicket(dir, manual.id, 'waiting', { force: false });
    expect(nextServiceTicket(dir)).toBeNull();
  });

  test('returns null when no waiting service tickets exist', () => {
    expect(nextServiceTicket(dir)).toBeNull();
  });
});

describe('staleRunningTickets', () => {
  test('flags a running ticket older than the threshold', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    // Threshold of -1 minute makes every running ticket immediately "stale" for test purposes.
    const stale = staleRunningTickets(dir, -1);
    expect(stale.map(s => s.id)).toContain(t.id);
  });

  test('does not flag a fresh running ticket against a generous threshold', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    const stale = staleRunningTickets(dir, 60);
    expect(stale.map(s => s.id)).not.toContain(t.id);
  });
});

describe('loadCatalog + resolveServiceRef', () => {
  test('resolves a valid catalog service to an in-root path', () => {
    const catalogPath = join(dir, 'services.yaml');
    writeFileSync(catalogPath, [
      'schemaVersion: 1',
      'services:',
      '  - id: audit',
      '    name: Workspace Audit',
      '    run: { type: script, ref: scripts/audit.ts }',
      '',
    ].join('\n'));
    const catalog = loadCatalog(catalogPath);
    const resolved = resolveServiceRef(catalog, 'audit', dir);
    expect(resolved.absPath.startsWith(dir)).toBe(true);
    expect(resolved.type).toBe('script');
  });

  test('throws for a service id not present in the catalog', () => {
    const catalogPath = join(dir, 'services.yaml');
    writeFileSync(catalogPath, 'schemaVersion: 1\nservices: []\n');
    const catalog = loadCatalog(catalogPath);
    expect(() => resolveServiceRef(catalog, 'nonexistent', dir)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/ticket-store.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/helpers/ticket-store.ts'`

- [ ] **Step 3: Implement `scripts/helpers/ticket-store.ts`**

```typescript
#!/usr/bin/env bun
// @version 1.0.0
// @l2-propagate: false
// ticket-store.ts — Atomic file I/O for the Phase A ticket queue. Every function
// takes an explicit directory/path so callers (CLI, skill, tests) never assume a
// fixed workspace location.
// Design: docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  const obj = loadYamlCapped<unknown>(ticketPath(dir, id));
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
  const absPath = resolve(workspaceRoot, base);
  if (!absPath.startsWith(resolve(workspaceRoot))) {
    throw new Error(`[ticket-store] resolved service ref escapes workspace root: ${absPath}`);
  }
  return { type: svc.run.type, ref: svc.run.ref, absPath };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/ticket-store.test.ts`
Expected: PASS (all createTicket/moveTicket/nextServiceTicket/staleRunningTickets/loadCatalog cases)

- [ ] **Step 5: Commit is deferred (see Task 10)**

---

## Task 4: Seed service catalog

**Files:**
- Create: `services.yaml` (workspace root)

- [ ] **Step 1: Write the file**

```yaml
schemaVersion: 1
services:
  - id: audit
    name: Workspace Audit
    description: Run the workspace QA gate (scripts/audit.ts)
    run: { type: script, ref: scripts/audit.ts }
schedule: []
```

- [ ] **Step 2: Verify it loads and validates**

Run: `bun -e "import { loadCatalog } from './scripts/helpers/ticket-store.ts'; console.log(loadCatalog('services.yaml'))"`
Expected: prints the parsed catalog object, no thrown error

---

## Task 5: CLI — `create`, `list`, `move`, `doctor`

**Files:**
- Create: `scripts/ticket.ts`

- [ ] **Step 1: Implement the CLI**

```typescript
#!/usr/bin/env bun
// @version 1.0.0
// @l2-propagate: false
// ticket.ts — CLI for the Phase A Service Ticket + Kanban system (workspace root only).
// Usage: bun scripts/ticket.ts <command> [args]
// Design: docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md

import { resolve, join } from 'node:path';
import {
  createTicket, listTickets, moveTicket, nextServiceTicket, staleRunningTickets, loadCatalog,
} from './helpers/ticket-store.ts';
import type { Priority, Status } from './helpers/ticket-schema.ts';

const workspaceRoot = resolve(import.meta.dir, '..');
const ticketsDir = join(workspaceRoot, 'tickets');
const catalogPath = join(workspaceRoot, 'services.yaml');

const [, , cmd, ...rest] = process.argv;

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(args[i]);
  }
  return { positional, flags };
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

switch (cmd) {
  case 'create': {
    const { positional, flags } = parseFlags(rest);
    const priority = (flags.priority as Priority) ?? 'normal';
    if (flags.manual) {
      const title = positional[0];
      if (!title) fail('usage: ticket.ts create --manual "<title>" [--priority low|normal|high|urgent]');
      const t = createTicket(ticketsDir, { kind: 'manual', title, priority });
      console.log(`✅ Created manual ticket ${t.id}: ${title}`);
    } else {
      const serviceId = positional[0];
      if (!serviceId) fail('usage: ticket.ts create <service-id> [--priority ...] [--inputs \'{"k":"v"}\']');
      const catalog = loadCatalog(catalogPath);
      if (!catalog.services.some(s => s.id === serviceId)) fail(`unknown service id: ${serviceId} (see services.yaml)`);
      const inputs = flags.inputs ? JSON.parse(flags.inputs as string) : undefined;
      const t = createTicket(ticketsDir, { kind: 'service', service: serviceId, priority, inputs });
      console.log(`✅ Created service ticket ${t.id} for '${serviceId}'`);
    }
    break;
  }
  case 'list': {
    const { flags } = parseFlags(rest);
    const tickets = listTickets(ticketsDir, { status: flags.status as Status | undefined });
    if (flags.json) console.log(JSON.stringify(tickets, null, 2));
    else for (const t of tickets) console.log(`${t.id}  [${t.status}]  ${t.kind === 'service' ? t.service : t.title}  (${t.priority})`);
    break;
  }
  case 'next': {
    const picked = nextServiceTicket(ticketsDir);
    if (!picked) { console.log('No waiting service tickets.'); break; }
    console.log(JSON.stringify(picked, null, 2));
    break;
  }
  case 'move': {
    const { positional, flags } = parseFlags(rest);
    const [id, status] = positional;
    if (!id || !status) fail('usage: ticket.ts move <id> <status> [--force]');
    const moved = moveTicket(ticketsDir, id, status as Status, { force: Boolean(flags.force) });
    console.log(`✅ ${id} -> ${moved.status}`);
    break;
  }
  case 'doctor': {
    const { flags } = parseFlags(rest);
    const thresholdMinutes = flags.minutes ? Number(flags.minutes) : 30;
    const stale = staleRunningTickets(ticketsDir, thresholdMinutes);
    if (stale.length === 0) { console.log('No stale running tickets.'); break; }
    for (const t of stale) console.log(`⚠️  ${t.id} has been running > ${thresholdMinutes}m`);
    break;
  }
  default:
    console.log('usage: bun scripts/ticket.ts <create|list|next|move|board|doctor> ...');
    process.exit(cmd ? 1 : 0);
}
```

- [ ] **Step 2: Manual smoke test (create, list, move)**

Run:
```bash
bun scripts/ticket.ts create audit --priority high
bun scripts/ticket.ts list
bun scripts/ticket.ts move T-<today>-001 waiting
bun scripts/ticket.ts next
bun scripts/ticket.ts move T-<today>-001 review
bun scripts/ticket.ts move T-<today>-001 done
bun scripts/ticket.ts list --json
```
Expected: each command prints a success line; the final `list --json` shows the ticket with `status: done` and 4 history entries. Clean up the test ticket file afterward: `rm tickets/T-<today>-001.yaml`.

- [ ] **Step 3: Commit is deferred (see Task 10)**

---

## Task 6: CLI — `board` (console + `--html`)

**Files:**
- Modify: `scripts/ticket.ts` (add the `board` case)

- [ ] **Step 1: Add an `escapeHtml` helper and the `board` case**

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

Add before the `switch (cmd)` block, then add this case inside the switch:

```typescript
  case 'board': {
    const { flags } = parseFlags(rest);
    const tickets = listTickets(ticketsDir);
    const lanes: Status[] = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'];
    if (flags.html) {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Ticket Board</title>
<style>body{font-family:sans-serif}.lane{display:inline-block;vertical-align:top;width:180px;margin:8px;padding:8px;border:1px solid #ccc}.card{border:1px solid #999;margin:4px 0;padding:4px;font-size:12px}</style>
</head><body>
${lanes.map(lane => `<div class="lane"><h3>${escapeHtml(lane)}</h3>${tickets.filter(t => t.status === lane).map(t => `<div class="card">${escapeHtml(t.id)}<br>${escapeHtml(t.kind === 'service' ? (t.service ?? '') : (t.title ?? ''))}</div>`).join('')}</div>`).join('')}
</body></html>`;
      console.log(html);
    } else {
      for (const lane of lanes) {
        console.log(`\n## ${lane}`);
        for (const t of tickets.filter(t => t.status === lane)) console.log(`  ${t.id}  ${t.kind === 'service' ? t.service : t.title}`);
      }
    }
    break;
  }
```

- [ ] **Step 2: Manual smoke test**

Run: `bun scripts/ticket.ts board --html > /tmp/board.html && grep -c "Content-Security-Policy" /tmp/board.html`
Expected: `1`

- [ ] **Step 3: Commit is deferred (see Task 10)**

---

## Task 7: `skills/ticket-run/SKILL.md`

**Files:**
- Create: `skills/ticket-run/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: ticket-run
status: active
scope: local
description: >
  Pulls the next waiting service ticket from the Phase A ticket queue and executes
  its referenced skill or script. Use when: processing the local service ticket
  queue, running "/ticket-run".
owner: automation-engineer
version: 1.0.0
last_reviewed: 2026-07-16
prerequisites: []
metadata:
  type: process
  triggers:
    - ticket-run
    - process ticket queue
    - run next ticket
---

## Context

Executes exactly one `kind: service` ticket per invocation (no internal polling loop — repeated processing is the caller's responsibility). Never touches `kind: manual` tickets. Design: `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md`.

## Execution Steps

1. Run `bun scripts/ticket.ts next`. If it prints "No waiting service tickets.", stop.
2. Otherwise parse the printed ticket JSON. Load `services.yaml`, look up `ticket.service` in the catalog (this is the only place `run.ref` is read from — never from ticket content).
3. Execute via array-form spawn only — never build a shell command string:
   - `run.type: script` → `Bun.spawn(['bun', absPath, '--inputs-json', JSON.stringify(ticket.inputs ?? {})])`
   - `run.type: skill` → invoke the named skill, passing `ticket.inputs` as its argument object
4. On success (exit code 0): `bun scripts/ticket.ts move <id> review`
5. On failure: `bun scripts/ticket.ts move <id> failed`, and write the captured stderr/stdout tail into the ticket's `error` field via a follow-up `ticket.ts` write (implementation note: this requires either extending `moveTicket` with an optional `error` payload, or a small `ticket.ts set-error <id> "<text>"` command — add whichever is simpler when implementing this step; not detailed further here since it is a small mechanical extension of Task 5/6's CLI, not a new design decision).

## Related

- `scripts/ticket.ts`, `scripts/helpers/ticket-store.ts`, `scripts/helpers/ticket-schema.ts`
- `scripts/dispatch.ts` — a *different*, session-scoped mechanism; a service's own execution may invoke it internally, but `ticket-run` itself does not.
```

- [ ] **Step 2: No automated test for this step** (it is a documentation/process file consumed by the agent runtime, not executable TypeScript) — review by reading it back once written.

---

## Task 8: `.gitignore` — ticket instances excluded, directory preserved

**Files:**
- Modify: `.gitignore`
- Create: `tickets/.gitkeep`

- [ ] **Step 1: Add the negation + ignore rule**

`.gitignore` line 10 is a blanket `/*/` rule that ignores every root-level directory; each tracked directory is un-ignored individually via a `!<dir>/` negation block at lines 74-105 (e.g. `!scripts/`, `!tests/`). Without a matching negation, `tickets/*.yaml` alone would have no effect — the whole `tickets/` directory, including `.gitkeep`, would stay invisible to git.

Add both lines to `.gitignore`:
1. `!tickets/` — insert in the negation block near line 105 (after `!tests/`)
2. `tickets/*.yaml` — append near the end of the file, after the `!tests/` negation block (e.g. near the CodeGraph/Sandbox section around line 113), so it takes effect within the now-un-ignored `tickets/` directory

- [ ] **Step 2: Create the placeholder so the directory itself is tracked**

Run: `mkdir -p tickets && touch tickets/.gitkeep`

- [ ] **Step 3: Verify**

Run: `git status --porcelain tickets/`
Expected: `?? tickets/.gitkeep` (the directory is now visible to git and the placeholder is untracked, pending the Task 10 commit).

Run: `bun scripts/ticket.ts create audit --priority normal && git status --porcelain tickets/`
Expected: still only `?? tickets/.gitkeep` — the newly created `T-*.yaml` ticket file does **not** appear, confirming `tickets/*.yaml` is correctly ignored. Clean up: `rm tickets/T-*.yaml`.

---

## Task 9: Register in `scripts/SCRIPTS.md`

**Files:**
- Modify: `scripts/SCRIPTS.md` (Registry table)

- [ ] **Step 1: Add the registry rows**

Helper modules under `scripts/helpers/` **do** get their own Registry rows in this repo (confirmed precedent: `helpers/merge-frontmatter.ts`, `helpers/beta-lifecycle.ts`, `helpers/pm-md-parser.ts` are all individually listed). Add three rows to the `## Registry` table, all with `layer: L0` (not `L0+L1` — these are intentionally workspace-root-only per the design's L0 boundary decision; do not add any of them to `templates/common/scripts/`):

```
| `ticket.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/ticket-schema.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/ticket-store.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
```

- [ ] **Step 2: Verify**

Run: `bun scripts/verify-scripts.ts 2>&1 | tail -20`
Expected: no new failures introduced by the added row (pre-existing unrelated failures, if any, are out of scope for this plan).

---

## Task 10: Full verification, CHANGELOG, and single commit

**Files:**
- Modify: `CHANGELOG.md` (single `[Unreleased]` entry for this whole feature — not per ticket-transition, per spec §4)
- Modify: `memory/YYYY-MM-DD.md` (today's daily log)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: PASS, including the new `tests/unit/ticket-schema.test.ts` and `tests/unit/ticket-store.test.ts`

- [ ] **Step 2: Run the workspace audit**

Run: `bun scripts/audit.ts`
Expected: no new failures (specifically: no "stray directory/file in workspace root" for `services.yaml` or `tickets/`, confirming Task 1 worked)

- [ ] **Step 3: Add the CHANGELOG entry**

Use the `/changelog` skill (per this repo's policy) to add one `[Unreleased]` entry summarizing: "feat(tickets): add Phase A local file-based Service Ticket + Kanban (`services.yaml`, `tickets/`, `scripts/ticket.ts`, `skills/ticket-run`) — replaces the never-implemented 2026-05-28 Kanban design; see design doc and roadmap." Do not add a second entry — per spec §4, individual ticket status transitions never get their own changelog entries.

- [ ] **Step 4: Confirm the design docs already written this session are included**

Files already on disk from the brainstorming phase (no action needed, just confirm they exist before committing): `docs/designs/ai-workspace-service-platform-roadmap.md`, `docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md`, `memory/meeting-2026-07-16-ticket-kanban-design-review.md`, the supersede-note edit in `memory/archive/meeting-2026-05-28-kanban-process-design.md`, and the `memory/MEMORY.md` index line update.

- [ ] **Step 5: Single commit via `/sync`**

This repo forbids direct `git commit`/`git push` (pre-commit hook enforces this; CLAUDE.md explicitly forbids `--no-verify` bypass). Use the `/sync` skill to run the full pipeline (memlog → sync-md → changelog check → audit → commit → PR) for all files touched by this plan plus the earlier design docs, as a single PR.
