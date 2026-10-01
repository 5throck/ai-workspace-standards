// @version 1.0.0
// T-20261001-009 — resolveTicketLocation: disambiguation of service vs governance
// ticket ids that share the same T-YYYYMMDD-NNN format across the two stores.
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTicket, moveTicket, resolveTicketLocation,
} from '../../scripts/helpers/ticket-store.ts';

let root: string;
let serviceDir: string;
let governanceDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ticket-ns-test-'));
  serviceDir = join(root, 'tickets');
  governanceDir = join(root, 'tickets', 'governance');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Copies a ticket file into the governance store under the SAME id — recreates
 * the production collision shape (T-20261001-007 exists in both stores). */
function cloneToGovernance(id: string): void {
  mkdirSync(governanceDir, { recursive: true });
  copyFileSync(join(serviceDir, `${id}.yaml`), join(governanceDir, `${id}.yaml`));
}

/** Creates a same-id twin in BOTH stores (the ambiguous-id fixture). */
function createAmbiguousPair() {
  const svc = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
  cloneToGovernance(svc.id);
  return svc.id;
}

describe('resolveTicketLocation', () => {
  test('bare id present only in the service store resolves to service', () => {
    const t = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
    const loc = resolveTicketLocation(serviceDir, governanceDir, t.id);
    expect(loc.kind).toBe('service');
    expect(loc.dir).toBe(serviceDir);
  });

  test('bare id present only in the governance store resolves to manual', () => {
    const t = createTicket(governanceDir, { kind: 'manual', title: 'gov only', priority: 'low' });
    const loc = resolveTicketLocation(serviceDir, governanceDir, t.id);
    expect(loc.kind).toBe('manual');
    expect(loc.dir).toBe(governanceDir);
  });

  test('bare id present in BOTH stores throws naming both paths and the fix', () => {
    const id = createAmbiguousPair();
    let err: Error | undefined;
    try {
      resolveTicketLocation(serviceDir, governanceDir, id);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain('ambiguous');
    expect(err!.message).toContain(`governance/${id}`);
    expect(err!.message).toContain(`service/${id}`);
    expect(err!.message).toContain(join(governanceDir, `${id}.yaml`));
    expect(err!.message).toContain(join(serviceDir, `${id}.yaml`));
  });

  test('explicit service/<id> form resolves the service record even when ambiguous', () => {
    const id = createAmbiguousPair();
    const loc = resolveTicketLocation(serviceDir, governanceDir, `service/${id}`);
    expect(loc.kind).toBe('service');
    expect(loc.dir).toBe(serviceDir);
    expect(loc.id).toBe(id);
  });

  test('explicit governance/<id> form resolves the governance record even when ambiguous', () => {
    const id = createAmbiguousPair();
    const loc = resolveTicketLocation(serviceDir, governanceDir, `governance/${id}`);
    expect(loc.kind).toBe('manual');
    expect(loc.dir).toBe(governanceDir);
    expect(loc.id).toBe(id);
  });

  test('explicit-form id drives moveTicket to the right record (end-to-end)', () => {
    const id = createAmbiguousPair();
    const moved = moveTicket(serviceDir, id, 'waiting');
    expect(moved.status).toBe('waiting');
  });

  test('unknown bare id errors listing both searched paths', () => {
    let err: Error | undefined;
    try {
      resolveTicketLocation(serviceDir, governanceDir, 'T-19990101-001');
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain('not found');
    expect(err!.message).toContain('T-19990101-001');
  });

  test('invalid id shape is rejected before any filesystem probe', () => {
    expect(() => resolveTicketLocation(serviceDir, governanceDir, '../escape')).toThrow(/invalid ticket id/);
  });
});
