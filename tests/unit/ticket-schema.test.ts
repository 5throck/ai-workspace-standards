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

describe('validateTicket upstream block (design 2026-10-01 §5.2)', () => {
  const upstream = () => ({
    project: 'co-test', variant: 'co-test', template_version: '0.1.0', source: 'project/co-test', trust: 'untrusted',
    suspected_layer: 'L1', symptom: 'x'.repeat(30), affected_paths: ['scripts/a.ts'],
    triage: 'inbox', flagged: false, triage_reasons: [], dedupe_key: 'abc', duplicates: [],
  });
  const base = (over: Record<string, unknown> = {}) => ({
    schemaVersion: 1, id: 'U-20261001-001', kind: 'manual', priority: 'normal', status: 'backlog', attempts: 0,
    created_at: '2026-10-01T00:00:00.000Z', history: [{ at: '2026-10-01T00:00:00.000Z', from: null, to: 'backlog' }],
    result: null, error: null, upstream: upstream(), ...over,
  });
  const withUp = (o: Record<string, unknown>) => base({ upstream: { ...upstream(), ...o } });

  test('a well-formed upstream ticket validates', () => { expect(() => validateTicket(base())).not.toThrow(); });
  test('upstream on a service ticket is rejected', () => {
    expect(() => validateTicket(base({ kind: 'service', service: 'audit' }))).toThrow(/only on kind: manual/);
  });
  test('upstream with inputs or a T- id is rejected', () => {
    expect(() => validateTicket(base({ inputs: { a: 'b' } }))).toThrow(/inputs/);
    expect(() => validateTicket(base({ id: 'T-20261001-001' }))).toThrow(/U-YYYYMMDD-NNN/);
  });
  test('trust must be untrusted; source must equal project/<project>', () => {
    expect(() => validateTicket(withUp({ trust: 'trusted' }))).toThrow(/trust/);
    expect(() => validateTicket(withUp({ source: 'project/co-other' }))).toThrow(/source/);
    expect(() => validateTicket(withUp({ source: 'co-test' }))).toThrow(/source/);
  });
  test('caps and path pattern are re-checked at validation', () => {
    expect(() => validateTicket(withUp({ symptom: 'short' }))).toThrow(/symptom/);
    expect(() => validateTicket(withUp({ affected_paths: ['../x'] }))).toThrow(/affected_paths/);
    expect(() => validateTicket(withUp({ affected_paths: [] }))).toThrow(/affected_paths/);
    expect(() => validateTicket(withUp({ repro: 'r'.repeat(2001) }))).toThrow(/repro/);
    expect(() => validateTicket(withUp({ triage: 'maybe' }))).toThrow(/triage/);
  });
});

