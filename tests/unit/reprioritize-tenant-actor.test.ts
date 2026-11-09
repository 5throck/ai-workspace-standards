/**
 * spoke-tenant actor grammar for the delegation kanban priority governance
 * (design docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.3,
 * WP1): parseActor/strikeKeyFor/checkReprioritize over the
 * `spoke-tenant:gw-<12hex>` namespace, plus store-level behavior via
 * reprioritizeTicket — history[] records the actor verbatim, P0 stays
 * user-only, the +1/24h cap and the 3-strike freeze ledger key PER TENANT ID
 * (never colliding with spoke-pm keys).
 *
 * @version 1.0.0
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import {
  checkReprioritize,
  parseActor,
  strikeKeyFor,
  STRIKES_FILE_NAME,
  FROZEN_THRESHOLD,
  isFrozen,
  loadStrikes,
  ReprioritizeRefusedError,
} from '../../scripts/helpers/reprioritize.ts';
import { readTicket, reprioritizeTicket } from '../../scripts/helpers/ticket-store.ts';
import type { Ticket } from '../../scripts/helpers/ticket-schema.ts';

const TENANT = 'gw-0123456789ab';

describe('parseActor — the tenant grammar is strict (design §3.1 id shape)', () => {
  test('accepts spoke-tenant:gw-<12hex>', () => {
    expect(parseActor(`spoke-tenant:${TENANT}`)).toBe(`spoke-tenant:${TENANT}`);
  });
  test('rejects short/long/non-hex/uppercase/fleet ids', () => {
    expect(parseActor('spoke-tenant:gw-0123456789a')).toBeNull(); // 11 hex
    expect(parseActor('spoke-tenant:gw-0123456789abc')).toBeNull(); // 13 hex
    expect(parseActor('spoke-tenant:gw-0123456789AB')).toBeNull(); // uppercase
    expect(parseActor('spoke-tenant:gw-zzzzzzzzzzzz')).toBeNull(); // not hex
    expect(parseActor('spoke-tenant:co-myproject')).toBeNull(); // fleet namespace
    expect(parseActor('spoke-tenant:')).toBeNull();
  });
  test('the pre-existing grammars are unchanged', () => {
    expect(parseActor('user')).toBe('user');
    expect(parseActor('hub-pm')).toBe('hub-pm');
    expect(parseActor('spoke-pm:co-myproject')).toBe('spoke-pm:co-myproject');
    expect(parseActor('nonsense')).toBeNull();
  });
});

describe('strikeKeyFor — tenant actors key on the tenant id, separate namespace', () => {
  test('spoke-tenant key is the tenant id', () => {
    expect(strikeKeyFor(`spoke-tenant:${TENANT}`)).toBe(TENANT);
  });
  test('tenant keys never collide with spoke-pm project-name keys', () => {
    // A spoke project literally named gw-0123456789ab would key identically ONLY
    // if the grammar collided — it cannot: spoke-pm names are not gw ids here,
    // and the slice prefixes differ.
    expect(strikeKeyFor(`spoke-pm:co-myproject`)).toBe('co-myproject');
    expect(strikeKeyFor('hub-pm')).toBe('hub-pm');
    expect(strikeKeyFor('user')).toBeNull();
  });
});

describe('checkReprioritize — tenant actors follow the spoke-pm write rules', () => {
  const actor = `spoke-tenant:${TENANT}` as const;

  test('a +1 raise is allowed', () => {
    expect(checkReprioritize(actor, 'normal', 'high').allowed).toBe(true);
  });
  test('a +2 raise is refused with raise-cap (violation)', () => {
    const v = checkReprioritize(actor, 'low', 'high');
    expect(v.allowed).toBe(false);
    if (!v.allowed) {
      expect(v.code).toBe('raise-cap');
      expect(v.violation).toBe(true);
    }
  });
  test('P0/urgent stays user-only (violation feeds the ledger)', () => {
    const v = checkReprioritize(actor, 'normal', 'urgent');
    expect(v.allowed).toBe(false);
    if (!v.allowed) {
      expect(v.code).toBe('p0-user-only');
      expect(v.violation).toBe(true);
    }
  });
  test('a second raise within 24h of the last raise is refused (raise-window)', () => {
    const v = checkReprioritize(actor, 'normal', 'high', { nowMs: 1_000, lastRaiseAt: '2026-11-08T00:00:00.000Z' });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.code).toBe('raise-window');
  });
  test('lowering is unrestricted', () => {
    expect(checkReprioritize(actor, 'high', 'low').allowed).toBe(true);
  });
});

describe('reprioritizeTicket with a tenant actor (store level)', () => {
  let dir: string;
  let stateDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tenant-actor-store-'));
    stateDir = mkdtempSync(join(tmpdir(), 'tenant-actor-strikes-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  });

  function writeTicket(id = 'U-20261108-001'): void {
    const t: Ticket = {
      schemaVersion: 1,
      id,
      kind: 'manual',
      title: 'Upstream report from co-test',
      priority: 'normal',
      status: 'backlog',
      attempts: 0,
      created_at: '2026-11-08T00:00:00.000Z',
      history: [{ at: '2026-11-08T00:00:00.000Z', from: null, to: 'backlog' }],
      result: null,
      error: null,
      upstream: {
        project: 'co-test',
        variant: 'co-test',
        template_version: '0.8.3',
        source: 'project/co-test',
        trust: 'untrusted',
        suspected_layer: 'L2',
        symptom: 'Priority drift after the sync wave.',
        affected_paths: ['scripts/SCRIPTS.md'],
        triage: 'inbox',
        flagged: false,
        triage_reasons: [],
        dedupe_key: 'a'.repeat(64),
        duplicates: [],
      } as Ticket['upstream'],
    } as Ticket;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.yaml`), dump(t), 'utf-8');
  }

  test('an allowed raise records the tenant actor VERBATIM in history[]', () => {
    writeTicket();
    const t = reprioritizeTicket(dir, 'U-20261108-001', 'high', `spoke-tenant:${TENANT}`);
    expect(t.priority).toBe('high');
    const last = t.history[t.history.length - 1];
    expect(last.actor).toBe(`spoke-tenant:${TENANT}`);
    expect((last as unknown as { action: string }).action).toBe('reprioritize');
    expect(readTicket(dir, 'U-20261108-001').priority).toBe('high');
  });

  test('P0 attempt is refused AND recorded as a strike keyed on the tenant id', () => {
    writeTicket();
    expect(() => reprioritizeTicket(dir, 'U-20261108-001', 'urgent', `spoke-tenant:${TENANT}`, { stateDir }))
      .toThrow(ReprioritizeRefusedError);
    const state = loadStrikes(stateDir);
    expect(state.projects[TENANT]?.violations).toBe(1);
    expect(Object.keys(state.projects)).toEqual([TENANT]); // keyed per tenant id
  });

  test('three violations freeze the TENANT id; a spoke-pm actor with the same suffix is unaffected', () => {
    writeTicket();
    for (let i = 0; i < FROZEN_THRESHOLD; i++) {
      expect(() => reprioritizeTicket(dir, 'U-20261108-001', 'urgent', `spoke-tenant:${TENANT}`, { stateDir }))
        .toThrow(ReprioritizeRefusedError);
    }
    const state = loadStrikes(stateDir);
    expect(isFrozen(state, TENANT)).toBe(true);
    // Frozen gate: even a legal raise is refused with the frozen typed error.
    expect(() => reprioritizeTicket(dir, 'U-20261108-001', 'high', `spoke-tenant:${TENANT}`, { stateDir }))
      .toThrow(/frozen/);
    // A DIFFERENT tenant id has its own (empty) ledger entry.
    const other = 'gw-ffffffffffff';
    expect(() => reprioritizeTicket(dir, 'U-20261108-001', 'high', `spoke-tenant:${other}`, { stateDir }))
      .not.toThrow();
    expect(readTicket(dir, 'U-20261108-001').priority).toBe('high');
    expect(existsSync(join(stateDir, STRIKES_FILE_NAME))).toBe(true);
    const persisted = JSON.parse(readFileSync(join(stateDir, STRIKES_FILE_NAME), 'utf-8')) as { projects: Record<string, unknown> };
    expect(Object.keys(persisted.projects)).toContain(TENANT);
    expect(Object.keys(persisted.projects)).not.toContain(other);
  });
});
