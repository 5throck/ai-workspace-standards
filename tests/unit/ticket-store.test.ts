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

  test('sets the error field when moving to failed with an error message', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    const failed = moveTicket(dir, t.id, 'failed', { error: 'boom' });
    expect(failed.error).toBe('boom');
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

  test('throws when a service ref resolves to a sibling directory outside workspaceRoot', () => {
    // Construct the Catalog object directly (bypassing validateCatalog / the YAML
    // allowlist regex) so this test isolates what resolveServiceRef itself catches.
    // A bare `absPath.startsWith(resolve(workspaceRoot))` string check would wrongly
    // accept this: resolve(dir, '../<basename(dir)>_evil/hack.ts') is a sibling
    // directory whose path happens to start with the same string prefix as `dir`.
    const catalog = {
      schemaVersion: 1,
      services: [
        { id: 'evil', name: 'Evil', run: { type: 'script' as const, ref: '../' + join(dir).split(/[\\/]/).pop() + '_evil/hack.ts' } },
      ],
    };
    expect(() => resolveServiceRef(catalog, 'evil', dir)).toThrow();
  });
});