describe('upstream cross-field invariants (T-20261002-007, M2)', () => {
  const upstream = () => ({
    project: 'co-test', variant: 'co-test', template_version: '0.1.0', source: 'project/co-test', trust: 'untrusted',
    suspected_layer: 'L2', symptom: 'A symptom long enough to pass the twenty-character floor.',
    affected_paths: ['skills/SKILLS.md'],
    triage: 'inbox', flagged: false, triage_reasons: [], dedupe_key: 'abc', duplicates: [],
  });
  const base = (over: Record<string, unknown> = {}) => ({
    schemaVersion: 1, id: 'U-20261002-001', kind: 'manual', priority: 'normal', status: 'backlog', attempts: 0,
    created_at: '2026-10-02T00:00:00.000Z', history: [{ at: '2026-10-02T00:00:00.000Z', from: null, to: 'backlog' }],
    result: null, error: null, upstream: upstream(), ...over,
  });
  const withUp = (o: Record<string, unknown>) => base({ upstream: { ...upstream(), ...o } });

  test('project must match ^co-[a-z0-9-]{1,40}$', () => {
    expect(() => validateTicket(withUp({ project: 'not-co' }))).toThrow(/co-\[a-z0-9-\]/);
    expect(() => validateTicket(withUp({ project: '' }))).toThrow(/co-\[a-z0-9-\]/);
    expect(() => validateTicket(withUp({ project: `co-${'x'.repeat(41)}` }))).toThrow(/co-\[a-z0-9-\]/);
  });

  test('template_version and variant must be string or null', () => {
    expect(() => validateTicket(withUp({ template_version: 3 }))).toThrow(/template_version/);
    expect(() => validateTicket(withUp({ variant: 7 }))).toThrow(/variant/);
    expect(() => validateTicket(withUp({ template_version: null, variant: null }))).not.toThrow();
  });

  test('triage↔status consistency: inbox ⇒ backlog|done; ready ⇒ waiting|review|done', () => {
    expect(() => validateTicket(withUp({ triage: 'inbox', }))).not.toThrow();      // backlog ✓
    expect(() => validateTicket(withUp({ triage: 'ready' }))).toThrow(/inconsistent/); // ready + backlog ✗
    expect(() => validateTicket(base({
      status: 'done',
      history: [
        { at: 'x', from: null, to: 'backlog' },
        { at: 'x', from: 'backlog', to: 'waiting' },
        { at: 'x', from: 'waiting', to: 'running' },
        { at: 'x', from: 'running', to: 'review' },
        { at: 'x', from: 'review', to: 'done' },
      ],
      upstream: { ...upstream(), triage: 'ready', resolution: { outcome: 'fixed', summary: 's' } },
    }))).not.toThrow(); // ready + done ✓
    expect(() => validateTicket(base({
      status: 'waiting',
      history: [{ at: 'x', from: null, to: 'backlog' }, { at: 'x', from: 'backlog', to: 'waiting' }],
      upstream: { ...upstream(), triage: 'ready' },
    }))).not.toThrow(); // ready + waiting ✓
  });

  test('done requires a resolution; resolution requires a non-empty summary', () => {
    expect(() => validateTicket(base({
      status: 'done',
      history: [
        { at: 'x', from: null, to: 'backlog' },
        { at: 'x', from: 'backlog', to: 'waiting' },
        { at: 'x', from: 'waiting', to: 'running' },
        { at: 'x', from: 'running', to: 'review' },
        { at: 'x', from: 'review', to: 'done' },
      ],
    }))).toThrow(/requires upstream\.resolution/);
    expect(() => validateTicket(withUp({ resolution: { outcome: 'fixed' } }))).toThrow(/summary/);
    expect(() => validateTicket(withUp({ resolution: { outcome: 'fixed', summary: '   ' } }))).toThrow(/summary/);
  });

  test('resolution pr_url must be https and template_version a non-empty string', () => {
    expect(() => validateTicket(withUp({ resolution: { outcome: 'fixed', summary: 's', pr_url: 'http://x' } }))).toThrow(/https/);
    expect(() => validateTicket(withUp({ resolution: { outcome: 'fixed', summary: 's', template_version: '' } }))).toThrow(/template_version/);
    expect(() => validateTicket(withUp({ resolution: { outcome: 'fixed', summary: 's', pr_url: 'https://github.com/x/pull/1', template_version: 'unreleased' } }))).not.toThrow();
  });

  test('legacy real tickets stay valid (U-20261001-001 shape: done + inbox + no resolution.template_version)', () => {
    expect(() => validateTicket(base({
      status: 'done',
      history: [
        { at: 'x', from: null, to: 'backlog' },
        { at: 'x', from: 'backlog', to: 'waiting' },
        { at: 'x', from: 'waiting', to: 'running' },
        { at: 'x', from: 'running', to: 'review' },
        { at: 'x', from: 'review', to: 'done' },
      ],
      upstream: { ...upstream(), triage: 'inbox', resolution: { outcome: 'fixed', pr_url: 'https://github.com/x/pull/2', summary: 'legacy' } },
    }))).not.toThrow();
  });
});
