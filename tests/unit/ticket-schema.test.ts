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

describe('validateTicket attempts ↔ history (T-20260917-003)', () => {
  const base = {
    schemaVersion: 1,
    id: 'T-20260917-100',
    kind: 'service',
    service: 'audit',
    priority: 'normal',
    status: 'waiting',
    attempts: 0,
    created_at: '2026-09-17T10:00:00+09:00',
    history: [{ at: '2026-09-17T10:00:00+09:00', from: null, to: 'backlog' }],
    result: null,
    error: null,
  };

  test('accepts attempts 0 with no failed → waiting transitions', () => {
    expect(() => validateTicket({ ...base })).not.toThrow();
  });

  test('accepts attempts equal to the failed → waiting transition count', () => {
    const ticket = {
      ...base,
      status: 'running',
      attempts: 1,
      history: [
        ...base.history,
        { at: '2026-09-17T11:00:00+09:00', from: 'backlog', to: 'waiting' },
        { at: '2026-09-17T12:00:00+09:00', from: 'waiting', to: 'running' },
        { at: '2026-09-17T13:00:00+09:00', from: 'running', to: 'failed' },
        { at: '2026-09-17T14:00:00+09:00', from: 'failed', to: 'waiting' },
        { at: '2026-09-17T15:00:00+09:00', from: 'waiting', to: 'running' },
      ],
    };
    expect(() => validateTicket(ticket)).not.toThrow();
  });

  test('rejects attempts drifting above the derived count', () => {
    const ticket = { ...base, attempts: 1 };
    expect(() => validateTicket(ticket)).toThrow(/attempts.*failed.*waiting|failed.*waiting.*attempts/i);
  });

  test('rejects attempts left at 0 when history records a retry', () => {
    const ticket = {
      ...base,
      attempts: 0,
      history: [
        ...base.history,
        { at: '2026-09-17T12:00:00+09:00', from: 'waiting', to: 'running' },
        { at: '2026-09-17T13:00:00+09:00', from: 'running', to: 'failed' },
        { at: '2026-09-17T14:00:00+09:00', from: 'failed', to: 'waiting' },
      ],
    };
    expect(() => validateTicket(ticket)).toThrow(/attempts/);
  });
});
